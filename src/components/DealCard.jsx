import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, Heart, ImageOff, ArrowRight, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { useBookmarks } from '@/lib/BookmarksContext';
import { verificationFreshness } from '@/lib/verificationFreshness';

export function formatPrice(price) {
  if (price == null || isNaN(price)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export default function DealCard({ deal, viewMode = 'grid' }) {
  const { isSaved, toggleBookmark } = useBookmarks();
  const [imgError, setImgError] = useState(false);

  const dealId = deal.id || deal.asin;
  const saved = isSaved(dealId);
  const isExpired = Boolean(deal.isExpired || deal.status === 'EXPIRED');
  const hoursLeft = deal.expiresInHours ? Math.max(1, Math.ceil(deal.expiresInHours)) : null;
  const freshness = verificationFreshness(deal.priceCheckAt);

  const handleBookmarkClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark(deal);
  };

  const sourceBadge = !isExpired && deal.sourceVerified ? (
    <span title={freshness.label} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${freshness.stale ? 'text-amber-800 bg-amber-100' : 'text-slate-600 bg-slate-100'}`}>
      <ShieldCheck className={`w-3 h-3 ${freshness.stale ? 'text-amber-600' : 'text-emerald-600'}`} />
      {freshness.ageSeconds === null ? 'Price verified' : freshness.label.replace('Price checked ', '')}
    </span>
  ) : null;

  if (viewMode === 'list') {
    return (
      <Link
        to={`/deal/${deal.id || deal.asin}`}
        className={`group rounded-2xl border p-4 transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center relative w-full ${
          isExpired
            ? 'bg-slate-50/80 border-dashed border-slate-300 opacity-70 hover:opacity-100 hover:bg-white hover:border-slate-400'
            : 'bg-white border-slate-200/90 hover:shadow-md hover:border-slate-300'
        }`}
      >
        <div className={`relative w-full sm:w-32 h-36 sm:h-32 rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-3 border ${
          isExpired ? 'bg-slate-100/80 border-slate-200 grayscale-[0.85]' : 'bg-slate-50 border-slate-100'
        }`}>
          {!imgError && deal.imageUrl ? (
            <img src={deal.imageUrl} alt={deal.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgError(true)} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-slate-300"><ImageOff className="w-8 h-8" /></div>
          )}
          {isExpired ? (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-slate-800 text-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs"><Clock className="w-3 h-3 text-amber-400" /> Ended</span>
          ) : deal.discountPercent > 0 ? (
            <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">-{deal.discountPercent}%</span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            {isExpired ? (
              <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Deal Ended {hoursLeft ? `• Auto-deletes in ${hoursLeft}h` : ''}</span>
            ) : deal.category ? (
              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{deal.category}</span>
            ) : null}
            {sourceBadge}
          </div>
          <h3 className={`text-sm sm:text-base font-semibold transition leading-snug line-clamp-2 ${isExpired ? 'text-slate-600 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>{deal.title}</h3>
          {deal.shortBio && <p className="text-xs text-slate-500 line-clamp-1 leading-normal">{deal.shortBio}</p>}
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0 gap-3">
          <div className="text-left sm:text-right min-w-0">
            <div className={`text-lg font-black ${isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</div>
            {deal.originalPrice > deal.salePrice && <div className="text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</div>}
          </div>
          <button type="button" onClick={handleBookmarkClick} title={saved ? 'Remove' : 'Save'} className={`w-8 h-8 rounded-lg flex items-center justify-center transition border ${saved ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200'}`}>
            <Heart className={`w-4 h-4 ${saved ? 'fill-rose-600' : ''}`} />
          </button>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/deal/${deal.id || deal.asin}`}
      className={`group rounded-2xl border overflow-hidden transition-all flex flex-col h-full w-full relative ${
        isExpired
          ? 'bg-slate-50/90 border-dashed border-slate-300 opacity-75 hover:opacity-100 hover:bg-white hover:border-slate-400 hover:shadow-sm'
          : 'bg-white border-slate-200/90 hover:shadow-md hover:border-slate-300'
      }`}
    >
      <div className={`relative aspect-square w-full overflow-hidden flex items-center justify-center p-4 border-b shrink-0 ${isExpired ? 'bg-slate-100/70 border-slate-200 grayscale-[0.85]' : 'bg-slate-50/70 border-slate-100'}`}>
        {!imgError && deal.imageUrl ? (
          <img src={deal.imageUrl} alt={deal.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgError(true)} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-slate-300"><ImageOff className="w-10 h-10" /></div>
        )}

        {isExpired ? (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-slate-800 text-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs pointer-events-none"><Clock className="w-3 h-3 text-amber-400" /> Deal Ended</span>
        ) : deal.discountPercent > 0 ? (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs pointer-events-none"><TrendingDown className="h-3 w-3" /> {deal.discountPercent}% OFF</span>
        ) : null}

        <button type="button" onClick={handleBookmarkClick} title={saved ? 'Remove from Saved' : 'Save Deal'} className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition shadow-xs border z-10 ${saved ? 'bg-rose-600 text-white border-rose-600' : 'bg-white/90 hover:bg-white text-slate-600 hover:text-rose-600 border-slate-200'}`}>
          <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3 min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs min-w-0">
            {isExpired ? (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded flex items-center gap-1 truncate max-w-[150px]"><AlertCircle className="w-2.5 h-2.5" /> {hoursLeft ? `Deletes in ${hoursLeft}h` : 'Ended'}</span>
            ) : (
              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded truncate max-w-[130px]">{deal.category || 'Deal'}</span>
            )}
            {sourceBadge}
          </div>
          <h3 className={`text-sm font-bold transition leading-snug line-clamp-2 h-[2.625rem] overflow-hidden ${isExpired ? 'text-slate-600 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>{deal.title}</h3>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0 truncate">
            <span className={`text-lg font-black ${isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>{formatPrice(deal.salePrice)}</span>
            {deal.originalPrice > deal.salePrice && <span className="text-xs text-slate-400 line-through truncate">{formatPrice(deal.originalPrice)}</span>}
          </div>
          <span className={`text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors ml-2 ${isExpired ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-500 group-hover:text-emerald-600'}`}>
            <span>{isExpired ? 'Ended' : 'View Deal'}</span><ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}
