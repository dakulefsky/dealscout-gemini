import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/components/DealCard';
import { verificationFreshness } from '@/lib/verificationFreshness';
import { addCategoryInterest } from '@/lib/feedPersonalization';
import { deals as dealsApi, functions, editorial as editorialApi } from '@/lib/api';
import { useBookmarks } from '@/lib/BookmarksContext';
import SidebarAds from '@/components/SidebarAds';
import AdSensePlaceholder from '@/components/AdSensePlaceholder';
import { ArrowLeft, ShoppingBag, Loader2, Heart, Share2, CheckCircle2, ExternalLink, ShieldCheck, Clock, AlertTriangle, Star, ArrowRight } from 'lucide-react';

function categorySlug(value) {
  return encodeURIComponent(String(value || '').trim());
}

export default function DealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [editorial, setEditorial] = useState(null);
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
        const editorialResult = await Promise.allSettled([
          asin ? editorialApi.get(asin) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setEditorial(editorialResult[0]?.status === 'fulfilled' ? editorialResult[0].value : null);
      })
      .catch(() => mounted && setDeal(null))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  const dealId = deal?.id || deal?.asin;
  const saved = isSaved(dealId);

  async function handleBuy() {
    if (!deal) return;
    const amazonTab = window.open('about:blank', '_blank');
    if (!amazonTab) {
      toast({ title: 'Could not open Amazon', description: 'Please allow pop-ups for DealScout and try again.', variant: 'destructive' });
      return;
    }
    amazonTab.opener = null;
    setRedirecting(true);
    try {
      const res = await functions.amazonRedirect(deal.productUrl);
      if (res?.redirectUrl) {
        addCategoryInterest(deal.category, 3);
        amazonTab.location.replace(res.redirectUrl);
      } else {
        amazonTab.close();
        toast({ title: "Couldn't open Amazon", variant: 'destructive' });
      }
    } catch (e) {
      amazonTab.close();
      toast({ title: 'Could not open Amazon', description: e.message, variant: 'destructive' });
    } finally {
      setRedirecting(false);
    }
  }

  function handleSave() {
    if (!deal) return;
    if (!saved) addCategoryInterest(deal.category, 4);
    toggleBookmark(deal);
  }

  function handleShare() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast({ title: 'Link copied' });
    setTimeout(() => setCopiedLink(false), 2500);
  }

  if (loading) return <div className="ds-shell py-24 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-800" /></div>;

  if (!deal) {
    return (
      <div className="ds-shell py-24 text-center">
        <div className="ds-kicker">No longer available</div>
        <h2 className="font-heading text-3xl font-bold text-emerald-950 mt-2">Deal not found</h2>
        <p className="text-slate-500 mt-3 text-sm">This deal may have ended or is no longer available.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-900 border-b border-emerald-900 pb-1"><ArrowLeft className="w-4 h-4" /> Back to deals</Link>
      </div>
    );
  }

  const freshness = verificationFreshness(deal.priceCheckAt);
  const savings = Math.max(0, Number(deal.originalPrice || 0) - Number(deal.salePrice || 0));
  const categoryPath = deal.category ? `/category/${categorySlug(deal.category)}` : '/';

  return (
    <div className="ds-shell py-6 sm:py-9 pb-28 lg:pb-14">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 border-b border-emerald-950/10 pb-4">
        <Link to="/" className="font-semibold hover:text-emerald-900">Deals</Link>
        <span aria-hidden="true">/</span>
        <Link to={categoryPath} className="font-semibold hover:text-emerald-900">{deal.category || 'All deals'}</Link>
      </nav>

      {deal.isExpired && (
        <div className="border-b border-amber-300 bg-amber-50 py-3 px-1 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div><p className="text-sm font-bold">This deal has ended</p><p className="text-xs mt-0.5">Amazon may now show a different price or offer.</p></div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)] gap-8 lg:gap-12 pt-7 sm:pt-10 items-start">
        <main className="min-w-0">
          <div className={`bg-[#f4f1e9] border border-emerald-950/10 aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] flex items-center justify-center p-7 sm:p-12 ${deal.isExpired ? 'grayscale-[0.75]' : ''}`}>
            <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} fittingType="contain" className="w-full h-full" alt={deal.title} />
          </div>

          {editorial?.isHumanPick && (
            <section className="mt-8 border-y border-emerald-950/10 py-6 sm:py-7">
              <div className="ds-kicker inline-flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-emerald-800" /> DealScout pick</div>
              <h2 className="font-heading text-2xl font-bold text-emerald-950 mt-2">Why this one stood out</h2>
              {editorial.editorialNote && <p className="text-sm text-slate-600 leading-relaxed mt-3 max-w-2xl">{editorial.editorialNote}</p>}
            </section>
          )}

          <div className="mt-9">
            <AdSensePlaceholder format="in-content" slotId="5432109876" label="Advertisement" className="w-full" />
            <p className="text-[11px] text-slate-400 text-center mt-4">Product details and customer feedback are available on the current Amazon listing.</p>
          </div>
        </main>

        <aside className="lg:sticky lg:top-24 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <Link to={categoryPath} className="ds-kicker hover:text-emerald-700">{deal.category || 'Deal'}</Link>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleShare} aria-label="Share deal" className="w-9 h-9 border border-emerald-950/15 flex items-center justify-center text-slate-500 hover:text-emerald-900 focus-visible:ring-2 focus-visible:ring-emerald-800">{copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <Share2 className="w-4 h-4" />}</button>
              <button type="button" onClick={handleSave} aria-label={saved ? `Remove ${deal.title} from saved deals` : `Save ${deal.title}`} className={`w-9 h-9 border flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-800 ${saved ? 'bg-emerald-950 text-white border-emerald-950' : 'border-emerald-950/15 text-slate-500 hover:text-emerald-900'}`}><Heart className={`w-4 h-4 ${saved ? 'fill-white' : ''}`} /></button>
            </div>
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.03] text-emerald-950 mt-4">{deal.title}</h1>

          <div className="mt-7 flex items-baseline gap-3 flex-wrap border-b border-emerald-950/10 pb-5">
            <span className={`text-4xl sm:text-5xl font-black tracking-tight ${deal.isExpired ? 'text-slate-500 line-through' : 'text-emerald-950'}`}>{formatPrice(deal.salePrice)}</span>
            {deal.originalPrice > deal.salePrice && <span className="text-sm text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}
            {deal.discountPercent > 0 && !deal.isExpired && <span className="text-xs font-black text-emerald-800">{deal.discountPercent}% OFF</span>}
          </div>

          {!deal.isExpired && savings > 0 && <p className="text-sm font-bold text-emerald-800 mt-4">Save {formatPrice(savings)} on the current verified price.</p>}

          {deal.sourceVerified && <div className={`mt-4 flex items-center gap-2 text-xs font-semibold ${freshness.stale ? 'text-amber-800' : 'text-slate-600'}`}><ShieldCheck className={`w-4 h-4 ${freshness.stale ? 'text-amber-600' : 'text-emerald-700'}`} /><span>{freshness.stale ? 'Price check is older than usual' : freshness.label}</span></div>}
          {freshness.stale && !deal.isExpired && <p className="text-xs text-amber-800 mt-2">Confirm the current offer on Amazon before buying.</p>}

          <button onClick={handleBuy} disabled={redirecting} className={`mt-7 inline-flex items-center justify-between gap-3 w-full px-5 py-4 font-bold text-sm transition disabled:opacity-60 ${deal.isExpired ? 'bg-slate-800 hover:bg-slate-900 text-white' : 'bg-emerald-950 hover:bg-emerald-900 text-white'}`}>
            <span className="inline-flex items-center gap-2">{redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}{redirecting ? 'Opening Amazon…' : deal.isExpired ? 'Check current price' : 'View deal on Amazon'}</span><ExternalLink className="w-4 h-4 opacity-70" />
          </button>
          <p className="text-[10px] leading-relaxed text-slate-400 mt-2">As an Amazon Associate I earn from qualifying purchases. Final price and availability are determined on Amazon.</p>

          <Link to={categoryPath} className="mt-7 border-t border-emerald-950/10 pt-4 flex items-center justify-between text-sm font-bold text-emerald-950 hover:text-emerald-700"><span>More {String(deal.category || 'deal').toLowerCase()} deals</span><ArrowRight className="w-4 h-4" /></Link>

          <div className="mt-9"><SidebarAds category={deal.category || 'Electronics'} /></div>
        </aside>
      </div>

      <div className="fixed lg:hidden bottom-0 inset-x-0 z-40 border-t border-emerald-950/15 bg-[#fbfaf7]/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(13,63,45,0.08)]">
        <div className="ds-shell !px-0 flex items-center gap-3">
          <div className="min-w-0 flex-1"><div className="text-xl font-black text-emerald-950 truncate">{formatPrice(deal.salePrice)}</div>{savings > 0 && !deal.isExpired && <div className="text-[10px] text-emerald-700 font-bold">Save {formatPrice(savings)}</div>}</div>
          <button onClick={handleBuy} disabled={redirecting} className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 font-black text-sm disabled:opacity-60 ${deal.isExpired ? 'bg-slate-800 text-white' : 'bg-emerald-950 text-white'}`}>{redirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}{deal.isExpired ? 'Check Amazon' : 'View on Amazon'}</button>
        </div>
      </div>
    </div>
  );
}
