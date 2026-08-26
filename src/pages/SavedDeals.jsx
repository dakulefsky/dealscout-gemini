import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useBookmarks } from '@/lib/BookmarksContext';
import DealCard from '@/components/DealCard';
import { Button } from '@/components/ui/button';

export default function SavedDeals() {
  const { savedDealsList, isLoading } = useBookmarks();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 mb-3">
            <Heart className="w-3.5 h-3.5 fill-rose-600" />
            Your Wishlist
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black text-slate-900">
            Saved Deals ({savedDealsList.length})
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1.5">
            Keep track of your favorite Amazon deals and curated product discounts.
          </p>
        </div>

        <Link to="/">
          <Button variant="outline" className="gap-2 rounded-xl text-slate-700">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            Browse All Deals
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 auto-rows-fr">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse space-y-3">
              <div className="aspect-square bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : savedDealsList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">No Saved Deals Yet</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Tap the heart icon on any deal to save it to your wishlist for quick access later.
            </p>
          </div>
          <Link to="/" className="inline-block">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2 px-6">
              Explore Today's Deals <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 auto-rows-fr items-stretch">
          {savedDealsList.map((deal) => (
            <DealCard key={deal.id || deal.asin} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
