const CHANNELS = Object.freeze({
  WEB: 'web',
  APP: 'app',
  WHATSAPP_STATUS: 'whatsapp_status',
});

const DAY_SECONDS = 24 * 60 * 60;
const CHANNEL_POLICY = Object.freeze({
  [CHANNELS.WEB]: Object.freeze({ maxFreshnessSeconds: 7 * DAY_SECONDS, minDiscountPercent: 15, minQualityScore: 0, requireImage: false }),
  [CHANNELS.APP]: Object.freeze({ maxFreshnessSeconds: 7 * DAY_SECONDS, minDiscountPercent: 15, minQualityScore: 0, requireImage: false }),
  [CHANNELS.WHATSAPP_STATUS]: Object.freeze({ maxFreshnessSeconds: DAY_SECONDS, minDiscountPercent: 20, minQualityScore: 75, requireImage: true }),
});

function asUnixSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  // Accept either milliseconds or seconds at the boundary, but normalize once.
  return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

function dealDiscountPercent(deal = {}) {
  const explicit = Number(deal.discount_percent ?? deal.discountPercent);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const original = Number(deal.original_price ?? deal.originalPrice);
  const sale = Number(deal.sale_price ?? deal.salePrice);
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale <= 0 || sale >= original) return 0;
  return ((original - sale) / original) * 100;
}

function isVerifiedActiveDeal(deal = {}) {
  const verified = deal.source_verified === 1 || deal.source_verified === true || deal.sourceVerified === true;
  const expired = deal.is_expired === 1 || deal.is_expired === true || deal.isExpired === true || deal.status === 'EXPIRED';
  return Boolean(verified && !expired && deal.status === 'APPROVED' && deal.asin && deal.title);
}

function evaluateDistribution(deal = {}, channel, nowUnix = Math.floor(Date.now() / 1000)) {
  const policy = CHANNEL_POLICY[channel];
  if (!policy) throw new Error(`Unsupported distribution channel: ${channel}`);

  const reasons = [];
  if (!isVerifiedActiveDeal(deal)) reasons.push('deal_not_verified_active_approved');

  const discountPercent = dealDiscountPercent(deal);
  if (discountPercent < policy.minDiscountPercent) reasons.push('discount_below_channel_minimum');

  const qualityScore = Number(deal.quality_score ?? deal.qualityScore ?? 0) || 0;
  if (qualityScore < policy.minQualityScore) reasons.push('quality_below_channel_minimum');

  const imageUrl = String(deal.image_url ?? deal.imageUrl ?? '').trim();
  if (policy.requireImage && !/^https?:\/\//i.test(imageUrl)) reasons.push('image_required');

  const checkedAt = asUnixSeconds(deal.price_check_at ?? deal.priceCheckAt);
  const now = asUnixSeconds(nowUnix);
  const ageSeconds = checkedAt && now ? Math.max(0, now - checkedAt) : Number.POSITIVE_INFINITY;
  if (!checkedAt || ageSeconds > policy.maxFreshnessSeconds) reasons.push('price_check_stale');

  return {
    channel,
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      discountPercent: Math.round(discountPercent * 10) / 10,
      qualityScore,
      priceCheckAgeSeconds: Number.isFinite(ageSeconds) ? ageSeconds : null,
    },
  };
}

function distributionScore(deal = {}, nowUnix = Math.floor(Date.now() / 1000)) {
  const quality = Math.max(0, Math.min(100, Number(deal.quality_score ?? deal.qualityScore ?? 0) || 0));
  const discount = Math.max(0, Math.min(80, dealDiscountPercent(deal)));
  const checkedAt = asUnixSeconds(deal.price_check_at ?? deal.priceCheckAt);
  const now = asUnixSeconds(nowUnix);
  const ageHours = checkedAt && now ? Math.max(0, now - checkedAt) / 3600 : 168;
  const freshness = Math.max(0, 24 - Math.min(24, ageHours));
  return Math.round((quality * 0.55 + discount * 0.35 + freshness * 0.1) * 100) / 100;
}

function selectChannelDeals(deals = [], channel, options = {}) {
  const nowUnix = asUnixSeconds(options.nowUnix || Math.floor(Date.now() / 1000));
  const limit = Math.max(0, Math.min(100, Number(options.limit) || 10));
  const excluded = new Set((options.excludedAsins || []).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean));
  const seen = new Set();

  return (deals || [])
    .filter((deal) => {
      const asin = String(deal?.asin || '').trim().toUpperCase();
      if (!asin || excluded.has(asin) || seen.has(asin)) return false;
      const evaluation = evaluateDistribution(deal, channel, nowUnix);
      if (!evaluation.eligible) return false;
      seen.add(asin);
      return true;
    })
    .map((deal) => ({ deal, score: distributionScore(deal, nowUnix) }))
    .sort((a, b) => b.score - a.score || String(a.deal.asin).localeCompare(String(b.deal.asin)))
    .slice(0, limit)
    .map(({ deal }) => deal);
}

module.exports = {
  CHANNELS,
  CHANNEL_POLICY,
  evaluateDistribution,
  selectChannelDeals,
  distributionScore,
  dealDiscountPercent,
  isVerifiedActiveDeal,
};
