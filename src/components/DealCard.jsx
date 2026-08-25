import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { TrendingDown, ShieldAlert, Star } from 'lucide-react';

export function formatPrice(price) {
  if (price == null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export default function DealCard({ deal }) {
  return (
    <Link
      to={`/deal/${deal.id}`}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col"
    >
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        <Image
          src={deal.imageUrl}
          fittingType="fill"
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          alt={deal.title}
        />
        {deal.discountPercent > 0 && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            <TrendingDown className="h-3 w-3" /> {deal.discountPercent}%
          </span>
        )}
        {!deal.sourceSufficient && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full border border-amber-200">
            <ShieldAlert className="h-3 w-3" /> Limited data
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3 sm:p-4">
        {deal.category && (
          <span className="text-[11px] uppercase tracking-wide font-semibold text-emerald-600 mb-1">
            {deal.category}
          </span>
        )}
        <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 flex-1">
          {deal.title}
        </h3>

        {deal.rating != null && (
          <div className="flex items-center gap-1 mt-1.5">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-slate-600 font-medium">{deal.rating.toFixed(1)}</span>
            {deal.ratingsTotal > 0 && (
              <span className="text-xs text-slate-400">({deal.ratingsTotal.toLocaleString()})</span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-base font-bold text-emerald-700">{formatPrice(deal.salePrice)}</span>
          {deal.originalPrice > deal.salePrice && (
            <span className="text-xs text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>
          )}
        </div>

        {deal.shortBio && (
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">{deal.shortBio}</p>
        )}
      </div>
    </Link>
  );
}
