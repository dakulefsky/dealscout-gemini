import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingDown, Search, LayoutGrid, List, RotateCcw, ShieldCheck, Star, SlidersHorizontal, Flame, Sparkles } from 'lucide-react';
import DealCard from '@/components/DealCard';
import { deals as dealsApi, categories as categoriesApi, editorial as editorialApi } from '@/lib/api';
import { rankDeals } from '@/lib/dealRanking';
import { loadInterests, personalizedRank, STORAGE_KEY, INTERESTS_CHANGED_EVENT } from '@/lib/feedPersonalization';
import { loadDismissedDeals, DISMISSALS_CHANGED_EVENT } from '@/lib/feedDismissals';
import { loadPreviousVisit, checkpointVisit, dealCreatedTimestampMs, dealFreshnessTimestampMs } from '@/lib/feedReturnLoop';
import { INITIAL_FEED_SIZE, nextVisibleCount } from '@/lib/progressiveFeed';
import { loadSeenDealDrop, markDealDropSeen, freshDealDrop } from '@/lib/dealDropFreshness';
import { buildFeedChapters, chapterDealIds } from '@/lib/feedChapters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SORTS = [
  { key: 'best', label: 'Best for you' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];
const DISCOUNT_TIERS = [{ value: 0, label: 'Any discount' }, { value: 15, label: '15%+ off' }, { value: 25, label: '25%+ off' }, { value: 30, label: '30%+ off' }, { value: 50, label: '50%+ off' }];
const PRICE_TIERS = [{ value: 'all', label: 'Any price' }, { value: 'under-50', label: 'Under $50', max: 50 }, { value: '50-150', label: '$50–$150', min: 50, max: 150 }, { value: '150-300', label: '$150–$300', min: 150, max: 300 }, { value: 'over-300', label: '$300+', min: 300 }];
const CHAPTER_INTERVAL = 8;
const REMOTE_PAGE_SIZE = 24;

function dealIdentity(deal) {
  return String(deal?.id || deal?.asin || '').trim();
}

function balancedFeatured(items, maxItems = 8) {
  const bounded = (items || []).slice(0, maxItems);
  const evenLength = bounded.length - (bounded.length % 2);
  return evenLength >= 2 ? bounded.slice(0, evenLength) : [];
}

