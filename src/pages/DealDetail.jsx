import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/components/DealCard';
import { deals as dealsApi, functions } from '@/lib/api';
import {
  ArrowLeft, TrendingDown, Check, X, ShieldAlert, Star,
  ShoppingBag, Loader2,
} from 'lucide-react';

export default function DealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    dealsApi.get(id)
      .then(setDeal)
      .catch(() => setDeal(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleBuy() {
    if (!deal) return;
    setRedirecting(true);
    try {
      const res = await functions.amazonRedirect(deal.productUrl);
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast({ title: "Couldn't generate affiliate link", variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Redirect failed', description: e.message, variant: 'destructive' });
    } finally {
      setRedirecting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-slate-200 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-slate-200 rounded" />
              <div className="h-10 w-40 bg-slate-200 rounded" />
              <div className="h-32 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center">
        <p className="text-slate-500">Deal not found or no longer available.</p>
        <Link to="/" className="mt-4 inline-block text-emerald-600 font-medium hover:underline">← Back to all deals</Link>
      </div>
    );
  }

  const pros = (deal.pros || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const cons = (deal.cons || '').split('\n').map((s) => s.trim()).filter(Boolean);
  let reviews = [];
  try { reviews = JSON.parse(deal.reviews || '[]'); } catch { reviews = []; }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft className="h-4 w-4" /> All deals
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="relative aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
          <Image src={deal.imageUrl} fittingType="fill" className="w-full h-full" alt={deal.title} />
          {deal.discountPercent > 0 && (
            <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow">
              <TrendingDown className="h-4 w-4" /> {deal.discountPercent}% OFF
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">
            {deal.category || 'Uncategorized'}
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
            {deal.title}
          </h1>

          {deal.rating != null && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className={`h-4 w-4 ${s < Math.round(deal.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-700">{deal.rating.toFixed(1)}</span>
              {deal.ratingsTotal > 0 && (
                <span className="text-xs text-slate-400">({deal.ratingsTotal.toLocaleString()} ratings on Amazon)</span>
              )}
            </div>
          )}

          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-4xl font-bold text-emerald-700">{formatPrice(deal.salePrice)}</span>
            {deal.originalPrice > deal.salePrice && (
              <span className="text-lg text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>
            )}
            {deal.discountPercent > 0 && (
              <span className="text-sm font-semibold text-emerald-600">Save {deal.discountPercent}%</span>
            )}
          </div>

          {deal.asin && <p className="mt-2 text-xs text-slate-400">ASIN: {deal.asin}</p>}

          <button
            onClick={handleBuy}
            disabled={redirecting}
            className="mt-6 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-60"
          >
            {redirecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
            {redirecting ? 'Preparing link…' : 'Buy on Amazon'}
          </button>
          <p className="mt-2 text-xs text-slate-400">Links to Amazon with our affiliate tracking tag — you pay the same price.</p>

          {!deal.sourceSufficient && (
            <div className="mt-5 flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-4">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">⚠️ Limited data available</p>
                <p className="text-sm text-amber-800 mt-0.5">Please verify product details on Amazon before purchasing.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Summary</h2>
        <p className="text-slate-700 leading-relaxed">{deal.fullSummary || deal.shortBio}</p>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold text-emerald-800 mb-3"><Check className="h-4 w-4" /> Pros</h3>
          {pros.length ? (
            <ul className="space-y-2">
              {pros.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{p.replace(/^[-•]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No pros listed.</p>}
        </div>
        <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold text-rose-800 mb-3"><X className="h-4 w-4" /> Cons</h3>
          {cons.length ? (
            <ul className="space-y-2">
              {cons.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{c.replace(/^[-•]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No cons listed.</p>}
        </div>
      </div>

      {(reviews.length > 0 || deal.rating != null) && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-4">Amazon customer reviews</h2>
          {deal.rating != null && (
            <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
              <span className="text-4xl font-bold text-amber-700">{deal.rating.toFixed(1)}</span>
              <div>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className={`h-5 w-5 ${s < Math.round(deal.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
                {deal.ratingsTotal > 0 && (
                  <p className="text-sm text-slate-600 mt-1">Based on {deal.ratingsTotal.toLocaleString()} Amazon ratings</p>
                )}
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className={`h-4 w-4 ${s < (r.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{r.author}</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
                <p className="mt-2 text-xs text-slate-400">Verified Amazon purchase</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-10 text-[11px] leading-relaxed text-slate-400">
        Deal summaries and pros/cons are produced with AI assistance from manufacturer specifications and consumer reviews, then editorially reviewed. Pricing and availability are subject to change. See our{' '}
        <Link to="/disclosure" className="underline hover:text-slate-600">affiliate disclosure</Link>.
      </p>
    </div>
  );
}
