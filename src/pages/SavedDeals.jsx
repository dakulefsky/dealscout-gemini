import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Bookmark } from 'lucide-react';
import { useBookmarks } from '@/lib/BookmarksContext';
import DealCard from '@/components/DealCard';

export default function SavedDeals() {
  const { savedDealsList, isLoading } = useBookmarks();

  return (
    <div className="ds-shell py-8 sm:py-12 pb-20">
      <header className="border-y border-emerald-950/10 py-7 sm:py-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="ds-kicker inline-flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 fill-emerald-800" /> Your shortlist</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-emerald-950 mt-2">Saved deals</h1>
          <p className="text-sm text-slate-600 mt-3 max-w-xl">A clean place to keep the finds you actually want to come back to.</p>
          {!isLoading && <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-400 mt-4">{savedDealsList.length} saved deal{savedDealsList.length === 1 ? '' : 's'}</div>}
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-950 border-b border-emerald-950 pb-1 w-fit">Keep shopping <ArrowRight className="w-4 h-4" /></Link>
      </header>

      <main className="pt-8 sm:pt-10">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{[1, 2, 3, 4].map((n) => <div key={n} className="border border-emerald-950/10 bg-white animate-pulse"><div className="aspect-[4/3] bg-stone-100" /><div className="p-4 space-y-3"><div className="h-3 bg-stone-100" /><div className="h-5 w-24 bg-stone-100" /></div></div>)}</div>
        ) : savedDealsList.length === 0 ? (
          <section className="max-w-3xl mx-auto py-16 sm:py-24 text-center border-y border-emerald-950/10">
            <Bookmark className="w-9 h-9 mx-auto text-emerald-800" />
            <div className="ds-kicker mt-5">Nothing here yet</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-emerald-950 mt-2">Build a shortlist worth revisiting.</h2>
            <p className="text-sm text-slate-500 leading-relaxed mt-4 max-w-md mx-auto">Save a deal from any product card and it will stay collected here for quick comparison later.</p>
            <Link to="/" className="mt-7 inline-flex items-center gap-2 bg-emerald-950 text-white px-5 py-3 text-sm font-bold hover:bg-emerald-900">Browse today’s deals <ArrowRight className="w-4 h-4" /></Link>
          </section>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr items-stretch">{savedDealsList.map((deal) => <DealCard key={deal.id || deal.asin} deal={deal} />)}</div>
        )}
      </main>
    </div>
  );
}
