const deals = require('../repositories/dealRepository');
const { fetchDealsList, fetchProductByAsin } = require('./providerRouter');
const { recordObservation } = require('./priceHistoryService');
const { scoreVerifiedDeal } = require('./dealQualityService');
const { publishingDecision, getHoldbackPercent } = require('./editorialCadenceService');
const { oldestCheckedFirst } = require('./verificationQueue');

async function safeRecordObservation(observation) {
  try { await recordObservation(observation); }
  catch (err) { console.warn('[DealCronService] Price history observation skipped:', err.message); }
}

class DealCronService {
  constructor() {
    this.intervalId = null; this.purgeIntervalId = null; this.lastRun = null; this.lastPriceCheck = null; this.lastPurgeRun = null; this.isRunning = false;
    this.stats = { totalRuns: 0, dealsAdded: 0, dealsUpdated: 0, dealsAutoApproved: 0, dealsPendingReview: 0, dealsEditorialHoldback: 0, dealsRejected: 0, dealsExpired: 0, dealsPurged: 0, lastError: null, nextRunEstimate: null };
  }

  start() {
    setTimeout(() => this.runFullCycle().catch((err) => console.warn('[DealCronService] Initial cycle:', err.message)), 15000);
    const intervalMs = 6 * 60 * 60 * 1000;
    this.stats.nextRunEstimate = new Date(Date.now() + 15000).toISOString();
    this.intervalId = setInterval(() => this.runFullCycle().catch((err) => console.warn('[DealCronService] Scheduled cycle:', err.message)), intervalMs);
    this.purgeIntervalId = setInterval(() => this.purgeOldExpiredDeals().catch((err) => console.warn('[DealCronService] Purge:', err.message)), 30 * 60 * 1000);
  }

  stop() { if (this.intervalId) clearInterval(this.intervalId); if (this.purgeIntervalId) clearInterval(this.purgeIntervalId); this.intervalId = null; this.purgeIntervalId = null; }
  async runFullCycle() { await this.purgeOldExpiredDeals(); await this.checkDealPricesAndAvailability(); await this.syncDailyDeals(); }
  async purgeOldExpiredDeals() { this.lastPurgeRun = new Date(); const result = await deals.purgeExpired(86400); this.stats.dealsPurged += result.purgedCount || 0; return result; }

  async checkDealPricesAndAvailability() {
    this.lastPriceCheck = new Date();
    const all = await deals.listAll();
    const activeDeals = all.filter((d) => !d.is_expired && d.status === 'APPROVED' && d.source_verified === 1);
    const verificationBatch = oldestCheckedFirst(activeDeals, 10);
    let expiredCount = 0; let checkedCount = 0;

    for (const deal of verificationBatch) {
      checkedCount += 1;
      const attemptAt = Math.floor(Date.now() / 1000);
      try {
        await deals.update(deal.id, { last_verify_attempt_at: attemptAt });
        const liveInfo = await fetchProductByAsin(deal.asin);
        if (!liveInfo?.sourceVerified) continue;
        const outOfStock = liveInfo.availability && /out of stock|unavailable/i.test(liveInfo.availability);
        const original = Number(liveInfo.originalPrice); const sale = Number(liveInfo.salePrice); const discount = Number(liveInfo.discountPercent);
        const discountEnded = Number.isFinite(discount) && discount < 5 && Number.isFinite(original) && Number.isFinite(sale) && sale >= original;
        if (Number.isFinite(original) && Number.isFinite(sale) && original > 0 && sale > 0 && sale <= original) await safeRecordObservation({ asin: deal.asin, salePrice: sale, originalPrice: original, sourceProvider: liveInfo.sourceProvider || deal.source_provider || 'VERIFIED_PROVIDER' });
        if (outOfStock || discountEnded) { await deals.expire(deal.id, outOfStock ? 'Product unavailable at verified source' : 'Verified deal ended'); expiredCount += 1; }
        else {
          const changes = { price_check_at: attemptAt, last_verify_attempt_at: attemptAt };
          if (Number.isFinite(sale) && sale > 0) changes.sale_price = sale;
          if (Number.isFinite(original) && original >= sale) changes.original_price = original;
          if (Number.isFinite(discount) && discount >= 0) changes.discount_percent = discount;
          if (liveInfo.imageUrl && liveInfo.imageUrl !== deal.image_url) changes.image_url = liveInfo.imageUrl;
          await deals.update(deal.id, changes);
        }
      } catch (err) { console.warn(`[DealCronService] Price verification for ${deal.asin}:`, err.message); }
    }
    this.stats.dealsExpired += expiredCount;
    return { checkedCount, expiredCount, eligibleCount: activeDeals.length };
  }

