import { Link } from 'react-router-dom';

export default function Support() {
  return (
    <div className="ds-shell py-10 sm:py-14">
      <article className="max-w-4xl">
        <header className="border-y border-emerald-950/10 py-8 sm:py-10">
          <div className="ds-kicker">Help</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-emerald-950 mt-2">DealScout Support</h1>
          <p className="mt-3 text-slate-600">Quick help for the website and app.</p>
        </header>
        <div className="grid sm:grid-cols-2 border-t border-l border-emerald-950/10 mt-8 text-sm leading-relaxed">
          <section className="border-r border-b border-emerald-950/10 bg-white p-5 sm:p-6"><h2 className="font-bold text-emerald-950">A price changed</h2><p className="mt-2 text-slate-600">Amazon can change price, seller, shipping, coupons, or stock after DealScout's latest check. Refresh DealScout and confirm the final offer on Amazon before buying.</p></section>
          <section className="border-r border-b border-emerald-950/10 bg-white p-5 sm:p-6"><h2 className="font-bold text-slate-900">Saved deals disappeared</h2><p className="mt-2 text-slate-600">Guest saves are associated with an installation identifier. Clearing browser/app storage or reinstalling can create a new identity, so earlier guest saves may no longer appear.</p></section>
          <section className="border-r border-b border-emerald-950/10 bg-white p-5 sm:p-6"><h2 className="font-bold text-slate-900">A deal is gone</h2><p className="mt-2 text-slate-600">Deals can end quickly. DealScout removes stale or expired offers from public shopper surfaces as its catalog is refreshed and verified.</p></section>
          <section className="border-r border-b border-emerald-950/10 bg-white p-5 sm:p-6"><h2 className="font-bold text-slate-900">Amazon checkout</h2><p className="mt-2 text-slate-600">Checkout, payment, delivery, returns, and retailer-account issues happen on Amazon and are handled under Amazon's policies rather than inside DealScout.</p></section>
        </div>
        <div className="mt-8 border-t border-emerald-950/10 pt-6 text-sm text-slate-600">
          <p>For data-practice information, read the <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/privacy">Privacy Policy</Link>. For affiliate information, read the <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/disclosure">Affiliate Disclosure</Link>.</p>
        </div>
      </article>
    </div>
  );
}
