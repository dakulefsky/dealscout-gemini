import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { bounties } from '@/lib/api';

export default function Memberships() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bounties.list().then((result) => {
      if (active) setPrograms(result?.programs || []);
    }).catch(() => {}).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="ds-shell py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-950"><ArrowLeft className="h-4 w-4" /> Back to deals</Link>
      <header className="mt-8 border-b-2 border-emerald-950 pb-7 max-w-3xl">
        
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950 mt-2">Amazon memberships</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-4 leading-relaxed">Explore Amazon’s shopping, watching, listening, and reading memberships. Check current offers and eligibility on Amazon before signing up.</p>
      </header>

      {programs.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4 mt-8 max-w-5xl">
          {programs.map((program) => (
            <a key={program.id} href={program.url} target="_blank" rel="noopener sponsored" className="group bg-white border border-emerald-950/15 p-6 sm:p-7 hover:border-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900 transition-colors">
              <div className="flex items-center justify-between gap-4 border-b border-emerald-950/15 pb-4">
                <span className="ds-kicker">Amazon subscription</span>
                <ArrowUpRight className="h-5 w-5 text-emerald-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-emerald-950 mt-5">{program.name}</h2>
              <p className="text-sm text-slate-600 leading-relaxed mt-2">{program.description}</p>
              <span className="inline-block mt-6 text-xs font-black uppercase tracking-wider text-emerald-900">View on Amazon</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-600" role="status">{loading ? 'Loading memberships…' : 'Membership links are temporarily unavailable.'}</p>
      )}

      <div className="max-w-5xl border-t border-emerald-950/15 mt-9 pt-5 text-xs text-slate-600 leading-relaxed">
        <p>As an Amazon Associate I earn from qualifying purchases. DealScout may earn from eligible memberships or sign-ups through these links. Availability, trials, pricing, and terms are determined on Amazon. <Link to="/disclosure" className="underline underline-offset-2 hover:text-emerald-950">Affiliate disclosure</Link></p>
      </div>
    </div>
  );
}
