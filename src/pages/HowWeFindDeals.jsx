import { Link } from 'react-router-dom';
export default function HowWeFindDeals() {
  return <article className="ds-shell py-10 sm:py-14"><div className="max-w-3xl">
    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">How DealScout finds deals</h1>
    <p className="mt-4 text-slate-600 leading-relaxed">DealScout organizes Amazon discounts by department so you can compare products and find an offer that fits what you need.</p>
    <h2 className="mt-8 text-xl font-semibold">What gets published</h2>
    <p className="mt-3 text-sm text-slate-600 leading-relaxed">Offers go through automated price, availability and product-data checks before publication. Admin controls allow manual review and corrections. A published deal is not necessarily a personal recommendation from an editor.</p>
    <h2 className="mt-8 text-xl font-semibold">Prices and percentage savings</h2>
    <p className="mt-3 text-sm text-slate-600 leading-relaxed">Savings compare the checked offer price with the reference price supplied by the Amazon listing. Reference prices can vary; a large percentage does not prove that an offer is the lowest historical price. Check the exact size, color, quantity and seller before buying.</p>
    <h2 className="mt-8 text-xl font-semibold">Keeping offers current</h2>
    <p className="mt-3 text-sm text-slate-600 leading-relaxed">Public deal listings require a price check within the past 24 hours. Prices can change between checks. The product page shows when the price was checked, and Amazon has the final price, shipping terms and availability.</p>
    <h2 className="mt-8 text-xl font-semibold">How we earn</h2>
    <p className="mt-3 text-sm text-slate-600 leading-relaxed">As an Amazon Associate we earn from qualifying purchases. <Link to="/disclosure" className="underline">Read our affiliate disclosure</Link>.</p>
    <p className="mt-8 text-sm"><Link to="/support" className="underline">Report an incorrect product or price</Link> · <Link to="/" className="underline">Browse departments</Link></p>
  </div></article>;
}
