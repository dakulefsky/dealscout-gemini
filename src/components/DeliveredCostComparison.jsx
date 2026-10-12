import { useState } from 'react';
import { compareDeliveredOffers } from '../../shared/deliveredCost.mjs';
const blank = () => ({ price: '', shipping: '', tax: '', discount: '', quantity: '' });
const fields = [['price', 'Item price ($)'], ['shipping', 'Shipping ($)'], ['tax', 'Tax at checkout ($)'], ['discount', 'Eligible discount ($)'], ['quantity', 'Quantity in the same unit']];
export default function DeliveredCostComparison() {
  const [offers, setOffers] = useState([blank(), blank()]);
  const result = compareDeliveredOffers(...offers);
  return <section id="compare-offers" className="scroll-mt-24 my-10 rounded-xl border border-emerald-950/15 bg-stone-50 p-5 sm:p-7" aria-labelledby="comparison-title">
    <h2 id="comparison-title" className="text-xl font-semibold text-emerald-950">Compare two offers</h2>
    <p className="mt-2 text-sm text-slate-600">Use checkout amounts and the same quantity unit for both offers. Blank shipping, tax and discount count as zero. Missing charges make the result provisional.</p>
    <div className="grid gap-6 sm:grid-cols-2 mt-5">{offers.map((offer, index) => <fieldset key={index}><legend className="font-semibold">Offer {index ? 'B' : 'A'}</legend><div className="grid gap-3 mt-3">{fields.map(([key, label]) => <label key={key} className="text-xs text-slate-600">{label}<input type="number" min="0" step={key === 'quantity' ? 'any' : '0.01'} inputMode="decimal" value={offer[key]} onChange={event => setOffers(current => current.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 mt-1 text-sm text-slate-900" /></label>)}</div></fieldset>)}</div>
    <div role="status" aria-live="polite" className="mt-5 text-sm text-emerald-950">{result ? <><p>A: ${result.offerA.total.toFixed(2)} delivered · ${result.offerA.unitPrice.toFixed(4)} per unit.</p><p className="mt-1">B: ${result.offerB.total.toFixed(2)} delivered · ${result.offerB.unitPrice.toFixed(4)} per unit.</p><p className="font-semibold mt-3">{result.cheaper ? `Offer ${result.cheaper} costs ${result.savingPercent.toFixed(1)}% less per unit.` : 'Both have the same unit cost.'}</p></> : <p>Enter both item prices and positive quantities. Use non-negative dollar amounts with at most two decimal places; discounts cannot exceed the total charges.</p>}</div>
    <p className="mt-3 text-xs text-slate-500">This compares arithmetic cost, not product quality or suitability. The calculator runs in your browser.</p>
  </section>;
}
