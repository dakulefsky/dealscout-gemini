import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ShoppingBag, LogIn, LogOut, Settings } from 'lucide-react';
import AffiliateBanner from '@/components/AffiliateBanner';

export default function Layout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-heading font-bold text-slate-900 text-lg">
            <ShoppingBag className="h-5 w-5 text-emerald-600" />
            DealScout
          </Link>

          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                      location.pathname === '/admin'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="h-4 w-4" /> Admin
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition"
              >
                <LogIn className="h-4 w-4" /> Log in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <AffiliateBanner />

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <span>&copy; {new Date().getFullYear()} DealScout. All rights reserved.</span>
          <Link to="/disclosure" className="hover:text-slate-600 transition">Affiliate Disclosure</Link>
        </div>
      </footer>
    </div>
  );
}
