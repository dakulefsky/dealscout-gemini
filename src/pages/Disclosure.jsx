import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Disclosure() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-8 transition">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>

      <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2">Affiliate Disclosure</h1>
      <p className="text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Amazon Associates Program</h2>
          <p>
            DealScout participates in the Amazon Services LLC Associates Program, an affiliate advertising program designed
            to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. When you click
            a product link and make a purchase, we may earn a small commission — at no extra cost to you.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Editorial Independence</h2>
          <p>
            Affiliate commissions do not influence our editorial decisions. Every deal on DealScout is curated to provide
            genuine value and competitive pricing.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Pricing & Availability</h2>
          <p>
            Prices and availability can change rapidly on Amazon. Always verify the final price directly on the Amazon checkout
            page before completing your purchase. We are not responsible for price changes or stock fluctuations that occur on Amazon.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">FTC Compliance</h2>
          <p>
            In accordance with the Federal Trade Commission (FTC) guidelines, we are required to disclose that we may
            receive compensation for purchases made through links on this site. This disclosure is provided in compliance
            with 16 CFR Part 255 of the FTC's Guides Concerning the Use of Endorsements and Testimonials in Advertising.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Contact</h2>
          <p>
            For questions about our disclosure policy, please contact us directly.
          </p>
        </section>
      </div>
    </div>
  );
}
