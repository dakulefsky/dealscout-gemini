import { useEffect, useState } from 'react';
import { ArrowRight, BadgePercent, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bounties } from '@/lib/api';

const CAMPAIGN_STYLES = {
  'prime-day': {
    panel: 'border-sky-200 bg-[#edf5fa]',
    accent: 'border-l-sky-700',
    icon: 'border-sky-200 bg-white text-sky-800',
    eyebrow: 'Amazon event',
    title: 'text-slate-950',
    button: 'bg-sky-800 text-white hover:bg-sky-900',
  },
  'black-friday-cyber-monday': {
    panel: 'border-slate-700 bg-slate-950 text-white',
    accent: 'border-l-amber-400',
    icon: 'border-slate-700 bg-slate-900 text-amber-300',
    eyebrow: 'Seasonal sale',
    title: 'text-white',
    button: 'bg-amber-300 text-slate-950 hover:bg-amber-200',
  },
  'thanksgiving-day-sale': {
    panel: 'border-amber-200 bg-[#fbf3e5]',
    accent: 'border-l-amber-700',
    icon: 'border-amber-200 bg-white text-amber-800',
    eyebrow: 'Seasonal sale',
    title: 'text-slate-950',
    button: 'bg-amber-800 text-white hover:bg-amber-900',
  },
  'halloween-day-sale': {
    panel: 'border-orange-200 bg-[#fff5ec]',
    accent: 'border-l-orange-700',
    icon: 'border-orange-200 bg-white text-orange-800',
    eyebrow: 'Seasonal sale',
    title: 'text-slate-950',
    button: 'bg-orange-800 text-white hover:bg-orange-900',
  },
  'christmas-day-sale': {
    panel: 'border-sky-200 bg-[#eff5f7]',
    accent: 'border-l-emerald-800',
    icon: 'border-sky-200 bg-white text-sky-800',
    eyebrow: 'Winter sale',
    title: 'text-slate-950',
    button: 'bg-emerald-900 text-white hover:bg-emerald-950',
  },
};

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

  const style = CAMPAIGN_STYLES[promotion.id] || CAMPAIGN_STYLES['prime-day'];
  return (
    <aside aria-label={`${promotion.title} promotion`} className={`mb-7 border border-l-[6px] px-4 py-4 sm:px-6 sm:py-5 ${style.panel} ${style.accent}`}>
      <div className="flex items-center gap-4 sm:gap-5">
        <span aria-hidden="true" className={`hidden h-14 w-14 shrink-0 items-center justify-center border sm:flex ${style.icon}`}>
          <BadgePercent className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 sm:hidden" />
            <span>{style.eyebrow}</span>
          </div>
          <h2 className={`font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${style.title}`}>{promotion.title}</h2>
          <p className={`mt-1 text-sm ${promotion.id === 'black-friday-cyber-monday' ? 'text-slate-300' : 'text-slate-600'}`}>{promotion.description}</p>
        </div>
        <Link to={promotion.href || '/?category=all'} className={`inline-flex shrink-0 items-center gap-2 px-4 py-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${style.button}`}>
          <span className="hidden sm:inline">Shop deals</span><span className="sm:hidden">Shop</span><ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}
