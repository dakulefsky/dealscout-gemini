import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Heart, RefreshCw, Search, ShieldCheck, Smartphone } from 'lucide-react';

export default function Support() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>

      <article className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-xs">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Help
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-slate-900">DealScout support</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">Quick answers for the website and app, including saved deals, stale prices, Amazon links, and recommendation controls.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-7">
          <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <div className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-slate-900">A price changed</h2></div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">DealScout only exposes deals inside its public freshness window, but Amazon can change price, seller, shipping, coupons, or stock after the latest check. Refresh DealScout and always confirm the final offer on Amazon before buying.</p>
          </section>

          <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <div className="flex items-center gap-2"><Heart className="w-5 h-5 text-rose-500" /><h2 className="font-bold text-slate-900">Saved deals disappeared</h2></div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">Guest saves are tied to a random installation identifier. Clearing browser/app storage or reinstalling can create a new identity, so saves associated with the old guest identity may no longer appear.</p>
          </section>

          <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <div className="flex items-center gap-2"><Search className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-slate-900">Search or filters look wrong</h2></div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">Reset the active filters and try again. Search, category, discount, price, and sort selections all change the server-backed deal feed, so a restrictive combination can legitimately return no deals.</p>
          </section>

          <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-slate-900">Recommendations feel off</h2></div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">Use “Not interested” on individual deals or reset recommendations from the feed. Recommendation interests are local to your device and are designed to decay rather than permanently lock you into a category.</p>
          </section>
        </div>

        <div className="mt-8 pt-7 border-t border-slate-200 space-y-7 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Amazon orders, returns, and payments</h2>
            <p>DealScout is a deal-discovery service, not the retailer or payment processor. Order status, cancellation, returns, refunds, payment issues, shipping, and seller disputes must be handled with Amazon or the seller shown at checkout.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">A link does not open</h2>
            <p>Try refreshing the deal and opening it again. DealScout validates outbound Amazon destinations, but a product can be removed or redirected after publication. If the product is unavailable, use search or return to the feed for another deal.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Privacy and affiliate information</h2>
            <p>Read the <Link to="/privacy" className="font-semibold text-emerald-700 hover:text-emerald-800">privacy policy</Link> for the current website/app data practices and the <Link to="/disclosure" className="font-semibold text-emerald-700 hover:text-emerald-800">affiliate disclosure</Link> for Amazon Associate information.</p>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-slate-900">Before you buy</h2>
                <p className="mt-1.5 text-slate-700">The Amazon checkout page is the final source for the seller, current price, shipping, availability, promotions, and purchase terms. A DealScout price is a recently observed deal price, not a guarantee that Amazon will still offer it when you check out.</p>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
