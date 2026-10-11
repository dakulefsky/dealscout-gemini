const deals = require('../repositories/dealRepository');
const { scoreVerifiedDeal } = require('./dealQualityService');
const { publishingDecision } = require('./editorialCadenceService');

// Discovery and already-paid verification share the same new-record shape.
function discoveredRecord(item, quality, publication, verifiedAt) {
  const original = Number(item.originalPrice ?? item.original_price);
  const sale = Number(item.salePrice ?? item.sale_price);
  const discount = Number((((original - sale) / original) * 100).toFixed(1));
  const status = publication.status;
  return {
    id: item.asin, title: item.title, asin: item.asin, category: item.category || 'Other',
    original_price: original, sale_price: sale, discount_percent: discount,
    image_url: item.imageUrl || item.image_url || '',
    product_url: item.productUrl || item.product_url || `https://www.amazon.com/dp/${item.asin}`,
    rating: 0, ratings_total: 0, short_bio: '', full_summary: '', pros: '', cons: '', reviews: [],
    source_sufficient: 1, source_verified: 1, source_provider: item.sourceProvider || 'VERIFIED_PROVIDER',
    status, quality_score: quality.score, is_expired: 0, expired_at: null,
    price_check_at: verifiedAt, last_verify_attempt_at: verifiedAt,
    raw_source_data: `${item.sourceProvider || 'Verified provider'} | ASIN: ${item.asin} | publication=${publication.reason}`,
    created_at: verifiedAt,
  };
}

async function retainBulkDiscoveries(items, existingDeals, verifiedAt = Math.floor(Date.now() / 1000)) {
  const known = new Set(existingDeals.map(deal => String(deal.asin || '').toUpperCase()));
  let created = 0;
  let pendingReview = 0;
  for (const item of items) {
    if (known.has(item.asin)) continue;
    const quality = scoreVerifiedDeal(item);
    if (quality.decision === 'REJECT') continue;
    const publication = publishingDecision(item, quality);
    // Conflict handling protects concurrent manual edits and rejections.
    const inserted = await deals.upsert(discoveredRecord(item, quality, publication, verifiedAt), { insertOnly: true });
    if (!inserted) continue;
    known.add(item.asin);
    created += 1;
    if (publication.status === 'PENDING_REVIEW') pendingReview += 1;
  }
  return { created, pendingReview };
}

module.exports = { discoveredRecord, retainBulkDiscoveries };
