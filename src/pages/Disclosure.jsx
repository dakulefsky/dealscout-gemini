import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeDollarSign, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';

export default function Disclosure() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-xs">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Transparency
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Affiliate disclosure</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
            The short version: DealScout may earn a commission when you buy through eligible Amazon links. It does not increase the price you pay.
          </p>
        </div>

        <section className="mt-7 p-5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <BadgeDollarSign className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-slate-900">As an Amazon Associate I earn from qualifying purchases.</p>
              <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">Eligible purchases made after following an Amazon link from DealScout may generate a commission for DealScout at no additional cost to you.</p>
            </div>
          </div>
        </section>

        <div className="grid sm:grid-cols-3 gap-3 mt-7">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 mt-3">Prices are checked</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">We aim to show deals only when the current price and comparison price can be verified.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <Clock3 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 mt-3">Deals can change</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">Prices, sellers, shipping, promotions, and availability may change after our latest check.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 mt-3">Amazon is final</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">Always confirm the final seller, price, shipping, availability, and purchase terms on Amazon.</p>
          </div>
        </div>

        <div className="mt-8 pt-7 border-t border-slate-200 space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">DealScout Picks</h2>
            <p>A DealScout Pick is a deal we chose to highlight because it stands out. A pick is not a claim that we personally tested or used the product unless we explicitly say so.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Accuracy</h2>
            <p>We work to keep prices, discounts, product details, and deal status accurate. We do not intentionally invent prices, discounts, customer reviews, scarcity, or personal product experience.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">Affiliate relationships</h2>
            <p>Affiliate compensation does not guarantee that a product will be featured or labeled a DealScout Pick. The goal is to surface useful deals while being clear about how the site may earn money.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
