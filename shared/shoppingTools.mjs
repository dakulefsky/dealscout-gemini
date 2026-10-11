export function compareUnitPrices(priceA, quantityA, priceB, quantityB) {
  const values = [priceA, quantityA, priceB, quantityB].map(Number);
  if (values.some(value => !Number.isFinite(value) || value <= 0)) return null;
  const [a, qa, b, qb] = values;
  const unitA = a / qa, unitB = b / qb;
  if (![unitA, unitB].every(value => Number.isFinite(value) && value > 0)) return null;
  return { unitA, unitB, cheaper: unitA === unitB ? null : unitA < unitB ? 'A' : 'B', savingPercent: (1 - Math.min(unitA, unitB) / Math.max(unitA, unitB)) * 100 };
}
export function freshInitialFeed(page, params, nowMs = Date.now()) {
  if (params.sort !== 'best' || params.category || params.q || params.minDiscount || params.minPrice || params.maxPrice || !Array.isArray(page?.items)) return { items: [], nextCursor: null };
  const items = page.items.filter(deal => {
    const checked = Number(deal.priceCheckAt) * 1000;
    return deal.sourceVerified === true && deal.status === 'APPROVED' && !deal.isExpired && checked > 0 && checked <= nowMs && nowMs - checked <= 86400000 && Number(deal.salePrice) > 0 && Number(deal.originalPrice) > Number(deal.salePrice);
  });
  return { items, nextCursor: items.length ? page.nextCursor || null : null };
}
