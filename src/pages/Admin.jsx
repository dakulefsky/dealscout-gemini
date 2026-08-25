import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/components/DealCard';
import { Image } from '@/components/ui/image';
import { Link } from 'react-router-dom';
import { deals as dealsApi, functions } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Check, X, Loader2, Clock, CircleCheck, CircleX, ShieldAlert, FileWarning, Lock, DownloadCloud, ArrowLeft,
} from 'lucide-react';

const TABS = [
  { key: 'PENDING_REVIEW', label: 'Pending Review', icon: Clock },
  { key: 'APPROVED',       label: 'Approved',        icon: CircleCheck },
  { key: 'REJECTED',      label: 'Rejected',         icon: CircleX },
];

export default function Admin() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [activeTab, setActiveTab] = useState('PENDING_REVIEW');
  const [dealList, setDealList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    dealsApi.list({ status: activeTab, limit: 100 })
      .then(setDealList)
      .catch(() => setDealList([]))
      .finally(() => setLoading(false));
  }, [activeTab, user]);

  async function fetchNewDeals() {
    setFetching(true);
    try {
      const data = await functions.fetchDeals(10);
      toast({
        title: `Fetched ${data.created} new deal${data.created === 1 ? '' : 's'}`,
        description: data.skipped?.length > 0 ? `${data.skipped.length} skipped (duplicates)` : 'Added to Pending Review',
      });
      if (activeTab === 'PENDING_REVIEW') {
        const fresh = await dealsApi.list({ status: 'PENDING_REVIEW', limit: 100 });
        setDealList(fresh);
      }
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
      toast({ title: `Deal ${status === 'APPROVED' ? 'approved' : 'rejected'}`, description: deal.title });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  if (isLoadingAuth || !authChecked) {
    return <div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Lock className="h-10 w-10 text-slate-300 mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold text-slate-900">Access restricted</h1>
        <p className="text-slate-500 mt-2">This area is for administrators only.</p>
        <Link to="/" className="mt-5 inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to deals
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full">
            <Lock className="h-3 w-3" /> Internal
          </span>
        </div>
        <p className="text-slate-500 mt-1">Review AI-generated deal summaries against raw source data before publishing.</p>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={fetchNewDeals}
          disabled={fetching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition"
        >
          {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
          {fetching ? 'Fetching...' : 'Fetch New Deals'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : dealList.length === 0 ? (
        <p className="text-slate-500 py-16 text-center">No deals in this queue.</p>
      ) : activeTab === 'PENDING_REVIEW' ? (
        <div className="space-y-4">
          {dealList.map((deal) => (
            <PendingDealRow
              key={deal.id}
              deal={deal}
              onApprove={() => updateStatus(deal, 'APPROVED')}
              onReject={() => updateStatus(deal, 'REJECTED')}
              busy={busyId === deal.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dealList.map((deal) => (
            <div key={deal.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                <Image src={deal.imageUrl} fittingType="fill" className="w-full h-full" alt={deal.title} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">{deal.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{deal.category}</p>
                <p className="text-sm font-bold text-emerald-700 mt-1">
                  {formatPrice(deal.salePrice)}{' '}
                  <span className="text-xs text-slate-400 line-through font-normal">{formatPrice(deal.originalPrice)}</span>
                </p>
                {!deal.sourceSufficient && (
                  <p className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium mt-1">
                    <ShieldAlert className="h-3 w-3" /> Low-confidence
                  </p>
                )}
                <button
                  onClick={() => updateStatus(deal, activeTab === 'APPROVED' ? 'REJECTED' : 'APPROVED')}
                  disabled={busyId === deal.id}
                  className="mt-2 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {activeTab === 'APPROVED' ? 'Move to Rejected' : 'Move to Approved'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingDealRow({ deal, onApprove, onReject, busy }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-64 p-4 border-b lg:border-b-0 lg:border-r border-slate-100 flex gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
            <Image src={deal.imageUrl} fittingType="fill" className="w-full h-full" alt={deal.title} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">{deal.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{deal.category} · ASIN {deal.asin}</p>
            <p className="text-sm font-bold text-emerald-700 mt-1">
              {formatPrice(deal.salePrice)}{' '}
              <span className="text-xs text-slate-400 line-through font-normal">{formatPrice(deal.originalPrice)}</span>{' '}
              <span className="text-xs text-emerald-600 font-semibold">{deal.discountPercent}% off</span>
            </p>
            {!deal.sourceSufficient && (
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-amber-700 font-medium">
                <ShieldAlert className="h-3 w-3" /> Low-confidence source
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2">
              <CircleCheck className="h-3.5 w-3.5" /> AI-Generated Summary
            </div>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">{deal.fullSummary || deal.shortBio}</p>
            {deal.pros && <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Pros:</span> {deal.pros}</p>}
            {deal.cons && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-700">Cons:</span> {deal.cons}</p>}
          </div>
          <div className="p-4 bg-slate-50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
              <FileWarning className="h-3.5 w-3.5" /> Raw Source Data
            </div>
            <pre className="text-xs text-slate-600 whitespace-pre-wrap break-words font-mono max-h-48 overflow-auto leading-relaxed">
              {deal.rawSourceData || 'No raw data provided.'}
            </pre>
          </div>
        </div>

        <div className="lg:w-40 p-4 border-t lg:border-t-0 lg:border-l border-slate-100 flex lg:flex-col gap-2">
          <button onClick={onApprove} disabled={busy} className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
          </button>
          <button onClick={onReject} disabled={busy} className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-sm font-semibold rounded-lg disabled:opacity-60 transition">
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}
