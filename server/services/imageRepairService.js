const deals = require('../repositories/dealRepository');
const { fetchProductByAsin } = require('./providerRouter');

let intervalId = null;
let lastRun = null;
let lastResult = null;
let running = false;

function needsImageRepair(deal) {
  const url = String(deal?.image_url || '').trim();
  return deal?.source_verified === 1 && deal?.is_expired !== 1 && !/^https?:\/\//i.test(url);
}

async function imageHealth() {
  const all = await deals.listAll();
  const candidates = all.filter(needsImageRepair);
  return {
    activeVerifiedDeals: all.filter((deal) => deal?.source_verified === 1 && deal?.is_expired !== 1).length,
    missingImages: candidates.length,
    healthyImages: Math.max(0, all.filter((deal) => deal?.source_verified === 1 && deal?.is_expired !== 1).length - candidates.length),
    running,
    lastRun,
    lastResult,
  };
}

async function repairMissingImages(limit = 20) {
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
          await deals.update(deal.id, { image_url: live.imageUrl, price_check_at: Math.floor(Date.now() / 1000) });
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
}

function startImageRepairScheduler() {
  if (intervalId) return;
  const run = async () => {
    try {
      const health = await imageHealth();
      if (health.missingImages > 0) await repairMissingImages(10);
    } catch (error) {
      console.warn('[ImageRepair] Scheduled repair skipped:', error.message);
    }
  };
  setTimeout(run, 2 * 60 * 1000);
  intervalId = setInterval(run, 6 * 60 * 60 * 1000);
}

function stopImageRepairScheduler() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

module.exports = { repairMissingImages, needsImageRepair, imageHealth, startImageRepairScheduler, stopImageRepairScheduler };
