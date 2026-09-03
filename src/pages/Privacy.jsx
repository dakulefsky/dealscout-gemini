import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-9 shadow-sm">
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-xs text-slate-400">Last updated September 3, 2026</p>
        <div className="mt-7 space-y-6 text-sm leading-relaxed text-slate-600">
          <section><h2 className="mb-2 text-lg font-bold text-slate-900">What DealScout uses</h2><p>DealScout can use a randomly generated guest identifier to associate features such as saved deals with the same browser or app installation. The service also processes ordinary technical request and operational information needed to run, secure, and troubleshoot DealScout.</p></section>
          <section><h2 className="mb-2 text-lg font-bold text-slate-900">Personalization</h2><p>Recommendation interests and dismissed-deal preferences can be stored on your device. Clearing browser or app storage can remove that local state and may create a new guest identity, which can make saves associated with the previous guest identity inaccessible from the new installation.</p></section>
          <section><h2 className="mb-2 text-lg font-bold text-slate-900">Retail purchases</h2><p>DealScout does not process Amazon checkout or payment information. Deal links take you to the retailer, where the retailer's own terms and privacy practices apply. DealScout may earn a commission from qualifying purchases made through affiliate links.</p></section>
          <section><h2 className="mb-2 text-lg font-bold text-slate-900">Service providers</h2><p>DealScout relies on infrastructure and service providers for functions such as hosting, databases, product data, and communications. Information may be processed by those providers as needed to provide their services to DealScout.</p></section>
          <section><h2 className="mb-2 text-lg font-bold text-slate-900">WhatsApp Status</h2><p>DealScout's WhatsApp surface is used to publish selected deals as outbound Status updates. The shopper website and app do not require access to your WhatsApp contacts or private messages.</p></section>
          <section><h2 className="mb-2 text-lg font-bold text-slate-900">Questions and changes</h2><p>This policy may change as DealScout's features and data practices change. See <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/support">Support</Link> for current help information and the <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/disclosure">Affiliate Disclosure</Link> for affiliate-link information.</p></section>
        </div>
      </article>
    </div>
  );
}
