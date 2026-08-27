import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useBookmarks } from '@/lib/BookmarksContext';
import { Image } from '@/components/ui/image';
import { ShoppingBag, LogIn, LogOut, Settings, Heart, Search, X } from 'lucide-react';
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    categoriesApi.list().then((res) => setCategoriesList(res || [])).catch(() => setCategoriesList([]));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setIsSearchOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const value = searchQuery.trim();
    if (!value) return;
    setIsSearchOpen(false);
    setMobileSearchOpen(false);
    navigate(`/?q=${encodeURIComponent(value)}`);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
  }

  const searchBox = (mobile = false) => (
    <div className="relative w-full">
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            ref={mobile ? undefined : searchRef}
            autoFocus={mobile}
            type="search"
            placeholder="Search deals"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
            onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
            className="w-full pl-9 pr-8 h-10 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition"
          />
          {searchQuery && <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
        </div>
      </form>

      {isSearchOpen && searchQuery.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 p-2">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching deals.</div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((deal) => (
                <Link key={deal.id || deal.asin} to={`/deal/${deal.id || deal.asin}`} onClick={() => setIsSearchOpen(false)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 p-1 shrink-0"><Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full" /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-900 truncate">{deal.title}</h4>
                    <div className="flex items-center gap-2 text-[11px] mt-0.5"><span className="font-black text-emerald-700">${Number(deal.salePrice || 0).toFixed(2)}</span>{deal.discountPercent > 0 && <span className="text-emerald-700 font-semibold">{deal.discountPercent}% off</span>}</div>
                  </div>
                </Link>
              ))}
              <button type="button" onClick={() => handleSearchSubmit({ preventDefault() {} })} className="w-full text-center text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl p-2">See all results</button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3 sm:gap-5">
          <Link to="/" className="flex items-center gap-2 font-heading font-black text-slate-900 text-lg sm:text-xl tracking-tight shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs"><ShoppingBag className="h-4 w-4" /></div>
            <span>Deal<span className="text-emerald-600">Scout</span></span>
          </Link>

          <div className="relative flex-1 max-w-md hidden md:block">{searchBox(false)}</div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={() => setMobileSearchOpen((v) => !v)} className={`md:hidden w-9 h-9 rounded-xl flex items-center justify-center ${mobileSearchOpen ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`} title="Search"><Search className="h-4 w-4" /></button>
            <Link to="/saved" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-2 rounded-xl transition ${location.pathname === '/saved' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Heart className={`h-4 w-4 ${savedDealIds.length > 0 ? 'text-rose-600 fill-rose-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Saved</span>
              {savedDealIds.length > 0 && <span className="bg-rose-600 text-white text-[9px] font-bold min-w-4 h-4 px-1 rounded-full inline-flex items-center justify-center">{savedDealIds.length}</span>}
            </Link>

            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && <Link to="/admin" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-2 rounded-xl transition ${location.pathname.startsWith('/admin') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><Settings className="h-4 w-4" /><span className="hidden sm:inline">Admin</span></Link>}
                <button onClick={logout} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2 sm:px-3 py-2 rounded-xl transition"><LogOut className="h-4 w-4" /><span className="hidden lg:inline">Logout</span></button>
              </>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 sm:px-3 py-2 rounded-xl transition"><LogIn className="h-4 w-4" /><span className="hidden sm:inline">Login</span></Link>
            )}
          </nav>
        </div>

        {mobileSearchOpen && <div className="md:hidden max-w-7xl mx-auto px-4 pb-3">{searchBox(true)}</div>}
      </header>

      <main className="flex-1">{children}</main>
      <AffiliateBanner />

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2 font-heading font-black text-slate-900 text-base"><div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center"><ShoppingBag className="h-3.5 w-3.5" /></div><span>DealScout</span></div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">Amazon price drops and standout deals, organized so they're easy to scan.</p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Categories</h4>
              <ul className="space-y-1.5 text-xs">{categoriesList.slice(0, 5).map((c) => <li key={c.id}><Link to={`/category/${c.slug}`} className="text-slate-600 hover:text-emerald-600 transition">{c.name}</Link></li>)}</ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">More</h4>
              <ul className="space-y-1.5 text-xs"><li><Link to="/disclosure" className="text-slate-600 hover:text-emerald-600 transition">Affiliate Disclosure</Link></li><li><Link to="/saved" className="text-slate-600 hover:text-emerald-600 transition">Saved Deals</Link></li></ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 text-center sm:text-left"><span>&copy; {new Date().getFullYear()} DealScout. Amazon and the Amazon logo are trademarks of Amazon.com, Inc.</span><span>As an Amazon Associate I earn from qualifying purchases.</span></div>
        </div>
      </footer>
    </div>
  );
}
