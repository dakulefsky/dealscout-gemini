import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DealCard from '@/components/DealCard';
import { ArrowLeft, ArrowRight, LayoutGrid, List, TrendingDown, ShieldCheck } from 'lucide-react';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';
import { rankDeals } from '@/lib/dealRanking';
import { categorySeoContent } from '@/lib/categorySeoContent';

const SORTS = [
  { key: 'best', label: 'Best deals' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];
const PAGE_SIZE = 24;

function serverSort(sort) {
  if (sort === 'discount') return 'discount_desc';
  if (sort === 'price-low') return 'price_asc';
  if (sort === 'price-high') return 'price_desc';
  return '-created_date';
}

function mergeDeals(current, incoming) {
  const seen = new Set(current.map((deal) => deal.id || deal.asin));
  return [...current, ...incoming.filter((deal) => {
    const id = deal.id || deal.asin;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('best');
  const [viewMode, setViewMode] = useState('grid');
  const sentinelRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDeals([]);
    setNextCursor(null);

    categoriesApi.list({ activeOnly: 0 })
      .then((cats) => {
        if (controller.signal.aborted) return null;
        setAllCategories(Array.isArray(cats) ? cats : []);
        const found = cats?.find((c) => c.slug === slug || c.name.toLowerCase() === slug?.toLowerCase());
        setCategory(found || null);
        if (!found) return null;
        return dealsApi.page({ category: found.name, sort: serverSort(sort), limit: PAGE_SIZE }, { signal: controller.signal });
      })
      .then((page) => {
        if (!page || controller.signal.aborted) return;
        setDeals(page.items || []);
        setNextCursor(page.nextCursor || null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load category deals');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [slug, sort]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loadingMore || typeof IntersectionObserver === 'undefined' || !category) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setLoadingMore(true);
      dealsApi.page({ category: category.name, sort: serverSort(sort), limit: PAGE_SIZE, cursor: nextCursor })
        .then((page) => {
          setDeals((current) => mergeDeals(current, page.items || []));
          setNextCursor(page.nextCursor || null);
        })
        .catch((err) => setError(err.message || 'Could not load more deals'))
        .finally(() => setLoadingMore(false));
    }, { rootMargin: '700px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [category, loadingMore, nextCursor, sort]);

  const visibleDeals = useMemo(() => {
    const list = [...deals];
    if (sort === 'best') return rankDeals(list);
    if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
    if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
    return list;
  }, [deals, sort]);

  const seoContent = useMemo(() => categorySeoContent(category?.slug || slug, category?.description), [category, slug]);
  const relatedCategories = useMemo(() => {
    const wanted = new Set(seoContent.related || []);
    return allCategories.filter((item) => wanted.has(item.slug)).slice(0, 3);
  }, [allCategories, seoContent]);

  return (
    <div className="ds-shell py-7 sm:py-10 pb-20">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-950 transition"><ArrowLeft className="h-3.5 w-3.5" /> All deals</Link>

      <header className="mt-6 border-y border-emerald-950/10 py-7 sm:py-10 grid lg:grid-cols-[1fr_auto] gap-6 lg:items-end">
        <div className="max-w-4xl">
          <div className="ds-kicker">Category edit</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-[0.98] text-emerald-950 mt-2">{category ? category.name : 'Category'} deals</h1>
          <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">{seoContent.intro}</p>
          {!loading && visibleDeals.length > 0 && <div className="mt-4 text-[11px] uppercase tracking-[0.12em] font-bold text-slate-400">{visibleDeals.length} verified deals loaded{nextCursor ? ' · more available' : ''}</div>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400" htmlFor="category-sort">Sort</label>
          <select id="category-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-semibold border border-emerald-950/15 px-3 bg-white text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="hidden sm:flex items-center border border-emerald-950/15">
            <button type="button" aria-label="Grid view" onClick={() => setViewMode('grid')} className={`p-2.5 ${viewMode === 'grid' ? 'bg-emerald-950 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="List view" onClick={() => setViewMode('list')} className={`p-2.5 border-l border-emerald-950/15 ${viewMode === 'list' ? 'bg-emerald-950 text-white' : 'text-slate-500'}`}><List className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </header>

      <main className="pt-7 sm:pt-9">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="border border-emerald-950/10 bg-white animate-pulse"><div className="aspect-[4/3] bg-stone-100" /><div className="p-4 space-y-3"><div className="h-3 bg-stone-100" /><div className="h-6 w-24 bg-stone-100" /></div></div>)}</div>
        ) : error && visibleDeals.length === 0 ? (
          <div className="text-center py-20 border-y border-emerald-950/10"><TrendingDown className="h-9 w-9 text-slate-300 mx-auto mb-3" /><h3 className="font-heading text-xl font-bold text-emerald-950">Couldn’t load this edit</h3><p className="text-sm text-slate-500 mt-1">{error}</p></div>
        ) : visibleDeals.length === 0 ? (
          <div className="text-center py-20 border-y border-emerald-950/10"><TrendingDown className="h-9 w-9 text-slate-300 mx-auto mb-3" /><h3 className="font-heading text-xl font-bold text-emerald-950">No active deals here right now</h3><p className="text-sm text-slate-500 mt-1">New verified finds will appear here as they land.</p></div>
        ) : (
          <>
            {viewMode === 'grid' ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr items-stretch">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div> : <div>{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>}
            <div ref={sentinelRef} className="h-10" aria-hidden="true" />
            {nextCursor ? <div className="text-center py-5 text-xs font-semibold text-slate-400">{loadingMore ? 'Loading more verified deals…' : 'More deals load as you scroll'}</div> : <div className="text-center py-8 mt-4 border-t border-emerald-950/10"><ShieldCheck className="w-4 h-4 mx-auto text-emerald-700" /><div className="mt-2 text-xs font-bold text-emerald-950">End of the current edit</div></div>}
            {error && <div role="status" className="text-center text-xs text-amber-700">Couldn’t load the next page. Scroll away and back to retry.</div>}
          </>
        )}
      </main>

      {category && (
        <section className="mt-14 border-t border-emerald-950/10 pt-8 grid lg:grid-cols-[1.35fr_0.65fr] gap-8 lg:gap-12" aria-label={`About ${category.name} deals`}>
          <div>
            <div className="ds-kicker">Deal guide</div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-emerald-950 mt-2">What makes a {category.name.toLowerCase()} deal worth showing</h2>
            <p className="text-sm leading-relaxed text-slate-600 mt-4 max-w-2xl">{seoContent.guidance}</p>
            <p className="text-[11px] leading-relaxed text-slate-400 mt-5 max-w-2xl">Deal prices and availability can change after our most recent check. Confirm the final price, variant, shipping and availability on Amazon before purchase.</p>
          </div>
          <div className="lg:border-l lg:border-emerald-950/10 lg:pl-8">
            <div className="ds-kicker">Keep browsing</div>
            <h2 className="font-heading text-xl font-bold text-emerald-950 mt-2">Related deal categories</h2>
            <div className="mt-4 border-t border-emerald-950/10">{relatedCategories.map((item) => <Link key={item.slug} to={`/category/${item.slug}`} className="flex items-center justify-between gap-3 border-b border-emerald-950/10 py-3 text-sm font-bold text-slate-800 hover:text-emerald-800 transition"><span>{item.name} deals</span><ArrowRight className="w-4 h-4" /></Link>)}</div>
          </div>
        </section>
      )}
    </div>
  );
}
