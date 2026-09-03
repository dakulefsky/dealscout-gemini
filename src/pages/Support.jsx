import { Link } from 'react-router-dom';

export default function Support() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-9 shadow-sm">
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-slate-900">DealScout Support</h1>
        <p className="mt-3 text-slate-600">Quick help for the website and app.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 text-sm leading-relaxed">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-bold text-slate-900">A price changed</h2><p className="mt-2 text-slate-600">Amazon can change price, seller, shipping, coupons, or stock after DealScout's latest check. Refresh DealScout and confirm the final offer on Amazon before buying.</p></section>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-bold text-slate-900">Saved deals disappeared</h2><p className="mt-2 text-slate-600">Guest saves are associated with an installation identifier. Clearing browser/app storage or reinstalling can create a new identity, so earlier guest saves may no longer appear.</p></section>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-bold text-slate-900">A deal is gone</h2><p className="mt-2 text-slate-600">Deals can end quickly. DealScout removes stale or expired offers from public shopper surfaces as its catalog is refreshed and verified.</p></section>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-bold text-slate-900">Amazon checkout</h2><p className="mt-2 text-slate-600">Checkout, payment, delivery, returns, and retailer-account issues happen on Amazon and are handled under Amazon's policies rather than inside DealScout.</p></section>
        </div>
        <div className="mt-7 border-t border-slate-200 pt-6 text-sm text-slate-600">
          <p>For data-practice information, read the <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/privacy">Privacy Policy</Link>. For affiliate information, read the <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/disclosure">Affiliate Disclosure</Link>.</p>
        </div>
      </article>
    </div>
  );
}