  async syncDailyDeals() {
    if (this.isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
    this.isRunning = true; this.lastRun = new Date(); this.stats.totalRuns += 1; this.stats.lastError = null;
    let createdCount = 0; let updatedCount = 0; let autoApprovedCount = 0; let pendingCount = 0; let holdbackCount = 0; let rejectedCount = 0;
    try {
      const providerDeals = await fetchDealsList({ amazonDomain: 'amazon.com', maxResults: 20, minDiscount: 15 });
      for (const item of providerDeals) {
        const quality = scoreVerifiedDeal(item); if (quality.decision === 'REJECT') { rejectedCount += 1; continue; }
        const original = Number(item.originalPrice ?? item.original_price); const sale = Number(item.salePrice ?? item.sale_price);
        const discount = Number((((original - sale) / original) * 100).toFixed(1)); const publication = publishingDecision(item, quality); const status = publication.status; const verifiedAt = Math.floor(Date.now() / 1000);
        if (publication.reason === 'EDITORIAL_HOLDBACK') holdbackCount += 1;
        await safeRecordObservation({ asin: item.asin, salePrice: sale, originalPrice: original, sourceProvider: item.sourceProvider || 'VERIFIED_PROVIDER' });
        const existing = await deals.findByIdOrAsin(item.asin);
        if (existing) {
          const changes = { sale_price: sale, original_price: original, discount_percent: discount, price_check_at: verifiedAt, last_verify_attempt_at: verifiedAt, source_verified: 1, source_sufficient: 1, source_provider: item.sourceProvider || existing.source_provider, quality_score: quality.score };
          if (item.imageUrl && item.imageUrl !== existing.image_url) changes.image_url = item.imageUrl;
          if (existing.status !== 'APPROVED' && status === 'APPROVED') changes.status = 'APPROVED';
          await deals.update(existing.id, changes); updatedCount += 1; continue;
        }
        await deals.upsert({ id: item.asin, title: item.title, asin: item.asin, category: item.category || 'Amazon', original_price: original, sale_price: sale, discount_percent: discount, image_url: item.imageUrl || item.image_url || '', product_url: item.productUrl || item.product_url || `https://www.amazon.com/dp/${item.asin}`, rating: Number(item.rating) || 0, ratings_total: Number(item.ratingsTotal || item.ratings_total) || 0, short_bio: '', full_summary: '', pros: '', cons: '', reviews: [], source_sufficient: 1, source_verified: 1, source_provider: item.sourceProvider || 'VERIFIED_PROVIDER', status, quality_score: quality.score, is_expired: 0, expired_at: null, price_check_at: verifiedAt, last_verify_attempt_at: verifiedAt, raw_source_data: `${item.sourceProvider || 'Verified provider'} | ASIN: ${item.asin} | publication=${publication.reason}`, created_at: verifiedAt });
        createdCount += 1; if (status === 'APPROVED') autoApprovedCount += 1; else pendingCount += 1;
      }
      this.stats.dealsAdded += createdCount; this.stats.dealsUpdated += updatedCount; this.stats.dealsAutoApproved += autoApprovedCount; this.stats.dealsPendingReview += pendingCount; this.stats.dealsEditorialHoldback += holdbackCount; this.stats.dealsRejected += rejectedCount;
      this.stats.nextRunEstimate = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      return { created: createdCount, updated: updatedCount, autoApproved: autoApprovedCount, pendingReview: pendingCount, editorialHoldback: holdbackCount, rejected: rejectedCount, editorialHoldbackPercent: getHoldbackPercent(), status: 'SUCCESS' };
    } catch (err) { this.stats.lastError = err.message; return { error: err.message, status: 'NOTICE' }; }
    finally { this.isRunning = false; }
  }

  async getStatus() { return { running: Boolean(this.intervalId), lastRun: this.lastRun ? this.lastRun.toISOString() : null, lastPriceCheck: this.lastPriceCheck ? this.lastPriceCheck.toISOString() : null, lastPurgeRun: this.lastPurgeRun ? this.lastPurgeRun.toISOString() : null, nextRunEstimate: this.stats.nextRunEstimate, editorialHoldbackPercent: getHoldbackPercent(), lifecycle: await deals.lifecycleStats(), stats: this.stats }; }
}

module.exports = new DealCronService();
