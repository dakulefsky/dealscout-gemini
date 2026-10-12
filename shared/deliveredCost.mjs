function cents(value, required = false) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return required ? null : 0;
  if (typeof value === 'string' && !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value.trim())) return null;
  const amount = Number(value);
  const rounded = Math.round(amount * 100);
  return Number.isFinite(amount) && amount >= 0 && (amount === 0 || rounded > 0) && Number.isSafeInteger(rounded)
    && Math.abs(amount * 100 - rounded) < 0.000001 ? rounded : null;
}

export function deliveredOffer(offer = {}) {
  const amounts = [cents(offer.price, true), cents(offer.shipping ?? '', false),
    cents(offer.tax ?? '', false), cents(offer.discount ?? '', false)];
  const quantity = Number(offer.quantity);
  if (amounts.includes(null) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) return null;
  const [price, shipping, tax, discount] = amounts;
  const totalCents = price + shipping + tax - discount;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) return null;
  const unitPrice = totalCents / 100 / quantity;
  if (!Number.isFinite(unitPrice)) return null;
  return { total: totalCents / 100, unitPrice };
}

export function compareDeliveredOffers(a, b) {
  const offerA = deliveredOffer(a), offerB = deliveredOffer(b);
  if (!offerA || !offerB) return null;
  const difference = offerA.unitPrice - offerB.unitPrice;
  const tied = Math.abs(difference) <= Number.EPSILON * Math.max(1, offerA.unitPrice, offerB.unitPrice) * 8;
  const maximum = Math.max(offerA.unitPrice, offerB.unitPrice);
  return { offerA, offerB, cheaper: tied ? null : difference < 0 ? 'A' : 'B',
    savingPercent: tied || maximum === 0 ? 0 : Math.abs(difference) / maximum * 100 };
}
