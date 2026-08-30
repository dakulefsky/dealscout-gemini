import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, Heart, ArrowRight, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useBookmarks } from '@/lib/BookmarksContext';
import { verificationFreshness } from '@/lib/verificationFreshness';
import { addCategoryInterest, dwellWeight } from '@/lib/feedPersonalization';

export function formatPrice(price) {
  if (price == null || isNaN(price)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export default function DealCard({ deal, viewMode = 'grid' }) {
  const { isSaved, toggleBookmark } = useBookmarks();
  const dealId = deal.id || deal.asin;
  const saved = isSaved(dealId);
  const isExpired = Boolean(deal.isExpired || deal.status === 'EXPIRED');
  const hoursLeft = deal.expiresInHours ? Math.max(1, Math.ceil(deal.expiresInHours)) : null;
  const freshness = verificationFreshness(deal.priceCheckAt);
  const savings = Math.max(0, Number(deal.originalPrice || 0) - Number(deal.salePrice || 0));
  const viewedAt = useRef(null);

  function handleBookmarkClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!saved) addCategoryInterest(deal.category, 4);
    toggleBookmark(deal);
  }

  function handleViewStart() { viewedAt.current = Date.now(); }
  function handleViewEnd() {
    if (!viewedAt.current) return;
    const weight = dwellWeight(Date.now() - viewedAt.current);
    viewedAt.current = null;
    if (weight) addCategoryInterest(deal.category, weight);
  }
  function handleDealClick() { addCategoryInterest(deal.category, 2); }

  const sourceBadge = !isExpired && deal.sourceVerified ? (
    <span title={freshness.label} className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md whitespace-nowrap ${freshness.stale ? 'text-amber-800 bg-amber-100' : 'text-slate-600 bg-slate-100'}`}>
      <ShieldCheck className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${freshness.stale ? 'text-amber-600' : 'text-emerald-600'}`} />
      <span className="hidden sm:inline">{freshness.ageSeconds === null ? 'Price verified' : freshness.label.replace('Price checked ', '')}</span>
      <span className="sm:hidden">{freshness.stale ? 'Check price' : 'Checked'}</span>
    </span>
  ) : null;

  const linkSignals = { onMouseEnter: handleViewStart, onMouseLeave: handleViewEnd, onFocus: handleViewStart, onBlur: handleViewEnd, onClick: handleDealClick };

  if (viewMode === 'list') {
    return (
      <Link to={`/deal/${dealId}`} {...linkSignals} className={`group rounded-2xl border p-3 sm:p-4 transition-all flex gap-3 sm:gap-4 items-center relative w-full ${isExpired ? 'bg-slate-50/80 border-dashed border-slate-300 opacity-75' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
        <div className={`relative w-24 h-24 sm:w-32 sm:h-28 rounded-xl overflow-hidden shrink-0 p-2 sm:p-3 border ${isExpired ? 'bg-slate-100 border-slate-200 grayscale-[0.85]' : 'bg-slate-50 border-slate-100'}`}>
          <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-105 transition-transform duration-200" />
          {isExpired ? <span className="absolute top-1.5 left-1.5 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded"><Clock className="w-2.5 h-2.5 inline mr-0.5" /> Ended</span> : deal.discountPercent > 0 ? <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">-{deal.discountPercent}%</span> : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">{!isExpired && deal.category && <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[150px]">{deal.category}</span>}{isExpired && <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded"><AlertCircle className="w-2.5 h-2.5 inline" /> {hoursLeft ? `Deletes in ${hoursLeft}h` : 'Ended'}</span>}{sourceBadge}</div>
          <h3 className={`text-sm sm:text-base font-bold leading-snug line-clamp-2 ${isExpired ? 'text-slate-600 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>{deal.title}</h3>
          <div className="flex items-baseline gap-2 mt-2"><span className={`text-lg sm:text-xl font-black ${isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}{!isExpired && savings > 0 && <span className="hidden sm:inline text-[10px] font-bold text-emerald-700">Save {formatPrice(savings)}</span>}</div>
        </div>
        <button type="button" onClick={handleBookmarkClick} title={saved ? 'Remove from Saved' : 'Save Deal'} className={`absolute right-3 top-3 sm:static w-8 h-8 rounded-full flex items-center justify-center transition border shrink-0 ${saved ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 hover:text-rose-600 border-slate-200'}`}><Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} /></button>
      </Link>
    );
  }

  return (
    <Link to={`/deal/${dealId}`} {...linkSignals} className={`group rounded-xl sm:rounded-2xl border overflow-hidden transition-all flex flex-col h-full w-full relative ${isExpired ? 'bg-slate-50/90 border-dashed border-slate-300 opacity-75' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
      <div className={`relative aspect-[4/3] w-full overflow-hidden p-2.5 sm:p-4 border-b ${isExpired ? 'bg-slate-100 border-slate-200 grayscale-[0.85]' : 'bg-slate-50/70 border-slate-100'}`}>
        <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-105 transition-transform duration-300" />
        {isExpired ? <span className="absolute top-2 left-2 bg-slate-800 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md"><Clock className="w-2.5 h-2.5 inline mr-1 text-amber-400" /> Ended</span> : deal.discountPercent > 0 ? <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-md"><TrendingDown className="w-3 h-3 hidden sm:block" /> {deal.discountPercent}% OFF</span> : null}
        <button type="button" onClick={handleBookmarkClick} title={saved ? 'Remove from Saved' : 'Save Deal'} className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition shadow-xs border z-10 ${saved ? 'bg-rose-600 text-white border-rose-600' : 'bg-white/95 text-slate-600 hover:text-rose-600 border-slate-200'}`}><Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} /></button>
      </div>
      <div className="p-2.5 sm:p-4 flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-1.5 min-w-0 mb-2">{isExpired ? <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded truncate">{hoursLeft ? `Deletes in ${hoursLeft}h` : 'Ended'}</span> : <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[95px] sm:max-w-[130px]">{deal.category || 'Deal'}</span>}{sourceBadge}</div>
        <h3 className={`text-[12px] sm:text-sm font-bold leading-snug line-clamp-2 min-h-[2.1rem] sm:min-h-[2.625rem] ${isExpired ? 'text-slate-600 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>{deal.title}</h3>
        <div className="mt-auto pt-2.5 sm:pt-3 border-t border-slate-100 flex items-end justify-between gap-1.5 min-w-0"><div className="min-w-0"><div className="flex items-baseline gap-1 min-w-0"><span className={`text-base sm:text-lg font-black truncate ${isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-[10px] sm:text-xs text-slate-400 line-through truncate">{formatPrice(deal.originalPrice)}</span>}</div>{!isExpired && savings > 0 && <div className="text-[9px] sm:text-[10px] font-semibold text-emerald-700 mt-0.5">Save {formatPrice(savings)}</div>}</div><span className="hidden sm:inline-flex text-xs font-bold items-center gap-1 shrink-0 text-slate-500 group-hover:text-emerald-600">View <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></span></div>
      </div>
    </Link>
  );
}
