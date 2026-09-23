import { verificationFreshness } from './verificationFreshness.js';

export const HERO_MIN_DISCOUNT_PERCENT = 30;

export function trustworthyDiscountPercent(deal, nowMs = Date.now()) {
  if (!deal || deal.isExpired || deal.status === 'EXPIRED' || deal.sourceVerified !== true) return 0;
  if (verificationFreshness(deal.priceCheckAt, nowMs).stale) return 0;

  const original = Number(deal.originalPrice);
  const sale = Number(deal.salePrice);
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale <= 0 || sale >= original) return 0;

  const computed = ((original - sale) / original) * 100;
  const reported = Number(deal.discountPercent);
  const supported = Number.isFinite(reported) && reported > 0 ? Math.min(reported, computed) : computed;
  return Math.max(0, supported);
}

export function selectHeroDeal(deals, nowMs = Date.now()) {
  return (deals || [])
    .map((deal) => ({ deal, discount: trustworthyDiscountPercent(deal, nowMs) }))
    .filter(({ discount }) => discount >= HERO_MIN_DISCOUNT_PERCENT)
    .sort((a, b) => b.discount - a.discount)[0]?.deal || null;
}
