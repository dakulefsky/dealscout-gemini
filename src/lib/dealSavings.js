export function dealSavings(deal) {
  if (!deal || deal.isExpired || deal.is_expired === 1 || deal.status === 'EXPIRED') return { amount: 0, percent: 0 };
  const original = Number(deal.originalPrice ?? deal.original_price);
  const sale = Number(deal.salePrice ?? deal.sale_price);
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale <= 0 || sale >= original) return { amount: 0, percent: 0 };
  const amount = Math.round((original - sale) * 100) / 100;
  // Whole-percent labels are rounded down so a badge never overstates savings.
  return { amount, percent: Math.floor(((original - sale) / original) * 100 + 1e-8) };
}
