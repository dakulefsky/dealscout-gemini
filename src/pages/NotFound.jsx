import { Link } from 'react-router-dom';
import { ArrowRight, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="ds-shell py-20 sm:py-28">
      <section className="max-w-2xl border-y border-emerald-950/10 py-12 sm:py-16">
        <SearchX className="w-8 h-8 text-emerald-800" />
        <div className="ds-kicker mt-5">404</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-emerald-950 mt-2">That page isn’t here.</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-4 max-w-lg">The link may be old, mistyped, or the page may have moved.</p>
        <Link to="/" className="mt-7 inline-flex items-center gap-2 bg-emerald-950 text-white px-5 py-3 text-sm font-bold hover:bg-emerald-900">Back to current deals <ArrowRight className="w-4 h-4" /></Link>
      </section>
    </div>
  );
}
