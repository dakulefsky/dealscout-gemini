export function shareDeal(deal, nowMs = Date.now()) {
  const title = String(deal?.title || 'DealScout deal').trim();
  // Always share the public product URL, including when browsing the private service.
  const identity = String(deal?.id || deal?.asin || '').trim();
  const url = identity ? `https://dealscouted.com/deal/${encodeURIComponent(identity)}` : 'https://dealscouted.com/';
  const age = nowMs / 1000 - Number(deal?.priceCheckAt);
  const sale = Number(deal?.salePrice);
  const original = Number(deal?.originalPrice);
  const fresh = deal?.sourceVerified && !deal?.isExpired && (!deal.status || deal.status === 'APPROVED') && age >= 0 && age <= 86400 && sale > 0 && Number.isFinite(sale);
  const price = fresh ? `$${sale.toFixed(2)}${Number.isFinite(original) && original > sale ? ` · ${Math.round((1 - sale / original) * 100)}% off reference price` : ''}` : '';
  const text = [title, price, 'Found on DealScout'].filter(Boolean).join('\n');
  return { title, url, text, message: `${text}\n${url}`, price };
}
