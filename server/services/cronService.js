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
const { minimumDiscountPercent } = require('./publicDealPolicy');

const TWELVE_HOURS_SECONDS = 12 * 60 * 60;
const ONE_DAY_SECONDS = 24 * 60 * 60;
const THIRTY_MINUTES_SECONDS = 30 * 60;
const SCHEDULER_POLL_MS = 15 * 60 * 1000;
const PROVIDER_RETRY_SAFETY_SECONDS = 60;
const JOB_ERROR_RETRY_SECONDS = 30 * 60;
const JOB_LOCKS = Object.freeze({ purgeExpired: 44001, verifyPrices: 44002, discoverDeals: 44003 });
// Rainforest allows 16 requests/day by default. Leave room for deal discovery
// and a manual action while using one larger, price-only batch each day.
const DAILY_PRICE_VERIFY_MAX_BATCH = 12;
const JOB_INTERVALS = Object.freeze({ purgeExpired: THIRTY_MINUTES_SECONDS, verifyPrices: ONE_DAY_SECONDS, discoverDeals: TWELVE_HOURS_SECONDS });
const PROVIDER_BATCH_STOP_CODES = new Set(['PROVIDER_BUDGET_EXCEEDED', 'PROVIDER_COOLDOWN']);

function dailyPriceVerificationBatchSize(activeCount) {
  return verificationBatchSize(activeCount, {
    intervalHours: 24,
    targetHours: 24,
    maxBatch: DAILY_PRICE_VERIFY_MAX_BATCH,
  });
}

async function safeRecordObservation(observation) {
  try { await recordObservation(observation); }
  catch (err) { console.warn('[DealCronService] Price observation skipped:', err.message); }
}

function providerHasTransientTrouble(status) {
  return [status?.paapi?.throttle, status?.rainforest?.throttle].some((throttle) =>
    throttle?.coolingDown === true || Number(throttle?.consecutiveFailures || 0) > 0
  );
}

function shouldStopProviderBatch(error) {
  return PROVIDER_BATCH_STOP_CODES.has(String(error?.code || ''));
}

function providerRetryAt(error, nowMs = Date.now()) {
  const code = String(error?.code || '');
  const nowSeconds = Math.floor(Number(nowMs) / 1000);
  if (code === 'PROVIDER_COOLDOWN') {
    const retrySeconds = Math.max(PROVIDER_RETRY_SAFETY_SECONDS, Math.ceil(Number(error?.retryAfterMs || 0) / 1000));
    return nowSeconds + retrySeconds;
  }
  if (code !== 'PROVIDER_BUDGET_EXCEEDED') return null;

  const now = new Date(Number(nowMs));
  if (String(error?.scope || '').toLowerCase() === 'month') {
    return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 1, 0) / 1000);
  }
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 1, 0) / 1000);
}

async function rescheduleProviderJob(jobKey, error) {
  const retryAt = providerRetryAt(error);
  if (!retryAt) return null;
  try {
    await maintenanceCadence.reschedule(jobKey, retryAt);
    return retryAt;
  } catch (rescheduleError) {
    console.warn(`[DealCronService] Could not reschedule ${jobKey} after ${error?.code || 'provider deferral'}:`, rescheduleError.message);
    return null;
  }
}

