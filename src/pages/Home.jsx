import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingDown, Search, LayoutGrid, List, RotateCcw, ShieldCheck, Star } from 'lucide-react';
import DealCard from '@/components/DealCard';
import { deals as dealsApi, categories as categoriesApi, editorial as editorialApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SORTS = [
  { key: 'newest', label: 'Newest Deals' },
  { key: 'discount', label: 'Biggest Discount' },
  { key: 'price-low', label: 'Price: Low to High' },
  { key: 'price-high', label: 'Price: High to Low' },
];

const DISCOUNT_TIERS = [
  { value: 0, label: 'All Discounts' },
  { value: 15, label: '15%+ Off' },
  { value: 25, label: '25%+ Off' },
  { value: 30, label: '30%+ Off' },
  { value: 50, label: '50%+ Off' },
];

const PRICE_TIERS = [
  { value: 'all', label: 'Any Price' },
  { value: 'under-50', label: 'Under $50', max: 50 },
  { value: '50-150', label: '$50 – $150', min: 50, max: 150 },
  { value: '150-300', label: '$150 – $300', min: 150, max: 300 },
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
  const [sort, setSort] = useState('newest');
  const [minDiscount, setMinDiscount] = useState(0);
  const [priceTier, setPriceTier] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

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
    if (activeCat !== 'all') list = list.filter((d) => d.category && d.category.toLowerCase() === activeCat.toLowerCase());
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      list = list.filter((d) => d.title?.toLowerCase().includes(term) || d.shortBio?.toLowerCase().includes(term) || d.category?.toLowerCase().includes(term) || d.asin?.toLowerCase().includes(term));
    }
    if (minDiscount > 0) list = list.filter((d) => (d.discountPercent || 0) >= minDiscount);
    const selectedPriceTier = PRICE_TIERS.find((p) => p.value === priceTier);
    if (selectedPriceTier?.value !== 'all') {
      if (selectedPriceTier.min != null) list = list.filter((d) => (d.salePrice || 0) >= selectedPriceTier.min);
      if (selectedPriceTier.max != null) list = list.filter((d) => (d.salePrice || 0) <= selectedPriceTier.max);
    }
    if (sort === 'discount') list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    else if (sort === 'price-low') list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
    else if (sort === 'price-high') list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
    else list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    return list;
  }, [deals, activeCat, searchQuery, minDiscount, priceTier, sort]);

  const hasActiveFilters = activeCat !== 'all' || searchQuery.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'newest';
  const resetAllFilters = () => {
    setActiveCat('all'); setSearchQuery(''); setMinDiscount(0); setPriceTier('all'); setSort('newest'); setSearchParams({});
  };

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
          <div className="max-w-3xl space-y-3">
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Verified Amazon Price Drops</h1>
            <p className="text-base text-slate-600 leading-normal">Automated deal discovery with provider-verified pricing. Deals explicitly chosen by a human are labeled separately as DealScout Picks.</p>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
              <ShieldCheck className="w-4 h-4" /> No invented prices or discounts
            </div>
          </div>
        </div>
      </section>

      {picks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-6">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700"><Star className="w-4 h-4 fill-emerald-600 text-emerald-600" /> Human selected</div>
                <h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 mt-1">DealScout Picks</h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">Verified deals that received an explicit human editorial decision.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {picks.map((pick) => (
                <div key={pick.asin} className="flex flex-col gap-2">
                  <DealCard deal={pick.deal} viewMode="grid" />
                  {pick.editorialNote && (
                    <div className="rounded-xl bg-white border border-emerald-200 px-3 py-2 text-xs text-slate-700 leading-relaxed">
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
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none mb-4">
          <button onClick={() => { setActiveCat('all'); setSearchParams(searchQuery ? { q: searchQuery } : {}); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${activeCat === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>All Deals ({deals.length})</button>
          {categories.map((c) => {
            const count = deals.filter((d) => d.category?.toLowerCase() === c.name.toLowerCase()).length;
            return (
              <button key={c.id} onClick={() => { setActiveCat(c.name); setSearchParams({ category: c.name, ...(searchQuery ? { q: searchQuery } : {}) }); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${activeCat?.toLowerCase() === c.name.toLowerCase() ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                {c.name} {count > 0 && <span className="opacity-75 text-xs font-normal">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input type="text" placeholder="Filter deals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-xl" />
            </div>
            <select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className="h-8 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700">
              {DISCOUNT_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={priceTier} onChange={(e) => setPriceTier(e.target.value)} className="h-8 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700">
              {PRICE_TIERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {hasActiveFilters && <button type="button" onClick={resetAllFilters} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 transition"><RotateCcw className="w-3 h-3" /> Reset</button>}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Sort:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 text-xs font-semibold border border-slate-200 rounded-xl px-2.5 bg-slate-50 text-slate-800">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button type="button" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`} title="Grid View"><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`} title="List View"><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"><div className="aspect-square bg-slate-100" /><div className="p-4 space-y-3"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded" /><div className="h-5 w-24 bg-slate-100 rounded" /></div></div>)}
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8"><p className="text-slate-600 font-medium">Couldn't load deals: {error}</p><Button onClick={() => window.location.reload()} className="mt-4 bg-emerald-600 text-white">Try Again</Button></div>
        ) : visibleDeals.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto space-y-3"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto" /><h3 className="text-base font-bold text-slate-900">No deals match your criteria</h3><p className="text-xs text-slate-500">Try adjusting your filters or resetting them.</p><Button onClick={resetAllFilters} variant="outline" size="sm" className="rounded-xl font-semibold text-emerald-600 hover:bg-emerald-50 mt-2">Reset Filters</Button></div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 auto-rows-fr items-stretch">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div>
        ) : (
          <div className="space-y-3.5">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>
        )}
      </section>
    </div>
  );
}
