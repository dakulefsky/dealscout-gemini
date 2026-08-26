const db = require('../db');
const {
  fetchDealsList,
  fetchProductByAsin,
  getProviderStatus,
} = require('./providerRouter');
const { v4: uuidv4 } = require('uuid');

/**
 * Automated Deals Lifecycle & Ingestion Engine
 * Handles:
 * 1. Ingesting fresh deals from active provider (Rainforest / PA-API / Curated)
 * 2. Real-time Price Verification & Auto-Expiration (Greys out deals when discount ends or product is out of stock)
 * 3. 24-Hour Auto-Purge (Automatically deletes expired deals 24 hours after expiration)
 */
class DealCronService {
  constructor() {
    this.intervalId = null;
    this.purgeIntervalId = null;
    this.lastRun = null;
    this.lastPriceCheck = null;
    this.lastPurgeRun = null;
    this.isRunning = false;
    this.stats = {
      totalRuns: 0,
      dealsAdded: 0,
      dealsUpdated: 0,
      dealsExpired: 0,
      dealsPurged: 0,
      lastError: null,
      nextRunEstimate: null,
    };
  }

  start() {
    console.log('[DealCronService] Initializing automated daily deals & expiration lifecycle scheduler...');
    
    // Initial run on boot after a short grace period (15s)
    setTimeout(() => {
      this.runFullCycle().catch((err) => {
        console.warn('[DealCronService] Initial boot lifecycle notice:', err.message);
      });
    }, 15000);

    // Main sync & price check cycle: Every 6 hours
    const INTERVAL_MS = 6 * 60 * 60 * 1000;
    this.stats.nextRunEstimate = new Date(Date.now() + 15000).toISOString();

    this.intervalId = setInterval(() => {
      this.runFullCycle().catch((err) => {
        console.warn('[DealCronService] Scheduled auto-sync notice:', err.message);
      });
    }, INTERVAL_MS);

    // Purge check runs every 30 minutes to clean up deals that reached 24 hours
    this.purgeIntervalId = setInterval(() => {
      this.purgeOldExpiredDeals().catch((err) => {
        console.warn('[DealCronService] Hourly purge check notice:', err.message);
      });
    }, 30 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.purgeIntervalId) {
      clearInterval(this.purgeIntervalId);
      this.purgeIntervalId = null;
    }
  }

  async runFullCycle() {
    // 1. Purge deals older than 24h
    await this.purgeOldExpiredDeals();
    // 2. Check existing deal prices & availability
    await this.checkDealPricesAndAvailability();
    // 3. Ingest fresh deals
    await this.syncDailyDeals();
  }

  /**
   * Automatically purges expired deals that have been expired for >= 24 hours.
   */
  async purgeOldExpiredDeals() {
    this.lastPurgeRun = new Date();
    try {
      const purgeResult = db.purgeExpiredDeals(86400); // 24 hours in seconds
      if (purgeResult.purgedCount > 0) {
        this.stats.dealsPurged += purgeResult.purgedCount;
        console.log(`[DealCronService] Auto-Purge Complete: Deleted ${purgeResult.purgedCount} expired deal(s) that exceeded the 24-hour grace period.`);
      }
      return purgeResult;
    } catch (err) {
      console.warn('[DealCronService] Purge error:', err.message);
      return { purgedCount: 0, error: err.message };
    }
  }

  /**
   * Verifies live prices for active deals.
   * If a deal's sale price increases to original price, discount ends, or product becomes unavailable,
   * it marks the deal as Expired (starts the 24h countdown to deletion).
   */
  async checkDealPricesAndAvailability() {
    this.lastPriceCheck = new Date();
    const activeDeals = (db.tables.deals || []).filter((d) => !d.is_expired && d.status === 'APPROVED');
    let expiredCount = 0;
    let checkedCount = 0;

    console.log(`[DealCronService] Verifying live prices for ${activeDeals.length} active deals...`);

    for (const deal of activeDeals.slice(0, 10)) { // Verify top batches
      checkedCount++;
      try {
        const liveInfo = await fetchProductByAsin(deal.asin);
        if (liveInfo) {
          deal.price_check_at = Math.floor(Date.now() / 1000);

          // Check if deal expired (discount dropped to 0 or price returned to original or out of stock)
          const isOutOfStock = liveInfo.availability && /out of stock|unavailable/i.test(liveInfo.availability);
          const isDiscountEnded = (liveInfo.discountPercent || 0) < 5 && liveInfo.salePrice >= (liveInfo.originalPrice || liveInfo.salePrice);

          if (isOutOfStock || isDiscountEnded) {
            const reason = isOutOfStock ? 'Product went Out of Stock on Amazon' : 'Amazon deal ended / price restored to MSRP';
            db.expireDeal(deal.id, reason);
            expiredCount++;
            console.log(`[DealCronService] Auto-Expired deal ${deal.asin} (${deal.title.slice(0, 30)}...): ${reason}. (Will auto-delete in 24h)`);
          } else if (liveInfo.salePrice && liveInfo.salePrice !== deal.sale_price) {
            deal.sale_price = liveInfo.salePrice;
            deal.original_price = liveInfo.originalPrice || deal.original_price;
            deal.discount_percent = liveInfo.discountPercent || deal.discount_percent;
          }
        }
      } catch (err) {
        // Non-blocking notice
        console.warn(`[DealCronService] Price verification notice for ${deal.asin}:`, err.message);
      }
    }

    this.stats.dealsExpired += expiredCount;
    return { checkedCount, expiredCount };
  }

