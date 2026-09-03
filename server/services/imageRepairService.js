const deals = require('../repositories/dealRepository');
const postgres = require('../storage/postgres');
const { fetchProductByAsin } = require('./providerRouter');

const IMAGE_REPAIR_LOCK_ID = 44004;
const PROVIDER_STOP_CODES = new Set(['PROVIDER_BUDGET_EXCEEDED', 'PROVIDER_COOLDOWN']);

let lastRun = null;
let lastResult = null;
let running = false;

function needsImageRepair(deal) {
  const url = String(deal?.image_url || '').trim();
  return deal?.source_verified === 1 && deal?.is_expired !== 1 && !/^https?:\/\//i.test(url);
}

function shouldStopImageRepair(error) {
  return PROVIDER_STOP_CODES.has(String(error?.code || ''));
}

async function imageHealth() {
  const all = await deals.listAll();
  const activeVerified = all.filter((deal) => deal?.source_verified === 1 && deal?.is_expired !== 1);
  const candidates = activeVerified.filter(needsImageRepair);
  return {
    activeVerifiedDeals: activeVerified.length,
    missingImages: candidates.length,
    healthyImages: Math.max(0, activeVerified.length - candidates.length),
    running,
    lastRun,
    lastResult,
  };
}

async function repairMissingImages(limit = 20) {
  if (running) return { skipped: true, reason: 'ALREADY_RUNNING', ...(await imageHealth()) };

  const locked = await postgres.withAdvisoryLock(IMAGE_REPAIR_LOCK_ID, async () => {
    if (running) return { skipped: true, reason: 'ALREADY_RUNNING', ...(await imageHealth()) };
    running = true;
    lastRun = new Date().toISOString();
    try {
      const all = await deals.listAll();
      const allCandidates = all.filter(needsImageRepair);
      const candidates = allCandidates.slice(0, Math.min(Math.max(Number(limit) || 20, 1), 50));
      let attempted = 0;
      let repaired = 0;
      let failed = 0;
      let providerDeferred = false;
      let providerDeferredReason = null;
      const details = [];

      for (const deal of candidates) {
        attempted += 1;
        try {
          const live = await fetchProductByAsin(deal.asin);
          if (live?.sourceVerified && /^https?:\/\//i.test(String(live.imageUrl || ''))) {
            // Image repair is deliberately manual. Normal discovery and price
            // verification already refresh provider metadata, so a background
            // image-only poll would duplicate paid provider requests.
            await deals.update(deal.id, { image_url: live.imageUrl });
            repaired += 1;
            details.push({ asin: deal.asin, repaired: true });
          } else {
            failed += 1;
            details.push({ asin: deal.asin, repaired: false, reason: 'Provider returned no usable image' });
          }
        } catch (error) {
          if (shouldStopImageRepair(error)) {
            providerDeferred = true;
            providerDeferredReason = error.code;
            details.push({ asin: deal.asin, repaired: false, deferred: true, reason: error.code });
            break;
          }
          failed += 1;
          details.push({ asin: deal.asin, repaired: false, reason: error.message });
        }
      }

      lastResult = {
        checked: attempted,
        repaired,
        failed,
        providerDeferred,
        providerDeferredReason,
        deferredCount: providerDeferred ? Math.max(0, candidates.length - repaired - failed) : 0,
        remainingCandidates: Math.max(0, allCandidates.length - repaired),
      };
      return { ...lastResult, details };
    } finally {
      running = false;
    }
  });

  if (!locked.acquired) return { skipped: true, reason: 'LOCK_HELD', job: 'image-repair' };
  return locked.result;
}

module.exports = { repairMissingImages, needsImageRepair, shouldStopImageRepair, imageHealth };
