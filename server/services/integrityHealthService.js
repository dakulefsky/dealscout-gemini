const deals = require('../repositories/dealRepository');
const { departmentStock, TARGET_LIVE_DEALS } = require('./departmentSupplyService');
const { isPriceFresh, hasValidPricePair, meetsMinimumDiscount, checkedAtSeconds, PUBLIC_PRICE_MAX_AGE_SECONDS } = require('./publicDealPolicy');

function hasLegacyEnrichment(deal) {
  return Boolean(
    String(deal?.short_bio || '').trim() ||
    String(deal?.full_summary || '').trim() ||
    String(deal?.pros || '').trim() ||
    String(deal?.cons || '').trim() ||
    (Array.isArray(deal?.reviews) && deal.reviews.length)
  );
}

function isMissingImage(deal) {
  return deal?.source_verified === 1 && deal?.is_expired !== 1 && !/^https?:\/\//i.test(String(deal?.image_url || '').trim());
}

function isStalePrice(deal, now = Math.floor(Date.now() / 1000), maxAgeSeconds = PUBLIC_PRICE_MAX_AGE_SECONDS) {
  if (deal?.source_verified !== 1 || deal?.is_expired === 1 || deal?.status !== 'APPROVED') return false;
  return !isPriceFresh(deal, now, maxAgeSeconds);
}

function visibilityBreakdown(approved, now = Math.floor(Date.now() / 1000)) {
  const hidden = { unverified: 0, invalidPrice: 0, belowDiscount: 0, unchecked: 0, futureCheck: 0, stale: 0 };
  let visible = 0;
  for (const deal of approved) {
    // Exclusive reasons: every approved active record belongs to exactly one bucket.
    if (deal.source_verified !== 1) hidden.unverified++;
    else if (!hasValidPricePair(deal)) hidden.invalidPrice++;
    else if (!meetsMinimumDiscount(deal)) hidden.belowDiscount++;
    else if (!checkedAtSeconds(deal)) hidden.unchecked++;
    else if (checkedAtSeconds(deal) > now) hidden.futureCheck++;
    else if (!isPriceFresh(deal, now)) hidden.stale++;
    else visible++;
  }
  return { approved: approved.length, visible, hidden };
}

async function getIntegrityHealth() {
  const all = await deals.listAll();
  const live = all.filter((deal) => deal.status === 'APPROVED' && deal.is_expired !== 1);
  const unverifiedApproved = live.filter((deal) => deal.source_verified !== 1);
  const missingImages = live.filter(isMissingImage);
  const stalePrices = live.filter((deal) => isStalePrice(deal));
  const legacyEnrichment = live.filter(hasLegacyEnrichment);

  return {
    visibility: visibilityBreakdown(live),
    departmentSupply: { targetLiveDeals: TARGET_LIVE_DEALS, departments: Object.entries(departmentStock(all)).filter(([name]) => name !== 'Other').map(([name, visible]) => ({ name, visible })) },
    healthy: unverifiedApproved.length === 0 && missingImages.length === 0 && stalePrices.length === 0,
    liveDeals: live.length,
    unverifiedApproved: unverifiedApproved.length,
    missingImages: missingImages.length,
    stalePrices: stalePrices.length,
    legacyEnrichment: legacyEnrichment.length,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { getIntegrityHealth, hasLegacyEnrichment, isMissingImage, isStalePrice, visibilityBreakdown };
