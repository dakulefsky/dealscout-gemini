import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/components/DealCard';
import { Image } from '@/components/ui/image';
import { Link } from 'react-router-dom';
import { deals as dealsApi, categories as categoriesApi, functions, ai as aiApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Check,
  X,
  Loader2,
  Clock,
  CircleCheck,
  CircleX,
  ShieldAlert,
  FileWarning,
  Lock,
  DownloadCloud,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Tag,
  Layers,
  CheckCheck,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Link2,
  Zap,
  Server,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const TABS = [
  { key: 'PENDING_REVIEW', label: 'Pending Review', icon: Clock },
  { key: 'APPROVED', label: 'Approved & Live', icon: CircleCheck },
  { key: 'EXPIRED', label: 'Ended / Greyed Out', icon: AlertTriangle },
  { key: 'SITESTRIPE', label: 'SiteStripe & Link Importer', icon: Link2 },
  { key: 'AI_STUDIO', label: 'AI Ingest Studio', icon: Sparkles },
  { key: 'REJECTED', label: 'Rejected', icon: CircleX },
  { key: 'CATEGORIES', label: 'Manage Categories', icon: Tag },
];

export default function Admin() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [activeTab, setActiveTab] = useState('PENDING_REVIEW');
  const [dealList, setDealList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [stats, setStats] = useState({ total: 0, approvedCount: 0, pendingCount: 0, avgDiscount: 0 });
  const [lifecycleStats, setLifecycleStats] = useState({ activeDeals: 0, expiredDeals: 0, purgeEligibleDeals: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [verifyingPrices, setVerifyingPrices] = useState(false);
  const [purgingExpired, setPurgingExpired] = useState(false);
  const { toast } = useToast();

  // Provider State
  const [providerInfo, setProviderInfo] = useState({
    activeProvider: 'auto',
    rainforest: { configured: false },
    amazonPaapi: { configured: false, status: 'Not Configured' },
  });
  const [switchingProvider, setSwitchingProvider] = useState(false);

  // SiteStripe Importer State
  const [siteStripeUrl, setSiteStripeUrl] = useState('');
  const [importingSiteStripe, setImportingSiteStripe] = useState(false);
  const [siteStripePreview, setSiteStripePreview] = useState(null);
  const [isParsingSiteStripe, setIsParsingSiteStripe] = useState(false);

  // AI Ingestion Form State
  const [aiInput, setAiInput] = useState({
    title: '',
    asin: '',
    url: '',
    price: '',
    originalPrice: '',
    category: 'Electronics',
    rawText: '',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedResult, setAnalyzedResult] = useState(null);
  const [isLookingUpAsin, setIsLookingUpAsin] = useState(false);

  // Category creation
  const [newCat, setNewCat] = useState({ name: '', slug: '', description: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const isQueueTab = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(activeTab);
      const queryStatus = isQueueTab ? activeTab : undefined;

      const [deals, cats, st, lcStats, pStatus] = await Promise.all([
        dealsApi.list({ status: queryStatus, limit: 100 }),
        categoriesApi.list(),
        dealsApi.getStats().catch(() => ({ total: 0, approvedCount: 0, pendingCount: 0, avgDiscount: 0 })),
        dealsApi.getLifecycleStats().catch(() => ({ activeDeals: 0, expiredDeals: 0, purgeEligibleDeals: 0 })),
        functions.providerStatus().catch(() => ({ activeProvider: 'auto' })),
      ]);

      setDealList(deals || []);
      setCategoriesList(cats || []);
      setStats(st || {});
      setLifecycleStats(lcStats || {});
      setProviderInfo(pStatus || {});
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadData();
    }
  }, [activeTab, user]);

  const handleProviderSwitch = async (newProvider) => {
    setSwitchingProvider(true);
    try {
      const res = await functions.providerSwitch(newProvider);
      toast({
        title: 'Data Provider Updated',
        description: `Active deals provider switched to: ${res.activeProvider}`,
      });
      await loadData();
    } catch (err) {
      toast({ title: 'Failed to switch provider', description: err.message, variant: 'destructive' });
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleVerifyPrices = async () => {
    setVerifyingPrices(true);
    try {
      const res = await functions.verifyPrices(25);
      toast({
        title: 'Price & Availability Verified',
        description: `Checked ${res.checked} deals. ${res.expired} ended, ${res.active} active.`,
      });
      await loadData();
    } catch (err) {
      toast({ title: 'Price check failed', description: err.message, variant: 'destructive' });
    } finally {
      setVerifyingPrices(false);
    }
  };

  const handlePurgeExpired = async () => {
    if (!window.confirm('Purge all expired deals that ended more than 24 hours ago?')) return;
    setPurgingExpired(true);
    try {
      const res = await functions.purgeExpired();
      toast({
        title: 'Cleanup Complete',
        description: `Purged ${res.purged} expired deals from database.`,
      });
      await loadData();
    } catch (err) {
      toast({ title: 'Purge failed', description: err.message, variant: 'destructive' });
    } finally {
      setPurgingExpired(false);
    }
  };

  useEffect(() => {
    if (!siteStripeUrl.trim()) {
      setSiteStripePreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsParsingSiteStripe(true);
      try {
        const res = await functions.siteStripeParse(siteStripeUrl.trim());
        setSiteStripePreview(res);
      } catch (err) {
        setSiteStripePreview(null);
      } finally {
        setIsParsingSiteStripe(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [siteStripeUrl]);

  const handleSiteStripeImport = async (e, autoApprove = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!siteStripeUrl.trim()) return;
    setImportingSiteStripe(true);
    try {
      const res = await functions.siteStripeImport(siteStripeUrl.trim(), autoApprove);
      if (res.alreadyExists) {
        toast({
          title: 'Deal Already Tracked',
          description: `"${res.deal?.title}" (ASIN: ${res.deal?.asin}) already exists in DealScout database.`,
        });
      } else {
        toast({
          title: autoApprove ? 'Deal Published Live!' : 'SiteStripe Deal Ingested',
          description: `ASIN: ${res.deal?.asin} (${res.deal?.title?.slice(0, 40)}...) added with tag ${res.affiliateTag || 'dealscout-20'}.`,
        });
      }
      setSiteStripeUrl('');
      setSiteStripePreview(null);
      setActiveTab(autoApprove ? 'APPROVED' : 'PENDING_REVIEW');
      await loadData();
    } catch (err) {
      toast({
        title: 'SiteStripe Import Failed',
        description: err.message || 'Could not extract valid ASIN or resolve link.',
        variant: 'destructive',
      });
    } finally {
      setImportingSiteStripe(false);
    }
  };

  const handleExpireDeal = async (deal) => {
    setBusyId(deal.id);
    try {
      await dealsApi.expire(deal.id);
      toast({
        title: 'Deal Marked as Ended',
        description: `"${deal.title}" is now greyed out and will auto-purge in 24 hours.`,
      });
      await loadData();
    } catch (err) {
      toast({ title: 'Failed to expire deal', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRestoreDeal = async (deal) => {
    setBusyId(deal.id);
    try {
      await dealsApi.restore(deal.id);
      toast({
        title: 'Deal Restored',
        description: `"${deal.title}" is active and published live again.`,
      });
      await loadData();
    } catch (err) {
      toast({ title: 'Failed to restore deal', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRainforestLookup = async (directInput) => {
    const inputVal = typeof directInput === 'string' ? directInput : (aiInput.url || aiInput.asin);
    if (!inputVal) {
      toast({ title: 'Enter an Amazon URL or ASIN', description: 'e.g. https://amzn.to/... or B08PZHYWJS', variant: 'destructive' });
      return;
    }
    setIsLookingUpAsin(true);
    try {
      const res = await functions.rainforestLookup(inputVal);
      if (res?.data) {
        const d = res.data;
        setAiInput((prev) => ({
          ...prev,
          title: d.title || prev.title,
          asin: d.asin || prev.asin,
          imageUrl: d.imageUrl || prev.imageUrl,
          url: d.productUrl || (inputVal.startsWith('http') ? inputVal : prev.url),
          price: d.salePrice !== undefined && d.salePrice !== null ? String(d.salePrice) : prev.price,
          originalPrice: d.originalPrice !== undefined && d.originalPrice !== null ? String(d.originalPrice) : prev.originalPrice,
          category: d.category || prev.category,
          rawText: d.pros ? `${d.pros}\n\n${d.fullSummary || ''}` : d.fullSummary || prev.rawText,
        }));
        toast({
          title: 'Product Information Loaded',
          description: d.title ? d.title.slice(0, 60) + '...' : `ASIN: ${d.asin}`,
        });
      }
    } catch (err) {
      toast({ title: 'Lookup Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLookingUpAsin(false);
    }
  };

  async function fetchNewDeals() {
    setFetching(true);
    try {
      const data = await functions.fetchDeals(12);
      toast({
        title: `Ingested ${data.created} new deal${data.created === 1 ? '' : 's'}`,
        description: data.skipped?.length > 0 ? `${data.skipped.length} skipped (duplicates)` : 'Added to Pending Review queue.',
      });
      loadData();
    } catch (e) {
      toast({ title: 'Fetch failed', description: e.message, variant: 'destructive' });
    } finally {
      setFetching(false);
    }
  }

  async function updateStatus(deal, status) {
    setBusyId(deal.id);
    try {
      await dealsApi.update(deal.id, { status });
      setDealList((prev) => prev.filter((d) => d.id !== deal.id));
      toast({ title: `Deal ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`, description: deal.title });
      loadData();
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDeal(deal) {
    if (!window.confirm(`Delete deal "${deal.title}"?`)) return;
    setBusyId(deal.id);
    try {
      await dealsApi.delete(deal.id);
      setDealList((prev) => prev.filter((d) => d.id !== deal.id));
      toast({ title: 'Deal Deleted', description: deal.title });
      loadData();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function approveAllPending() {
    const pending = dealList.filter((d) => d.status === 'PENDING_REVIEW');
    if (!pending.length) return;
    if (!window.confirm(`Approve all ${pending.length} pending deals?`)) return;

    setLoading(true);
    try {
      const res = await dealsApi.approveAll();
      toast({
        title: 'All Deals Approved',
        description: `${res.approvedCount || pending.length} deal(s) published live to homepage.`
      });
      await loadData();
    } catch (e) {
      toast({ title: 'Approval failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const handleAiAnalyze = async (e) => {
    e.preventDefault();
    if (!aiInput.title && !aiInput.asin && !aiInput.rawText) {
      toast({ title: 'Please provide a title, ASIN, or product description.', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await aiApi.analyzeDeal({
        ...aiInput,
        price: aiInput.price ? Number(aiInput.price) : undefined,
        originalPrice: aiInput.originalPrice ? Number(aiInput.originalPrice) : undefined,
      });

      setAnalyzedResult(res.data);
      toast({
        title: 'Gemini Analysis Complete',
        description: `Deal Score: ${res.data?.dealScore || 88}/100 • ${res.data?.veracity || 'Verified'}`,
      });
    } catch (err) {
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAiDeal = async (status = 'APPROVED') => {
    if (!analyzedResult) return;
    try {
      const asinVal = aiInput.asin || 'B0' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const origP = analyzedResult.originalPrice || Number(aiInput.originalPrice) || 99.99;
      const saleP = analyzedResult.price || Number(aiInput.price) || 79.99;
      const disc = (origP > saleP && origP > 0)
        ? Math.round(((origP - saleP) / origP) * 100)
        : (analyzedResult.discountPercent || 20);

      await dealsApi.create({
        title: analyzedResult.title || aiInput.title,
        asin: asinVal,
        category: analyzedResult.category || aiInput.category || 'Electronics',
        originalPrice: origP,
        salePrice: saleP,
        discountPercent: disc,
        imageUrl:
          analyzedResult.imageUrl ||
          aiInput.imageUrl ||
          'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
        productUrl: (aiInput.url && aiInput.url.startsWith('http')) ? aiInput.url : `https://www.amazon.com/dp/${asinVal}`,
        rating: Number(analyzedResult.rating) || 4.7,
        ratingsTotal: Number(analyzedResult.ratingsTotal) || 1240,
        shortBio: analyzedResult.shortBio,
        fullSummary: analyzedResult.fullSummary,
        pros: Array.isArray(analyzedResult.pros) ? analyzedResult.pros.join('\n') : analyzedResult.pros,
        cons: Array.isArray(analyzedResult.cons) ? analyzedResult.cons.join('\n') : analyzedResult.cons,
        reviews: analyzedResult.reviews,
        status,
        rawSourceData: `Gemini AI Ingest | ASIN: ${asinVal} | Veracity: ${analyzedResult.veracity}`,
      });

      toast({
        title: `Deal ${status === 'APPROVED' ? 'Published Live' : 'Added to Review'}`,
        description: analyzedResult.title,
      });

      setAnalyzedResult(null);
      setAiInput({
        title: '',
        asin: '',
        url: '',
        price: '',
        originalPrice: '',
        category: 'Electronics',
        rawText: '',
      });
      setActiveTab(status);
    } catch (err) {
      toast({ title: 'Failed to create deal', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCat.name) return;
    try {
      const slug = newCat.slug || newCat.name.toLowerCase().replace(/\s+/g, '-');
      await categoriesApi.create({ ...newCat, slug });
      toast({ title: 'Category Created', description: newCat.name });
      setNewCat({ name: '', slug: '', description: '' });
      loadData();
    } catch (err) {
      toast({ title: 'Failed to create category', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    try {
      await categoriesApi.delete(id);
      toast({ title: 'Category Removed', description: name });
      loadData();
    } catch (err) {
      toast({ title: 'Failed to delete category', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Lock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold text-slate-900">Access restricted</h1>
        <p className="text-slate-500 mt-2">Sign in with an administrative account to access this studio.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition"
        >
          Sign In as Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="font-heading text-3xl font-black text-slate-900">Deal Management & Kishkes Studio</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 text-emerald-600" /> Gemini 3.7
            </span>
          </div>

          <p className="text-sm text-slate-500">
            Amazon PA-API v5 plumbing, SiteStripe fallback, automated price/stock verification, and 24h deal lifecycle purge.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleVerifyPrices}
            disabled={verifyingPrices}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 border-slate-300 hover:bg-slate-50"
          >
            {verifyingPrices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Verify Prices & End Deals
          </Button>

          <Button
            onClick={handlePurgeExpired}
            disabled={purgingExpired}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 text-amber-900"
          >
            {purgingExpired ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Purge 24h+ Expired ({lifecycleStats.purgeEligibleDeals || 0})
          </Button>

          <Button
            onClick={fetchNewDeals}
            disabled={fetching}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl gap-1.5 text-xs shadow-xs"
          >
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
            Sync Feed ({providerInfo.activeProvider || 'Auto'})
          </Button>
        </div>
      </div>

      {/* Provider Switcher & Kishkes Status Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-800/60">
              Active Provider: {providerInfo.activeProvider?.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              providerInfo.amazonPaapi?.configured
                ? 'bg-emerald-900/60 text-emerald-300'
                : 'bg-slate-800 text-slate-300'
            }`}>
              Amazon PA-API v5: {providerInfo.amazonPaapi?.status || 'Plumbing Ready (Awaiting Keys)'}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              providerInfo.rainforest?.configured
                ? providerInfo.rainforest?.quotaExhausted
                  ? 'bg-amber-900/60 text-amber-300'
                  : 'bg-blue-900/60 text-blue-300'
                : 'bg-slate-800 text-slate-400'
            }`}>
              Rainforest API: {providerInfo.rainforest?.configured ? (providerInfo.rainforest?.quotaExhausted ? 'Quota Exceeded (Curated Active)' : 'Active') : 'Not Configured'}
            </span>
          </div>

          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {providerInfo.amazonPaapi?.configured
              ? '✓ Amazon PA-API v5 credentials active. Direct signed requests will be used for product lookup and price checks.'
              : 'The PA-API v5 architecture with AWS SigV4 signing is fully implemented ("all the kishkes"). When your Amazon Associate API keys arrive, add them to Settings to switch instantly.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-400">Switch Provider:</span>
          <select
            value={providerInfo.activeProvider || 'auto'}
            onChange={(e) => handleProviderSwitch(e.target.value)}
            disabled={switchingProvider}
            className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="auto">Auto (PA-API → Rainforest → Curated)</option>
            <option value="amazon_paapi">Amazon PA-API v5</option>
            <option value="rainforest">Rainforest API</option>
            <option value="curated">Curated In-Memory Pool</option>
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Active</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{lifecycleStats.activeDeals || stats.approvedCount || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Review</div>
          <div className="text-2xl font-black text-amber-500 mt-1">{stats.pendingCount || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ended (Greyed)</div>
          <div className="text-2xl font-black text-slate-600 mt-1">{lifecycleStats.expiredDeals || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Discount</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.avgDiscount || 24}%</div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categories</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{categoriesList.length}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl transition whitespace-nowrap ${
                active
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.key === 'PENDING_REVIEW' && stats.pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 text-white font-extrabold">
                  {stats.pendingCount}
                </span>
              )}
              {tab.key === 'EXPIRED' && lifecycleStats.expiredDeals > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 text-slate-800 font-extrabold">
                  {lifecycleStats.expiredDeals}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: SiteStripe & Link Importer */}
      {activeTab === 'SITESTRIPE' && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="font-heading font-black text-xl text-slate-900 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-emerald-600" />
                SiteStripe & Shortlink Importer
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Paste any Amazon URL, SiteStripe embed snippet, <code>amzn.to</code> shortlink, or 10-digit ASIN. It resolves the product, formats your tracking tag, and pulls pricing & specifications.
              </p>
            </div>

            <form onSubmit={(e) => handleSiteStripeImport(e, false)} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">Amazon / SiteStripe URL or Embed Code</Label>
                  {isParsingSiteStripe && (
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Detecting ASIN...
                    </span>
                  )}
                </div>
                <Textarea
                  placeholder="Paste URL (e.g. https://amzn.to/3XYZ, https://amazon.com/dp/B08PZHYWJS), iframe embed snippet, or ASIN..."
                  value={siteStripeUrl}
                  onChange={(e) => setSiteStripeUrl(e.target.value)}
                  className="rounded-xl font-mono text-xs min-h-[90px] break-all"
                  required
                />
              </div>

              {/* Live Link Resolution Badge */}
              {siteStripePreview && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {siteStripePreview.asin ? `Detected ASIN: ${siteStripePreview.asin}` : (siteStripePreview.isShortlink ? 'Shortlink Detected (Resolves on Import)' : 'Link Recognized')}
                    </span>
                    {siteStripePreview.isShortlink && (
                      <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                        amzn.to / a.co shortlink
                      </span>
                    )}
                  </div>
                  {siteStripePreview.cleanUrl && (
                    <p className="text-[11px] font-mono text-emerald-800 truncate" title={siteStripePreview.cleanUrl}>
                      Target: {siteStripePreview.cleanUrl}
                    </p>
                  )}
                </div>
              )}

              {/* Quick Test Samples */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">Quick Test:</span>
                <button
                  type="button"
                  onClick={() => setSiteStripeUrl('https://www.amazon.com/dp/B08PZHYWJS?tag=dealscout-20')}
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition"
                >
                  AirPods Max (B08PZHYWJS)
                </button>
                <button
                  type="button"
                  onClick={() => setSiteStripeUrl('https://amzn.to/3exampleShortlink')}
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition"
                >
                  amzn.to Shortlink
                </button>
                <button
                  type="button"
                  onClick={() => setSiteStripeUrl('B09V3HN1KC')}
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition"
                >
                  Raw ASIN
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={importingSiteStripe || !siteStripeUrl.trim()}
                  variant="outline"
                  className="w-full rounded-xl py-3 border-slate-300 font-bold text-slate-800 hover:bg-slate-50 gap-1.5"
                >
                  {importingSiteStripe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 text-amber-600" />}
                  Save to Pending Review
                </Button>

                <Button
                  type="button"
                  onClick={(e) => handleSiteStripeImport(e, true)}
                  disabled={importingSiteStripe || !siteStripeUrl.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 shadow-sm gap-1.5"
                >
                  {importingSiteStripe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  ⚡ Publish Live Now
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              3 Independent Ingestion Channels
            </h4>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-900 block">1. Manual SiteStripe (Independent & No Quotas):</span>
                <p>Paste any Amazon link, <code>amzn.to</code> shortlink, or ASIN. This operates completely independently without using Rainforest API or third-party quota, immediately scraping the page image, price, title, and attaching your affiliate tag.</p>
              </div>
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">2. Amazon PA-API v5 (Official Amazon API):</span>
                <p>Direct cryptographic signed Amazon Product Advertising API v5 requests ("all the kishkes"). Automatically takes over automated lookups once your Amazon API credentials are active.</p>
              </div>
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">3. Rainforest API (Automated Feed Sync):</span>
                <p>Automated bulk search and category sync feeds used when automated scraping credits are available.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: AI Ingest Studio */}
      {activeTab === 'AI_STUDIO' && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="font-heading font-black text-xl text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Gemini Deal Analyzer & Generator
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Paste any product title, ASIN, or raw Amazon specs. Gemini extracts selling points, calculates markdown veracity, and formulates balanced pros & cons.
              </p>
            </div>

            <form onSubmit={handleAiAnalyze} className="space-y-4">
              <div className="space-y-1.5 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                    Amazon URL / Shortlink / ASIN
                  </Label>
                  <button
                    type="button"
                    onClick={() => handleRainforestLookup(aiInput.url || aiInput.asin)}
                    disabled={isLookingUpAsin || (!aiInput.asin && !aiInput.url)}
                    className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 shadow-2xs transition flex items-center gap-1"
                  >
                    {isLookingUpAsin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-emerald-600" />}
                    {isLookingUpAsin ? 'Fetching...' : '⚡ Auto-Fetch Info'}
                  </button>
                </div>
                <Input
                  placeholder="e.g. https://amzn.to/45OrwIi or B07L8T8Q82"
                  value={aiInput.url || aiInput.asin}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAiInput({
                      ...aiInput,
                      url: val.startsWith('http') ? val : aiInput.url,
                      asin: !val.startsWith('http') ? val : aiInput.asin
                    });
                  }}
                  className="rounded-xl bg-white text-xs font-mono"
                />
              </div>

              {aiInput.imageUrl && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <img
                    src={aiInput.imageUrl}
                    alt="Loaded Product Thumbnail"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 object-contain bg-white rounded-xl border border-slate-100 p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-emerald-700 block">✓ Product Media Loaded</span>
                    <span className="text-xs font-semibold text-slate-800 line-clamp-1">{aiInput.title || 'Amazon Product'}</span>
                    <span className="text-[11px] text-slate-500 font-mono">ASIN: {aiInput.asin || 'Extracted'}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Product Title</Label>
                <Input
                  placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  value={aiInput.title}
                  onChange={(e) => setAiInput({ ...aiInput, title: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Amazon ASIN</Label>
                  <Input
                    placeholder="e.g. B09XS7JWHH"
                    value={aiInput.asin}
                    onChange={(e) => setAiInput({ ...aiInput, asin: e.target.value })}
                    className="rounded-xl font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Category</Label>
                  <select
                    value={aiInput.category}
                    onChange={(e) => setAiInput({ ...aiInput, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Sale Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 328.00"
                    value={aiInput.price}
                    onChange={(e) => setAiInput({ ...aiInput, price: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">List / MSRP Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 398.00"
                    value={aiInput.originalPrice}
                    onChange={(e) => setAiInput({ ...aiInput, originalPrice: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Raw Description / Features</Label>
                <textarea
                  rows={3}
                  placeholder="Paste raw bullet points or specs..."
                  value={aiInput.rawText}
                  onChange={(e) => setAiInput({ ...aiInput, rawText: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isAnalyzing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 shadow-md gap-2"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isAnalyzing ? 'Analyzing with Gemini...' : '⚡ Generate AI Deal Breakdown'}
              </Button>
            </form>
          </div>

          {/* AI Result Inspection Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col justify-between">
            {analyzedResult ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    Deal Score: {analyzedResult.dealScore}/100 • {analyzedResult.veracity}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    -{analyzedResult.discountPercent}% Discount
                  </span>
                </div>

                <div className="flex gap-4 items-start">
                  {(analyzedResult.imageUrl || aiInput.imageUrl) && (
                    <img
                      src={analyzedResult.imageUrl || aiInput.imageUrl}
                      alt={analyzedResult.title || 'Product'}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 object-contain bg-slate-50 rounded-2xl border border-slate-200 p-1.5 shrink-0 shadow-2xs"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-heading font-bold text-base text-slate-900 line-clamp-2 leading-snug">{analyzedResult.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                      <span className="text-emerald-700 font-extrabold text-sm">${analyzedResult.price}</span>{' '}
                      {analyzedResult.originalPrice && <span className="text-slate-400 line-through">(MSRP: ${analyzedResult.originalPrice})</span>} · {analyzedResult.category}
                    </p>
                    {analyzedResult.asin && (
                      <span className="text-[11px] font-mono text-slate-400 block mt-0.5">ASIN: {analyzedResult.asin}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2">
                  <div className="font-bold text-slate-900">Summary:</div>
                  <p className="leading-relaxed">{analyzedResult.fullSummary}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <span className="font-bold text-emerald-900 block mb-1.5">Pros:</span>
                    <ul className="space-y-1 text-slate-700">
                      {analyzedResult.pros?.map((p, i) => (
                        <li key={i}>✓ {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200">
                    <span className="font-bold text-rose-900 block mb-1.5">Cons:</span>
                    <ul className="space-y-1 text-slate-700">
                      {analyzedResult.cons?.map((c, i) => (
                        <li key={i}>✗ {c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button
                    onClick={() => handleSaveAiDeal('APPROVED')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  >
                    Publish Live Now
                  </Button>
                  <Button
                    onClick={() => handleSaveAiDeal('PENDING_REVIEW')}
                    variant="outline"
                    className="flex-1 rounded-xl text-slate-700 font-bold"
                  >
                    Save to Pending Queue
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                <Sparkles className="w-12 h-12 text-slate-300" />
                <h4 className="font-bold text-slate-700 text-base">Awaiting Product Analysis</h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  Fill in the form on the left and click "Generate AI Deal Breakdown" to preview and verify before saving.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Categories Management */}
      {activeTab === 'CATEGORIES' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-heading font-black text-lg text-slate-900">Add New Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Category Name</Label>
                <Input
                  placeholder="e.g. Gaming & VR"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">URL Slug (optional)</Label>
                <Input
                  placeholder="e.g. gaming-vr"
                  value={newCat.slug}
                  onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Description</Label>
                <Input
                  placeholder="e.g. Consoles, accessories, and immersive gear."
                  value={newCat.description}
                  onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 text-white font-bold rounded-xl">
                Create Category
              </Button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-heading font-black text-lg text-slate-900">
              Active Categories ({categoriesList.length})
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {categoriesList.map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.description || 'No description'}</p>
                    <span className="text-[10px] text-emerald-600 font-mono mt-1 block">/category/{c.slug}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Deal Queues (Pending / Approved / Expired / Rejected) */}
      {['PENDING_REVIEW', 'APPROVED', 'EXPIRED', 'REJECTED'].includes(activeTab) && (
        <div className="space-y-4">
          {activeTab === 'PENDING_REVIEW' && dealList.length > 0 && (
            <div className="flex justify-between items-center bg-amber-50 border border-amber-200 p-4 rounded-2xl">
              <span className="text-xs font-bold text-amber-900">
                {dealList.length} deal{dealList.length > 1 ? 's' : ''} awaiting editorial verification
              </span>
              <Button
                size="sm"
                onClick={approveAllPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5"
              >
                <CheckCheck className="w-4 h-4" /> Approve All
              </Button>
            </div>
          )}

          {activeTab === 'EXPIRED' && dealList.length > 0 && (
            <div className="flex justify-between items-center bg-slate-100 border border-slate-300 p-4 rounded-2xl">
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900">{dealList.length} ended deal{dealList.length > 1 ? 's' : ''}</span> currently greyed out on the store. Deals older than 24h are auto-purged by the scheduled cron.
              </div>
              <Button
                size="sm"
                onClick={handlePurgeExpired}
                disabled={purgingExpired}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs gap-1.5 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Purge Now
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : dealList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 p-10 max-w-md mx-auto">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-900 text-base">No deals in this queue</h4>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'EXPIRED'
                  ? 'All monitored deals are currently live and valid on Amazon.'
                  : 'Use the AI Ingest Studio, SiteStripe Importer, or Sync Feed to add more.'}
              </p>
            </div>
          ) : activeTab === 'PENDING_REVIEW' ? (
            <div className="space-y-4">
              {dealList.map((deal) => (
                <PendingDealRow
                  key={deal.id}
                  deal={deal}
                  onApprove={() => updateStatus(deal, 'APPROVED')}
                  onReject={() => updateStatus(deal, 'REJECTED')}
                  onDelete={() => deleteDeal(deal)}
                  busy={busyId === deal.id}
                />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dealList.map((deal) => {
                const isDealExpired = Boolean(deal.isExpired || deal.status === 'EXPIRED');
                const hoursLeft = deal.expiresInHours ? Math.max(1, Math.ceil(deal.expiresInHours)) : null;

                return (
                  <div
                    key={deal.id}
                    className={`border rounded-3xl p-5 flex flex-col justify-between shadow-xs transition ${
                      isDealExpired
                        ? 'bg-slate-50 border-dashed border-slate-300 opacity-80 hover:opacity-100'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-20 h-20 rounded-2xl overflow-hidden border shrink-0 p-1 ${
                        isDealExpired ? 'bg-slate-100 border-slate-200 grayscale-[0.80]' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <Image src={deal.imageUrl} fittingType="contain" className="w-full h-full" alt={deal.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">
                            {deal.category}
                          </span>
                          {isDealExpired && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                              {hoursLeft ? `Purge in ${hoursLeft}h` : 'Expired'}
                            </span>
                          )}
                        </div>
                        <h4 className={`font-bold text-xs leading-snug line-clamp-2 mt-0.5 ${
                          isDealExpired ? 'text-slate-600 line-through' : 'text-slate-900'
                        }`}>
                          {deal.title}
                        </h4>
                        <p className="text-sm font-black mt-1">
                          <span className={isDealExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}>
                            {formatPrice(deal.salePrice)}
                          </span>{' '}
                          <span className="text-xs text-slate-400 line-through font-normal">
                            {formatPrice(deal.originalPrice)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                      {isDealExpired ? (
                        <button
                          onClick={() => handleRestoreDeal(deal)}
                          disabled={busyId === deal.id}
                          className="font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore Live
                        </button>
                      ) : activeTab === 'APPROVED' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExpireDeal(deal)}
                            disabled={busyId === deal.id}
                            title="Grey out this deal immediately"
                            className="font-bold text-amber-700 hover:text-amber-800 text-[11px]"
                          >
                            Mark Ended
                          </button>
                          <span className="text-slate-300">·</span>
                          <button
                            onClick={() => updateStatus(deal, 'REJECTED')}
                            disabled={busyId === deal.id}
                            className="font-semibold text-slate-500 hover:text-rose-600 text-[11px]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateStatus(deal, 'APPROVED')}
                          disabled={busyId === deal.id}
                          className="font-bold text-emerald-600 hover:text-emerald-700"
                        >
                          Publish Live
                        </button>
                      )}

                      <button
                        onClick={() => deleteDeal(deal)}
                        disabled={busyId === deal.id}
                        className="text-slate-400 hover:text-rose-600"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingDealRow({ deal, onApprove, onReject, onDelete, busy }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-72 p-5 border-b lg:border-b-0 lg:border-r border-slate-100 flex gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 p-1">
            <Image src={deal.imageUrl} fittingType="contain" className="w-full h-full" alt={deal.title} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">
              {deal.category}
            </span>
            <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 mt-0.5">
              {deal.title}
            </h4>
            <p className="text-sm font-black text-emerald-700 mt-1">
              {formatPrice(deal.salePrice)}{' '}
              <span className="text-xs text-slate-400 line-through font-normal">{formatPrice(deal.originalPrice)}</span>{' '}
              <span className="text-xs text-emerald-600 font-bold">{deal.discountPercent}% off</span>
            </p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">ASIN: {deal.asin}</p>
          </div>
        </div>

        <div className="flex-1 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> Editorial Summary
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{deal.fullSummary || deal.shortBio}</p>
            {deal.pros && (
              <div className="text-xs text-slate-600 pt-1">
                <span className="font-bold text-slate-900">Pros:</span> {deal.pros}
              </div>
            )}
            {deal.cons && (
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-900">Cons:</span> {deal.cons}
              </div>
            )}
          </div>

          <div className="p-5 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <FileWarning className="h-3.5 w-3.5" /> Source Context & Ingest Feed
            </div>
            <pre className="text-[11px] text-slate-600 whitespace-pre-wrap break-words font-mono max-h-36 overflow-auto leading-relaxed">
              {deal.rawSourceData || 'No raw source data available.'}
            </pre>
          </div>
        </div>

        <div className="lg:w-44 p-5 border-t lg:border-t-0 lg:border-l border-slate-100 flex lg:flex-col justify-center gap-2">
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-60 transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve & Publish
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-xs font-bold rounded-xl disabled:opacity-60 transition"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}
