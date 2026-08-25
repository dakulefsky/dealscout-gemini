import { useEffect, useMemo, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import DealCard from '@/components/DealCard';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';

const SORTS = [
  { key: 'newest',     label: 'Newest' },
  { key: 'discount',   label: 'Biggest Discount' },
  { key: 'price-low',  label: 'Price: Low to High' },
  { key: 'price-high', label: 'Price: High to Low' },
];

export default function Home() {
  const [deals, setDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('newest');
  const [activeCat, setActiveCat] = useState('all');

  useEffect(() => {
    Promise.all([
      dealsApi.list({ status: 'APPROVED', limit: 50 }),
      categoriesApi.list(),
    ])
      .then(([d, c]) => { setDeals(d); setCategories(c); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visibleDeals = useMemo(() => {
    let list = [...deals];
    if (activeCat !== 'all') list = list.filter((d) => d.category === activeCat);
    switch (sort) {
      case 'discount':   list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)); break;
      case 'price-low':  list.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0)); break;
      case 'price-high': list.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0)); break;
      default:           list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    return list;
  }, [deals, activeCat, sort]);

  return (
    <>
      <section className="bg-gradient-to-b from-emerald-50 to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <TrendingDown className="h-3.5 w-3.5" />
            Verified price drops, updated daily
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight max-w-2xl">
            Today's best <span className="text-emerald-600">Amazon deals</span>, verified and explained.
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl">
            Every deal is hand-reviewed by our team and clearly flagged for data quality — so you know exactly what you're buying before you click.
          </p>
          {!loading && !error && (
            <p className="mt-6 text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{deals.length}</span> approved deals live now
            </p>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCat('all')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                activeCat === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.name)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                  activeCat === c.name ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-200" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="h-4 w-full bg-slate-200 rounded" />
                  <div className="h-4 w-2/3 bg-slate-200 rounded" />
                  <div className="h-6 w-24 bg-slate-200 rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-slate-500">Couldn't load deals. Please try again later.</p>
          </div>
        ) : visibleDeals.length === 0 ? (
          <div className="text-center py-16">
            <TrendingDown className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {deals.length === 0 ? 'No approved deals yet. Check back soon!' : 'No deals match your filters.'}
            </p>
            {deals.length > 0 && (
              <button
                onClick={() => { setActiveCat('all'); setSort('newest'); }}
                className="mt-3 text-sm text-emerald-600 font-medium hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {visibleDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
          </div>
        )}
      </section>
    </>
  );
}
