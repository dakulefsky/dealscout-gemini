import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TrendingDown, Search, LayoutGrid, List, RotateCcw, ShieldCheck, Star, SlidersHorizontal, Sparkles, ArrowRight, CheckCircle2, Zap, Heart } from 'lucide-react';
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

function dealIdentity(deal) { return String(deal?.id || deal?.asin || '').trim(); }
function balancedFeatured(items, maxItems = 8) { const bounded = (items || []).slice(0, maxItems); const evenLength = bounded.length - (bounded.length % 2); return evenLength >= 2 ? bounded.slice(0, evenLength) : []; }
function mergeDeals(current, incoming) { const seen = new Set(current.map(dealIdentity)); return [...current, ...incoming.filter((deal) => { const id = dealIdentity(deal); if (!id || seen.has(id)) return false; seen.add(id); return true; })]; }
function serverSort(sort) { if (sort === 'discount') return 'discount_desc'; if (sort === 'price-low') return 'price_asc'; if (sort === 'price-high') return 'price_desc'; return '-created_date'; }

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
  const feedSentinel = useRef(null); const dropSeenMarker = useRef(null); const dealDropMarked = useRef(false);

  const selectedPriceTier = useMemo(() => PRICE_TIERS.find((p) => p.value === priceTier) || PRICE_TIERS[0], [priceTier]);
  const feedParams = useMemo(() => ({ limit: REMOTE_PAGE_SIZE, sort: serverSort(sort), category: activeCat === 'all' ? '' : activeCat, q: searchQuery.trim(), minDiscount: minDiscount || '', minPrice: selectedPriceTier.min ?? '', maxPrice: selectedPriceTier.max ?? '' }), [activeCat, searchQuery, minDiscount, selectedPriceTier, sort]);

  useEffect(() => { const q = searchParams.get('q'); if (q !== null) setSearchQuery(q); const c = searchParams.get('category'); if (c !== null) setActiveCat(c); }, [searchParams]);
  useEffect(() => { Promise.all([categoriesApi.list(), editorialApi.picks(4).catch(() => ({ picks: [] }))]).then(([c, p]) => { setCategories(c || []); setPicks(p?.picks || []); }).catch(() => {}); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setLoadingMore(false); setError(null); setDeals([]); setNextCursor(null); setVisibleCount(INITIAL_FEED_SIZE);
      dealsApi.page(feedParams, { signal: controller.signal }).then((page) => { setDeals(page?.items || []); setNextCursor(page?.nextCursor || null); }).catch((e) => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, searchQuery.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [feedParams, searchQuery]);
  useEffect(() => { const saveCheckpoint = () => checkpointVisit(); window.addEventListener('pagehide', saveCheckpoint); return () => window.removeEventListener('pagehide', saveCheckpoint); }, []);
  useEffect(() => { const refresh = () => setInterests(loadInterests()); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener(INTERESTS_CHANGED_EVENT, refresh); return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(INTERESTS_CHANGED_EVENT, refresh); }; }, []);
  useEffect(() => { const refresh = () => setDismissals(loadDismissedDeals()); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener(DISMISSALS_CHANGED_EVENT, refresh); return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener(DISMISSALS_CHANGED_EVENT, refresh); }; }, []);

  const availableDeals = useMemo(() => deals.filter((deal) => !dismissals[dealIdentity(deal)]), [deals, dismissals]);
  const visibleDeals = useMemo(() => { const list = [...availableDeals]; if (sort === 'best') return personalizedRank(rankDeals(list), interests); if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)); if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0)); if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0)); return list.sort((a, b) => dealCreatedTimestampMs(b) - dealCreatedTimestampMs(a)); }, [availableDeals, sort, interests]);

  const filteredPicks = useMemo(() => balancedFeatured(picks.filter((pick) => !dismissals[dealIdentity(pick.deal) || String(pick.asin || '')]), 4), [picks, dismissals]);
  const flatAllMode = activeCat === 'all' && searchParams.get('category') === 'all' && searchQuery.trim() === '' && minDiscount === 0 && priceTier === 'all' && sort === 'best';
  const hasActiveFilters = activeCat !== 'all' || searchQuery.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'best';
  const showCuratedHome = !flatAllMode && !hasActiveFilters;
  const dropDeals = useMemo(() => showCuratedHome ? balancedFeatured(freshDealDrop(visibleDeals, initialSeenDrop, 8), 8) : [], [visibleDeals, initialSeenDrop, showCuratedHome]);
  const dropIds = useMemo(() => new Set(dropDeals.map((deal) => deal.id || deal.asin)), [dropDeals]);
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
  const heroDeal = showCuratedHome ? dropDeals[0] : null;
  const heroSideDeals = showCuratedHome ? dropDeals.slice(1, 4) : [];
  const topDeals = showCuratedHome ? dropDeals.slice(0, 6) : [];

  const feedGrid = (items) => viewMode === 'grid' ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr items-stretch">{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div> : <div>{items.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>;

  const chapterBlock = (chapter) => <section key={chapter.key} className="my-10 pt-7 border-t border-emerald-950/10"><div className="flex items-end justify-between mb-5"><div><div className="ds-kicker">{chapter.eyebrow}</div><h3 className="ds-section-title mt-1">{chapter.title}</h3></div></div>{feedGrid(chapter.items)}</section>;
  const exploreWithChapters = () => { const sections = []; for (let start = 0; start < progressiveDeals.length; start += CHAPTER_INTERVAL) { const chunk = progressiveDeals.slice(start, start + CHAPTER_INTERVAL); sections.push(<Fragment key={`chunk-${start}`}>{feedGrid(chunk)}</Fragment>); const chapter = chapters[Math.floor(start / CHAPTER_INTERVAL)]; if (chapter) sections.push(chapterBlock(chapter)); } return sections; };

  return <div>
    {showCuratedHome && heroDeal && (
      <section className="border-b border-emerald-950/10 bg-[#f7f5ef]">
        <div className="ds-shell py-5 sm:py-8">
          <div ref={dropSeenMarker} className="h-px" aria-hidden="true" />
          <div className="grid lg:grid-cols-[0.78fr_1.65fr_0.92fr] gap-5 lg:gap-6 items-stretch">
            <div className="flex flex-col justify-center py-4 lg:py-8">
              <div className="ds-kicker">Deal Drop</div>
              <div className="text-sm font-bold text-emerald-900 mt-2">Good deals. No digging.</div>
              <h1 className="font-heading text-[42px] sm:text-[58px] lg:text-[64px] leading-[0.95] font-bold text-emerald-950 mt-3">Better deals for real life.</h1>
              <p className="text-sm sm:text-base leading-relaxed text-slate-600 mt-5 max-w-sm">The strongest verified finds, without making you dig through everything else.</p>
              <Link to="/?category=all" className="mt-6 inline-flex items-center justify-center gap-2 w-fit bg-emerald-950 text-white px-5 py-3 text-sm font-bold hover:bg-emerald-900">Browse all deals <ArrowRight className="w-4 h-4" /></Link>
              {refreshedSinceLastVisit > 0 && <div className="mt-5 text-xs font-semibold text-emerald-800"><Sparkles className="w-3.5 h-3.5 inline mr-1.5" />Freshly refreshed deals are waiting · {refreshedSinceLastVisit} updated</div>}
            </div>

            <Link to={`/deal/${heroDeal.id || heroDeal.asin}`} className="group relative min-h-[390px] sm:min-h-[470px] overflow-hidden bg-[#ded8ca]">
              <Image src={heroDeal.imageUrl} fallbackSrcs={heroDeal.imageGallery || []} alt={heroDeal.title} fittingType="contain" className="absolute inset-0 w-full h-full p-8 sm:p-12 group-hover:scale-[1.025] transition-transform duration-500" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 bg-gradient-to-t from-emerald-950/95 via-emerald-950/75 to-transparent text-white pt-28">
                <div className="text-[10px] uppercase tracking-[0.18em] font-black text-emerald-100">Featured deal</div>
                <h2 className="font-heading text-2xl sm:text-3xl font-bold leading-tight mt-1 max-w-xl line-clamp-2">{heroDeal.title}</h2>
                <div className="flex items-baseline gap-3 mt-3"><span className="text-3xl font-black">{formatPrice(heroDeal.salePrice)}</span>{heroDeal.originalPrice > heroDeal.salePrice && <span className="text-sm text-white/60 line-through">{formatPrice(heroDeal.originalPrice)}</span>}{heroDeal.discountPercent > 0 && <span className="bg-[#dcebdc] text-emerald-950 px-2 py-1 text-xs font-black">{heroDeal.discountPercent}% OFF</span>}</div>
              </div>
            </Link>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-px bg-emerald-950/10">
              {heroSideDeals.map((deal) => <Link key={deal.id || deal.asin} to={`/deal/${deal.id || deal.asin}`} className="group bg-white p-3 sm:p-4 flex items-center gap-3 min-h-[120px]"><div className="w-24 h-20 sm:w-28 sm:h-24 bg-[#f7f5ef] p-2 shrink-0"><Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full group-hover:scale-105 transition-transform" /></div><div className="min-w-0"><h3 className="text-xs sm:text-sm font-bold leading-snug line-clamp-2">{deal.title}</h3><div className="mt-2 flex items-baseline gap-2"><span className="text-lg font-black text-emerald-950">{formatPrice(deal.salePrice)}</span>{deal.originalPrice > deal.salePrice && <span className="text-[10px] text-slate-400 line-through">{formatPrice(deal.originalPrice)}</span>}</div>{deal.discountPercent > 0 && <div className="mt-1 text-[10px] font-black text-emerald-700">{deal.discountPercent}% OFF</div>}</div></Link>)}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-emerald-950/10 mt-5 border-y border-emerald-950/10">
            {[['Verified deals', 'Real savings, no guesswork', CheckCircle2], ['Curated for you', 'Only the good stuff', Heart], ['New deals daily', 'Fresh finds as they land', Zap], ['Price checked', 'We keep persistent deals fresh', ShieldCheck]].map(([title, text, Icon]) => <div key={title} className="bg-[#fbfaf7] px-4 py-4 flex items-start gap-3"><Icon className="w-5 h-5 text-emerald-800 mt-0.5 shrink-0" /><div><div className="text-xs font-bold text-emerald-950">{title}</div><div className="text-[10px] text-slate-500 mt-0.5">{text}</div></div></div>)}
          </div>
        </div>
      </section>
    )}

    {showCuratedHome && topDeals.length > 0 && <section className="ds-shell py-9 sm:py-12"><div className="flex items-end justify-between gap-4 mb-5"><div><div className="ds-kicker">Freshly checked · Today’s best finds</div><h2 className="ds-section-title mt-1">Today’s Top Deals</h2></div><Link to="/?category=all" className="text-xs font-bold text-emerald-900 inline-flex items-center gap-1">See all deals <ArrowRight className="w-3.5 h-3.5" /></Link></div><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{topDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} />)}</div></section>}

    {showCuratedHome && filteredPicks.length > 0 && <section className="border-y border-emerald-950/10 bg-white"><div className="ds-shell py-9 sm:py-12"><div className="mb-5"><div className="ds-kicker"><Star className="w-3.5 h-3.5 inline mr-1.5 fill-emerald-800" />Standout finds</div><h2 className="ds-section-title mt-1">DealScout Picks</h2></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{filteredPicks.map((pick) => <div key={pick.asin}><DealCard deal={pick.deal} />{pick.editorialNote && <p className="hidden sm:block mt-2 text-[11px] leading-relaxed text-slate-600 border-t border-emerald-950/10 pt-2"><strong className="text-emerald-900">Why we picked it:</strong> {pick.editorialNote}</p>}</div>)}</div></div></section>}

    <section className="ds-shell py-10 sm:py-12 pb-20">
      <div className="flex items-center gap-5 overflow-x-auto border-b border-emerald-950/10 pb-3 mb-5 text-sm whitespace-nowrap"><button onClick={() => { setActiveCat('all'); setSearchParams({ category: 'all', ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`font-bold pb-2 border-b-2 ${activeCat === 'all' ? 'text-emerald-950 border-emerald-950' : 'text-slate-500 border-transparent'}`}>All</button>{categories.map((c) => <button key={c.id} onClick={() => { setActiveCat(c.name); setSearchParams({ category: c.name, ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`font-semibold pb-2 border-b-2 ${activeCat?.toLowerCase() === c.name.toLowerCase() ? 'text-emerald-950 border-emerald-950' : 'text-slate-500 border-transparent'}`}>{c.name}</button>)}</div>

      <div className="border-y border-emerald-950/10 py-3 mb-7"><div className="flex items-center gap-2"><div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input type="text" placeholder="Search deals" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 text-sm bg-white border-emerald-950/10 rounded-none" /></div><select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-semibold border border-emerald-950/10 px-2.5 bg-white text-slate-800 max-w-[132px] sm:max-w-none">{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select><button type="button" onClick={() => setShowFilters((v) => !v)} className="h-10 w-10 border border-emerald-950/10 flex items-center justify-center md:hidden"><SlidersHorizontal className="w-4 h-4" /></button><div className="hidden md:flex items-center border border-emerald-950/10"><button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-emerald-950 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-3.5 h-3.5" /></button><button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-emerald-950 text-white' : 'text-slate-500'}`}><List className="w-3.5 h-3.5" /></button></div></div>
        <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2 mt-3`}><select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className="h-9 text-xs bg-white border border-emerald-950/10 px-2.5">{DISCOUNT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select><select value={priceTier} onChange={(e) => setPriceTier(e.target.value)} className="h-9 text-xs bg-white border border-emerald-950/10 px-2.5">{PRICE_TIERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select><span className="text-xs text-slate-400 ml-auto hidden sm:inline">{availableDeals.length} loaded</span>{personalized && <button onClick={resetPersonalization} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Reset recommendations</button>}{(hasActiveFilters || flatAllMode) && <button onClick={resetAllFilters} className="text-xs font-semibold text-rose-600 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset filters</button>}</div></div>

      {!loading && !error && exploreDeals.length > 0 && <div className="mb-5"><div className="ds-kicker">{flatAllMode ? 'Full catalog' : 'More to browse'}</div><h2 className="ds-section-title mt-1">{flatAllMode ? 'All verified deals' : 'More deals for you'}</h2></div>}
      {loading ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/3] bg-stone-100 animate-pulse" />)}</div> : error && deals.length === 0 ? <div className="text-center py-12 bg-white border border-emerald-950/10 p-8"><p>Couldn't load deals: {error}</p><Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button></div> : visibleDeals.length === 0 ? <div className="text-center py-16"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto" /><h3 className="font-bold mt-3">No deals match your filters</h3><Button onClick={resetAllFilters} variant="outline" size="sm" className="mt-3">Reset Filters</Button></div> : <>{exploreWithChapters()}<div ref={feedSentinel} className="h-10" aria-hidden="true" />{hasMore ? <div className="text-center py-6 text-xs font-semibold text-slate-400">{loadingMore ? 'Loading more verified deals…' : 'Finding more good deals…'}</div> : <div className="text-center py-10 border-t border-emerald-950/10 mt-8"><ShieldCheck className="w-5 h-5 text-emerald-700 mx-auto" /><div className="mt-2 text-sm font-bold text-emerald-950">You’ve seen today’s best deals</div><p className="text-xs text-slate-500 mt-1">Come back later for newly verified finds.</p></div>}</>}
    </section>
  </div>;
}
