import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import guide from '../../shared/buyingGuide.json';
import { freshInitialFeed } from '../../shared/shoppingTools.mjs';
import { deals as dealsApi } from '@/lib/api';
import DealCard from '@/components/DealCard';
import DeliveredCostComparison from '@/components/DeliveredCostComparison';
import { readServerBootstrap } from '@/lib/serverBootstrap';
function bootstrap() {
  return freshInitialFeed(readServerBootstrap('initial-guide-deals'), { sort: 'best' }).items;
}
export default function BuyingGuide() {
  const [items, setItems] = useState(bootstrap);
  const [feedUnavailable, setFeedUnavailable] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    document.title = `${guide.title} — DealScout`;
    const controller = new AbortController();
    dealsApi.page({ sort: 'best', limit: 6 }, { signal: controller.signal })
      .then(page => { if (!controller.signal.aborted) setItems(page.items || []); })
      .catch(() => { if (!controller.signal.aborted) setFeedUnavailable(true); });
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  const current = freshInitialFeed({ items }, { sort: 'best' }, now).items;
  return <article className="ds-shell py-10 sm:py-14">
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500"><Link to="/" className="underline">Departments</Link> / Buying guide</nav>
    <header className="max-w-3xl mt-6"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">DealScout buying guides</p><h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{guide.title}</h1><p className="mt-5 text-slate-600 leading-relaxed">{guide.intro}</p><p className="mt-3 text-xs text-slate-500 leading-relaxed">{guide.disclosure}</p><a href="#compare-offers" className="inline-block mt-5 text-sm font-semibold underline text-emerald-900">Compare two offers with the calculator</a></header>
    <div className="max-w-3xl">{guide.sections.map((section, index) => <div key={section.id}><section id={section.id} className="mt-9 scroll-mt-24"><h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>{section.paragraphs.map(p => <p key={p} className="mt-3 text-sm text-slate-600 leading-relaxed">{p}</p>)}</section>{index === 3 && <DeliveredCostComparison />}</div>)}
      <section className="mt-10 border-t border-slate-200 pt-6"><h2 className="text-lg font-semibold">Sources and pricing policy</h2><ul className="mt-3 space-y-2 text-sm">{guide.sources.map(source => <li key={source.url}>{source.url.startsWith('/') ? <Link to={source.url} className="underline">{source.label}</Link> : <a href={source.url} rel="nofollow noopener" className="underline">{source.label}</a>}</li>)}</ul><p className="mt-4 text-xs text-slate-500">As an Amazon Associate we earn from qualifying purchases.</p></section>
    </div>
    <section className="mt-12 border-t border-slate-200 pt-8"><h2 className="text-xl font-semibold">Current verified offers</h2><p className="mt-2 text-sm text-slate-600">Use the checklist above to compare an offer that fits what you need. Check the deal page’s price-check time and confirm the final terms on Amazon.</p><div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">{current.map(deal => <DealCard key={deal.id || deal.asin} deal={deal} />)}</div>{!current.length && <p className="mt-4 text-sm text-slate-500">{feedUnavailable ? 'Current offers are temporarily unavailable.' : 'No current offers to show here.'} <Link to="/" className="underline">Browse departments</Link>.</p>}</section>
  </article>;
}
