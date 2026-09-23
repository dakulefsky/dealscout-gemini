import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TrendingDown, Search, LayoutGrid, List, RotateCcw, Star, SlidersHorizontal, Sparkles, ArrowRight } from 'lucide-react';
import DealCard, { formatPrice } from '@/components/DealCard';
import { Image } from '@/components/ui/image';
import { deals as dealsApi, categories as categoriesApi, editorial as editorialApi } from '@/lib/api';
import { rankDeals } from '@/lib/dealRanking';
import { loadInterests, personalizedRank, STORAGE_KEY, INTERESTS_CHANGED_EVENT } from '@/lib/feedPersonalization';
import { loadDismissedDeals, DISMISSALS_CHANGED_EVENT } from '@/lib/feedDismissals';
import { loadPreviousVisit, checkpointVisit, dealCreatedTimestampMs, dealFreshnessTimestampMs } from '@/lib/feedReturnLoop';
import { INITIAL_FEED_SIZE, nextVisibleCount } from '@/lib/progressiveFeed';
import { loadSeenDealDrop, markDealDropSeen, freshDealDrop } from '@/lib/dealDropFreshness';
import { buildFeedChapters, chapterDealIds } from '@/lib/feedChapters';
import { trustworthyDiscountPercent } from '@/lib/heroDealQuality';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SORTS = [
  { key: 'best', label: 'Top deals' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];
const DISCOUNT_TIERS = [{ value: 0, label: '15%+ (all deals)' }, { value: 15, label: '15%+ off' }, { value: 25, label: '25%+ off' }, { value: 30, label: '30%+ off' }, { value: 50, label: '50%+ off' }];
const PRICE_TIERS = [{ value: 'all', label: 'Any price' }, { value: 'under-50', label: 'Under $50', max: 50 }, { value: '50-150', label: '$50–$150', min: 50, max: 150 }, { value: '150-300', label: '$150–$300', min: 150, max: 300 }, { value: 'over-300', label: '$300+', min: 300 }];
const CHAPTER_INTERVAL = 8;
const REMOTE_PAGE_SIZE = 24;

function dealIdentity(deal) { return String(deal?.id || deal?.asin || '').trim(); }
function balancedFeatured(items, maxItems = 8) { const bounded = (items || []).slice(0, maxItems); const evenLength = bounded.length - (bounded.length % 2); return evenLength >= 2 ? bounded.slice(0, evenLength) : []; }
function mergeDeals(current, incoming) { const seen = new Set(current.map(dealIdentity)); return [...current, ...incoming.filter((deal) => { const id = dealIdentity(deal); if (!id || seen.has(id)) return false; seen.add(id); return true; })]; }
function serverSort(sort) { if (sort === 'discount') return 'discount_desc'; if (sort === 'price-low') return 'price_asc'; if (sort === 'price-high') return 'price_desc'; return '-created_date'; }

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]); const [categories, setCategories] = useState([]); const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState(null); const [retryNonce, setRetryNonce] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [activeCat, setActiveCat] = useState(searchParams.get('category') || 'all'); const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('best'); const [minDiscount, setMinDiscount] = useState(0); const [priceTier, setPriceTier] = useState('all'); const [viewMode, setViewMode] = useState('grid'); const [showFilters, setShowFilters] = useState(false);
  const [interests, setInterests] = useState(() => loadInterests());
  const [dismissals, setDismissals] = useState(() => loadDismissedDeals());
  const [visibleCount, setVisibleCount] = useState(INITIAL_FEED_SIZE);
  const [initialSeenDrop] = useState(() => loadSeenDealDrop());
  const [lastVisit] = useState(() => loadPreviousVisit());
  const feedSentinel = useRef(null); const dropSeenMarker = useRef(null); const dealDropMarked = useRef(false);

  const selectedPriceTier = useMemo(() => PRICE_TIERS.find((p) => p.value === priceTier) || PRICE_TIERS[0], [priceTier]);
  const feedParams = useMemo(() => ({ limit: REMOTE_PAGE_SIZE, sort: serverSort(sort), category: activeCat === 'all' ? '' : activeCat, q: searchQuery.trim(), minDiscount: minDiscount || '', minPrice: selectedPriceTier.min ?? '', maxPrice: selectedPriceTier.max ?? '' }), [activeCat, searchQuery, minDiscount, selectedPriceTier, sort]);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setActiveCat(searchParams.get('category') || 'all');
  }, [searchParams]);
  useEffect(() => { Promise.all([categoriesApi.list(), editorialApi.picks(4).catch(() => ({ picks: [] }))]).then(([c, p]) => { setCategories(c || []); setPicks(p?.picks || []); }).catch(() => {}); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setLoadingMore(false); setError(null); setDeals([]); setNextCursor(null); setVisibleCount(INITIAL_FEED_SIZE);
      dealsApi.page(feedParams, { signal: controller.signal }).then((page) => { setDeals(page?.items || []); setNextCursor(page?.nextCursor || null); }).catch((e) => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, searchQuery.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [feedParams, searchQuery, retryNonce]);
  useEffect(() => { const saveCheckpoint = () => checkpointVisit(); window.addEventListener('pagehide', saveCheckpoint); return () => window.removeEventListener('pagehide', saveCheckpoint); }, []);
  useEffect(() => { const refresh = () => setInterests(loadInterests()); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener(INTERESTS_CHANGED_EVENT, refresh); return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(INTERESTS_CHANGED_EVENT, refresh); }; }, []);
  useEffect(() => { const refresh = () => setDismissals(loadDismissedDeals()); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener(DISMISSALS_CHANGED_EVENT, refresh); return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(DISMISSALS_CHANGED_EVENT, refresh); }; }, []);

  const availableDeals = useMemo(() => deals.filter((deal) => !dismissals[dealIdentity(deal)]), [deals, dismissals]);
  const visibleDeals = useMemo(() => { const list = [...availableDeals]; if (sort === 'best') return personalizedRank(rankDeals(list), interests); if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)); if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0)); if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0)); return list.sort((a, b) => dealCreatedTimestampMs(b) - dealCreatedTimestampMs(a)); }, [availableDeals, sort, interests]);

  const filteredPicks = useMemo(() => balancedFeatured(picks.filter((pick) => !dismissals[dealIdentity(pick.deal) || String(pick.asin || '')]), 4), [picks, dismissals]);
  const flatAllMode = activeCat === 'all' && searchParams.get('category') === 'all' && searchQuery.trim() === '' && minDiscount === 0 && priceTier === 'all' && sort === 'best';
  const hasActiveFilters = activeCat !== 'all' || searchQuery.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'best';
  const showCuratedHome = !flatAllMode && !hasActiveFilters;
  const spotlightDeals = useMemo(() => {
    if (!showCuratedHome) return [];
    return visibleDeals
      .map((deal) => ({ deal, discount: trustworthyDiscountPercent(deal) }))
      .filter((item) => item.discount >= 30)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 3)
      .map(({ deal }) => deal);
  }, [visibleDeals, showCuratedHome]);
  const spotlightIds = useMemo(() => new Set(spotlightDeals.map((deal) => deal.id || deal.asin)), [spotlightDeals]);
  const dropDeals = useMemo(() => showCuratedHome ? balancedFeatured(freshDealDrop(visibleDeals.filter((deal) => !spotlightIds.has(deal.id || deal.asin)), initialSeenDrop, 8), 8) : [], [visibleDeals, spotlightIds, initialSeenDrop, showCuratedHome]);
  const dropIds = useMemo(() => new Set([...spotlightIds, ...dropDeals.map((deal) => deal.id || deal.asin)]), [spotlightIds, dropDeals]);
  const chapters = useMemo(() => showCuratedHome ? buildFeedChapters(visibleDeals, interests, dropIds) : [], [visibleDeals, interests, dropIds, showCuratedHome]);
  const chapterIds = useMemo(() => chapterDealIds(chapters), [chapters]);
  const exploreDeals = useMemo(() => (flatAllMode || hasActiveFilters) ? visibleDeals : visibleDeals.filter((deal) => { const id = deal.id || deal.asin; return !dropIds.has(id) && !chapterIds.has(id); }), [visibleDeals, flatAllMode, hasActiveFilters, dropIds, chapterIds]);
  const progressiveDeals = exploreDeals.slice(0, flatAllMode ? REMOTE_PAGE_SIZE : visibleCount);
  const hasLocalMore = (flatAllMode ? REMOTE_PAGE_SIZE : visibleCount) < exploreDeals.length;
  const hasMore = hasLocalMore || Boolean(nextCursor);
  const refreshedSinceLastVisit = lastVisit > 0 ? availableDeals.filter((deal) => dealFreshnessTimestampMs(deal) > lastVisit).length : 0;

  useEffect(() => { setVisibleCount(INITIAL_FEED_SIZE); }, [interests, dismissals]);
  const loadRemotePage = useCallback(() => { if (!nextCursor || loadingMore) return; setLoadingMore(true); dealsApi.page({ ...feedParams, cursor: nextCursor }).then((page) => { setDeals((current) => mergeDeals(current, page?.items || [])); setNextCursor(page?.nextCursor || null); }).catch((e) => setError(e.message)).finally(() => setLoadingMore(false)); }, [feedParams, loadingMore, nextCursor]);
  useEffect(() => { const node = feedSentinel.current; if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return undefined; const observer = new IntersectionObserver((entries) => { if (!entries.some((entry) => entry.isIntersecting)) return; if (hasLocalMore) setVisibleCount((current) => nextVisibleCount(current, exploreDeals.length)); else loadRemotePage(); }, { rootMargin: '700px 0px' }); observer.observe(node); return () => observer.disconnect(); }, [hasMore, hasLocalMore, exploreDeals.length, loadRemotePage]);
  useEffect(() => { const node = dropSeenMarker.current; if (!node || !dropDeals.length || dealDropMarked.current || typeof IntersectionObserver === 'undefined') return undefined; const observer = new IntersectionObserver((entries) => { if (!entries.some((entry) => entry.isIntersecting)) return; markDealDropSeen(dropDeals); dealDropMarked.current = true; observer.disconnect(); }, { rootMargin: '0px 0px -10% 0px' }); observer.observe(node); return () => observer.disconnect(); }, [dropDeals]);

  const resetAllFilters = () => { setActiveCat('all'); setSearchQuery(''); setMinDiscount(0); setPriceTier('all'); setSort('best'); setSearchParams({}); };
  const resetPersonalization = () => { try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* optional */ } setInterests({}); };
  const personalized = Object.values(interests).some((score) => Number(score) > 0);
  const topDeals = showCuratedHome ? dropDeals.slice(0, 4) : [];

  const feedGrid = (items) => viewMode === 'grid' ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr items-stretch">{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div> : <div>{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>;

  const chapterBlock = (chapter) => <section key={chapter.key} className="my-10 pt-7 border-t border-emerald-950/10"><div className="flex items-end justify-between mb-5"><div><div className="ds-kicker">{chapter.eyebrow}</div><h3 className="ds-section-title mt-1">{chapter.title}</h3></div></div>{feedGrid(chapter.items)}</section>;
  const exploreWithChapters = () => { const sections = []; for (let start = 0; start < progressiveDeals.length; start += CHAPTER_INTERVAL) { const chunk = progressiveDeals.slice(start, start + CHAPTER_INTERVAL); sections.push(<Fragment key={`chunk-${start}`}>{feedGrid(chunk)}</Fragment>); const chapter = chapters[Math.floor(start / CHAPTER_INTERVAL)]; if (chapter) sections.push(chapterBlock(chapter)); } return sections; };

  return <div>
    {showCuratedHome && (
      <section className="border-b border-emerald-950/15 bg-[#f3efe5]">
        <div className="ds-shell py-7 sm:py-9">
          <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.72fr)] gap-9 lg:gap-12 items-start">
            <div>
              <div className="flex items-end justify-between gap-5 border-b-2 border-emerald-950 pb-3">
                <div>
                  <h1 className="font-heading text-3xl sm:text-[38px] font-black leading-none text-emerald-950">Departments</h1>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.13em] font-black text-slate-500">15%+ off · recently checked</p>
                </div>
                <div className="hidden sm:block text-[10px] uppercase tracking-[0.14em] font-black text-slate-500">{categories.length} active departments</div>
              </div>

              <div className="grid sm:grid-cols-2 border-b border-emerald-950/15">
                {categories.map((category, index) => (
                  <Link
                    key={category.id || category.slug}
                    to={`/category/${category.slug}`}
                    className={`group flex items-center justify-between gap-4 py-3 border-b border-emerald-950/15 ${index % 2 === 0 ? 'sm:pr-6 sm:border-r sm:border-emerald-950/20' : 'sm:pl-6'}`}
                  >
                    <span className="text-[14px] sm:text-[15px] font-black text-emerald-950 group-hover:translate-x-0.5 transition-transform">{category.name}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] font-black text-slate-400">{Number(category.liveCount || 0)} live</span>
                  </Link>
                ))}
                <Link to="/?category=all" className="sm:col-span-2 flex items-center justify-between gap-4 py-4 text-[11px] uppercase tracking-[0.12em] font-black text-emerald-950">
                  <span>Browse all current deals</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {refreshedSinceLastVisit > 0 && <div className="mt-4 text-xs font-semibold text-emerald-800"><Sparkles className="w-3.5 h-3.5 inline mr-1.5" />{refreshedSinceLastVisit} deals refreshed since your last visit</div>}
            </div>

            <aside className="lg:border-l lg:border-emerald-950/20 lg:pl-7">
              <div className="border-b-2 border-emerald-950 pb-3">
                <div className="ds-kicker">30%+ off</div>
                <h2 className="font-heading text-2xl sm:text-[30px] font-black leading-none text-emerald-950 mt-1">Standouts</h2>
              </div>

              {spotlightDeals.length > 0 ? (
                <div className="divide-y divide-emerald-950/15">
                  {spotlightDeals.map((deal, index) => (
                    <Link key={deal.id || deal.asin} to={`/deal/${deal.id || deal.asin}`} className="group grid grid-cols-[72px_1fr] gap-3 py-4">
                      <div className={`h-16 p-1.5 ${index === 1 ? 'bg-[#e5dfd1]' : 'bg-white'}`}>
                        <Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} className="w-full h-full group-hover:scale-[1.03] transition-transform" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-[0.13em] font-black text-emerald-700">{trustworthyDiscountPercent(deal)}% off · checked</div>
                        <h3 className="mt-1 text-[13px] font-bold text-slate-950 leading-snug line-clamp-2">{deal.title}</h3>
                        <div className="mt-1.5 flex items-baseline gap-2"><span className="text-base font-black text-emerald-950">{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-[10px] text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-5 text-sm text-slate-500 border-b border-emerald-950/10">No 30%+ standouts are verified right now.</div>
              )}
            </aside>
          </div>
        </div>
      </section>
    )}

    {showCuratedHome && topDeals.length > 0 && <section className="ds-shell py-8 sm:py-10"><div ref={dropSeenMarker} className="h-px" aria-hidden="true" /><div className="flex items-end justify-between gap-4 mb-5"><div><div className="ds-kicker">Fresh checks</div><h2 className="ds-section-title mt-1">Current</h2></div><Link to="/?category=all" className="text-xs font-bold text-emerald-900 inline-flex items-center gap-1">See all deals <ArrowRight className="w-3.5 h-3.5" /></Link></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{topDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} />)}</div></section>}

    {showCuratedHome && filteredPicks.length > 0 && <section className="border-y-2 border-emerald-950/15 bg-white"><div className="ds-shell py-9 sm:py-12"><div className="mb-5"><div className="ds-kicker"><Star className="w-3.5 h-3.5 inline mr-1.5 fill-emerald-800" />Editor’s picks</div><h2 className="ds-section-title mt-1">Selected deals</h2></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{filteredPicks.map((pick) => <div key={pick.asin}><DealCard deal={pick.deal} />{pick.editorialNote && <p className="hidden sm:block mt-2 text-[11px] leading-relaxed text-slate-600 border-t border-emerald-950/10 pt-2"><strong className="text-emerald-900">Why we picked it:</strong> {pick.editorialNote}</p>}</div>)}</div></div></section>}

    <section className="ds-shell py-10 sm:py-12 pb-20">
      <div className="flex items-center gap-5 overflow-x-auto border-b border-emerald-950/10 pb-3 mb-5 text-sm whitespace-nowrap"><button onClick={() => { setActiveCat('all'); setSearchParams({ category: 'all', ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`font-bold pb-2 border-b-2 ${activeCat === 'all' ? 'text-emerald-950 border-emerald-950' : 'text-slate-500 border-transparent'}`}>All</button>{categories.map((c) => <button key={c.id} onClick={() => { setActiveCat(c.name); setSearchParams({ category: c.name, ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`font-semibold pb-2 border-b-2 ${activeCat?.toLowerCase() === c.name.toLowerCase() ? 'text-emerald-950 border-emerald-950' : 'text-slate-500 border-transparent'}`}>{c.name}</button>)}</div>

      <div className="border-y border-emerald-950/10 py-3 mb-7"><div className="flex items-center gap-2"><div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input type="search" aria-label="Search deals" placeholder="Search deals" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 text-sm bg-white border-emerald-950/10 rounded-none" /></div><select aria-label="Sort deals" value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-semibold border border-emerald-950/10 px-2.5 bg-white text-slate-800 max-w-[132px] sm:max-w-none">{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select><button type="button" aria-label="Toggle deal filters" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)} className="h-10 w-10 border border-emerald-950/10 flex items-center justify-center md:hidden"><SlidersHorizontal className="w-4 h-4" /></button><div className="hidden md:flex items-center border border-emerald-950/10"><button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-emerald-950 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-3.5 h-3.5" /></button><button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-emerald-950 text-white' : 'text-slate-500'}`}><List className="w-3.5 h-3.5" /></button></div></div>
        <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2 mt-3`}><select aria-label="Minimum discount" value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className="h-9 text-xs bg-white border border-emerald-950/10 px-2.5">{DISCOUNT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select><select aria-label="Price range" value={priceTier} onChange={(e) => setPriceTier(e.target.value)} className="h-9 text-xs bg-white border border-emerald-950/10 px-2.5">{PRICE_TIERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select><span className="text-xs text-slate-400 ml-auto hidden sm:inline">{availableDeals.length} loaded</span>{personalized && <button onClick={resetPersonalization} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Reset recommendations</button>}{(hasActiveFilters || flatAllMode) && <button onClick={resetAllFilters} className="text-xs font-semibold text-rose-600 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset filters</button>}</div></div>

      {!loading && !error && exploreDeals.length > 0 && <div className="mb-5"><div className="ds-kicker">{flatAllMode ? 'Full catalog' : 'Keep browsing'}</div><h2 className="ds-section-title mt-1">{flatAllMode ? 'All verified deals' : 'All deals'}</h2></div>}
      {loading ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/3] bg-stone-100 animate-pulse" />)}</div> : error && deals.length === 0 ? <div className="text-center py-12 bg-white border border-emerald-950/10 p-8"><p>Couldn't load deals: {error}</p><Button onClick={() => setRetryNonce((value) => value + 1)} className="mt-4">Try Again</Button></div> : visibleDeals.length === 0 ? <div className="text-center py-16"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto" /><h3 className="font-bold mt-3">No deals match your filters</h3><Button onClick={resetAllFilters} variant="outline" size="sm" className="mt-3">Reset Filters</Button></div> : <>{exploreWithChapters()}<div ref={feedSentinel} className="h-10" aria-hidden="true" />{hasMore && <div className="text-center py-6 text-xs font-semibold text-slate-400">{loadingMore ? 'Loading more verified deals…' : 'Loading more deals…'}</div>}</>}
    </section>
  </div>;
}
