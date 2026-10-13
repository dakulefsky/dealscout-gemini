import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActiveCategories } from '@/lib/useActiveCategories';
import content from '../../shared/followContent.json';
const origin = 'https://dealscouted.com';

export default function FollowDeals() {
  const categories = useActiveCategories();
  useEffect(() => { document.title = `${content.title} — DealScout`; }, []);
  const feeds = [{ name: 'All departments', url: `${origin}/feed.xml` }, ...categories.map(category => ({ name: category.name, url: `${origin}/feed.xml?category=${encodeURIComponent(category.slug)}` }))];
  return <main className="ds-shell py-10 sm:py-14">
    <h1 className="text-3xl font-bold text-slate-900">{content.title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">{content.intro}</p>
    <section className="mt-9 max-w-3xl"><h2 className="text-xl font-semibold text-slate-900">{content.feedTitle}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{content.feedDescription}</p>
      <ul className="mt-5 divide-y divide-slate-200">{feeds.map(feed => <li key={feed.url} className="py-4"><a href={feed.url} className="text-sm font-semibold text-emerald-900 underline">{feed.name} RSS feed</a><input readOnly aria-label={`${feed.name} feed URL`} value={feed.url} onFocus={event => event.target.select()} className="mt-2 block w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" /></li>)}</ul>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{content.priceNote}</p>
    </section>
    <section className="mt-10 max-w-3xl border-t border-slate-200 pt-7"><h2 className="text-xl font-semibold text-slate-900">{content.savedTitle}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{content.savedDescription}</p><Link to="/saved" className="mt-4 inline-block text-sm font-semibold text-emerald-900 underline">Open Saved Deals</Link></section>
  </main>;
}
