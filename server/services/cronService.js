const db = require('../db');
const { fetchDealsList, fetchProductByAsin } = require('./providerRouter');
const { recordObservation } = require('./priceHistoryService');

class DealCronService {
  constructor() {
    this.intervalId = null;
    this.purgeIntervalId = null;
    this.lastRun = null;
    this.lastPriceCheck = null;
    this.lastPurgeRun = null;
    this.isRunning = false;
    this.stats = { totalRuns: 0, dealsAdded: 0, dealsUpdated: 0, dealsExpired: 0, dealsPurged: 0, lastError: null, nextRunEstimate: null };
  }

  start() {
    setTimeout(() => this.runFullCycle().catch((err) => console.warn('[DealCronService] Initial cycle:', err.message)), 15000);
    const intervalMs = 6 * 60 * 60 * 1000;
    this.stats.nextRunEstimate = new Date(Date.now() + 15000).toISOString();
    this.intervalId = setInterval(() => this.runFullCycle().catch((err) => console.warn('[DealCronService] Scheduled cycle:', err.message)), intervalMs);
    this.purgeIntervalId = setInterval(() => this.purgeOldExpiredDeals().catch((err) => console.warn('[DealCronService] Purge:', err.message)), 30 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.purgeIntervalId) clearInterval(this.purgeIntervalId);
    this.intervalId = null;
    this.purgeIntervalId = null;
  }

  async runFullCycle() {
    await this.purgeOldExpiredDeals();
    await this.checkDealPricesAndAvailability();
    await this.syncDailyDeals();
  }

  async purgeOldExpiredDeals() {
    this.lastPurgeRun = new Date();
    const result = db.purgeExpiredDeals(86400);
    this.stats.dealsPurged += result.purgedCount || 0;
    return result;
  }

  async checkDealPricesAndAvailability() {
    this.lastPriceCheck = new Date();
    const activeDeals = (db.tables.deals || []).filter((d) => !d.is_expired && d.status === 'APPROVED' && (d.source_verified === 1 || d.source_sufficient === 1));
    let expiredCount = 0;
    let checkedCount = 0;
    let changed = false;

    for (const deal of activeDeals.slice(0, 10)) {
      checkedCount += 1;
      try {
        const liveInfo = await fetchProductByAsin(deal.asin);
        if (!liveInfo?.sourceVerified) continue;
        deal.price_check_at = Math.floor(Date.now() / 1000);
        const outOfStock = liveInfo.availability && /out of stock|unavailable/i.test(liveInfo.availability);
        const original = Number(liveInfo.originalPrice);
        const sale = Number(liveInfo.salePrice);
        const discount = Number(liveInfo.discountPercent);
        const discountEnded = Number.isFinite(discount) && discount < 5 && Number.isFinite(original) && Number.isFinite(sale) && sale >= original;

        if (Number.isFinite(original) && Number.isFinite(sale) && original > 0 && sale > 0 && sale <= original) {
          recordObservation({
            asin: deal.asin,
            salePrice: sale,
            originalPrice: original,
            sourceProvider: liveInfo.sourceProvider || deal.source_provider || 'VERIFIED_PROVIDER',
          });
        }

        if (outOfStock || discountEnded) {
          db.expireDeal(deal.id, outOfStock ? 'Product unavailable at verified source' : 'Verified deal ended');
          expiredCount += 1;
          changed = true;
        } else if (Number.isFinite(sale) && sale > 0 && sale !== Number(deal.sale_price)) {
          deal.sale_price = sale;
          if (Number.isFinite(original) && original >= sale) deal.original_price = original;
          if (Number.isFinite(discount) && discount >= 0) deal.discount_percent = discount;
          changed = true;
        }
      } catch (err) {
        console.warn(`[DealCronService] Price verification for ${deal.asin}:`, err.message);
      }
    }
    if (changed) db.saveDb();
    this.stats.dealsExpired += expiredCount;
    return { checkedCount, expiredCount };
  }

  async syncDailyDeals() {
    if (this.isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
    this.isRunning = true;
    this.lastRun = new Date();
    this.stats.totalRuns += 1;
    this.stats.lastError = null;
    let createdCount = 0;
    let updatedCount = 0;
    let changed = false;

    try {
      const deals = await fetchDealsList({ amazonDomain: 'amazon.com', maxResults: 20, minDiscount: 15 });
      for (const item of deals) {
        if (!item?.sourceVerified || !item.asin || !item.title) continue;
        const original = Number(item.originalPrice ?? item.original_price);
        const sale = Number(item.salePrice ?? item.sale_price);
        if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale <= 0 || sale > original) continue;
        const discount = Number((((original - sale) / original) * 100).toFixed(1));

        recordObservation({
          asin: item.asin,
          salePrice: sale,
          originalPrice: original,
          sourceProvider: item.sourceProvider || 'VERIFIED_PROVIDER',
        });

        const existing = db.tables.deals.find((d) => d.asin === item.asin || d.id === item.asin);
        if (existing) {
          if (sale !== Number(existing.sale_price) || original !== Number(existing.original_price)) {
            existing.sale_price = sale;
            existing.original_price = original;
            existing.discount_percent = discount;
            existing.price_check_at = Math.floor(Date.now() / 1000);
            existing.source_verified = 1;
            existing.source_provider = item.sourceProvider || existing.source_provider;
            updatedCount += 1;
            changed = true;
          }
          continue;
        }

        db.tables.deals.unshift({
          id: item.asin,
          title: item.title,
          asin: item.asin,
          category: item.category || 'Electronics',
          original_price: original,
          sale_price: sale,
          discount_percent: discount,
          image_url: item.imageUrl || item.image_url || '',
          product_url: item.productUrl || item.product_url || `https://www.amazon.com/dp/${item.asin}`,
          rating: Number(item.rating) || 0,
          ratings_total: Number(item.ratingsTotal || item.ratings_total) || 0,
          short_bio: item.shortBio || item.short_bio || '',
          full_summary: item.fullSummary || item.full_summary || '',
          pros: item.pros || '',
          cons: item.cons || '',
          reviews: typeof item.reviews === 'string' ? item.reviews : JSON.stringify(item.reviews || []),
          source_sufficient: 1,
          source_verified: 1,
          source_provider: item.sourceProvider || 'VERIFIED_PROVIDER',
          status: 'PENDING_REVIEW',
          is_expired: 0,
          expired_at: null,
          price_check_at: Math.floor(Date.now() / 1000),
          raw_source_data: item.rawSourceData || item.raw_source_data || `${item.sourceProvider || 'Verified provider'} | ASIN: ${item.asin}`,
          created_at: Math.floor(Date.now() / 1000),
        });
        createdCount += 1;
        changed = true;
      }
      if (changed) db.saveDb();
      this.stats.dealsAdded += createdCount;
      this.stats.dealsUpdated += updatedCount;
      this.stats.nextRunEstimate = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      return { created: createdCount, updated: updatedCount, status: 'SUCCESS' };
    } catch (err) {
      this.stats.lastError = err.message;
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

module.exports = new DealCronService();
