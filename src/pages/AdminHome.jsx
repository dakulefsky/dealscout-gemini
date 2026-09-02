import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Eraser, Globe2, History, Image, Loader2, MessageCircle, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deals as dealsApi, functions } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

function Stat({ label, value, hint }) {
  return <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="text-xs font-semibold text-slate-500">{label}</div><div className="text-2xl font-black text-slate-900 mt-1">{value ?? '—'}</div>{hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}</div>;
}

function activityLabel(action = '') {
  const labels = {
    'deal.expire': 'Expired deal', 'deal.restore': 'Restored deal', 'deal.bulk_status': 'Updated deal statuses',
    'deal.approve_all': 'Approved review queue', 'images.repair': 'Repaired product images',
    'legacy_enrichment.cleanup': 'Cleaned legacy copy', 'prices.verify': 'Checked deal prices',
    'deals.discover': 'Ran deal discovery', 'provider.switch': 'Changed data provider',
    'channel.whatsapp_status': 'Changed WhatsApp Status publishing',
    'deal.import': 'Imported deal', 'editorial.save': 'Saved DealScout Pick', 'editorial.remove': 'Removed DealScout Pick',
  };
  return labels[action] || String(action).replace(/[._]/g, ' ');
}

function relativeTime(unix) {
  if (!unix) return 'never';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(unix || 0));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function countdownLabel(iso, now = Date.now()) {
  const target = Date.parse(iso || '');
  if (!Number.isFinite(target)) return 'Not scheduled';
  const remaining = Math.max(0, Math.floor((target - now) / 1000));
  if (remaining <= 0) return 'Due now';
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const EMPTY_ACTIVITY = { activity: [] };

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const busyRef = useRef(false);
  const [stats, setStats] = useState({});
  const [provider, setProvider] = useState({});
  const [integrity, setIntegrity] = useState({});
  const [publication, setPublication] = useState({});
  const [channelSettings, setChannelSettings] = useState({});
  const [legacyCleanup, setLegacyCleanup] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadFailures, setLoadFailures] = useState([]);
  const [now, setNow] = useState(Date.now());
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const requests = [
      ['deal stats', dealsApi.getStats()],
      ['provider status', functions.providerStatus()],
      ['integrity health', functions.integrityHealth()],
      ['publication health', functions.publicationHealth()],
      ['channel settings', functions.channelSettings()],
      ['legacy cleanup preview', functions.legacyEnrichmentPreview()],
      ['admin activity', functions.adminActivity(8)],
    ];

    try {
      const results = await Promise.allSettled(requests.map(([, promise]) => promise));
      const value = (index, fallback = {}) => results[index].status === 'fulfilled' ? results[index].value : fallback;
      setStats(value(0));
      setProvider(value(1));
      setIntegrity(value(2));
      setPublication(value(3));
      setChannelSettings(value(4));
      setLegacyCleanup(value(5));
      setRecentActivity(value(6, EMPTY_ACTIVITY)?.activity || []);
      setLoadFailures(results.flatMap((result, index) => result.status === 'rejected' ? [requests[index][0]] : []));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function run(name, fn, success, describe) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(name);
    try {
      const result = await fn();
      toast({ title: success, description: describe ? describe(result) : undefined });
      await load();
    } catch (error) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>;

  const lifecycle = stats.lifecycle || {};
  const integrityIssues = Number(integrity.unverifiedApproved || 0) + Number(integrity.missingImages || 0) + Number(integrity.stalePrices || 0);
  const publicationUnavailable = loadFailures.includes('publication health');
  const publicationCounts = publication.counts || {};
  const publicationIssues = Number(publication.overdue || 0) + Number(publicationCounts.failed || 0);
  const cleanupCandidates = Number(legacyCleanup.candidates || 0);
  const effectiveProvider = provider.effectiveProvider || provider.configuredProvider || 'none';
  const actionInFlight = Boolean(busy);
  const cron = provider.cron || {};
  const nextPull = countdownLabel(cron.nextRunEstimate, now);
  const lastPull = cron.lastRun ? new Date(cron.lastRun).toLocaleString() : 'Not yet this process';
  const rainforestBudget = provider.rainforest?.budget || {};
  const budgetUnavailable = Boolean(rainforestBudget.error) || loadFailures.includes('provider status');
  const whatsappSettingsUnavailable = loadFailures.includes('channel settings');
  const whatsappStatusEnabled = whatsappSettingsUnavailable ? null : channelSettings.whatsappStatus?.enabled !== false;
  const whatsappStatusLabel = whatsappStatusEnabled === false ? 'Paused' : publicationUnavailable ? 'Unknown' : publicationIssues ? 'Needs attention' : 'Ready';
  const whatsappStatusClass = whatsappStatusEnabled === false || publicationUnavailable || publicationIssues ? 'text-amber-700' : 'text-emerald-700';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div><div className="text-xs font-bold uppercase tracking-wider text-emerald-600">DealScout Operations</div><h1 className="text-3xl font-black text-slate-900 mt-1">Admin</h1><p className="text-sm text-slate-500 mt-1">One deal engine, with separate controls for web, app, and WhatsApp Status.</p></div>
        <Button variant="outline" onClick={load} disabled={actionInFlight} className="rounded-xl gap-2"><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      {loadFailures.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div><div className="text-sm font-bold">Some operational data could not be loaded</div><div className="text-xs mt-1">Unavailable: {loadFailures.join(', ')}. Missing values are shown as — instead of being treated as healthy zeroes.</div></div>
        </div>
      )}

      <section className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider"><Clock3 className="w-4 h-4" /> Shared deal pull</div>
            <div className="text-3xl font-black mt-2">Next pull in {nextPull}</div>
            <div className="text-sm text-slate-300 mt-2">Automatic discovery runs on the shared catalog. A manual pull uses the same ingestion path.</div>
            <div className="text-xs text-slate-400 mt-2">Last pull: {lastPull}</div>
          </div>
          <Button disabled={actionInFlight} onClick={() => run('sync', () => functions.fetchDeals(15), 'Shared deal pull complete', (result) => `${result?.created || 0} new, ${result?.updated || 0} refreshed. Web, app, and WhatsApp Status now share the same catalog.`)} className="rounded-xl gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shrink-0">
            {busy === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Pull deals now
          </Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2 mt-5 text-xs font-bold">
          <div className="rounded-xl bg-white/10 px-3 py-2">Web ← shared PostgreSQL catalog</div>
          <div className="rounded-xl bg-white/10 px-3 py-2">App ← same shopper API/catalog</div>
          <div className="rounded-xl bg-white/10 px-3 py-2">WhatsApp Status ← same approved deals</div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Live deals" value={stats.approvedCount ?? lifecycle.activeCount} />
        <Stat label="Needs review" value={stats.pendingCount} />
        <Stat label="Ended" value={lifecycle.expiredCount} />
        <Stat label="Integrity issues" value={loadFailures.includes('integrity health') ? null : integrityIssues} hint={loadFailures.includes('integrity health') ? 'Health check unavailable' : integrityIssues ? 'Needs attention' : 'Core checks clean'} />
        <Stat label="Publishing issues" value={publicationUnavailable ? null : publicationIssues} hint={publicationUnavailable ? 'Automation health unavailable' : publicationIssues ? 'Failed or overdue jobs' : 'Queue healthy'} />
        <Stat label="Average discount" value={stats.avgDiscount != null ? `${Number(stats.avgDiscount).toFixed(0)}%` : null} />
      </div>

      <section>
        <div className="mb-3"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Channel controls</div><h2 className="text-xl font-black text-slate-900 mt-1">Web, app, and WhatsApp Status</h2></div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Globe2 className="w-5 h-5 text-emerald-600" /><div className="font-black text-slate-900">Web</div></div><span className="text-xs font-bold text-emerald-700">Live</span></div>
            <p className="text-sm text-slate-500 mt-3">Reads approved deals from the shared catalog immediately after ingestion or review.</p>
            <div className="mt-4 text-xs text-slate-500"><span className="font-bold text-slate-700">Visible deals:</span> {stats.approvedCount ?? lifecycle.activeCount ?? '—'}</div>
            <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800">Open shopper site <ArrowRight className="w-4 h-4" /></Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-emerald-600" /><div className="font-black text-slate-900">App</div></div><span className="text-xs font-bold text-emerald-700">Shared feed</span></div>
            <p className="text-sm text-slate-500 mt-3">The native app uses the same shopper API and approved catalog as the website. No second Rainforest pull is needed.</p>
            <div className="mt-4 text-xs text-slate-500"><span className="font-bold text-slate-700">Catalog:</span> synchronized with web</div>
            <div className="mt-4 text-sm font-bold text-slate-700">Admin stays on the web dashboard; the shopper app stays admin-free.</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-600" /><div className="font-black text-slate-900">WhatsApp Status</div></div><span className={`text-xs font-bold ${whatsappStatusClass}`}>{whatsappStatusLabel}</span></div>
            <p className="text-sm text-slate-500 mt-3">Publishes from the same approved deal catalog; it does not perform its own Rainforest discovery pull.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Queued</div><div className="font-black text-slate-900 mt-1">{publicationUnavailable ? '—' : publicationCounts.queued || 0}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Published</div><div className="font-black text-slate-900 mt-1">{publicationUnavailable ? '—' : publicationCounts.published || 0}</div></div></div>
            <Button disabled={actionInFlight || whatsappStatusEnabled === null} onClick={() => run('whatsapp-status', () => functions.setWhatsAppStatusEnabled(!whatsappStatusEnabled), whatsappStatusEnabled ? 'WhatsApp Status paused' : 'WhatsApp Status resumed')} variant="outline" className="mt-4 w-full rounded-xl gap-2 font-bold">
              {busy === 'whatsapp-status' ? <Loader2 className="w-4 h-4 animate-spin" /> : whatsappStatusEnabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />} {whatsappStatusEnabled ? 'Pause Status publishing' : 'Resume Status publishing'}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <Link to="/admin/editorial" className="lg:col-span-2 bg-slate-900 text-white rounded-3xl p-6 hover:bg-slate-800 transition group">
          <div className="flex items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider"><CheckCircle2 className="w-4 h-4" /> Review queue</div><h2 className="text-2xl font-black mt-3">Review deals that need attention</h2><p className="text-sm text-slate-300 mt-2">Publish normally, feature as a Pick, reject, or save for later.</p></div><ArrowRight className="w-5 h-5 mt-1 group-hover:translate-x-1 transition" /></div>
          <div className="mt-6 text-sm font-bold">{stats.pendingCount ?? '—'} waiting</div>
        </Link>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-600" /><h2 className="font-black text-slate-900">System health</h2></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="font-bold text-slate-800">{loadFailures.includes('provider status') ? 'Unavailable' : effectiveProvider}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rainforest</span><span className={provider.rainforest?.isConfigured ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{loadFailures.includes('provider status') ? 'Unknown' : provider.rainforest?.isConfigured ? 'Ready' : 'Not configured'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rainforest today</span><span className="font-bold text-slate-800">{budgetUnavailable ? '—' : `${rainforestBudget.dayCount || 0}/${rainforestBudget.limits?.daily ?? '∞'}`}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rainforest month</span><span className="font-bold text-slate-800">{budgetUnavailable ? '—' : `${rainforestBudget.monthCount || 0}/${rainforestBudget.limits?.monthly ?? '∞'}`}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Requests blocked today</span><span className={Number(rainforestBudget.blockedToday || 0) > 0 ? 'font-bold text-amber-700' : 'font-bold text-slate-800'}>{budgetUnavailable ? '—' : rainforestBudget.blockedToday || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Missing images</span><span className={integrity.missingImages > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{loadFailures.includes('integrity health') ? '—' : integrity.missingImages || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Stale prices</span><span className={integrity.stalePrices > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{loadFailures.includes('integrity health') ? '—' : integrity.stalePrices || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Approved unverified</span><span className={integrity.unverifiedApproved > 0 ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>{loadFailures.includes('integrity health') ? '—' : integrity.unverifiedApproved || 0}</span></div>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4"><div className="flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-600" /><h2 className="font-black text-slate-900">WhatsApp publication automation</h2></div>{!publicationUnavailable && <span className={`text-xs font-bold ${whatsappStatusEnabled === false || publicationIssues ? 'text-amber-700' : 'text-emerald-700'}`}>{whatsappStatusEnabled === false ? 'Paused' : publicationIssues ? 'Needs attention' : 'Healthy'}</span>}</div>
        {publicationUnavailable ? <p className="text-sm text-slate-500">Publication queue health is unavailable right now.</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Queued" value={publicationCounts.queued || 0} hint={whatsappStatusEnabled === false ? 'Held while Status is paused' : publication.retryWaiting ? `${publication.retryWaiting} waiting to retry` : 'Ready or scheduled'} />
            <Stat label="Overdue" value={publication.overdue || 0} hint={publication.oldestQueuedAt ? `Oldest ${relativeTime(publication.oldestQueuedAt)}` : 'No overdue backlog'} />
            <Stat label="Failed" value={publicationCounts.failed || 0} hint="Terminal failures" />
            <Stat label="Published" value={publicationCounts.published || 0} hint={`Last success ${relativeTime(publication.lastPublishedAt)}`} />
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-emerald-600" /><h2 className="font-black text-slate-900">Maintenance actions</h2></div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Button disabled={actionInFlight} onClick={() => run('verify', () => functions.verifyPrices(25), 'Prices checked')} variant="outline" className="rounded-xl justify-start gap-2">{busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check prices</Button>
          <Button disabled={actionInFlight} onClick={() => run('images', () => functions.repairImages(30), 'Image repair complete', (result) => `${result?.repaired || 0} repaired.`)} variant="outline" className="rounded-xl justify-start gap-2">{busy === 'images' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />} Repair images</Button>
          {cleanupCandidates > 0 && <Button disabled={actionInFlight} onClick={() => run('cleanup', () => functions.cleanupLegacyEnrichment(), 'Legacy copy cleaned', (result) => `${result?.cleaned || 0} rows cleaned.`)} variant="outline" className="rounded-xl justify-start gap-2 sm:col-span-2 border-amber-200 text-amber-800 hover:bg-amber-50">{busy === 'cleanup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />} Clean {cleanupCandidates} known legacy {cleanupCandidates === 1 ? 'row' : 'rows'}</Button>}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4"><History className="w-5 h-5 text-slate-600" /><h2 className="font-black text-slate-900">Recent activity</h2></div>
        {recentActivity.length === 0 ? <p className="text-sm text-slate-500">Admin actions will appear here as they happen.</p> : <div className="divide-y divide-slate-100">{recentActivity.map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4"><div className="min-w-0"><div className="text-sm font-bold text-slate-800 capitalize">{activityLabel(item.action)}</div><div className="text-xs text-slate-500 mt-0.5 truncate">{item.target_id ? `${item.target_type || 'item'}: ${item.target_id}` : item.path}</div></div><div className="text-xs text-slate-500 shrink-0">{relativeTime(item.created_at)}</div></div>)}</div>}
      </section>
    </div>
  );
}
