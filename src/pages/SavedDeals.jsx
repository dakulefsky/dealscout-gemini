import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useBookmarks } from '@/lib/BookmarksContext';
import DealCard from '@/components/DealCard';
import { Button } from '@/components/ui/button';

export default function SavedDeals() {
  const { savedDealsList, isLoading } = useBookmarks();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-600 mb-2"><Heart className="w-3.5 h-3.5 fill-rose-600" /> Saved</div>
          <h1 className="font-heading text-2xl sm:text-4xl font-black text-slate-950">Saved Deals</h1>
          <p className="text-sm text-slate-500 mt-1.5">Keep your favorite deals in one place and come back to them quickly.</p>
          {!isLoading && <p className="text-xs text-slate-400 mt-2">{savedDealsList.length} saved deal{savedDealsList.length === 1 ? '' : 's'}</p>}
        </div>

        <Link to="/"><Button variant="outline" className="gap-2 rounded-xl text-slate-700"><ShoppingBag className="w-4 h-4 text-emerald-600" /> Browse deals</Button></Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">{[1, 2, 3, 4].map((n) => <div key={n} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"><div className="aspect-[4/3] bg-slate-100" /><div className="p-3 sm:p-4 space-y-3"><div className="h-4 bg-slate-100 rounded" /><div className="h-5 w-24 bg-slate-100 rounded" /></div></div>)}</div>
      ) : savedDealsList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto"><Heart className="w-7 h-7" /></div>
          <div className="space-y-2"><h3 className="text-lg sm:text-xl font-black text-slate-900">Nothing saved yet</h3><p className="text-sm text-slate-500 leading-relaxed">Tap the heart on any deal and it will show up here.</p></div>
          <Link to="/" className="inline-block"><Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2 px-6">Browse deals <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 auto-rows-fr items-stretch">{savedDealsList.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} />)}</div>
      )}
    </div>
  );
}
