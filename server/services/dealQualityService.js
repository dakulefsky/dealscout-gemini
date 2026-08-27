function scoreVerifiedDeal(item = {}) {
  const original = Number(item.originalPrice ?? item.original_price);
  const sale = Number(item.salePrice ?? item.sale_price);
  const rating = Number(item.rating) || 0;
  const ratingsTotal = Number(item.ratingsTotal ?? item.ratings_total) || 0;
  const hasImage = Boolean(item.imageUrl || item.image_url);
  const availability = String(item.availability || '').toLowerCase();
  const sourceVerified = item.sourceVerified === true || item.source_verified === 1;

  if (!sourceVerified || !item.asin || !item.title) return { score: 0, decision: 'REJECT', reasons: ['unverified source'] };
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale <= 0 || sale >= original) {
    return { score: 0, decision: 'REJECT', reasons: ['invalid price pair'] };
  }
  if (/out of stock|unavailable/.test(availability)) return { score: 0, decision: 'REJECT', reasons: ['unavailable'] };

  const discount = ((original - sale) / original) * 100;
  if (discount < 15) return { score: 0, decision: 'REJECT', reasons: ['discount below 15%'] };

  let score = 45; // verified source + valid live price pair
  const reasons = ['verified live pricing'];

  if (discount >= 40) { score += 25; reasons.push('40%+ discount'); }
  else if (discount >= 30) { score += 20; reasons.push('30%+ discount'); }
  else if (discount >= 20) { score += 14; reasons.push('20%+ discount'); }
  else { score += 8; reasons.push('15%+ discount'); }

  if (rating >= 4.5) { score += 12; reasons.push('4.5+ rating'); }
  else if (rating >= 4.0) { score += 8; reasons.push('4.0+ rating'); }
  else if (rating > 0 && rating < 3.5) { score -= 12; reasons.push('low rating'); }

  if (ratingsTotal >= 1000) { score += 10; reasons.push('1000+ ratings'); }
  else if (ratingsTotal >= 100) { score += 6; reasons.push('100+ ratings'); }
  else if (ratingsTotal > 0 && ratingsTotal < 20) { score -= 5; reasons.push('low review volume'); }

  if (hasImage) { score += 5; reasons.push('product image'); }
  if (item.isPrime === true || item.is_prime === true) { score += 3; reasons.push('Prime'); }
  if (item.dealBadge || item.deal_badge) { score += 5; reasons.push('Amazon deal badge'); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, decision: score >= 75 ? 'AUTO_APPROVE' : 'PENDING_REVIEW', reasons };
}

module.exports = { scoreVerifiedDeal };
