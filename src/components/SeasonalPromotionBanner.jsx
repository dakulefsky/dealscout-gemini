import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bounties } from '@/lib/api';

export default function SeasonalPromotionBanner({ hasLiveDeals = false }) {
  const [promotion, setPromotion] = useState(null);

  useEffect(() => {
    let active = true;
    bounties.seasonalPromotion().then((result) => {
      if (active) setPromotion(result?.promotion || null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!promotion || !hasLiveDeals) return null;
  return <aside aria-label="Seasonal deal event" className="mb-7 border-y border-emerald-950/15 bg-[#f7f5ef] px-4 py-3 sm:px-5 sm:py-3.5">
    <div className="flex items-center gap-3">
      <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-900" />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-emerald-950">{promotion.title}</h2>
        <p className="mt-0.5 text-xs text-slate-600">{promotion.description}</p>
      </div>
      <Link to={promotion.href} className="inline-flex shrink-0 items-center gap-1 border-b border-emerald-900 pb-0.5 text-xs font-bold text-emerald-950 hover:text-emerald-700">Browse deals <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
    </div>
  </aside>;
}
