import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, CheckCircle2, Clock, Eraser, Image, Loader2, RefreshCw, Settings2, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deals as dealsApi, functions } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

function Stat({ label, value, hint }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value ?? '—'}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [stats, setStats] = useState({});
  const [lifecycle, setLifecycle] = useState({});
  const [provider, setProvider] = useState({});
  const [images, setImages] = useState({});
  const [integrity, setIntegrity] = useState({});
  const [legacyCleanup, setLegacyCleanup] = useState({});
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [s, l, p, i, h, c] = await Promise.all([
        dealsApi.getStats().catch(() => ({})),
        dealsApi.getLifecycleStats().catch(() => ({})),
        functions.providerStatus().catch(() => ({})),
        functions.imageHealth().catch(() => ({})),
        functions.integrityHealth().catch(() => ({})),
        functions.legacyEnrichmentPreview().catch(() => ({})),
      ]);
      setStats(s || {});
      setLifecycle(l || {});
      setProvider(p || {});
      setImages(i || {});
      setIntegrity(h || {});
      setLegacyCleanup(c || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function run(name, fn, success, describe) {
    setBusy(name);
    try {
      const result = await fn();
      toast({ title: success, description: describe ? describe(result) : undefined });
      await load();
    } catch (error) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>;

  const integrityIssues = Number(integrity.unverifiedApproved || 0) + Number(integrity.missingImages || 0) + Number(integrity.stalePrices || 0);
  const cleanupCandidates = Number(legacyCleanup.candidates || 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">DealScout Operations</div>
          <h1 className="text-3xl font-black text-slate-900 mt-1">Admin</h1>
          <p className="text-sm text-slate-500 mt-1">Review what needs attention, check site health, and manage the essentials.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl gap-2"><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Live deals" value={stats.approvedCount ?? lifecycle.activeDeals} />
        <Stat label="Needs review" value={stats.pendingCount ?? 0} hint="Main review queue" />
        <Stat label="Ended" value={lifecycle.expiredDeals ?? 0} />
        <Stat label="Integrity issues" value={integrityIssues || 0} hint={integrityIssues > 0 ? 'Check system health' : 'Core checks clean'} />
        <Stat label="Average discount" value={stats.avgDiscount != null ? `${Number(stats.avgDiscount).toFixed(0)}%` : '—'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Link to="/admin/editorial" className="lg:col-span-2 bg-slate-900 text-white rounded-3xl p-6 hover:bg-slate-800 transition group">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider"><CheckCircle2 className="w-4 h-4" /> Review queue</div>
              <h2 className="text-2xl font-black mt-3">Review deals that need attention</h2>
              <p className="text-sm text-slate-300 mt-2 max-w-xl">Approve, feature, or add a short note from one focused queue.</p>
            </div>
            <ArrowRight className="w-5 h-5 mt-1 group-hover:translate-x-1 transition" />
          </div>
          <div className="mt-6 text-sm font-bold">{stats.pendingCount || 0} waiting</div>
        </Link>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-600" /><h2 className="font-black text-slate-900">System health</h2></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="font-bold text-slate-800">{provider.activeProvider || 'auto'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rainforest</span><span className={provider.rainforest?.configured ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{provider.rainforest?.configured ? 'Ready' : 'Not configured'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Price monitor</span><span className="font-bold text-slate-800">{provider.cron?.running ? 'Running' : 'Idle'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Missing images</span><span className={integrity.missingImages > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{integrity.missingImages || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Stale prices</span><span className={integrity.stalePrices > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{integrity.stalePrices || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Approved unverified</span><span className={integrity.unverifiedApproved > 0 ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>{integrity.unverifiedApproved || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Legacy enrichment</span><span className={integrity.legacyEnrichment > 0 ? 'font-bold text-amber-700' : 'font-bold text-slate-700'}>{integrity.legacyEnrichment || 0}</span></div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-emerald-600" /><h2 className="font-black text-slate-900">Quick actions</h2></div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Button disabled={busy === 'verify'} onClick={() => run('verify', () => functions.verifyPrices(25), 'Prices checked')} variant="outline" className="rounded-xl justify-start gap-2">{busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check prices</Button>
            <Button disabled={busy === 'sync'} onClick={() => run('sync', () => functions.fetchDeals(15), 'Deal discovery complete', (r) => `${r?.created || 0} new deals added.`)} variant="outline" className="rounded-xl justify-start gap-2">{busy === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Find deals now</Button>
            <Button disabled={busy === 'images'} onClick={() => run('images', () => functions.repairImages(30), 'Image repair complete', (r) => `${r?.repaired || 0} repaired, ${r?.failed || 0} still missing.`)} variant="outline" className="rounded-xl justify-start gap-2 sm:col-span-2">{busy === 'images' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} Repair missing images</Button>
            {cleanupCandidates > 0 && (
              <Button disabled={busy === 'cleanup'} onClick={() => run('cleanup', () => functions.cleanupLegacyEnrichment(), 'Legacy copy cleaned', (r) => `${r?.cleaned || 0} known machine-generated rows cleaned.`)} variant="outline" className="rounded-xl justify-start gap-2 sm:col-span-2 border-amber-200 text-amber-800 hover:bg-amber-50">
                {busy === 'cleanup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />} Clean {cleanupCandidates} known legacy {cleanupCandidates === 1 ? 'row' : 'rows'}
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4"><Wrench className="w-5 h-5 text-slate-600" /><h2 className="font-black text-slate-900">Tools</h2></div>
          <div className="space-y-2">
            <Link to="/admin/operations" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-bold text-slate-700"><span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Imports, categories & provider controls</span><ArrowRight className="w-4 h-4" /></Link>
            <Link to="/admin/editorial" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-bold text-slate-700"><span className="inline-flex items-center gap-2"><Clock className="w-4 h-4" /> Review queue</span><ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