  async syncDailyDeals() {
    if (this.isRunning) {
      console.log('[DealCronService] Sync already running. Skipping concurrent trigger.');
      return { skipped: true, reason: 'ALREADY_RUNNING' };
    }

    this.isRunning = true;
    this.lastRun = new Date();
    this.stats.totalRuns += 1;
    this.stats.lastError = null;

    console.log(`[DealCronService] Starting daily deals auto-sync at ${this.lastRun.toISOString()}...`);

    let createdCount = 0;
    let updatedCount = 0;

    try {
      // Fetch deals across active provider (PA-API / Rainforest / Curated)
      const deals = await fetchDealsList({
        amazonDomain: 'amazon.com',
        maxResults: 20,
        minDiscount: 15,
      });

      for (const item of deals) {
        const asin = item.asin;
        if (!asin) continue;

        // Check if deal already exists
        const existingIdx = db.tables.deals.findIndex((d) => d.asin === asin || d.id === asin);

        if (existingIdx !== -1) {
          const existing = db.tables.deals[existingIdx];
          let existingReviews = [];
          try {
            existingReviews = typeof existing.reviews === 'string' ? JSON.parse(existing.reviews) : (existing.reviews || []);
          } catch {
            existingReviews = [];
          }

          if (existingReviews.length === 0 && item.reviews) {
            existing.reviews = typeof item.reviews === 'string' ? item.reviews : JSON.stringify(item.reviews || []);
          }

          if (item.sale_price && item.sale_price !== existing.sale_price) {
            existing.sale_price = item.sale_price;
            existing.original_price = item.original_price || existing.original_price;
            existing.discount_percent = item.discount_percent || existing.discount_percent;
            existing.price_check_at = Math.floor(Date.now() / 1000);
            updatedCount += 1;
          }
        } else {
          // Add new verified deal
          const id = asin || uuidv4();
          const dealObj = {
            id,
            title: item.title,
            asin,
            category: item.category || 'Electronics',
            original_price: item.original_price || item.sale_price,
            sale_price: item.sale_price,
            discount_percent: item.discount_percent,
            image_url: item.image_url || item.imageUrl,
            product_url: item.product_url || item.productUrl,
            rating: item.rating || 4.6,
            ratings_total: item.ratings_total || item.ratingsTotal || 200,
            short_bio: item.short_bio || item.shortBio,
            full_summary: item.full_summary || item.fullSummary,
            pros: item.pros,
            cons: item.cons,
            reviews: typeof item.reviews === 'string' ? item.reviews : JSON.stringify(item.reviews || []),
            source_sufficient: 1,
            status: 'PENDING_REVIEW', // Editorial review queue
            is_expired: 0,
            expired_at: null,
            price_check_at: Math.floor(Date.now() / 1000),
            raw_source_data: `${item.sourceProvider || 'Auto Sync'} | ASIN: ${asin}`,
            created_at: Math.floor(Date.now() / 1000),
          };

          db.tables.deals.unshift(dealObj); db.saveDb();
          createdCount += 1;
        }
      }

      this.stats.dealsAdded += createdCount;
      this.stats.dealsUpdated += updatedCount;
      this.stats.nextRunEstimate = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      console.log(`[DealCronService] Auto-sync finished: +${createdCount} new deals added, ${updatedCount} updated.`);
      return { created: createdCount, updated: updatedCount, status: 'SUCCESS' };
    } catch (err) {
      this.stats.lastError = err.message;
      console.warn('[DealCronService] Auto-sync notice:', err.message);
      return { error: err.message, status: 'NOTICE' };
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      running: Boolean(this.intervalId),
      lastRun: this.lastRun ? this.lastRun.toISOString() : null,
      lastPriceCheck: this.lastPriceCheck ? this.lastPriceCheck.toISOString() : null,
      lastPurgeRun: this.lastPurgeRun ? this.lastPurgeRun.toISOString() : null,
      nextRunEstimate: this.stats.nextRunEstimate,
      lifecycle: db.getDealLifecycleStats(),
      stats: this.stats,
    };
  }
}

const dealCron = new DealCronService();
module.exports = dealCron;
