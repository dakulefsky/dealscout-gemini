import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

export default function AuthLayout({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2 font-heading font-bold text-slate-900 text-xl mb-8">
        <ShoppingBag className="h-6 w-6 text-emerald-600" />
        DealScout
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          {Icon && (
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Icon className="h-6 w-6 text-emerald-700" />
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-1.5 max-w-xs">{subtitle}</p>}
        </div>

        {children}

        {footer && (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        )}
      </div>
    </div>
  );
}