function mergeDeals(current, incoming) {
  const seen = new Set(current.map(dealIdentity));
  return [...current, ...incoming.filter((deal) => {
    const id = dealIdentity(deal);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

function serverSort(sort) {
  if (sort === 'discount') return 'discount_desc';
  if (sort === 'price-low') return 'price_asc';
  if (sort === 'price-high') return 'price_desc';
  return '-created_date';
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]); const [categories, setCategories] = useState([]); const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [activeCat, setActiveCat] = useState(searchParams.get('category') || 'all'); const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('best'); const [minDiscount, setMinDiscount] = useState(0); const [priceTier, setPriceTier] = useState('all'); const [viewMode, setViewMode] = useState('grid'); const [showFilters, setShowFilters] = useState(false);
  const [interests, setInterests] = useState(() => loadInterests());
  const [dismissals, setDismissals] = useState(() => loadDismissedDeals());
  const [visibleCount, setVisibleCount] = useState(INITIAL_FEED_SIZE);
  const [initialSeenDrop] = useState(() => loadSeenDealDrop());
  const [lastVisit] = useState(() => loadPreviousVisit());
  const feedSentinel = useRef(null);
  const dropSeenMarker = useRef(null);
  const dealDropMarked = useRef(false);

  const selectedPriceTier = useMemo(() => PRICE_TIERS.find((p) => p.value === priceTier) || PRICE_TIERS[0], [priceTier]);
  const feedParams = useMemo(() => ({
    limit: REMOTE_PAGE_SIZE,
    sort: serverSort(sort),
    category: activeCat === 'all' ? '' : activeCat,
    q: searchQuery.trim(),
    minDiscount: minDiscount || '',
    minPrice: selectedPriceTier.min ?? '',
    maxPrice: selectedPriceTier.max ?? '',
  }), [activeCat, searchQuery, minDiscount, selectedPriceTier, sort]);

  useEffect(() => { const q = searchParams.get('q'); if (q !== null) setSearchQuery(q); const c = searchParams.get('category'); if (c !== null) setActiveCat(c); }, [searchParams]);
  useEffect(() => {
    Promise.all([categoriesApi.list(), editorialApi.picks(4).catch(() => ({ picks: [] }))])
      .then(([c, p]) => { setCategories(c || []); setPicks(p?.picks || []); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      setDeals([]);
      setNextCursor(null);
      setVisibleCount(INITIAL_FEED_SIZE);
      dealsApi.page(feedParams, { signal: controller.signal })
        .then((page) => { setDeals(page?.items || []); setNextCursor(page?.nextCursor || null); })
        .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, searchQuery.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [feedParams, searchQuery]);
  useEffect(() => {
    const saveCheckpoint = () => checkpointVisit();
    window.addEventListener('pagehide', saveCheckpoint);
    return () => window.removeEventListener('pagehide', saveCheckpoint);
  }, []);
  useEffect(() => {
    const refresh = () => setInterests(loadInterests());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(INTERESTS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(INTERESTS_CHANGED_EVENT, refresh);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setDismissals(loadDismissedDeals());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(DISMISSALS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(DISMISSALS_CHANGED_EVENT, refresh);
    };
  }, []);

  const availableDeals = useMemo(() => deals.filter((deal) => !dismissals[dealIdentity(deal)]), [deals, dismissals]);
  const visibleDeals = useMemo(() => {
    const list = [...availableDeals];
    if (sort === 'best') return personalizedRank(rankDeals(list), interests);
    if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
    if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
    return list.sort((a, b) => dealCreatedTimestampMs(b) - dealCreatedTimestampMs(a));
  }, [availableDeals, sort, interests]);

  const filteredPicks = useMemo(() => balancedFeatured(picks.filter((pick) => !dismissals[dealIdentity(pick.deal) || String(pick.asin || '')]), 4), [picks, dismissals]);
  const flatAllMode = activeCat === 'all' && searchParams.get('category') === 'all' && searchQuery.trim() === '' && minDiscount === 0 && priceTier === 'all' && sort === 'best';
  const hasActiveFilters = activeCat !== 'all' || searchQuery.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'best';
  const showCuratedHome = !flatAllMode && !hasActiveFilters;
  const dropDeals = useMemo(() => showCuratedHome ? balancedFeatured(freshDealDrop(visibleDeals, initialSeenDrop, 8), 8) : [], [visibleDeals, initialSeenDrop, showCuratedHome]);
  const dropIds = useMemo(() => new Set(dropDeals.map((deal) => deal.id || deal.asin)), [dropDeals]);
  const chapters = useMemo(() => showCuratedHome ? buildFeedChapters(visibleDeals, interests, dropIds) : [], [visibleDeals, interests, dropIds, showCuratedHome]);
  const chapterIds = useMemo(() => chapterDealIds(chapters), [chapters]);
  const exploreDeals = useMemo(() => (flatAllMode || hasActiveFilters) ? visibleDeals : visibleDeals.filter((deal) => {
    const id = deal.id || deal.asin;
    return !dropIds.has(id) && !chapterIds.has(id);
  }), [visibleDeals, flatAllMode, hasActiveFilters, dropIds, chapterIds]);
  const progressiveDeals = exploreDeals.slice(0, flatAllMode ? REMOTE_PAGE_SIZE : visibleCount);
  const hasLocalMore = (flatAllMode ? REMOTE_PAGE_SIZE : visibleCount) < exploreDeals.length;
  const hasMore = hasLocalMore || Boolean(nextCursor);
  const refreshedSinceLastVisit = lastVisit > 0 ? availableDeals.filter((deal) => dealFreshnessTimestampMs(deal) > lastVisit).length : 0;

  useEffect(() => { setVisibleCount(INITIAL_FEED_SIZE); }, [interests, dismissals]);
  const loadRemotePage = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    dealsApi.page({ ...feedParams, cursor: nextCursor })
      .then((page) => {
        setDeals((current) => mergeDeals(current, page?.items || []));
        setNextCursor(page?.nextCursor || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMore(false));
  }, [feedParams, loadingMore, nextCursor]);
  useEffect(() => {
    const node = feedSentinel.current;
    if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (hasLocalMore) setVisibleCount((current) => nextVisibleCount(current, exploreDeals.length));
      else loadRemotePage();
    }, { rootMargin: '700px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, hasLocalMore, exploreDeals.length, loadRemotePage]);
  useEffect(() => {
    const node = dropSeenMarker.current;
    if (!node || !dropDeals.length || dealDropMarked.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      markDealDropSeen(dropDeals);
      dealDropMarked.current = true;
      observer.disconnect();
    }, { rootMargin: '0px 0px -10% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [dropDeals]);

  const resetAllFilters = () => { setActiveCat('all'); setSearchQuery(''); setMinDiscount(0); setPriceTier('all'); setSort('best'); setSearchParams({}); };
  const resetPersonalization = () => { try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* optional */ } setInterests({}); };
  const personalized = Object.values(interests).some((score) => Number(score) > 0);

  const feedGrid = (items) => viewMode === 'grid'
    ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 auto-rows-fr items-stretch">{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div>
    : <div className="space-y-3.5">{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>;

  const chapterBlock = (chapter) => <div key={chapter.key} className="my-7 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5"><div className="mb-4"><div className="text-[11px] font-black uppercase tracking-wider text-violet-700">{chapter.eyebrow}</div><h3 className="font-heading text-lg sm:text-xl font-black text-slate-900 mt-1">{chapter.title}</h3></div>{feedGrid(chapter.items)}</div>;

  const exploreWithChapters = () => {
    const sections = [];
    for (let start = 0; start < progressiveDeals.length; start += CHAPTER_INTERVAL) {
      const chunk = progressiveDeals.slice(start, start + CHAPTER_INTERVAL);
      sections.push(<Fragment key={`chunk-${start}`}>{feedGrid(chunk)}</Fragment>);
      const chapter = chapters[Math.floor(start / CHAPTER_INTERVAL)];
      if (chapter) sections.push(chapterBlock(chapter));
    }
    return sections;
  };

  return <div className="space-y-5 sm:space-y-6">
    <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/80"><div className="max-w-7xl mx-auto px-4 py-7 sm:py-10"><div className="max-w-3xl"><div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-3"><ShieldCheck className="w-3.5 h-3.5" /> Freshly checked</div><h1 className="font-heading text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-[1.05]">Good deals. No digging.</h1>{refreshedSinceLastVisit > 0 && <div className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-violet-800 bg-violet-50 border border-violet-200 rounded-full px-3 py-1.5"><Sparkles className="w-4 h-4" /> Freshly refreshed deals are waiting</div>}</div></div></section>
    {dropDeals.length > 0 && <section className="max-w-7xl mx-auto px-4"><div ref={dropSeenMarker} className="h-px" aria-hidden="true" /><div className="rounded-2xl sm:rounded-3xl border border-orange-200 bg-orange-50/60 p-4 sm:p-5"><div className="mb-4"><div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-orange-700"><Flame className="w-3.5 h-3.5" /> Deal Drop</div><h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 mt-1">Today’s best finds</h2></div>{feedGrid(dropDeals)}</div></section>}
    {showCuratedHome && filteredPicks.length > 0 && <section className="max-w-7xl mx-auto px-4"><div className="rounded-2xl sm:rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5"><div className="mb-4"><div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700"><Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" /> Standout finds</div><h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 mt-1">DealScout Picks</h2></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{filteredPicks.map((pick) => <div key={pick.asin} className="flex flex-col gap-2 min-w-0"><DealCard deal={pick.deal} viewMode="grid" />{pick.editorialNote && <div className="hidden sm:block rounded-xl bg-white border border-emerald-200 px-3 py-2 text-xs text-slate-700 leading-relaxed"><span className="font-bold text-emerald-800">Why we picked it: </span>{pick.editorialNote}</div>}</div>)}</div></div></section>}
    <section className="max-w-7xl mx-auto px-4 pb-16">
      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none mb-2"><button onClick={() => { setActiveCat('all'); setSearchParams({ category: 'all', ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${activeCat === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>All</button>{categories.map((c) => <button key={c.id} onClick={() => { setActiveCat(c.name); setSearchParams({ category: c.name, ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${activeCat?.toLowerCase() === c.name.toLowerCase() ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{c.name}</button>)}</div>
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs mb-5"><div className="flex items-center gap-2"><div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input type="text" placeholder="Search deals" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" /></div><select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl px-2.5 bg-slate-50 text-slate-800 max-w-[132px] sm:max-w-none">{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select><button type="button" onClick={() => setShowFilters((v) => !v)} className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center md:hidden"><SlidersHorizontal className="w-4 h-4" /></button><div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200"><button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white text-emerald-600' : 'text-slate-500'}`}><LayoutGrid className="w-3.5 h-3.5" /></button><button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white text-emerald-600' : 'text-slate-500'}`}><List className="w-3.5 h-3.5" /></button></div></div>
      <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100`}><select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5">{DISCOUNT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select><select value={priceTier} onChange={(e) => setPriceTier(e.target.value)} className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5">{PRICE_TIERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select><span className="text-xs text-slate-400 ml-auto hidden sm:inline">{availableDeals.length} loaded</span>{personalized && <button onClick={resetPersonalization} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Reset recommendations</button>}{(hasActiveFilters || flatAllMode) && <button onClick={resetAllFilters} className="text-xs font-semibold text-rose-600 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset filters</button>}</div></div>
      {!loading && !error && exploreDeals.length > 0 && <div className="mb-4"><div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500"><Sparkles className="w-3.5 h-3.5" /> {flatAllMode ? 'All deals' : 'Explore'}</div><h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 mt-1">{flatAllMode ? 'All verified deals' : 'More deals for you'}</h2></div>}
      {loading ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/3] bg-slate-100 rounded-2xl animate-pulse" />)}</div> : error && deals.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border p-8"><p>Couldn't load deals: {error}</p><Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button></div> : visibleDeals.length === 0 ? <div className="text-center py-16"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto" /><h3 className="font-bold mt-3">No deals match your filters</h3><Button onClick={resetAllFilters} variant="outline" size="sm" className="mt-3">Reset Filters</Button></div> : <>{exploreWithChapters()}<div ref={feedSentinel} className="h-10" aria-hidden="true" />{hasMore ? <div className="text-center py-5 text-xs font-semibold text-slate-400">{loadingMore ? 'Loading more verified deals…' : 'Finding more good deals…'}</div> : <div className="text-center py-9"><div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"><ShieldCheck className="w-4 h-4 text-emerald-600" /> You’ve seen today’s best deals</div><p className="text-xs text-slate-500 mt-2">Come back later and DealScout will surface newly verified finds.</p></div>}</>}
    </section>
  </div>;
}
