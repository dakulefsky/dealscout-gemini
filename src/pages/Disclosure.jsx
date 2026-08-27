import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Disclosure() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-8 transition">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>

      <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2">Affiliate & Editorial Disclosure</h1>
      <p className="text-slate-500 mb-8">DealScout separates provider-verified facts from human editorial judgment.</p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
        <section className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="font-bold text-slate-900">As an Amazon Associate I earn from qualifying purchases.</p>
          <p className="mt-2 text-sm">If you buy through an eligible Amazon link on DealScout, DealScout may earn a commission at no additional cost to you.</p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">How deals are found</h2>
          <p>
            Deal discovery, price checks, discount calculations, availability checks, and stale-deal cleanup may be automated.
            DealScout only publishes provider-sourced pricing when the current price and a higher comparison price can be verified.
            Prices and stock can still change after a check, so the final Amazon product and checkout pages control.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Human editorial review</h2>
          <p>
            A deal labeled <strong>DealScout Pick</strong> has received an explicit human editorial decision. A human note may explain
            why a discount stood out, a tradeoff worth noticing, or why the deal was chosen to feature. A DealScout Pick does not mean
            the reviewer personally used the product unless the note expressly and truthfully says so.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Provider facts vs. our commentary</h2>
          <p>
            Product identifiers, current prices, comparison prices, availability, and other provider-sourced fields are kept separate
            from DealScout's own editorial commentary. We do not intentionally invent prices, discounts, customer reviews, scarcity,
            product experience, or source verification.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Pricing & availability</h2>
          <p>
            Amazon prices, promotions, sellers, and availability can change rapidly. Always verify the final seller, price, shipping,
            and terms on Amazon before purchasing.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Independence</h2>
          <p>
            Affiliate compensation does not guarantee placement or a DealScout Pick. Automated quality scoring can prioritize candidates,
            while human editorial labels are recorded separately from the underlying provider data.
          </p>
        </section>
      </div>
    </div>
  );
}
