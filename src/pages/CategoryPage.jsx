import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import DealCard from '@/components/DealCard';
import { ArrowLeft, LayoutGrid, List, Tag, TrendingDown } from 'lucide-react';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest Discount' },
  { key: 'rating', label: 'Top Rated' },
  { key: 'price-low', label: 'Price: Low to High' },
  { key: 'price-high', label: 'Price: High to Low' },
];

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    setLoading(true);
    categoriesApi
      .list()
      .then((cats) => {
        const found = cats?.find((c) => c.slug === slug || c.name.toLowerCase() === slug?.toLowerCase());
        setCategory(found || null);
        if (found) {
          return dealsApi.list({ status: 'APPROVED', category: found.name, limit: 50 }).then(setDeals);
        }
        setDeals([]);
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [slug]);

  const visibleDeals = useMemo(() => {
    let list = [...deals];
    switch (sort) {
      case 'discount':
        list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
        break;
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'price-low':
        list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
        break;
      case 'price-high':
        list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
        break;
      default:
        list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    return list;
  }, [deals, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to all deals
      </Link>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full mb-2">
            <Tag className="w-3.5 h-3.5" /> Category Hub
          </div>
          <h1 className="font-heading text-3xl font-black text-slate-900">
            {category ? category.name : 'Category'}
          </h1>
          {category?.description && (
            <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              {category.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition ${
                viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 auto-rows-fr">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 animate-pulse p-4 space-y-3">
              <div className="aspect-square bg-slate-100 rounded-xl" />
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-6 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : visibleDeals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-10 max-w-md mx-auto">
          <TrendingDown className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No active deals in this category</h3>
          <p className="text-sm text-slate-500 mt-1">Check back soon as editors curate daily price drops.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 auto-rows-fr items-stretch">
          {visibleDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} viewMode="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} viewMode="list" />
          ))}
        </div>
      )}
    </div>
  );
}
