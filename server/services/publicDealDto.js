function rowToDeal(r, { includeInternal = false } = {}) {
  if (!r) return null;
  const now = Math.floor(Date.now() / 1000);
  const isExpired = r.is_expired === 1 || r.status === 'EXPIRED';
  const expiredAt = r.expired_at || null;
  const purgeInSeconds = isExpired && expiredAt ? Math.max(0, 86400 - (now - Number(expiredAt))) : null;
  const originalPrice = Number(r.original_price ?? 0);
  const salePrice = Number(r.sale_price ?? 0);
  const discountPercent = Number.isFinite(originalPrice) && Number.isFinite(salePrice) && originalPrice > 0 && salePrice > 0 && salePrice < originalPrice
    ? Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1))
    : 0;
  const publicDeal = {
    id: r.id,
    title: r.title,
    asin: r.asin,
    category: r.category,
    originalPrice,
    salePrice,
    discountPercent,
    imageUrl: r.image_url,
    productUrl: r.product_url,
    qualityScore: Number(r.quality_score ?? 0),
    sourceVerified: r.source_verified === 1,
    status: r.status,
    isExpired,
    expiredAt,
    purgeInSeconds,
    purgeInHours: purgeInSeconds === null ? null : Number((purgeInSeconds / 3600).toFixed(1)),
    priceCheckAt: r.price_check_at || null,
    created_date: r.created_at ? new Date(Number(r.created_at) * 1000).toISOString() : null,
  };
  if (!includeInternal) return publicDeal;
  return {
    ...publicDeal,
    rating: Number(r.rating ?? 0),
    ratingsTotal: Number(r.ratings_total ?? 0),
    shortBio: r.short_bio,
    fullSummary: r.full_summary,
    pros: r.pros,
    cons: r.cons,
    reviews: Array.isArray(r.reviews) ? r.reviews : [],
    sourceSufficient: r.source_sufficient === 1,
    sourceProvider: r.source_provider || null,
    rawSourceData: r.raw_source_data || null,
    lastVerifyAttemptAt: r.last_verify_attempt_at || null,
  };
}
module.exports = { rowToDeal };
