import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingDown, Search, LayoutGrid, List, RotateCcw, ShieldCheck, Star, SlidersHorizontal } from 'lucide-react';
import DealCard from '@/components/DealCard';
import { deals as dealsApi, categories as categoriesApi, editorial as editorialApi } from '@/lib/api';
import { rankDeals } from '@/lib/dealRanking';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SORTS = [
  { key: 'best', label: 'Best deals' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];

const DISCOUNT_TIERS = [
  { value: 0, label: 'Any discount' },
  { value: 15, label: '15%+ off' },
  { value: 25, label: '25%+ off' },
  { value: 30, label: '30%+ off' },
  { value: 50, label: '50%+ off' },
];

const PRICE_TIERS = [
  { value: 'all', label: 'Any price' },
  { value: 'under-50', label: 'Under $50', max: 50 },
  { value: '50-150', label: '$50–$150', min: 50, max: 150 },
  { value: '150-300', label: '$150–$300', min: 150, max: 300 },
  { value: 'over-300', label: '$300+', min: 300 },
];

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCat, setActiveCat] = useState(searchParams.get('category') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('best');
  const [minDiscount, setMinDiscount] = useState(0);
  const [priceTier, setPriceTier] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearchQuery(q);
    const c = searchParams.get('category');
    if (c !== null) setActiveCat(c);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      dealsApi.list({ status: 'APPROVED', limit: 100 }),
      categoriesApi.list(),
      editorialApi.picks(4).catch(() => ({ picks: [] })),
    ])
      .then(([d, c, p]) => {
        setDeals(d || []);
        setCategories(c || []);
        setPicks(p?.picks || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visibleDeals = useMemo(() => {
    let list = [...deals];
    if (activeCat !== 'all') list = list.filter((d) => d.category?.toLowerCase() === activeCat.toLowerCase());
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      list = list.filter((d) => d.title?.toLowerCase().includes(term) || d.category?.toLowerCase().includes(term) || d.asin?.toLowerCase().includes(term));
    }
    if (minDiscount > 0) list = list.filter((d) => (d.discountPercent || 0) >= minDiscount);
    const selectedPriceTier = PRICE_TIERS.find((p) => p.value === priceTier);
    if (selectedPriceTier?.value !== 'all') {
      if (selectedPriceTier.min != null) list = list.filter((d) => (d.salePrice || 0) >= selectedPriceTier.min);
      if (selectedPriceTier.max != null) list = list.filter((d) => (d.salePrice || 0) <= selectedPriceTier.max);
    }

    if (sort === 'best') return rankDeals(list);
    if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
    if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
    return list.sort((a, b) => Number(b.createdAt || b.created_at || 0) - Number(a.createdAt || a.created_at || 0));
  }, [deals, activeCat, searchQuery, minDiscount, priceTier, sort]);

  const hasActiveFilters = activeCat !== 'all' || searchQuery.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'best';
  const resetAllFilters = () => {
    setActiveCat('all');
    setSearchQuery('');
    setMinDiscount(0);
    setPriceTier('all');
    setSort('best');
    setSearchParams({});
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 py-7 sm:py-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> Prices checked regularly
            </div>
            <h1 className="font-heading text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-[1.05]">Great Amazon deals, without the clutter.</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-3 max-w-2xl">Scan the strongest price drops first, then filter by category, discount, or price when you want to dig deeper.</p>
          </div>
        </div>
      </section>

      {picks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="rounded-2xl sm:rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700"><Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" /> Standout finds</div>
                <h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 mt-1">DealScout Picks</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {picks.map((pick) => (
                <div key={pick.asin} className="flex flex-col gap-2 min-w-0">
                  <DealCard deal={pick.deal} viewMode="grid" />
                  {pick.editorialNote && (
                    <div className="hidden sm:block rounded-xl bg-white border border-emerald-200 px-3 py-2 text-xs text-slate-700 leading-relaxed">
                      <span className="font-bold text-emerald-800">Why we picked it: </span>{pick.editorialNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none mb-2">
          <button onClick={() => { setActiveCat('all'); setSearchParams(searchQuery ? { q: searchQuery } : {}); }} className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${activeCat === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>All ({deals.length})</button>
          {categories.map((c) => {
            const count = deals.filter((d) => d.category?.toLowerCase() === c.name.toLowerCase()).length;
            return (
              <button key={c.id} onClick={() => { setActiveCat(c.name); setSearchParams({ category: c.name, ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${activeCat?.toLowerCase() === c.name.toLowerCase() ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                {c.name}{count > 0 && <span className="opacity-70 text-xs font-normal"> {count}</span>}
              </button>
            );
          })}
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs mb-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="text" placeholder="Search deals" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 text-sm bg-slate-50 border-slate-200 rounded-xl" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl px-2.5 bg-slate-50 text-slate-800 max-w-[132px] sm:max-w-none">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => setShowFilters((value) => !value)} className={`h-10 w-10 rounded-xl border flex items-center justify-center md:hidden ${showFilters || minDiscount > 0 || priceTier !== 'all' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`} title="Filters"><SlidersHorizontal className="w-4 h-4" /></button>
            <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button type="button" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`} title="Grid View"><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`} title="List View"><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100`}>
            <select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className="h-9 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700">
              {DISCOUNT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={priceTier} onChange={(e) => setPriceTier(e.target.value)} className="h-9 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700">
              {PRICE_TIERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <span className="text-xs text-slate-400 ml-auto hidden sm:inline">{visibleDeals.length} deals</span>
            {hasActiveFilters && <button type="button" onClick={resetAllFilters} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50"><RotateCcw className="w-3 h-3" /> Reset</button>}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"><div className="aspect-[4/3] bg-slate-100" /><div className="p-3 sm:p-4 space-y-3"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded" /><div className="h-5 w-24 bg-slate-100 rounded" /></div></div>)}</div>
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8"><p className="text-slate-600 font-medium">Couldn't load deals: {error}</p><Button onClick={() => window.location.reload()} className="mt-4 bg-emerald-600 text-white">Try Again</Button></div>
        ) : visibleDeals.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto space-y-3"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto" /><h3 className="text-base font-bold text-slate-900">No deals match your filters</h3><p className="text-xs text-slate-500">Try widening the discount or price range.</p><Button onClick={resetAllFilters} variant="outline" size="sm" className="rounded-xl font-semibold text-emerald-600 mt-2">Reset Filters</Button></div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 auto-rows-fr items-stretch">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div>
        ) : (
          <div className="space-y-3.5">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>
        )}
      </section>
    </div>
  );
}