async function recordJobSuccess(jobKey) {
  try { await maintenanceCadence.markSucceeded(jobKey); }
  catch (error) { console.warn(`[DealCronService] Could not persist successful ${jobKey} run:`, error.message); }
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
    // Keep each maintenance lane independent. A transient cleanup/database error
    // must not suppress deal discovery or price verification for the whole cycle.
    const runJob = async (jobKey, name, task) => {
      try {
        const result = await task();
        if (result?.status === 'NOTICE' && result.error) {
          await this.rescheduleAfterJobError(jobKey, result.error);
        }
        return result;
      } catch (error) {
        this.stats.lastError = error?.message || String(error);
        console.warn(`[DealCronService] ${name} failed; scheduling a retry:`, this.stats.lastError);
        await this.rescheduleAfterJobError(jobKey, error);
        return { status: 'NOTICE', job: name, error: this.stats.lastError, retryAfterSeconds: JOB_ERROR_RETRY_SECONDS };
      }
    };

    const purge = await runJob('purge-expired', 'purge-expired', () => this.purgeOldExpiredDeals({ scheduled }));
    // One discovery request can refresh many existing ASINs and add new inventory,
    // so give that bulk request priority before spending the remaining provider
    // allowance on single-ASIN verification calls.
    const discovery = await runJob('discover-deals', 'discover-deals', () => this.syncDailyDeals({ scheduled }));
    const verification = await runJob('verify-prices', 'verify-prices', () => this.checkDealPricesAndAvailability({ scheduled }));
    return { purge, verification, discovery };
  }

  async rescheduleAfterJobError(jobKey, error) {
    // Budget and cooldown errors have their own precise retry windows. Other
    // failures get a bounded half-hour retry instead of waiting a full cadence.
    if (shouldStopProviderBatch(error)) return rescheduleProviderJob(jobKey, error);
    try {
      const retryAt = Math.floor(Date.now() / 1000) + JOB_ERROR_RETRY_SECONDS;
      await maintenanceCadence.reschedule(jobKey, retryAt);
      return retryAt;
    } catch (rescheduleError) {
      console.warn(`[DealCronService] Could not reschedule ${jobKey} after an error:`, rescheduleError.message);
      return null;
    }
  }

  async purgeOldExpiredDeals({ scheduled = false } = {}) {
    return this.runDistributed(JOB_LOCKS.purgeExpired, 'purge-expired', async () => {
      const claim = await this.claimCadence('purge-expired', JOB_INTERVALS.purgeExpired, scheduled);
      if (!claim.acquired) return cadenceSkip('purge-expired', claim);
      this.lastPurgeRun = new Date();
      const result = await deals.purgeExpired(86400);
      this.stats.dealsPurged += result.purgedCount || 0;
      await recordJobSuccess('purge-expired');
      return result;
    });
  }

  async checkDealPricesAndAvailability({ scheduled = false, maxChecks = null } = {}) {
    return this.runDistributed(JOB_LOCKS.verifyPrices, 'verify-prices', async () => {
      // Manual checks must not push the next scheduled daily verification out.
      // The advisory lock still prevents overlapping work.
      if (scheduled) {
        const claim = await this.claimCadence('verify-prices', JOB_INTERVALS.verifyPrices, true);
        if (!claim.acquired) return cadenceSkip('verify-prices', claim);
      }
      this.lastPriceCheck = new Date();
      const all = await deals.listAll();
      const activeDeals = all.filter((deal) => !deal.is_expired && deal.status === 'APPROVED' && deal.source_verified === 1);
      const dailyBatchSize = dailyPriceVerificationBatchSize(activeDeals.length);
      const batchSize = maxChecks == null ? dailyBatchSize : Math.min(dailyBatchSize, Math.max(1, Math.floor(Number(maxChecks) || 1)));
      // Scan the full oldest-first queue so retry backoff on a few failures
      // cannot make every manual batch appear to do nothing.
      const verificationCandidates = oldestCheckedFirst(activeDeals, Math.max(1, activeDeals.length));
      let expiredCount = 0;
      let checkedCount = 0;
      let deferredCount = 0;
      let itemFailureCount = 0;
      let providerDeferred = false;
      let providerDeferredReason = null;
      let providerRetryAtUnix = null;

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
          const computedDiscount = Number.isFinite(original) && Number.isFinite(sale) && original > sale && sale > 0
            ? ((original - sale) / original) * 100
            : 0;
          const discountEnded = liveInfo.isDeal === false || computedDiscount < minimumDiscountPercent();

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
            providerRetryAtUnix = await rescheduleProviderJob('verify-prices', err);
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
      await recordJobSuccess('verify-prices');
      return {
        checkedCount, expiredCount, deferredCount, itemFailureCount, eligibleCount: activeDeals.length, batchSize,
        providerDeferred, providerDeferredReason, providerRetryAt: providerRetryAtUnix,
      };
    });
  }

  async syncDailyDeals(options = {}) {
    await require('./primeDayPolicy').refresh();
    if (this.isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };

    const maxResults = boundedNumber(options.maxResults, 20, 1, 50);
    const minDiscount = boundedNumber(options.minDiscount, minimumDiscountPercent(), 0, 100);
    const scheduled = options.scheduled === true;

    return this.runDistributed(JOB_LOCKS.discoverDeals, 'discover-deals', async () => {
      if (this.isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
      const claim = await this.claimCadence('discover-deals', JOB_INTERVALS.discoverDeals, scheduled);
      if (!claim.acquired) return cadenceSkip('discover-deals', claim);
      this.isRunning = true;
      this.stats.totalRuns += 1;
      this.stats.lastError = null;
      let createdCount = 0;
      let updatedCount = 0;
      let autoApprovedCount = 0;
      let pendingCount = 0;
      let holdbackCount = 0;
      let rejectedCount = 0;

      try {
        const providerDeals = await fetchDealsList({ amazonDomain: 'amazon.com', maxResults, minDiscount, overrideDailyLimit: options.overrideDailyLimit === true && !scheduled });
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
        this.lastRun = new Date();
        await recordJobSuccess('discover-deals');

        return {
          created: createdCount, updated: updatedCount, autoApproved: autoApprovedCount,
          pendingReview: pendingCount, editorialHoldback: holdbackCount, rejected: rejectedCount,
          editorialHoldbackPercent: getHoldbackPercent(), maxResults, minDiscount, status: 'SUCCESS',
        };
      } catch (err) {
        this.stats.lastError = err.message;
        if (shouldStopProviderBatch(err)) {
          const retryAt = await rescheduleProviderJob('discover-deals', err);
          return { error: err.message, code: err.code, scope: err.scope, limit: err.limit, retryAfterMs: err.retryAfterMs, status: 'DEFERRED', nextDueAt: retryAt };
        }
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
    const durableLastSuccess = Number(durableDiscovery?.last_succeeded_at || 0);
    const durableLastAttempt = Number(durableDiscovery?.last_claimed_at || 0);
    return {
      running: Boolean(this.intervalId),
      lastRun: durableLastSuccess > 0 ? new Date(durableLastSuccess * 1000).toISOString() : (this.lastRun ? this.lastRun.toISOString() : null),
      lastAttempt: durableLastAttempt > 0 ? new Date(durableLastAttempt * 1000).toISOString() : null,
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
module.exports.providerRetryAt = providerRetryAt;
module.exports.cadenceSkip = cadenceSkip;
module.exports.JOB_INTERVALS = JOB_INTERVALS;
module.exports.dailyPriceVerificationBatchSize = dailyPriceVerificationBatchSize;
