import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Clock, AlertCircle, ShieldCheck, EyeOff } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useBookmarks } from '@/lib/BookmarksContext';
import { verificationFreshness } from '@/lib/verificationFreshness';
import { addCategoryInterest, reduceCategoryInterest, dwellWeight, loadInterests } from '@/lib/feedPersonalization';
import { dismissDeal, isDealDismissed, restoreDeal } from '@/lib/feedDismissals';

export function formatPrice(price) {
  if (price == null || isNaN(price)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export default function DealCard({ deal, viewMode = 'grid' }) {
  const { isSaved, toggleBookmark } = useBookmarks();
  const { toast } = useToast();
  const dealId = deal.id || deal.asin;
  const saved = isSaved(dealId);
  const [dismissed, setDismissed] = useState(() => isDealDismissed(dealId));
  const isExpired = Boolean(deal.isExpired || deal.status === 'EXPIRED');
  const hoursLeft = deal.expiresInHours ? Math.max(1, Math.ceil(deal.expiresInHours)) : null;
  const freshness = verificationFreshness(deal.priceCheckAt);
  const savings = Math.max(0, Number(deal.originalPrice || 0) - Number(deal.salePrice || 0));
  const cardRef = useRef(null);
  const viewedAt = useRef(null);
  const dwellRecorded = useRef(false);

  function handleBookmarkClick() {
    if (!saved) addCategoryInterest(deal.category, 4);
    toggleBookmark(deal);
  }

  function handleDismissClick() {
    const previousScore = Number(loadInterests()?.[deal.category]) || 0;
    dismissDeal(dealId);
    const reducedInterests = reduceCategoryInterest(deal.category, 3);
    const reducedScore = Number(reducedInterests?.[deal.category]) || 0;
    const removedWeight = Math.max(0, previousScore - reducedScore);
    setDismissed(true);
    toast({
      title: 'Deal hidden',
      description: 'We’ll show you fewer deals like this.',
      duration: 2000,
      action: <button type="button" className="inline-flex h-8 items-center justify-center border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2" onClick={() => { restoreDeal(dealId); if (removedWeight) addCategoryInterest(deal.category, removedWeight); setDismissed(false); }}>Undo</button>,
    });
  }

  const finishDwell = useCallback(() => {
    if (!viewedAt.current || dwellRecorded.current) { viewedAt.current = null; return; }
    const weight = dwellWeight(Date.now() - viewedAt.current);
    viewedAt.current = null;
    if (weight) { dwellRecorded.current = true; addCategoryInterest(deal.category, weight); }
  }, [deal.category]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.65);
      if (visible && !viewedAt.current && !dwellRecorded.current) viewedAt.current = Date.now();
      if (!visible && viewedAt.current) finishDwell();
    }, { threshold: [0, 0.65, 1] });
    observer.observe(node);
    return () => { finishDwell(); observer.disconnect(); };
  }, [dealId, finishDwell]);

  function handleDealClick() { addCategoryInterest(deal.category, 2); }
  if (dismissed) return null;

  const sourceBadge = !isExpired && deal.sourceVerified ? (
    <span title={freshness.label} className={`inline-flex items-center gap-1 text-[9px] font-bold ${freshness.stale ? 'text-amber-700' : 'text-slate-500'}`}>
      <ShieldCheck className={`w-3 h-3 ${freshness.stale ? 'text-amber-600' : 'text-emerald-700'}`} />
      {freshness.stale ? 'Check price' : 'Verified'}
    </span>
  ) : null;

  const actionButtons = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={handleDismissClick} title="Not interested" aria-label={`Not interested in ${deal.title}`} className="w-8 h-8 flex items-center justify-center bg-white/90 text-slate-400 hover:text-slate-800 border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><EyeOff className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={handleBookmarkClick} title={saved ? 'Remove from Saved' : 'Save Deal'} aria-label={saved ? `Remove ${deal.title} from saved deals` : `Save ${deal.title}`} className={`w-8 h-8 flex items-center justify-center border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${saved ? 'bg-emerald-950 text-white border-emerald-950' : 'bg-white/90 text-slate-500 border-slate-200 hover:text-emerald-900'}`}><Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} /></button>
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div ref={cardRef} className={`group border-t border-emerald-950/10 py-4 flex gap-4 items-center relative ${isExpired ? 'opacity-65' : ''}`}>
        <Link to={`/deal/${dealId}`} onClick={handleDealClick} aria-label={`View deal: ${deal.title}`} className="flex gap-4 items-center flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
          <div className={`relative w-28 h-24 sm:w-36 sm:h-28 shrink-0 p-2 bg-white ${isExpired ? 'grayscale-[0.8]' : ''}`}>
            <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-[1.03] transition-transform duration-200" />
            {isExpired ? <span className="absolute top-1 left-1 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5">Ended</span> : deal.discountPercent > 0 ? <span className="absolute top-1 left-1 bg-emerald-100 text-emerald-950 text-[10px] font-black px-1.5 py-0.5">{deal.discountPercent}% OFF</span> : null}
          </div>
          <div className="flex-1 min-w-0 pr-20 sm:pr-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap"><span className="ds-kicker">{deal.category || 'Deal'}</span>{isExpired && <span className="text-[9px] text-amber-700 font-bold"><AlertCircle className="w-2.5 h-2.5 inline mr-0.5" />{hoursLeft ? `Deletes in ${hoursLeft}h` : 'Ended'}</span>}{sourceBadge}</div>
            <h3 className={`text-sm sm:text-base font-semibold leading-snug line-clamp-2 ${isExpired ? 'line-through text-slate-500' : 'text-slate-950 group-hover:text-emerald-900'}`}>{deal.title}</h3>
            <div className="flex items-baseline gap-2 mt-2"><span className="ds-price text-xl">{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}{!isExpired && savings > 0 && <span className="text-[10px] font-bold text-emerald-700">Save {formatPrice(savings)}</span>}</div>
          </div>
        </Link>
        <div className="absolute right-3 top-3 sm:static">{actionButtons}</div>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`group relative h-full flex flex-col bg-white border border-emerald-950/10 ${isExpired ? 'opacity-65' : 'hover:border-emerald-950/20 hover:shadow-[0_8px_28px_rgba(13,63,45,0.08)]'} transition-all`}>
      <Link to={`/deal/${dealId}`} onClick={handleDealClick} aria-label={`View deal: ${deal.title}`} className="flex flex-col flex-1 min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700">
        <div className={`relative aspect-[4/3] w-full overflow-hidden p-4 bg-[#f7f5f0] border-b border-emerald-950/5 ${isExpired ? 'grayscale-[0.8]' : ''}`}>
          <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-[1.035] transition-transform duration-300" />
          {isExpired ? <span className="absolute top-2 left-2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1"><Clock className="w-2.5 h-2.5 inline mr-1" />Ended</span> : deal.discountPercent > 0 ? <span className="absolute top-2 left-2 bg-[#dfeee2] text-emerald-950 text-[10px] font-black px-2 py-1">{deal.discountPercent}% OFF</span> : null}
        </div>
        <div className="p-3.5 sm:p-4 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2 min-h-[16px]"><span className="text-[9px] uppercase tracking-[0.12em] font-bold text-slate-500 truncate">{deal.category || 'Deal'}</span>{sourceBadge}</div>
          <h3 className={`text-xs sm:text-sm font-semibold leading-snug line-clamp-2 min-h-[2.4rem] ${isExpired ? 'line-through text-slate-500' : 'text-slate-950 group-hover:text-emerald-900'}`}>{deal.title}</h3>
          <div className="mt-auto pt-3">
            <div className="flex items-baseline gap-1.5 flex-wrap"><span className="ds-price text-lg sm:text-xl">{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-[10px] sm:text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}</div>
            <div className="mt-1.5 flex items-center justify-between gap-2">{!isExpired && savings > 0 ? <span className="text-[10px] font-bold text-emerald-700">Save {formatPrice(savings)}</span> : <span /> }<ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition" /></div>
          </div>
        </div>
      </Link>
      <div className="absolute top-2 right-2 z-10">{actionButtons}</div>
    </div>
  );
}
