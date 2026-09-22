import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="ds-shell py-10 sm:py-14">
      <article className="max-w-3xl">
        <header className="border-y border-emerald-950/10 py-8 sm:py-10">
          <div className="ds-kicker">Policies</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-emerald-950 mt-2">Privacy Policy</h1>
          <p className="mt-3 text-xs text-slate-400">Last updated September 23, 2026</p>
        </header>
        <div className="divide-y divide-emerald-950/10 text-sm leading-relaxed text-slate-600">
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">What DealScout uses</h2><p>DealScout can use a randomly generated guest identifier to associate features such as saved deals with the same browser or app installation. The service also processes ordinary technical request and operational information needed to run, secure, and troubleshoot DealScout.</p></section>
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">Personalization</h2><p>Recommendation interests and dismissed-deal preferences can be stored on your device. Clearing browser or app storage can remove that local state and may create a new guest identity, which can make saves associated with the previous guest identity inaccessible from the new installation.</p></section>
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">Retail purchases</h2><p>DealScout does not process Amazon checkout or payment information. Deal links take you to the retailer, where the retailer's own terms and privacy practices apply. DealScout may earn a commission from qualifying purchases made through affiliate links.</p></section>
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">Service providers</h2><p>DealScout relies on infrastructure and service providers for functions such as hosting, databases, product data, communications, and advertising. Information may be processed by those providers as needed to provide their services to DealScout.</p></section>
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">Advertising and cookies</h2><p>DealScout uses Google AdSense code to support advertising. Google and its advertising partners may use cookies, local storage, device information, or similar technologies to deliver, measure, limit, or personalize advertising where permitted. Consent choices and available controls can vary by region and by the advertising settings presented to you.</p></section>
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">WhatsApp Status</h2><p>DealScout's WhatsApp surface is used to publish selected deals as outbound Status updates. The shopper website and app do not require access to your WhatsApp contacts or private messages.</p></section>
          <section className="py-6"><h2 className="mb-2 text-lg font-bold text-emerald-950">Questions and changes</h2><p>This policy may change as DealScout's features and data practices change. See <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/support">Support</Link> for current help information and the <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/disclosure">Affiliate Disclosure</Link> for affiliate-link information.</p></section>
        </div>
      </article>
    </div>
  );
}
