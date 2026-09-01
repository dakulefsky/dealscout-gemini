import { Link } from 'react-router-dom';
import { ArrowLeft, Database, ExternalLink, Heart, ShieldCheck, Smartphone } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>

      <article className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-xs">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Privacy
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Privacy policy</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
            DealScout is built to find and organize deals without requiring a public shopper account. This page describes the data used by the current website and mobile app.
          </p>
          <p className="text-xs text-slate-400 mt-3">Last updated September 1, 2026.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-7">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 mt-3">Local preferences</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">Recommendation interests and dismissed-deal preferences are stored on your device so the feed can adapt to you.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <Heart className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 mt-3">Saved deals</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">A random guest identifier lets DealScout associate saved deals with the same browser or app installation.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 mt-3">Shared service data</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">The backend stores operational records needed to serve deals, saved items, and any enabled account-based features.</p>
          </div>
        </div>

        <div className="mt-8 pt-7 border-t border-slate-200 space-y-7 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Information DealScout uses</h2>
            <p>When you use DealScout, the service may process a randomly generated guest identifier, saved-deal choices, target-price settings when you deliberately create them, and ordinary technical request information needed to operate and protect the service. If an authenticated feature uses an email address, DealScout uses the verified account email rather than an arbitrary delivery address supplied in a request.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Personalization on your device</h2>
            <p>The website and app can learn broad category interests from actions such as opening, saving, dismissing, or spending time on deals. Those recommendation-interest scores are designed as local device state rather than a server-side advertising profile. They decay over time and can be reset from the product.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Purchases and Amazon</h2>
            <p>DealScout does not process your Amazon checkout or payment information. When you choose an Amazon deal, you leave DealScout and complete any purchase under Amazon's own terms and privacy practices. Amazon may attribute qualifying purchases to DealScout's affiliate link.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Service providers</h2>
            <p>DealScout relies on hosting, database, email, product-data, and other infrastructure providers to operate the service. Those providers may process information only as needed for their role. DealScout does not expose private administration data through the public shopper API.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">WhatsApp Status</h2>
            <p>DealScout's WhatsApp surface is an outbound Status publishing surface for selected deals. The shopper website and app do not require access to your WhatsApp contacts or private messages.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Storage and controls</h2>
            <p>Clearing DealScout website/app storage removes local recommendation state and can create a new guest identity. Because server-side saved records are associated with the previous identity, clearing that identity may make those earlier guest saves inaccessible from the new installation. Use the in-product reset and save controls when you want to change those preferences without resetting the installation identity.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Policy changes and questions</h2>
            <p>This policy will be updated when the product's data practices materially change. For current help options, visit the <Link to="/support" className="font-semibold text-emerald-700 hover:text-emerald-800">DealScout support page</Link>. For affiliate practices, see the <Link to="/disclosure" className="font-semibold text-emerald-700 hover:text-emerald-800">affiliate disclosure</Link>.</p>
          </section>

          <section className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-600">External retailers and services have their own privacy policies. Confirm the destination before providing payment, account, or other sensitive information outside DealScout.</p>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
