import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DealCard from '@/components/DealCard';
import { ArrowLeft, LayoutGrid, List, TrendingDown } from 'lucide-react';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';
import { rankDeals } from '@/lib/dealRanking';

const SORTS = [
  { key: 'best', label: 'Best deals' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('best');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    setLoading(true);
    categoriesApi.list()
      .then((cats) => {
        const found = cats?.find((c) => c.slug === slug || c.name.toLowerCase() === slug?.toLowerCase());
        setCategory(found || null);
        if (found) return dealsApi.list({ status: 'APPROVED', category: found.name, limit: 50 }).then((rows) => setDeals(rows || []));
        setDeals([]);
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [slug]);

  const visibleDeals = useMemo(() => {
    const list = [...deals];
    if (sort === 'best') return rankDeals(list);
    if (sort === 'discount') return list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    if (sort === 'price-low') return list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
    if (sort === 'price-high') return list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
    return list.sort((a, b) => Number(b.createdAt || b.created_at || 0) - Number(a.createdAt || a.created_at || 0));
  }, [deals, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"><ArrowLeft className="h-4 w-4" /> Back to deals</Link>

      <section className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-1.5">Category</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-950">{category ? category.name : 'Category'}</h1>
          {category?.description && <p className="mt-1.5 text-sm text-slate-600 max-w-2xl leading-relaxed">{category.description}</p>}
          {!loading && <p className="text-xs text-slate-400 mt-2">{visibleDeals.length} active deal{visibleDeals.length === 1 ? '' : 's'}</p>}
        </div>

        <div className="flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 text-xs sm:text-sm font-bold border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 focus:outline-none">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button type="button" onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button type="button" onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"><div className="aspect-[4/3] bg-slate-100" /><div className="p-3 sm:p-4 space-y-3"><div className="h-4 bg-slate-100 rounded" /><div className="h-6 w-24 bg-slate-100 rounded" /></div></div>)}</div>
      ) : visibleDeals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-10 max-w-md mx-auto"><TrendingDown className="h-10 w-10 text-slate-300 mx-auto mb-3" /><h3 className="text-base font-bold text-slate-900">No active deals here right now</h3><p className="text-sm text-slate-500 mt-1">Check back soon for new price drops.</p></div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 auto-rows-fr items-stretch">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="grid" />)}</div>
      ) : (
        <div className="space-y-3.5">{visibleDeals.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} viewMode="list" />)}</div>
      )}
    </div>
  );
}
