function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function dealRankScore(deal, nowMs = Date.now()) {
  if (!deal || deal.isExpired || deal.status === 'EXPIRED') return -Infinity;

  const discount = Math.max(0, Math.min(80, numeric(deal.discountPercent)));
  const sale = Math.max(0, numeric(deal.salePrice));
  const original = Math.max(sale, numeric(deal.originalPrice, sale));
  const savings = Math.max(0, original - sale);
  const providerQuality = Math.max(0, Math.min(100, numeric(deal.qualityScore ?? deal.quality_score)));

  let freshness = 0;
  const checkedAt = numeric(deal.priceCheckAt ?? deal.price_check_at);
  if (checkedAt > 0) {
    const ageHours = Math.max(0, (nowMs - checkedAt * 1000) / 3600000);
    freshness = ageHours <= 2 ? 12 : ageHours <= 12 ? 9 : ageHours <= 24 ? 6 : ageHours <= 72 ? 2 : -4;
  }

  const image = /^https?:\/\//i.test(String(deal.imageUrl || deal.image_url || '')) ? 5 : -6;
  const verified = deal.sourceVerified === true || deal.source_verified === 1 ? 10 : -20;
  const meaningfulSavings = Math.min(18, Math.log10(savings + 1) * 9);
  const discountWeight = discount * 0.85;
  const qualityWeight = providerQuality * 0.2;

  return Number((discountWeight + meaningfulSavings + qualityWeight + freshness + image + verified).toFixed(2));
}

export function rankDeals(deals, nowMs = Date.now()) {
  return [...(deals || [])].sort((a, b) => {
    const diff = dealRankScore(b, nowMs) - dealRankScore(a, nowMs);
    if (diff !== 0) return diff;
    return numeric(b.createdAt ?? b.created_at) - numeric(a.createdAt ?? a.created_at);
  });
}
