import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DealCard from '@/components/DealCard';
import { ArrowLeft, ArrowRight, LayoutGrid, List, TrendingDown } from 'lucide-react';
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

    categoriesApi.list()
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
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"><ArrowLeft className="h-4 w-4" /> Back to deals</Link>

      <section className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-1.5">Category</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-950">{category ? `${category.name} Deals & Price Drops` : 'Category Deals'}</h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl leading-relaxed">{seoContent.intro}</p>
          {!loading && visibleDeals.length > 0 && <p className="text-xs text-slate-400 mt-2">{visibleDeals.length} current deals loaded{nextCursor ? ' — more available' : ''}</p>}
        </div>

        <div className="flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-bold border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 focus:outline-none">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button type="button" aria-label="Grid view" onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button type="button" aria-label="List view" onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"><div className="aspect-[4/3] bg-slate-100" /><div className="p-3 sm:p-4 space-y-3"><div className="h-4 bg-slate-100 rounded" /><div className="h-6 w-24 bg-slate-100 rounded" /></div></div>)}</div>
      ) : error && visibleDeals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-10 max-w-md mx-auto"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto mb-3" /><h3 className="text-base font-bold text-slate-900">Couldn’t load this category</h3><p className="text-sm text-slate-500 mt-1">{error}</p></div>
      ) : visibleDeals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-10 max-w-md mx-auto"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto mb-3" /><h3 className="text-base font-bold text-slate-900">No active deals here right now</h3><p className="text-sm text-slate-500 mt-1">This category stays here. Check back as newly verified price drops arrive.</p></div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 auto-rows-fr items-stretch">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div>
          ) : (
            <div className="space-y-3.5">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>
          )}
          <div ref={sentinelRef} className="h-10" aria-hidden="true" />
          {nextCursor ? <div className="text-center py-4 text-xs font-semibold text-slate-400">{loadingMore ? 'Loading more verified deals…' : 'More deals load as you scroll'}</div> : <div className="text-center py-5 text-xs font-semibold text-slate-400">You’ve reached the end of the current deals in this category.</div>}
          {error && <div role="status" className="text-center text-xs text-amber-700">Couldn’t load the next page. Scroll away and back to retry.</div>}
        </>
      )}

      {category && (
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-4 pt-2" aria-label={`About ${category.name} deals`}>
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Deal guide</div>
            <h2 className="text-xl font-black text-slate-950 mt-2">How DealScout evaluates {category.name.toLowerCase()} deals</h2>
            <p className="text-sm leading-relaxed text-slate-600 mt-3">{seoContent.guidance}</p>
            <p className="text-xs leading-relaxed text-slate-400 mt-4">Deal prices and availability can change after our most recent check. DealScout links you to Amazon to confirm the final price, variant, shipping, and availability before purchase.</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Keep browsing</div>
            <h2 className="text-lg font-black text-slate-950 mt-2">Related deal categories</h2>
            <div className="mt-4 space-y-2">
              {relatedCategories.map((item) => (
                <Link key={item.slug} to={`/category/${item.slug}`} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:border-emerald-300 hover:text-emerald-700 transition">
                  <span>{item.name} deals</span><ArrowRight className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
