import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Clock, AlertCircle, ShieldCheck, EyeOff } from 'lucide-react';
import { Image } from '@/components/ui/image';
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
  const dealId = deal.id || deal.asin;
  const saved = isSaved(dealId);
  const [dismissed, setDismissed] = useState(() => isDealDismissed(dealId));
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef(null);
  const dismissedInterestPenaltyRef = useRef(0);
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
    dismissDeal(dealId);
    const before = Number(loadInterests()[deal.category] || 0);
    const after = Number(reduceCategoryInterest(deal.category, 3)[deal.category] || 0);
    dismissedInterestPenaltyRef.current = Math.max(0, before - after);
    viewedAt.current = null;
    setDismissed(true);
    setUndoVisible(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoVisible(false);
      undoTimerRef.current = null;
      dismissedInterestPenaltyRef.current = 0;
    }, 2000);
  }

  function handleUndoDismiss() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    restoreDeal(dealId);
    if (dismissedInterestPenaltyRef.current > 0) {
      addCategoryInterest(deal.category, dismissedInterestPenaltyRef.current);
    }
    dismissedInterestPenaltyRef.current = 0;
    setUndoVisible(false);
    setDismissed(false);
  }

  const finishDwell = useCallback(() => {
    if (!viewedAt.current || dwellRecorded.current) {
      viewedAt.current = null;
      return;
    }
    const weight = dwellWeight(Date.now() - viewedAt.current);
    viewedAt.current = null;
    if (weight) {
      dwellRecorded.current = true;
      addCategoryInterest(deal.category, weight);
    }
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
    return () => {
      finishDwell();
      observer.disconnect();
    };
  }, [dealId, finishDwell]);

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  function handleDealClick() { addCategoryInterest(deal.category, 2); }

  if (dismissed) {
    if (!undoVisible) return null;
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-6 z-[70] flex items-center gap-3 rounded-full bg-slate-950 text-white shadow-xl px-4 py-2.5 text-sm font-semibold" role="status" aria-live="polite">
        <span>Deal hidden</span>
        <button type="button" onClick={handleUndoDismiss} className="font-black text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 rounded px-1">Undo</button>
      </div>
    );
  }

  const sourceBadge = !isExpired && deal.sourceVerified ? (
    <span title={freshness.label} className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md whitespace-nowrap ${freshness.stale ? 'text-amber-800 bg-amber-100' : 'text-slate-600 bg-slate-100'}`}>
      <ShieldCheck className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${freshness.stale ? 'text-amber-600' : 'text-emerald-600'}`} />
      <span className="hidden sm:inline">{freshness.ageSeconds === null ? 'Price verified' : freshness.label.replace('Price checked ', '')}</span>
      <span className="sm:hidden">{freshness.stale ? 'Check price' : 'Checked'}</span>
    </span>
  ) : null;

  const actionButtons = (
    <div className="flex items-center gap-1.5 shrink-0">
      <button type="button" onClick={handleDismissClick} title="Not interested" aria-label={`Not interested in ${deal.title}`} className="w-8 h-8 rounded-full flex items-center justify-center transition border bg-white/95 backdrop-blur text-slate-400 hover:text-slate-700 border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2">
        <EyeOff className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={handleBookmarkClick} title={saved ? 'Remove from Saved' : 'Save Deal'} aria-label={saved ? `Remove ${deal.title} from saved deals` : `Save ${deal.title}`} className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${saved ? 'bg-rose-600 text-white border-rose-600' : 'bg-white/95 backdrop-blur text-slate-500 hover:text-rose-600 border-slate-200'}`}>
        <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} />
      </button>
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div ref={cardRef} className={`group rounded-2xl border p-3 sm:p-4 transition-all flex gap-3 sm:gap-4 items-center relative w-full ${isExpired ? 'bg-slate-50/80 border-dashed border-slate-300 opacity-75' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
        <Link to={`/deal/${dealId}`} onClick={handleDealClick} aria-label={`View deal: ${deal.title}`} className="flex gap-3 sm:gap-4 items-center flex-1 min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
          <div className={`relative w-24 h-24 sm:w-32 sm:h-28 rounded-xl overflow-hidden shrink-0 p-2 sm:p-3 border ${isExpired ? 'bg-slate-100 border-slate-200 grayscale-[0.85]' : 'bg-slate-50 border-slate-100'}`}>
            <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-105 transition-transform duration-200" />
            {isExpired ? <span className="absolute top-1.5 left-1.5 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded"><Clock className="w-2.5 h-2.5 inline mr-0.5" /> Ended</span> : deal.discountPercent > 0 ? <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">-{deal.discountPercent}%</span> : null}
          </div>
          <div className="flex-1 min-w-0 pr-16 sm:pr-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">{!isExpired && deal.category && <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[150px]">{deal.category}</span>}{isExpired && <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded"><AlertCircle className="w-2.5 h-2.5 inline" /> {hoursLeft ? `Deletes in ${hoursLeft}h` : 'Ended'}</span>}{sourceBadge}</div>
            <h3 className={`text-sm sm:text-base font-bold leading-snug line-clamp-2 ${isExpired ? 'text-slate-600 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>{deal.title}</h3>
            <div className="flex items-baseline gap-2 mt-2"><span className={`text-lg sm:text-xl font-black ${isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}{!isExpired && savings > 0 && <span className="hidden sm:inline text-[10px] font-bold text-emerald-700">Save {formatPrice(savings)}</span>}</div>
          </div>
        </Link>
        <div className="absolute right-3 top-3 sm:static">{actionButtons}</div>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`group rounded-xl sm:rounded-2xl border overflow-hidden transition-all flex flex-col h-full w-full relative ${isExpired ? 'bg-slate-50/90 border-dashed border-slate-300 opacity-75' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
      <Link to={`/deal/${dealId}`} onClick={handleDealClick} aria-label={`View deal: ${deal.title}`} className="flex flex-col flex-1 min-h-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600">
        <div className={`relative aspect-[4/3] w-full overflow-hidden p-2.5 sm:p-4 border-b ${isExpired ? 'bg-slate-100 border-slate-200 grayscale-[0.85]' : 'bg-slate-50/70 border-slate-100'}`}>
          <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-105 transition-transform duration-300" />
          {isExpired ? <span className="absolute top-2 left-2 bg-slate-800 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded"><Clock className="w-2.5 h-2.5 inline mr-0.5" /> Ended</span> : deal.discountPercent > 0 ? <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] sm:text-xs font-black px-2 py-1 rounded-lg">-{deal.discountPercent}%</span> : null}
        </div>
        <div className="p-3 sm:p-4 flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5 min-h-[20px] overflow-hidden">{deal.category && <span className="text-[8px] sm:text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[110px] sm:max-w-[150px]">{deal.category}</span>}{sourceBadge}</div>
          <h3 className={`text-xs sm:text-sm font-bold leading-snug line-clamp-2 min-h-[2.4rem] sm:min-h-[2.5rem] ${isExpired ? 'text-slate-600 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>{deal.title}</h3>
          <div className="mt-auto pt-2.5 flex items-end justify-between gap-1.5"><div className="min-w-0"><div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap"><span className={`text-base sm:text-lg font-black ${isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-[10px] sm:text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}</div>{!isExpired && savings > 0 && <div className="text-[9px] sm:text-[10px] font-bold text-emerald-700 mt-0.5">Save {formatPrice(savings)}</div>}</div><ArrowRight className={`w-4 h-4 shrink-0 mb-0.5 ${isExpired ? 'text-slate-300' : 'text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition'}`} /></div>
        </div>
      </Link>
      <div className="absolute top-2 right-2 z-10">{actionButtons}</div>
    </div>
  );
}
