const deals = require('../repositories/dealRepository');
const { fetchProductByAsin } = require('./providerRouter');

function needsImageRepair(deal) {
  const url = String(deal?.image_url || '').trim();
  return deal?.source_verified === 1 && deal?.is_expired !== 1 && !/^https?:\/\//i.test(url);
}

async function repairMissingImages(limit = 20) {
  const all = await deals.listAll();
  const candidates = all.filter(needsImageRepair).slice(0, Math.min(Math.max(Number(limit) || 20, 1), 50));
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

  return { checked: candidates.length, repaired, failed, remainingCandidates: Math.max(0, all.filter(needsImageRepair).length - repaired), details };
}

module.exports = { repairMissingImages, needsImageRepair };
