import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useBookmarks } from '@/lib/BookmarksContext';
import { Image } from '@/components/ui/image';
import { LogOut, Settings, Heart, Search, X, Loader2, Menu } from 'lucide-react';
import AffiliateBanner from '@/components/AffiliateBanner';
import { deals as dealsApi, categories as categoriesApi } from '@/lib/api';

const SEARCH_DEBOUNCE_MS = 200;
const NAV_LIMIT = 8;

export default function Layout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { savedDealIds } = useBookmarks();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    categoriesApi.list().then((result) => setCategoriesList(result || [])).catch(() => setCategoriesList([]));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setMobileSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await dealsApi.list({ q: query, status: 'APPROVED', limit: 6 }, { signal: controller.signal, timeoutMs: 8000 });
        setSearchResults(results || []);
        setIsSearchOpen(true);
      } catch (error) {
        if (error?.name !== 'AbortError') setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [searchQuery]);

  useEffect(() => {
    setIsSearchOpen(false);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  function handleSearchSubmit(event) {
    event.preventDefault();
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            ref={mobile ? undefined : searchRef}
            autoFocus={mobile}
            type="search"
            placeholder="Search products, brands, or categories…"
            value={searchQuery}
            onChange={(event) => { setSearchQuery(event.target.value); setIsSearchOpen(true); }}
            onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
            className="w-full pl-10 pr-9 h-11 rounded-md border border-emerald-950/10 bg-stone-100/80 text-sm text-emerald-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800/30 focus:bg-white transition"
          />
          {searchQuery && <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X className="h-4 w-4" /></button>}
        </div>
      </form>

      {isSearchOpen && searchQuery.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-emerald-950/10 shadow-2xl overflow-hidden z-50">
          {searchLoading ? (
            <div className="p-5 flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</div>
          ) : searchResults.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-500">No matching deals.</div>
          ) : (
            <div>
              {searchResults.map((deal) => (
                <Link key={deal.id || deal.asin} to={`/deal/${deal.id || deal.asin}`} className="flex items-center gap-3 p-3 border-b border-emerald-950/5 last:border-b-0 hover:bg-stone-50">
                  <div className="w-12 h-12 bg-white p-1 shrink-0"><Image src={deal.imageUrl} fallbackSrcs={deal.imageGallery || []} alt={deal.title} fittingType="contain" className="w-full h-full" /></div>
                  <div className="flex-1 min-w-0"><h4 className="text-xs font-semibold text-slate-900 truncate">{deal.title}</h4><div className="text-[11px] mt-1"><span className="font-black text-emerald-950">${Number(deal.salePrice || 0).toFixed(2)}</span>{deal.discountPercent > 0 && <span className="ml-2 text-emerald-700 font-bold">{deal.discountPercent}% off</span>}</div></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const topCategories = categoriesList.slice(0, NAV_LIMIT);

  return (
    <div className="min-h-screen bg-[#fbfaf7] flex flex-col font-sans text-slate-950">
      <header className="sticky top-0 z-40 bg-[#fbfaf7]/95 backdrop-blur-md border-b border-emerald-950/10">
        <div className="ds-shell">
          <div className="h-16 sm:h-[72px] flex items-center gap-3 sm:gap-6">
            <Link to="/" className="shrink-0 leading-none">
              <div className="font-heading text-[27px] sm:text-[34px] font-bold tracking-[-0.04em] text-emerald-950">DealScout</div>
              <div className="hidden sm:block text-[9px] text-slate-500 mt-0.5 tracking-wide">Good deals. No digging.</div>
            </Link>

            <div className="relative flex-1 max-w-2xl hidden md:block">{searchBox(false)}</div>

            <nav className="ml-auto flex items-center gap-1 sm:gap-4">
              <button type="button" onClick={() => setMobileSearchOpen((value) => !value)} className="md:hidden w-9 h-9 flex items-center justify-center text-slate-700" title="Search"><Search className="h-4 w-4" /></button>
              <Link to="/saved" className="relative inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-900 py-2">
                <Heart className={`h-4 w-4 ${savedDealIds.length ? 'text-rose-600 fill-rose-600' : ''}`} />
                <span className="hidden sm:inline">Saved</span>
                {savedDealIds.length > 0 && <span className="absolute -top-0.5 -right-2 bg-rose-600 text-white text-[8px] font-bold min-w-4 h-4 px-1 rounded-full inline-flex items-center justify-center">{savedDealIds.length}</span>}
              </Link>
              {isAuthenticated && user?.role === 'admin' && <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-900 py-2"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Admin</span></Link>}
              {isAuthenticated && user?.role === 'admin' && <button onClick={logout} className="inline-flex items-center text-slate-600 hover:text-slate-900 py-2" aria-label="Log out"><LogOut className="h-4 w-4" /></button>}
              <Link to="/?category=all" className="hidden lg:inline-flex items-center gap-2 rounded-md bg-emerald-950 text-white px-4 py-2.5 text-xs font-bold hover:bg-emerald-900">Browse all deals</Link>
              <button type="button" onClick={() => setMobileMenuOpen((value) => !value)} aria-expanded={mobileMenuOpen} aria-controls="mobile-dealscout-menu" className="lg:hidden inline-flex items-center justify-center w-9 h-9 text-slate-700" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}><Menu className="h-5 w-5" /></button>
            </nav>
          </div>

          {mobileSearchOpen && <div className="md:hidden pb-3">{searchBox(true)}</div>}

          {mobileMenuOpen && (
            <nav id="mobile-dealscout-menu" aria-label="Mobile navigation" className="lg:hidden border-t border-emerald-950/10 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                <Link to="/?category=all" className="py-2 text-sm font-bold text-emerald-950">All deals</Link>
                <Link to="/saved" className="py-2 text-sm font-semibold text-slate-700">Saved deals</Link>
                {topCategories.map((category) => <Link key={category.id || category.slug} to={`/category/${category.slug}`} className="py-2 text-sm font-semibold text-slate-700 hover:text-emerald-900">{category.name}</Link>)}
                {isAuthenticated && user?.role === 'admin' && <Link to="/admin" className="py-2 text-sm font-semibold text-slate-700">Admin</Link>}
              </div>
            </nav>
          )}

          <div className="hidden md:flex items-center gap-6 h-10 overflow-x-auto text-[12px] font-semibold text-slate-700 whitespace-nowrap border-t border-emerald-950/5">
            <Link to="/?category=all" className="hover:text-emerald-900">All Deals</Link>
            {topCategories.map((category) => <Link key={category.id || category.slug} to={`/category/${category.slug}`} className="hover:text-emerald-900">{category.name}</Link>)}
            {categoriesList.length > NAV_LIMIT && <span className="text-slate-400">More</span>}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <AffiliateBanner />

      <footer className="bg-emerald-950 text-emerald-50 mt-14">
        <div className="ds-shell py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2"><div className="font-heading text-2xl font-bold">DealScout</div><p className="text-sm text-emerald-100/70 mt-2 max-w-md">Standout deals, verified prices, and less noise.</p></div>
            <div><h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/60 mb-3">Categories</h4><ul className="space-y-2 text-xs">{categoriesList.slice(0, 5).map((category) => <li key={category.id}><Link to={`/category/${category.slug}`} className="text-emerald-50/80 hover:text-white">{category.name}</Link></li>)}</ul></div>
            <div><h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/60 mb-3">More</h4><ul className="space-y-2 text-xs"><li><Link to="/disclosure" className="text-emerald-50/80 hover:text-white">Affiliate Disclosure</Link></li><li><Link to="/privacy" className="text-emerald-50/80 hover:text-white">Privacy</Link></li><li><Link to="/support" className="text-emerald-50/80 hover:text-white">Support</Link></li><li><Link to="/saved" className="text-emerald-50/80 hover:text-white">Saved Deals</Link></li></ul></div>
          </div>
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-emerald-100/50 text-center sm:text-left"><span>&copy; {new Date().getFullYear()} DealScout. Amazon and the Amazon logo are trademarks of Amazon.com, Inc.</span><span>As an Amazon Associate I earn from qualifying purchases.</span></div>
        </div>
      </footer>
    </div>
  );
}
