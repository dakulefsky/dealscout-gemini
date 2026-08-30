const deals = require('../repositories/dealRepository');
const postgres = require('../storage/postgres');
const { fetchProductByAsin } = require('./providerRouter');

const IMAGE_REPAIR_LOCK_ID = 44004;
const INITIAL_REPAIR_DELAY_MS = 2 * 60 * 1000;
const REPAIR_INTERVAL_MS = 6 * 60 * 60 * 1000;

let intervalId = null;
let initialTimeoutId = null;
let lastRun = null;
let lastResult = null;
let running = false;

function needsImageRepair(deal) {
  const url = String(deal?.image_url || '').trim();
  return deal?.source_verified === 1 && deal?.is_expired !== 1 && !/^https?:\/\//i.test(url);
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
      let repaired = 0;
      let failed = 0;
      const details = [];

      for (const deal of candidates) {
        try {
          const live = await fetchProductByAsin(deal.asin);
          if (live?.sourceVerified && /^https?:\/\//i.test(String(live.imageUrl || ''))) {
            // Image repair is not a lifecycle/price verification pass. Updating
            // price_check_at here would make a stored price appear fresher than it is.
            await deals.update(deal.id, { image_url: live.imageUrl });
            repaired += 1;
            details.push({ asin: deal.asin, repaired: true });
          } else {
            failed += 1;
            details.push({ asin: deal.asin, repaired: false, reason: 'Provider returned no usable image' });
          }
        } catch (error) {
          failed += 1;
          details.push({ asin: deal.asin, repaired: false, reason: error.message });
        }
      }

      lastResult = {
        checked: candidates.length,
        repaired,
        failed,
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

function startImageRepairScheduler() {
  if (intervalId || initialTimeoutId) return;
  const run = async () => {
    try {
      const health = await imageHealth();
      if (health.missingImages > 0) await repairMissingImages(10);
    } catch (error) {
      console.warn('[ImageRepair] Scheduled repair skipped:', error.message);
    }
  };

  initialTimeoutId = setTimeout(async () => {
    initialTimeoutId = null;
    await run();
  }, INITIAL_REPAIR_DELAY_MS);
  intervalId = setInterval(run, REPAIR_INTERVAL_MS);
}

function stopImageRepairScheduler() {
  if (initialTimeoutId) clearTimeout(initialTimeoutId);
  if (intervalId) clearInterval(intervalId);
  initialTimeoutId = null;
  intervalId = null;
}

module.exports = { repairMissingImages, needsImageRepair, imageHealth, startImageRepairScheduler, stopImageRepairScheduler };
