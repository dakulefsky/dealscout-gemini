import { Link } from 'react-router-dom';

export default function AffiliateBanner() {
  return (
    <div className="bg-slate-100 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3 text-center">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          DealScout is a participant in the Amazon Services LLC Associates Program.{' '}
          <Link to="/disclosure" className="underline hover:text-slate-700">
            Affiliate Disclosure
          </Link>
        </p>
      </div>
    </div>
  );
}
