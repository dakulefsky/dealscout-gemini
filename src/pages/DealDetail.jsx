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
import {
  ArrowLeft,
  TrendingDown,
  ShoppingBag,
  Loader2,
  Heart,
  Share2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        if (data?.asin) {
          try {
            const e = await editorialApi.get(data.asin);
            if (mounted) setEditorial(e);
          } catch {
            if (mounted) setEditorial(null);
          }
        }
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
      else toast({ title: "Couldn't generate affiliate link", variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Redirect failed', description: e.message, variant: 'destructive' });
    } finally {
      setRedirecting(false);
    }
  }

  const handleShare = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast({ title: 'Deal Link Copied', description: 'Direct link copied to clipboard.' });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>;
  }

  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-slate-900">Deal not found</h2>
        <p className="text-slate-500 mt-2 text-sm">This deal may have expired or is no longer available.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700"><ArrowLeft className="w-4 h-4" /> Back to all deals</Link>
      </div>
    );
  }

  const pros = (deal.pros || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const cons = (deal.cons || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const freshness = verificationFreshness(deal.priceCheckAt);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition"><ArrowLeft className="h-4 w-4" /> Back to deals</Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl text-xs font-semibold text-slate-700 gap-1.5">
            {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}{copiedLink ? 'Copied' : 'Share'}
          </Button>
          <Button variant={saved ? 'default' : 'outline'} size="sm" onClick={() => toggleBookmark(deal)} className={`rounded-xl text-xs font-semibold gap-1.5 ${saved ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'text-slate-700'}`}>
            <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} />{saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
          {deal.isExpired && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div><p className="font-bold">This deal has ended</p><p className="text-xs mt-1">Our price monitor detected that the discount ended or the item became unavailable. Check Amazon for the current offer.</p></div>
            </div>
          )}

          <div className={`grid md:grid-cols-2 gap-6 lg:gap-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs ${deal.isExpired ? 'opacity-85' : ''}`}>
            <div className={`relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-6 ${deal.isExpired ? 'grayscale-[0.8]' : ''}`}>
              <Image src={deal.imageUrl} fittingType="contain" className="w-full h-full object-contain" alt={deal.title} />
              {deal.isExpired ? (
                <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full"><Clock className="w-3.5 h-3.5 text-amber-400" /> Deal Ended</span>
              ) : deal.discountPercent > 0 ? (
                <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full"><TrendingDown className="h-3.5 w-3.5" /> {deal.discountPercent}% OFF</span>
              ) : null}
            </div>

            <div className="flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md">{deal.category || 'Deals'}</span>
                  {deal.sourceVerified && (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${freshness.stale ? 'text-amber-800 bg-amber-50' : 'text-slate-600 bg-slate-50'}`}>
                      <ShieldCheck className={`w-4 h-4 ${freshness.stale ? 'text-amber-600' : 'text-emerald-600'}`} />
                      {freshness.label}
                    </span>
                  )}
                </div>
                <h1 className={`font-heading text-xl sm:text-2xl font-bold leading-snug ${deal.isExpired ? 'text-slate-700' : 'text-slate-900'}`}>{deal.title}</h1>
                <p className="text-[11px] text-slate-400 font-mono">ASIN: {deal.asin}</p>

                <div className="flex items-baseline gap-3 pt-2 flex-wrap">
                  <span className={`text-3xl font-extrabold ${deal.isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>
                  {deal.originalPrice > deal.salePrice && <span className="text-base text-slate-400 line-through font-normal">{formatPrice(deal.originalPrice)}</span>}
                  {!deal.isExpired && deal.discountPercent > 0 && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Save {formatPrice(deal.originalPrice - deal.salePrice)}</span>}
                </div>

                {freshness.stale && !deal.isExpired && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">This verification is older than our preferred freshness window. Confirm the current offer on Amazon before buying.</p>
                )}

                {deal.shortBio && <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">{deal.shortBio}</p>}
              </div>

              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] text-slate-500"><strong>As an Amazon Associate I earn from qualifying purchases.</strong></p>
                <button onClick={handleBuy} disabled={redirecting} className={`inline-flex items-center justify-center gap-2 w-full py-3.5 font-bold text-sm sm:text-base rounded-2xl shadow-xs transition disabled:opacity-60 ${deal.isExpired ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                  {redirecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}{redirecting ? 'Opening Amazon…' : deal.isExpired ? 'Check Current Price on Amazon' : 'View on Amazon'}<ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </button>
                <p className="text-[10px] text-slate-400">Final seller, price, shipping, and availability are determined on Amazon.</p>
              </div>
            </div>
          </div>

          {editorial?.isHumanPick && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-7">
              <div className="flex items-center gap-2 text-emerald-900 font-black"><Star className="w-5 h-5 fill-emerald-600 text-emerald-600" /> DealScout Pick</div>
              {editorial.editorialNote ? <p className="text-sm text-emerald-950 leading-relaxed mt-3">{editorial.editorialNote}</p> : <p className="text-sm text-emerald-800 mt-2">A human editor reviewed this deal and chose it to feature.</p>}
              <p className="text-[11px] text-emerald-700/70 mt-3">Human editorial decision • provider facts remain separately verified</p>
            </div>
          )}

          {deal.fullSummary && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <h2 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Product overview</h2>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">{deal.fullSummary}</p>
            </div>
          )}

          {(pros.length > 0 || cons.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><h3 className="font-bold text-slate-900 text-sm">What stands out</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{pros.map((p, i) => <li key={i}>✓ {p}</li>)}</ul></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><h3 className="font-bold text-slate-900 text-sm">Tradeoffs to notice</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{cons.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>
            </div>
          )}

          <AdSensePlaceholder format="in-content" slotId="5432109876" label="Advertisement" className="w-full" />

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 leading-relaxed">
            DealScout does not currently display Amazon customer star ratings or review excerpts from the Rainforest data source. If an authorized Amazon content API is enabled later, public review content can be restored under that API's terms.
          </div>
        </div>

        <div className="lg:col-span-4 sticky top-20"><SidebarAds category={deal.category || 'Electronics'} /></div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400 text-center pt-6 border-t border-slate-200">Prices and availability can change after verification. Always confirm the final offer on Amazon.</p>
    </div>
  );
}
