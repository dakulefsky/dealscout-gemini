import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/components/DealCard';
import { verificationFreshness } from '@/lib/verificationFreshness';
import { deals as dealsApi, functions, editorial as editorialApi } from '@/lib/api';
import { useBookmarks } from '@/lib/BookmarksContext';
import SidebarAds from '@/components/SidebarAds';
import AdSensePlaceholder from '@/components/AdSensePlaceholder';
import { ArrowLeft, TrendingDown, ShoppingBag, Loader2, Heart, Share2, CheckCircle2, ExternalLink, ShieldCheck, Clock, AlertTriangle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

function categorySlug(value) {
  return encodeURIComponent(String(value || '').trim());
}

function observedPrices(history) {
  return (history || []).map((point) => Number(point?.price)).filter((price) => Number.isFinite(price) && price > 0);
}

export default function DealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [editorial, setEditorial] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { toast } = useToast();
  const { isSaved, toggleBookmark } = useBookmarks();

  useEffect(() => {
    let mounted = true;
    dealsApi.get(id)
      .then(async (data) => {
        if (!mounted) return;
        setDeal(data);
        const asin = data?.asin;
        const dealId = data?.id || asin;
        const [editorialResult, historyResult] = await Promise.allSettled([
          asin ? editorialApi.get(asin) : Promise.resolve(null),
          dealId ? dealsApi.getPriceHistory(dealId) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setEditorial(editorialResult.status === 'fulfilled' ? editorialResult.value : null);
        const history = historyResult.status === 'fulfilled' ? historyResult.value?.history : [];
        setPriceHistory(Array.isArray(history) ? history : []);
      })
      .catch(() => mounted && setDeal(null))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  const dealId = deal?.id || deal?.asin;
  const saved = isSaved(dealId);

  async function handleBuy() {
    if (!deal) return;
    setRedirecting(true);
    try {
      const res = await functions.amazonRedirect(deal.productUrl);
      if (res?.redirectUrl) window.location.href = res.redirectUrl;
      else toast({ title: "Couldn't open Amazon", variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Could not open Amazon', description: e.message, variant: 'destructive' });
    } finally {
      setRedirecting(false);
    }
  }

  function handleShare() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast({ title: 'Link copied' });
    setTimeout(() => setCopiedLink(false), 2500);
  }

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>;

  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-slate-900">Deal not found</h2>
        <p className="text-slate-500 mt-2 text-sm">This deal may have ended or is no longer available.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600"><ArrowLeft className="w-4 h-4" /> Back to deals</Link>
      </div>
    );
  }

  const freshness = verificationFreshness(deal.priceCheckAt);
  const savings = Math.max(0, Number(deal.originalPrice || 0) - Number(deal.salePrice || 0));
  const prices = observedPrices(priceHistory);
  const hasObservedRange = prices.length >= 2;
  const historyLow = hasObservedRange ? Math.min(...prices) : null;
  const historyHigh = hasObservedRange ? Math.max(...prices) : null;
  const firstObservedAt = priceHistory[0]?.date ? new Date(priceHistory[0].date) : null;
  const recentHistory = priceHistory.slice(-5).reverse();
  const categoryPath = deal.category ? `/category/${categorySlug(deal.category)}` : '/';

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 sm:py-8 pb-28 lg:pb-8 space-y-6 sm:space-y-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/" className="font-medium hover:text-slate-900">Deals</Link>
        <span aria-hidden="true">/</span>
        <Link to={categoryPath} className="font-medium hover:text-slate-900">{deal.category || 'All deals'}</Link>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl text-xs font-semibold gap-1.5">{copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}{copiedLink ? 'Copied' : 'Share'}</Button>
          <Button variant={saved ? 'default' : 'outline'} size="sm" onClick={() => toggleBookmark(deal)} className={`rounded-xl text-xs font-semibold gap-1.5 ${saved ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}><Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} />{saved ? 'Saved' : 'Save'}</Button>
        </div>
      </div>

      {deal.isExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div><p className="font-bold">This deal has ended</p><p className="text-xs mt-1">The discount ended or the item became unavailable. Amazon may have a different offer now.</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <main className="lg:col-span-8 space-y-6">
          <section className={`grid md:grid-cols-2 gap-5 sm:gap-7 bg-white rounded-3xl p-4 sm:p-7 border border-slate-200 shadow-xs ${deal.isExpired ? 'opacity-85' : ''}`}>
            <div className={`relative aspect-[4/3] md:aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-5 ${deal.isExpired ? 'grayscale-[0.8]' : ''}`}>
              <Image src={deal.imageUrl} fittingType="contain" className="w-full h-full" alt={deal.title} />
              {deal.isExpired ? (
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full"><Clock className="w-3.5 h-3.5 text-amber-400" /> Ended</span>
              ) : deal.discountPercent > 0 ? (
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full"><TrendingDown className="h-3.5 w-3.5" /> {deal.discountPercent}% OFF</span>
              ) : null}
            </div>

            <div className="flex flex-col justify-between gap-5 min-w-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Link to={categoryPath} className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100">{deal.category || 'Deal'}</Link>
                  {deal.sourceVerified && <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${freshness.stale ? 'text-amber-800 bg-amber-50' : 'text-slate-600 bg-slate-50'}`}><ShieldCheck className={`w-3.5 h-3.5 ${freshness.stale ? 'text-amber-600' : 'text-emerald-600'}`} /> {freshness.label}</span>}
                </div>

                <h1 className="font-heading text-xl sm:text-2xl font-black leading-snug text-slate-950">{deal.title}</h1>

                <div className="mt-5 flex items-end gap-2.5 flex-wrap">
                  <span className={`text-3xl sm:text-4xl font-black tracking-tight ${deal.isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>
                  {deal.originalPrice > deal.salePrice && <span className="text-sm sm:text-base text-slate-400 line-through mb-1">{formatPrice(deal.originalPrice)}</span>}
                </div>
                {!deal.isExpired && savings > 0 && <p className="text-sm font-bold text-emerald-700 mt-1">You save {formatPrice(savings)} ({deal.discountPercent}% off)</p>}
                {freshness.stale && !deal.isExpired && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mt-4">Price check is older than usual. Confirm the current offer on Amazon.</p>}
              </div>

              <div className="space-y-2 hidden lg:block">
                <button onClick={handleBuy} disabled={redirecting} className={`inline-flex items-center justify-center gap-2 w-full py-3.5 font-bold text-base rounded-2xl shadow-xs transition disabled:opacity-60 ${deal.isExpired ? 'bg-slate-800 hover:bg-slate-900 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'}`}>
                  {redirecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}{redirecting ? 'Opening Amazon…' : deal.isExpired ? 'Check current price' : 'View deal on Amazon'}<ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                </button>
                <p className="text-[10px] leading-relaxed text-slate-400">As an Amazon Associate I earn from qualifying purchases. Final price and availability are determined on Amazon.</p>
              </div>
            </div>
          </section>

          {hasObservedRange && (
            <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Observed price history</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {prices.length} recorded price checks{firstObservedAt && !Number.isNaN(firstObservedAt.getTime()) ? ` since ${firstObservedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide font-bold text-slate-400">Observed range</div>
                  <div className="text-base font-black text-slate-900">{formatPrice(historyLow)} – {formatPrice(historyHigh)}</div>
                </div>
              </div>

              <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
                {recentHistory.map((point) => {
                  const date = point?.date ? new Date(point.date) : null;
                  return (
                    <div key={`${point.date}-${point.price}`} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span className="text-slate-500">{date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recorded check'}</span>
                      <span className="font-bold text-slate-900">{formatPrice(point.price)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400 mt-3">History shows prices DealScout actually observed. It is not a guarantee of the current Amazon price.</p>
            </section>
          )}

          {editorial?.isHumanPick && (
            <section className="bg-emerald-50 border border-emerald-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-emerald-900 font-black"><Star className="w-5 h-5 fill-emerald-600 text-emerald-600" /> DealScout Pick</div>
              {editorial.editorialNote && <p className="text-sm text-emerald-950 leading-relaxed mt-3">{editorial.editorialNote}</p>}
            </section>
          )}

          <AdSensePlaceholder format="in-content" slotId="5432109876" label="Advertisement" className="w-full" />
          <p className="text-xs text-slate-500 text-center">Product details and customer feedback are available on the current Amazon listing.</p>
        </main>

        <aside className="lg:col-span-4 lg:sticky lg:top-20"><SidebarAds category={deal.category || 'Electronics'} /></aside>
      </div>

      <div className="fixed lg:hidden bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="min-w-0 flex-1"><div className="text-lg font-black text-emerald-700 truncate">{formatPrice(deal.salePrice)}</div>{savings > 0 && !deal.isExpired && <div className="text-[10px] text-slate-500">Save {formatPrice(savings)}</div>}</div>
          <button onClick={handleBuy} disabled={redirecting} className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm disabled:opacity-60 ${deal.isExpired ? 'bg-slate-800 text-white' : 'bg-amber-500 text-slate-950'}`}>{redirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}{deal.isExpired ? 'Check Amazon' : 'View on Amazon'}</button>
        </div>
        <p className="text-[9px] text-slate-400 text-center mt-1.5">As an Amazon Associate I earn from qualifying purchases.</p>
      </div>
    </div>
  );
}