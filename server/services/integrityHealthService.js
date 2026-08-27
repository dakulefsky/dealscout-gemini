const deals = require('../repositories/dealRepository');

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

function isStalePrice(deal, now = Math.floor(Date.now() / 1000), maxAgeSeconds = 24 * 3600) {
  if (deal?.source_verified !== 1 || deal?.is_expired === 1 || deal?.status !== 'APPROVED') return false;
  const checkedAt = Number(deal?.price_check_at || 0);
  return !checkedAt || now - checkedAt > maxAgeSeconds;
}

async function getIntegrityHealth() {
  const all = await deals.listAll();
  const live = all.filter((deal) => deal.status === 'APPROVED' && deal.is_expired !== 1);
  const unverifiedApproved = live.filter((deal) => deal.source_verified !== 1);
  const missingImages = live.filter(isMissingImage);
  const stalePrices = live.filter(isStalePrice);
  const legacyEnrichment = live.filter(hasLegacyEnrichment);

  return {
    healthy: unverifiedApproved.length === 0 && missingImages.length === 0 && stalePrices.length === 0,
    liveDeals: live.length,
    unverifiedApproved: unverifiedApproved.length,
    missingImages: missingImages.length,
    stalePrices: stalePrices.length,
    legacyEnrichment: legacyEnrichment.length,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { getIntegrityHealth, hasLegacyEnrichment, isMissingImage, isStalePrice };
