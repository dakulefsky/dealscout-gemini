import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useBookmarks } from '@/lib/BookmarksContext';
import {
  ShoppingBag,
  LogIn,
  LogOut,
  Settings,
  Heart,
  Search,
  X
} from 'lucide-react';
import AffiliateBanner from '@/components/AffiliateBanner';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';

export default function Layout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { savedDealIds } = useBookmarks();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    async function loadCats() {
      try {
        const res = await categoriesApi.list();
        setCategoriesList(res || []);
      } catch (err) {
        console.error('Failed to load categories in header:', err);
      }
    }
    loadCats();
  }, []);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await dealsApi.list({ q: searchQuery, status: 'APPROVED', limit: 6 });
        setSearchResults(results || []);
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Search query failed:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Main Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 font-heading font-black text-slate-900 text-xl tracking-tight shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span>
              Deal<span className="text-emerald-600">Scout</span>
            </span>
          </Link>

          {/* Instant Search Bar */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search deals... (Press '/' to focus)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Instant Search Dropdown Popover */}
            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 p-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">
                  Matching Deals ({searchResults.length})
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No verified deals found for "{searchQuery}".
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((deal) => (
                      <Link
                        key={deal.id || deal.asin}
                        to={`/deal/${deal.id || deal.asin}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition"
                      >
                        <img
                          src={deal.imageUrl}
                          alt={deal.title}
                          className="w-9 h-9 object-contain rounded-lg bg-white border border-slate-100 p-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 truncate">
                            {deal.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-bold text-emerald-600">${Number(deal.salePrice).toFixed(2)}</span>
                            {deal.discountPercent > 0 && (
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">
                                -{deal.discountPercent}%
                              </span>
                            )}
                            <span className="text-slate-400 truncate">{deal.category}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Navigation & Actions */}
          <nav className="flex items-center gap-2">
            {/* Wishlist / Saved Deals Link */}
            <Link
              to="/saved"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition ${
                location.pathname === '/saved'
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Heart className={`h-4 w-4 ${savedDealIds.length > 0 ? 'text-rose-600 fill-rose-600' : 'text-slate-400'}`} />
              <span>Saved</span>
              {savedDealIds.length > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {savedDealIds.length}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition ${
                      location.pathname === '/admin'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Admin</span>
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-xl transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
              >
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1">{children}</main>

      <AffiliateBanner />

      {/* Modern Clean Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2 font-heading font-black text-slate-900 text-base">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <ShoppingBag className="h-3.5 w-3.5" />
                </div>
                <span>DealScout</span>
              </div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Hand-curated daily Amazon deals verified for real discount value.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Categories
              </h4>
              <ul className="space-y-1.5 text-xs">
                {categoriesList.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/category/${c.slug}`}
                      className="text-slate-600 hover:text-emerald-600 transition"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Legal
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/disclosure" className="text-slate-600 hover:text-emerald-600 transition">
                    Affiliate Disclosure
                  </Link>
                </li>
                <li>
                  <Link to="/saved" className="text-slate-600 hover:text-emerald-600 transition">
                    Saved Deals
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>&copy; {new Date().getFullYear()} DealScout. Amazon and the Amazon logo are trademarks of Amazon.com, Inc.</span>
            <span>Independent Amazon Associate</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
