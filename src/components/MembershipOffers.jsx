import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { bounties } from '@/lib/api';

export default function MembershipOffers() {
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    let active = true;
    bounties.list().then((result) => {
      if (active) setPrograms(result?.programs || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!programs.length) return null;

  return <aside aria-label="Amazon memberships and subscriptions" className="mt-10 border-t border-slate-200 pt-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0"><h2 className="text-sm font-semibold text-slate-800">Also from Amazon</h2><p className="mt-1 text-xs text-slate-500">Memberships and subscriptions</p></div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {programs.map((program) => <a key={program.id} href={program.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-emerald-900">{program.name}<ArrowUpRight aria-hidden="true" className="w-3 h-3" /></a>)}
      </div>
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Offers, eligibility, and terms are set by Amazon. As an Amazon Associate, DealScout may earn from qualifying sign-ups.</p>
  </aside>;
}
