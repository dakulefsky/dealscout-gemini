import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DealCard from '@/components/DealCard';
import { ArrowLeft } from 'lucide-react';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    categoriesApi.list({ slug })
      .then((cats) => {
        const cat = cats?.[0] ?? null;
        setCategory(cat);
        if (cat) {
          return dealsApi.list({ status: 'APPROVED', category: cat.name, limit: 50 }).then(setDeals);
        }
        setDeals([]);
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft className="h-4 w-4" /> All deals
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900">
          {category ? category.name : 'Category'}
        </h1>
        {category?.description && <p className="mt-2 text-slate-600 max-w-2xl">{category.description}</p>}
        {!loading && !category && (
          <p className="mt-2 text-sm text-rose-500">Category "{slug}" not found.</p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-full bg-slate-200 rounded" />
                <div className="h-6 w-24 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <p className="text-slate-500 py-16 text-center">No approved deals in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
        </div>
      )}
    </div>
  );
}
