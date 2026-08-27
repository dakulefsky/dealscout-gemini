import { Link } from 'react-router-dom';

export default function AffiliateBanner() {
  return (
    <div className="bg-slate-100 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3 text-center">
        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
          As an Amazon Associate I earn from qualifying purchases.{' '}
          <Link to="/disclosure" className="underline underline-offset-2 hover:text-slate-900">
            See how DealScout verifies and reviews deals.
          </Link>
        </p>
      </div>
    </div>
  );
}
