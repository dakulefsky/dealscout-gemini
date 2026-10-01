import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, TrendingDown, Search, LayoutGrid, List, RotateCcw, SlidersHorizontal, ShoppingBag, Laptop, House, Shirt, HeartPulse, PawPrint, Blocks } from 'lucide-react';
import DealCard from '@/components/DealCard';
import MembershipOffers from '@/components/MembershipOffers';
import SeasonalPromotionBanner from '@/components/SeasonalPromotionBanner';
import { deals as dealsApi } from '@/lib/api';
import { useActiveCategories } from '@/lib/useActiveCategories';
import { rankDeals } from '@/lib/dealRanking';
import { interleaveCategories } from '@/lib/feedDiversity';
import { loadInterests, personalizedRank, STORAGE_KEY, INTERESTS_CHANGED_EVENT } from '@/lib/feedPersonalization';
import { loadDismissedDeals, DISMISSALS_CHANGED_EVENT } from '@/lib/feedDismissals';
import { checkpointVisit, dealCreatedTimestampMs } from '@/lib/feedReturnLoop';
import { INITIAL_FEED_SIZE, nextVisibleCount } from '@/lib/progressiveFeed';
import { featuredDealCandidates } from '@/lib/heroDealQuality';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SORTS = [
  { key: 'best', label: 'Top deals' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];
const DISCOUNT_TIERS = [{ value: 0, label: '15%+ (all deals)' }, { value: 25, label: '25%+ off' }, { value: 30, label: '30%+ off' }, { value: 50, label: '50%+ off' }];
const PRICE_TIERS = [{ value: 'all', label: 'Any price' }, { value: 'under-50', label: 'Under $50', max: 50 }, { value: '50-150', label: '$50–$150', min: 50, max: 150 }, { value: '150-300', label: '$150–$300', min: 150, max: 300 }, { value: 'over-300', label: '$300+', min: 300 }];
const REMOTE_PAGE_SIZE = 24;

function departmentStyle(name) {
  if (/electronic|computer/i.test(name)) return { Icon: Laptop };
  if (/home|kitchen|garden/i.test(name)) return { Icon: House };
  if (/cloth|fashion|shoe/i.test(name)) return { Icon: Shirt };
  if (/health|beauty/i.test(name)) return { Icon: HeartPulse };
  if (/pet/i.test(name)) return { Icon: PawPrint };
  if (/toy|game/i.test(name)) return { Icon: Blocks };
  return { Icon: ShoppingBag, color: 'bg-slate-100 text-slate-800' };
}

function dealIdentity(deal) { return String(deal?.id || deal?.asin || '').trim(); }
function balancedFeatured(items, maxItems = 8) {
  const remaining = [...(items || [])]; const selected = [];
  while (remaining.length && selected.length < maxItems) {
    const categories = new Set();
    for (let index = 0; index < remaining.length && selected.length < maxItems;) {
      const category = String(remaining[index]?.category || remaining[index]?.deal?.category || '').toLowerCase();
      if (categories.has(category)) { index += 1; continue; }
      categories.add(category); selected.push(remaining.splice(index, 1)[0]);
    }
  }
  return selected;
}
function mergeDeals(current, incoming) { const seen = new Set(current.map(dealIdentity)); return [...current, ...incoming.filter((deal) => { const id = dealIdentity(deal); if (!id || seen.has(id)) return false; seen.add(id); return true; })]; }
function serverSort(sort) { if (sort === 'best') return 'best'; if (sort === 'discount') return 'discount_desc'; if (sort === 'price-low') return 'price_asc'; if (sort === 'price-high') return 'price_desc'; return '-created_date'; }

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]); const categories = useActiveCategories();
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState(null); const [retryNonce, setRetryNonce] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [activeCat, setActiveCat] = useState(searchParams.get('category') || 'all'); const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('best'); const [minDiscount, setMinDiscount] = useState(0); const [priceTier, setPriceTier] = useState('all'); const [viewMode, setViewMode] = useState('grid'); const [showFilters, setShowFilters] = useState(false);
  const [interests, setInterests] = useState(() => loadInterests());
  const [dismissals, setDismissals] = useState(() => loadDismissedDeals());
  const [visibleCount, setVisibleCount] = useState(INITIAL_FEED_SIZE);
  const feedSentinel = useRef(null);
  const spotlightTrackRef = useRef(null);
  const feedGeneration = useRef(0); const paginationRequest = useRef(null);

  const selectedPriceTier = useMemo(() => PRICE_TIERS.find((p) => p.value === priceTier) || PRICE_TIERS[0], [priceTier]);
  const feedParams = useMemo(() => ({ limit: REMOTE_PAGE_SIZE, sort: serverSort(sort), category: activeCat === 'all' ? '' : activeCat, q: searchQuery.trim(), minDiscount: minDiscount || '', minPrice: selectedPriceTier.min ?? '', maxPrice: selectedPriceTier.max ?? '' }), [activeCat, searchQuery, minDiscount, selectedPriceTier, sort]);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setActiveCat(searchParams.get('category') || 'all');
  }, [searchParams]);
  useEffect(() => {
    const controller = new AbortController();
    const generation = ++feedGeneration.current;
    paginationRequest.current?.abort();
    paginationRequest.current = null;
    setLoading(true); setLoadingMore(false); setError(null); setDeals([]); setNextCursor(null); setVisibleCount(Math.min(INITIAL_FEED_SIZE, 12));
    const timer = window.setTimeout(() => {
      dealsApi.page(feedParams, { signal: controller.signal }).then((page) => { if (controller.signal.aborted || generation !== feedGeneration.current) return; setDeals(page?.items || []); setNextCursor(page?.nextCursor || null); }).catch((e) => { if (!controller.signal.aborted && generation === feedGeneration.current && e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted && generation === feedGeneration.current) setLoading(false); });
    }, searchQuery.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); paginationRequest.current?.abort(); };
  }, [feedParams, searchQuery, retryNonce]);
  useEffect(() => { const saveCheckpoint = () => checkpointVisit(); window.addEventListener('pagehide', saveCheckpoint); return () => window.removeEventListener('pagehide', saveCheckpoint); }, []);
  useEffect(() => { const refresh = () => setInterests(loadInterests()); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener(INTERESTS_CHANGED_EVENT, refresh); return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(INTERESTS_CHANGED_EVENT, refresh); }; }, []);
  useEffect(() => { const refresh = () => setDismissals(loadDismissedDeals()); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener(DISMISSALS_CHANGED_EVENT, refresh); return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(DISMISSALS_CHANGED_EVENT, refresh); }; }, []);

  const availableDeals = useMemo(() => deals.filter((deal) => !dismissals[dealIdentity(deal)]), [deals, dismissals]);
  const visibleDeals = useMemo(() => { const list = [...availableDeals]; if (sort === 'best') { const ranked = personalizedRank(activeCat === 'all' && !searchQuery.trim() ? list : rankDeals(list), interests); return activeCat === 'all' && !searchQuery.trim() ? interleaveCategories(ranked) : ranked; } if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)); if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0)); if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0)); return list.sort((a, b) => dealCreatedTimestampMs(b) - dealCreatedTimestampMs(a)); }, [availableDeals, sort, interests, activeCat, searchQuery]);

  const flatAllMode = activeCat === 'all' && searchParams.get('category') === 'all' && searchQuery.trim() === '' && minDiscount === 0 && priceTier === 'all' && sort === 'best';
  const hasActiveFilters = activeCat !== 'all' || searchQuery.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'best';
  const showCuratedHome = !flatAllMode && !hasActiveFilters;
  const spotlightDeals = useMemo(() => {
    if (!showCuratedHome) return [];
    const candidates = featuredDealCandidates(visibleDeals);
    const standouts = candidates.filter((item) => item.discount >= 30);
    return balancedFeatured((standouts.length ? standouts : candidates)
      .sort((a, b) => b.discount - a.discount)
      .map(({ deal, needsPriceCheck }) => ({ ...deal, _spotlightNeedsPriceCheck: needsPriceCheck })), 8);
  }, [visibleDeals, showCuratedHome]);
  const spotlightIds = useMemo(() => new Set(spotlightDeals.map(dealIdentity)), [spotlightDeals]);
  const exploreDeals = useMemo(() => showCuratedHome ? visibleDeals.filter((deal) => !spotlightIds.has(dealIdentity(deal))) : visibleDeals, [visibleDeals, showCuratedHome, spotlightIds]);
  const progressiveDeals = exploreDeals.slice(0, visibleCount);
  const hasLocalMore = visibleCount < exploreDeals.length;
  const hasMore = hasLocalMore || Boolean(nextCursor);

  useEffect(() => { setVisibleCount(Math.min(INITIAL_FEED_SIZE, 12)); }, [interests, dismissals]);
  const loadRemotePage = useCallback(() => {
    if (!nextCursor || loading || loadingMore || paginationRequest.current) return;
    const generation = feedGeneration.current;
    const controller = new AbortController();
    paginationRequest.current = controller;
    setLoadingMore(true);
    dealsApi.page({ ...feedParams, cursor: nextCursor }, { signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted || generation !== feedGeneration.current) return;
        setDeals((current) => mergeDeals(current, page?.items || []));
        setNextCursor(page?.nextCursor || null);
        setError(null);
      })
      .catch((e) => { if (!controller.signal.aborted && generation === feedGeneration.current) setError(e.message); })
      .finally(() => {
        if (paginationRequest.current === controller) paginationRequest.current = null;
        if (generation === feedGeneration.current) setLoadingMore(false);
      });
  }, [feedParams, loading, loadingMore, nextCursor]);
  useEffect(() => { const node = feedSentinel.current; if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return undefined; const observer = new IntersectionObserver((entries) => { if (!entries.some((entry) => entry.isIntersecting)) return; if (hasLocalMore) setVisibleCount((current) => nextVisibleCount(current, exploreDeals.length)); else loadRemotePage(); }, { rootMargin: '700px 0px' }); observer.observe(node); return () => observer.disconnect(); }, [hasMore, hasLocalMore, exploreDeals.length, loadRemotePage]);

  const resetAllFilters = () => { setActiveCat('all'); setSearchQuery(''); setMinDiscount(0); setPriceTier('all'); setSort('best'); setSearchParams({}); };
  const resetPersonalization = () => { try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* optional */ } setInterests({}); };
  const scrollSpotlight = (direction) => {
    const track = spotlightTrackRef.current;
    if (track) track.scrollBy({ left: direction * Math.max(240, track.clientWidth * 0.82), behavior: 'smooth' });
  };
  const personalized = Object.values(interests).some((score) => Number(score) > 0);

  const feedGrid = (items, prioritizeImages = false) => viewMode === 'grid' ? <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 auto-rows-fr items-stretch">{items.map((deal, index) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" imagePriority={prioritizeImages && index < 2} />)}</div> : <div>{items.map((deal, index) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" imagePriority={prioritizeImages && index < 2} />)}</div>;

  return <div className="bg-white">
    <div className="ds-shell py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{flatAllMode ? 'All deals' : hasActiveFilters ? 'Find a deal' : 'Shop by department'}</h1>
        {!showCuratedHome && <p className="mt-2 text-sm text-slate-500">Browse current Amazon deals.</p>}
      </header>

      {showCuratedHome && <nav aria-label="Shop by department" className="mb-8">
        {categories.length > 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {categories.filter((category) => category.name !== 'Other').map((category) => {
            const { Icon } = departmentStyle(category.name);
            return <Link key={category.id || category.slug || category.name} to={`/?category=${encodeURIComponent(category.name)}`} className="group flex items-center gap-3 min-h-20 px-3 sm:px-4 py-3 border border-slate-200 rounded-md text-sm font-semibold text-slate-800 hover:border-emerald-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
              <span className="flex items-center justify-center w-10 h-10 shrink-0 text-slate-600"><Icon aria-hidden="true" className="w-5 h-5" /></span>
              <span className="flex-1">{category.name}</span><ArrowRight aria-hidden="true" className="hidden sm:block w-4 h-4 shrink-0 text-slate-400 group-hover:text-emerald-800" />
            </Link>;
          })}
          <Link to="/?category=all" className="flex items-center justify-between gap-3 min-h-20 px-4 py-3 border border-slate-300 bg-slate-100 rounded-md text-sm font-semibold text-slate-900 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">All deals<ArrowRight aria-hidden="true" className="w-4 h-4 shrink-0" /></Link>
        </div> : <Link to="/?category=all" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 underline underline-offset-4">Browse all deals<ArrowRight aria-hidden="true" className="w-4 h-4" /></Link>}
      </nav>}

      {showCuratedHome && !loading && <SeasonalPromotionBanner hasLiveDeals={deals.length > 0} />}

      {showCuratedHome && !loading && <section aria-labelledby="best-deals-heading" className="mb-8 min-w-0 border border-slate-300 border-t-4 border-t-slate-800 bg-[#f7f5ef] px-3 sm:px-5 py-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="best-deals-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Best deals</h2>
          <div className="flex items-center gap-3">
            {spotlightDeals.length > 1 && <div className="flex items-center gap-1" aria-label="Best deals scrolling controls">
              <button type="button" aria-label="Scroll best deals left" aria-controls="best-deals-track" onClick={() => scrollSpotlight(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800">
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </button>
              <button type="button" aria-label="Scroll best deals right" aria-controls="best-deals-track" onClick={() => scrollSpotlight(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800">
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>}
            <Link to="/?category=all" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-emerald-900">See all deals <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" /></Link>
          </div>
        </div>
        {spotlightDeals.length > 0 ? <>{spotlightDeals.some((deal) => deal._spotlightNeedsPriceCheck) && <p className="text-xs text-amber-800 mb-3">Strong recorded discounts. Check current prices on Amazon.</p>}
          <div id="best-deals-track" ref={spotlightTrackRef} role="region" aria-label="Best deals carousel" aria-roledescription="carousel" className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 sm:gap-4">
            {spotlightDeals.map((deal, index) => <div key={deal.id || deal.asin} role="group" aria-label={`Deal ${index + 1} of ${spotlightDeals.length}`} aria-roledescription="slide" className="w-[78%] max-w-[280px] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]">
              <DealCard deal={deal} viewMode="grid" imagePriority={index < 2} />
            </div>)}
          </div></> : <p className="text-sm text-slate-600">No current verified discounts to feature. Browse the full selection below.</p>}
      </section>}

      <section aria-labelledby="browse-deals-heading" className="border-t border-slate-200 bg-slate-50 -mx-3 sm:-mx-5 px-3 sm:px-5 py-7 mt-10">
        <div className="flex items-end justify-between gap-4 mb-5"><div><h2 id="browse-deals-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{flatAllMode ? 'All verified deals' : hasActiveFilters ? 'Matching deals' : 'Browse deals'}</h2>{!hasActiveFilters && <p className="mt-1 text-sm text-slate-600">A fresh mix from across the departments. More appear as you browse.</p>}</div>{!hasActiveFilters && <Link to="/?category=all" className="hidden sm:inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-900 underline underline-offset-4">See all deals <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" /></Link>}</div>
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 sm:p-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input type="search" aria-label="Search deals" placeholder="Search products" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 text-sm bg-white border-slate-200 rounded-md" /></div>
            <select aria-label="Sort deals" value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm border border-slate-200 rounded-md px-2 bg-white text-slate-700 max-w-[124px] sm:max-w-none">{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            <button type="button" aria-label="Toggle deal filters" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)} className="h-10 w-10 shrink-0 border border-slate-200 rounded-md bg-white flex items-center justify-center md:hidden"><SlidersHorizontal className="w-4 h-4" /></button>
            <div className="hidden md:flex items-center border border-slate-200 rounded-md overflow-hidden">
              <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={`p-2.5 ${viewMode === 'grid' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={`p-2.5 ${viewMode === 'list' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500'}`}><List className="w-4 h-4" /></button>
            </div>
          </div>
          <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2 mt-3`}>
            <select aria-label="Department" value={activeCat} onChange={(e) => { setActiveCat(e.target.value); setSearchParams({ category: e.target.value, ...(searchQuery ? { q: searchQuery } : {}) }); }} className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2 max-w-full">
              <option value="all">All departments</option>{activeCat !== 'all' && !categories.some((c) => c.name === activeCat) && <option value={activeCat}>{activeCat}</option>}{categories.map((c) => <option key={c.id || c.slug} value={c.name}>{c.name}</option>)}
            </select>
            <select aria-label="Minimum discount" value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2">{DISCOUNT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <select aria-label="Price range" value={priceTier} onChange={(e) => setPriceTier(e.target.value)} className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2">{PRICE_TIERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            {(hasActiveFilters || flatAllMode) && <button onClick={resetAllFilters} className="text-xs text-slate-600 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset filters</button>}
            {personalized && <button onClick={resetPersonalization} className="text-xs text-slate-500 md:ml-auto">Reset recommendations</button>}
          </div>
        </div>

        {loading ? <div role="status" aria-label="Loading deals" className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-slate-50 rounded-md animate-pulse" />)}</div>
          : error && deals.length === 0 ? <div role="alert" className="text-center py-12"><p>Couldn’t load deals. Please try again.</p><Button onClick={() => setRetryNonce((value) => value + 1)} className="mt-4">Try again</Button></div>
          : visibleDeals.length === 0 ? <div className="text-center py-12"><TrendingDown className="h-8 w-8 text-slate-300 mx-auto" /><h3 className="font-semibold mt-3">{hasActiveFilters ? 'No deals match your filters' : 'No current deals right now'}</h3>{hasActiveFilters && <Button onClick={resetAllFilters} variant="outline" size="sm" className="mt-3">Reset filters</Button>}</div>
          : <>{feedGrid(progressiveDeals)}<div ref={feedSentinel} className="h-10" aria-hidden="true" />{loadingMore && <p role="status" className="text-center py-5 text-sm text-slate-500">Finding more deals…</p>}{error && <div role="status" className="text-center text-sm text-amber-800 py-3">Couldn’t load more deals. <button onClick={loadRemotePage} className="underline font-semibold">Try again</button></div>}{!hasMore && !error && <div role="status" className="text-center py-5 text-sm text-slate-600">You’ve reached the end of the current deals. <Link to="/?category=all" className="font-semibold underline underline-offset-4">Browse all departments</Link></div>}</>}
      </section>
      {showCuratedHome && <MembershipOffers />}
    </div>
  </div>;
}
