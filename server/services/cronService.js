const deals = require('../repositories/dealRepository');
const refreshStates = require('../repositories/refreshStateRepository');
const maintenanceCadence = require('../repositories/maintenanceCadenceRepository');
const postgres = require('../storage/postgres');
const { fetchDealsList, fetchProductByAsin, getProviderStatus } = require('./providerRouter');
const { recordObservation } = require('./priceHistoryService');
const { scoreVerifiedDeal } = require('./dealQualityService');
const { publishingDecision, getHoldbackPercent } = require('./editorialCadenceService');
const { oldestCheckedFirst } = require('./verificationQueue');
const { verificationBatchSize } = require('./verificationCapacity');
const { rediscoveryLifecycleChanges } = require('./rediscoveryLifecycle');
const { verifiedSourceChanges } = require('./verifiedDealRefresh');
const { canAttemptRefresh } = require('./refreshRetryPolicy');

const TWELVE_HOURS_SECONDS = 12 * 60 * 60;
const THIRTY_MINUTES_SECONDS = 30 * 60;
const SCHEDULER_POLL_MS = 15 * 60 * 1000;
const JOB_LOCKS = Object.freeze({ purgeExpired: 44001, verifyPrices: 44002, discoverDeals: 44003 });
const JOB_INTERVALS = Object.freeze({ purgeExpired: THIRTY_MINUTES_SECONDS, verifyPrices: TWELVE_HOURS_SECONDS, discoverDeals: TWELVE_HOURS_SECONDS });
const PROVIDER_BATCH_STOP_CODES = new Set(['PROVIDER_BUDGET_EXCEEDED', 'PROVIDER_COOLDOWN']);

async function safeRecordObservation(observation) {
  try { await recordObservation(observation); }
  catch (err) { console.warn('[DealCronService] Price history observation skipped:', err.message); }
}

function providerHasTransientTrouble(status) {
  return [status?.paapi?.throttle, status?.rainforest?.throttle].some((throttle) =>
    throttle?.coolingDown === true || Number(throttle?.consecutiveFailures || 0) > 0
  );
}

