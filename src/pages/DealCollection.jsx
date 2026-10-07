import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import collections from '../../shared/dealCollections.json';
import { deals as dealsApi } from '@/lib/api';
import DealCard from '@/components/DealCard';

export default function DealCollection() {
  const { slug } = useParams();
  const collection = collections.find((item) => item.slug === slug);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const active = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setItems([]); setCursor(null); setLoading(true); setError(false);
    if (!collection) { setLoading(false); return () => controller.abort(); }
    document.title = `${collection.name} — DealScout`;
    dealsApi.page({ ...collection.filters, sort: 'best', limit: 24 }, { signal: controller.signal })
      .then((page) => { if (!controller.signal.aborted) { setItems(page.items || []); setCursor(page.nextCursor); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); active.current?.abort(); };
  }, [collection, retry]);
  async function loadMore() {
    if (loading || !cursor) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setError(false);
    try {
      const page = await dealsApi.page({ ...collection.filters, sort: 'best', limit: 24, cursor }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setItems((current) => {
        const seen = new Set(current.map((d) => d.id || d.asin));
        return [...current, ...(page.items || []).filter((d) => !seen.has(d.id || d.asin))];
      });
      setCursor(page.nextCursor);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  if (!collection) return <div className="ds-shell py-12"><h1>Collection not found</h1><Link to="/">Browse current deals</Link></div>;
  return <div className="ds-shell py-8 sm:py-12">
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500"><Link to="/" className="underline">Home</Link> / {collection.shortName}</nav>
    <header className="max-w-3xl mt-6 mb-8"><h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{collection.name}</h1><p className="mt-3 text-sm text-slate-600 leading-relaxed">{collection.description}</p></header>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} />)}</div>
    {loading && <p role="status" className="py-8 text-sm text-slate-500">Loading deals…</p>}
    {error && <div role="status" className="py-8 text-sm">Couldn’t load deals. <button type="button" className="underline" onClick={() => items.length ? loadMore() : setRetry((v) => v + 1)}>Try again</button></div>}
    {!loading && !error && !items.length && <p className="py-8 text-sm text-slate-600">No current deals match this collection. <Link to="/" className="underline">Browse other departments</Link>.</p>}
    {cursor && !loading && <button type="button" onClick={loadMore} className="mt-8 border border-slate-300 rounded-md px-5 py-3 font-semibold text-sm">Show more deals</button>}
    <section className="mt-10 border-t border-slate-200 pt-6"><h2 className="font-semibold">Before you buy</h2><p className="mt-2 text-sm text-slate-600 max-w-3xl">{collection.guidance}</p><Link to="/how-we-find-deals" className="mt-3 inline-block text-sm underline">How DealScout selects deals</Link></section>
    <nav aria-label="More deal collections" className="mt-8 flex flex-wrap gap-4 text-sm">{collections.filter((c) => c.slug !== slug).map((c) => <Link key={c.slug} to={`/deals/${c.slug}`} className="underline">{c.shortName}</Link>)}<Link to="/" className="underline">All departments</Link></nav>
  </div>;
}
