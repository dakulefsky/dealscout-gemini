const PUBLIC_PRICE_MAX_AGE_SECONDS = 24 * 60 * 60;

function checkedAtSeconds(deal) {
  const value = Number(deal?.price_check_at ?? deal?.priceCheckAt ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isPriceFresh(deal, nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = PUBLIC_PRICE_MAX_AGE_SECONDS) {
  const checkedAt = checkedAtSeconds(deal);
  if (!checkedAt) return false;
  const age = Number(nowSeconds) - checkedAt;
  return Number.isFinite(age) && age >= 0 && age <= Number(maxAgeSeconds);
}

function isPublicDeal(deal, options = {}) {
  if (!deal) return false;
  if (deal.status !== 'APPROVED') return false;
  if (deal.is_expired === 1 || deal.isExpired === true) return false;
  if (!(deal.source_verified === 1 || deal.sourceVerified === true)) return false;
  return isPriceFresh(deal, options.nowSeconds, options.maxAgeSeconds);
}

function freshPriceThreshold(nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = PUBLIC_PRICE_MAX_AGE_SECONDS) {
  return Math.floor(Number(nowSeconds) - Number(maxAgeSeconds));
}

module.exports = {
  PUBLIC_PRICE_MAX_AGE_SECONDS,
  checkedAtSeconds,
  isPriceFresh,
  isPublicDeal,
  freshPriceThreshold,
};