function shouldStopProviderBatch(error) {
  return PROVIDER_BATCH_STOP_CODES.has(String(error?.code || ''));
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cadenceSkip(job, claim) {
  return {
    skipped: true,
    reason: 'NOT_DUE',
    job,
    nextDueAt: claim?.state?.next_due_at || null,
  };
}

class DealCronService {
  constructor() {
    this.intervalId = null;
    this.purgeIntervalId = null;
    this.lastRun = null;
    this.lastPriceCheck = null;
    this.lastPurgeRun = null;
    this.isRunning = false;
    this.stats = {
      totalRuns: 0, dealsAdded: 0, dealsUpdated: 0, dealsAutoApproved: 0,
      dealsPendingReview: 0, dealsEditorialHoldback: 0, dealsRejected: 0,
      dealsExpired: 0, dealsPurged: 0, lastError: null, nextRunEstimate: null,
    };
  }

  scheduleNextCycle(delayMs = SCHEDULER_POLL_MS) {
    if (this.intervalId) clearTimeout(this.intervalId);
    const delay = Math.max(1000, Number(delayMs) || SCHEDULER_POLL_MS);
    this.intervalId = setTimeout(async () => {
      this.intervalId = null;
      try { await this.runFullCycle({ scheduled: true }); }
      catch (err) { console.warn('[DealCronService] Scheduled cycle:', err.message); }
      finally { this.scheduleNextCycle(); }
    }, delay);
  }

  start() {
    if (this.intervalId) return;
    // Cloud Run instances only poll for due work. PostgreSQL owns the actual
    // cadence, so staggered instances/restarts cannot multiply provider pulls.
    this.scheduleNextCycle();
  }

  stop() {
    if (this.intervalId) clearTimeout(this.intervalId);
    if (this.purgeIntervalId) clearInterval(this.purgeIntervalId);
    this.intervalId = null;
    this.purgeIntervalId = null;
    this.stats.nextRunEstimate = null;
  }

  async runDistributed(lockId, job, task) {
    const result = await postgres.withAdvisoryLock(lockId, task);
    if (!result.acquired) return { skipped: true, reason: 'LOCK_HELD', job };
    return result.result;
  }

  async claimCadence(jobKey, intervalSeconds, scheduled) {
    return maintenanceCadence.claim(jobKey, intervalSeconds, { force: !scheduled });
  }

  async runFullCycle({ scheduled = false } = {}) {
    const purge = await this.purgeOldExpiredDeals({ scheduled });
    const verification = await this.checkDealPricesAndAvailability({ scheduled });
    const discovery = await this.syncDailyDeals({ scheduled });
    return { purge, verification, discovery };
  }

  async purgeOldExpiredDeals({ scheduled = false } = {}) {
    return this.runDistributed(JOB_LOCKS.purgeExpired, 'purge-expired', async () => {
      const claim = await this.claimCadence('purge-expired', JOB_INTERVALS.purgeExpired, scheduled);
      if (!claim.acquired) return cadenceSkip('purge-expired', claim);
      this.lastPurgeRun = new Date();
      const result = await deals.purgeExpired(86400);
      this.stats.dealsPurged += result.purgedCount || 0;
      return result;
    });
  }

  async checkDealPricesAndAvailability({ scheduled = false } = {}) {
    return this.runDistributed(JOB_LOCKS.verifyPrices, 'verify-prices', async () => {
      const claim = await this.claimCadence('verify-prices', JOB_INTERVALS.verifyPrices, scheduled);
      if (!claim.acquired) return cadenceSkip('verify-prices', claim);
      this.lastPriceCheck = new Date();
      const all = await deals.listAll();
      const activeDeals = all.filter((deal) => !deal.is_expired && deal.status === 'APPROVED' && deal.source_verified === 1);
      const batchSize = verificationBatchSize(activeDeals.length);
      const candidateLimit = Math.min(100, Math.max(batchSize, batchSize * 3));
      const verificationCandidates = oldestCheckedFirst(activeDeals, candidateLimit || 1);
      let expiredCount = 0;
      let checkedCount = 0;
      let deferredCount = 0;
      let itemFailureCount = 0;
      let providerDeferred = false;
      let providerDeferredReason = null;

      for (const deal of verificationCandidates) {
        if (checkedCount >= batchSize) break;
        const attemptAt = Math.floor(Date.now() / 1000);
        const refreshState = await refreshStates.get(deal.asin);
        if (!canAttemptRefresh(refreshState, attemptAt)) { deferredCount += 1; continue; }

        checkedCount += 1;
        try {
          await deals.update(deal.id, { last_verify_attempt_at: attemptAt });
          const liveInfo = await fetchProductByAsin(deal.asin, { allowNonDeal: true });
          if (!liveInfo?.sourceVerified) {
            const providerStatus = await getProviderStatus();
            if (!providerHasTransientTrouble(providerStatus)) {
              const error = Object.assign(new Error('No verifiable product refresh result'), { code: 'UNVERIFIED_REFRESH' });
              await refreshStates.recordFailure(deal.asin, error, { at: attemptAt });
              itemFailureCount += 1;
            }
            continue;
          }

          await refreshStates.recordSuccess(deal.asin, { at: attemptAt, provider: liveInfo.sourceProvider || deal.source_provider || 'VERIFIED_PROVIDER' });
          const outOfStock = liveInfo.availability && /out of stock|unavailable/i.test(liveInfo.availability);
          const original = Number(liveInfo.originalPrice);
          const sale = Number(liveInfo.salePrice);
          const discount = Number(liveInfo.discountPercent);
          const discountEnded = liveInfo.isDeal === false
            || (Number.isFinite(discount) && discount < 5 && Number.isFinite(original) && Number.isFinite(sale) && sale >= original);

          if (Number.isFinite(original) && Number.isFinite(sale) && original > 0 && sale > 0 && sale <= original) {
            await safeRecordObservation({ asin: deal.asin, salePrice: sale, originalPrice: original, sourceProvider: liveInfo.sourceProvider || deal.source_provider || 'VERIFIED_PROVIDER' });
          }

          if (outOfStock || discountEnded) {
            await deals.expire(deal.id, outOfStock ? 'Product unavailable at verified source' : 'Verified deal ended');
            expiredCount += 1;
            continue;
          }

          const changes = { price_check_at: attemptAt, last_verify_attempt_at: attemptAt, ...verifiedSourceChanges(deal, liveInfo) };
          if (Number.isFinite(sale) && sale > 0) changes.sale_price = sale;
          if (Number.isFinite(original) && Number.isFinite(sale) && original >= sale) changes.original_price = original;
          if (Number.isFinite(discount) && discount >= 0) changes.discount_percent = discount;
          await deals.update(deal.id, changes);
        } catch (err) {
          if (shouldStopProviderBatch(err)) {
            providerDeferred = true;
            providerDeferredReason = err.code;
            deferredCount += Math.max(0, batchSize - checkedCount);
            console.warn(`[DealCronService] Verification batch stopped: ${err.code}`);
            break;
          }

          const providerStatus = await getProviderStatus().catch(() => null);
          if (!providerHasTransientTrouble(providerStatus)) {
            await refreshStates.recordFailure(deal.asin, err, { at: attemptAt });
            itemFailureCount += 1;
          }
          console.warn(`[DealCronService] Price verification for ${deal.asin}:`, err.message);
        }
      }

      this.stats.dealsExpired += expiredCount;
      return {
        checkedCount, expiredCount, deferredCount, itemFailureCount, eligibleCount: activeDeals.length, batchSize,
        providerDeferred, providerDeferredReason,
      };
    });
  }

  async syncDailyDeals(options = {}) {
    if (this.isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };

    const maxResults = boundedNumber(options.maxResults, 20, 1, 50);
    const minDiscount = boundedNumber(options.minDiscount, 15, 0, 100);
    const scheduled = options.scheduled === true;

    return this.runDistributed(JOB_LOCKS.discoverDeals, 'discover-deals', async () => {
      if (this.isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
      const claim = await this.claimCadence('discover-deals', JOB_INTERVALS.discoverDeals, scheduled);
      if (!claim.acquired) return cadenceSkip('discover-deals', claim);
      this.isRunning = true;
      this.lastRun = new Date();
      this.stats.totalRuns += 1;
      this.stats.lastError = null;
      let createdCount = 0;
      let updatedCount = 0;
      let autoApprovedCount = 0;
      let pendingCount = 0;
      let holdbackCount = 0;
      let rejectedCount = 0;

      try {
        const providerDeals = await fetchDealsList({ amazonDomain: 'amazon.com', maxResults, minDiscount });
        for (const item of providerDeals) {
          const quality = scoreVerifiedDeal(item);
          if (quality.decision === 'REJECT') { rejectedCount += 1; continue; }

          const original = Number(item.originalPrice ?? item.original_price);
          const sale = Number(item.salePrice ?? item.sale_price);
          const discount = Number((((original - sale) / original) * 100).toFixed(1));
          const publication = publishingDecision(item, quality);
          const status = publication.status;
          const verifiedAt = Math.floor(Date.now() / 1000);
          if (publication.reason === 'EDITORIAL_HOLDBACK') holdbackCount += 1;

          await safeRecordObservation({ asin: item.asin, salePrice: sale, originalPrice: original, sourceProvider: item.sourceProvider || 'VERIFIED_PROVIDER' });
          const existing = await deals.findByIdOrAsin(item.asin);
          if (existing) {
            const changes = {
              sale_price: sale, original_price: original, discount_percent: discount,
              price_check_at: verifiedAt, last_verify_attempt_at: verifiedAt,
              source_verified: 1, source_sufficient: 1,
              source_provider: item.sourceProvider || existing.source_provider,
              quality_score: quality.score,
              ...rediscoveryLifecycleChanges(existing, status),
              ...verifiedSourceChanges(existing, item),
            };
            await deals.update(existing.id, changes);
            await refreshStates.recordSuccess(item.asin, { provider: item.sourceProvider, at: verifiedAt });
            updatedCount += 1;
            continue;
          }

          await deals.upsert({
            id: item.asin, title: item.title, asin: item.asin, category: item.category || 'Other',
            original_price: original, sale_price: sale, discount_percent: discount,
            image_url: item.imageUrl || item.image_url || '',
            product_url: item.productUrl || item.product_url || `https://www.amazon.com/dp/${item.asin}`,
            rating: 0, ratings_total: 0, short_bio: '', full_summary: '', pros: '', cons: '', reviews: [],
            source_sufficient: 1, source_verified: 1, source_provider: item.sourceProvider || 'VERIFIED_PROVIDER',
            status, quality_score: quality.score, is_expired: 0, expired_at: null,
            price_check_at: verifiedAt, last_verify_attempt_at: verifiedAt,
            raw_source_data: `${item.sourceProvider || 'Verified provider'} | ASIN: ${item.asin} | publication=${publication.reason}`,
            created_at: verifiedAt,
          });
          await refreshStates.recordSuccess(item.asin, { provider: item.sourceProvider, at: verifiedAt });
          createdCount += 1;
          if (status === 'APPROVED') autoApprovedCount += 1; else pendingCount += 1;
        }

        this.stats.dealsAdded += createdCount;
        this.stats.dealsUpdated += updatedCount;
        this.stats.dealsAutoApproved += autoApprovedCount;
        this.stats.dealsPendingReview += pendingCount;
        this.stats.dealsEditorialHoldback += holdbackCount;
        this.stats.dealsRejected += rejectedCount;

        return {
          created: createdCount, updated: updatedCount, autoApproved: autoApprovedCount,
          pendingReview: pendingCount, editorialHoldback: holdbackCount, rejected: rejectedCount,
          editorialHoldbackPercent: getHoldbackPercent(), maxResults, minDiscount, status: 'SUCCESS',
        };
      } catch (err) {
        this.stats.lastError = err.message;
        return { error: err.message, status: 'NOTICE' };
      } finally {
        this.isRunning = false;
      }
    });
  }

  async getStatus() {
    const durableDiscovery = await maintenanceCadence.get('discover-deals').catch(() => null);
    const durableNextDue = Number(durableDiscovery?.next_due_at || 0);
    const nextRunEstimate = durableNextDue > 0 ? new Date(durableNextDue * 1000).toISOString() : null;
    return {
      running: Boolean(this.intervalId),
      lastRun: this.lastRun ? this.lastRun.toISOString() : null,
      lastPriceCheck: this.lastPriceCheck ? this.lastPriceCheck.toISOString() : null,
      lastPurgeRun: this.lastPurgeRun ? this.lastPurgeRun.toISOString() : null,
      nextRunEstimate,
      scheduleSource: durableNextDue > 0 ? 'postgres' : 'pending_first_run',
      schedulerPollMinutes: SCHEDULER_POLL_MS / 60000,
      editorialHoldbackPercent: getHoldbackPercent(),
      lifecycle: await deals.lifecycleStats(),
      stats: this.stats,
    };
  }
}

module.exports = new DealCronService();
module.exports.shouldStopProviderBatch = shouldStopProviderBatch;
module.exports.cadenceSkip = cadenceSkip;
