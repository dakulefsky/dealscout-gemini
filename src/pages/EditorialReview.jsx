import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck, Star, Save, ArrowLeft, CheckCircle2, Clock, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image } from '@/components/ui/image';
import { deals as dealsApi, editorial as editorialApi } from '@/lib/api';
import { formatPrice } from '@/components/DealCard';
import { useToast } from '@/components/ui/use-toast';

const emptyEditorial = { editorialNote: '', isHumanPick: false, reviewedAt: null, reviewedBy: null };

export default function EditorialReview() {
  const [deals, setDeals] = useState([]);
  const [editorialByAsin, setEditorialByAsin] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyAsin, setBusyAsin] = useState(null);
  const [filter, setFilter] = useState('needs-review');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allDeals = await dealsApi.list({ limit: 100 });
      const verified = (allDeals || []).filter((d) => d.sourceVerified && !d.isExpired && ['APPROVED', 'PENDING_REVIEW'].includes(d.status));
      setDeals(verified);
      const batch = await editorialApi.batch(verified.map((deal) => deal.asin));
      setEditorialByAsin(batch?.byAsin || {});
    } catch (error) {
      toast({ title: 'Could not load review queue', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const visibleDeals = useMemo(() => deals.filter((deal) => {
    const e = editorialByAsin[deal.asin] || emptyEditorial;
    if (filter === 'needs-review') return deal.status === 'PENDING_REVIEW';
    if (filter === 'picks') return e.isHumanPick;
    return true;
  }), [deals, editorialByAsin, filter]);

  function updateDraft(asin, patch) {
    setEditorialByAsin((prev) => ({ ...prev, [asin]: { ...(prev[asin] || emptyEditorial), ...patch } }));
  }

  async function save(deal, override = {}, publish = false) {
    const current = { ...(editorialByAsin[deal.asin] || emptyEditorial), ...override };
    setBusyAsin(deal.asin);
    try {
      const saved = await editorialApi.save(deal.asin, { editorialNote: current.editorialNote || '', isHumanPick: Boolean(current.isHumanPick) });
      if (publish && deal.status !== 'APPROVED') await dealsApi.update(deal.id || deal.asin, { status: 'APPROVED' });
      setEditorialByAsin((prev) => ({ ...prev, [deal.asin]: saved }));
      setDeals((prev) => prev.map((d) => d.asin === deal.asin ? { ...d, status: publish ? 'APPROVED' : d.status } : d));
      toast({ title: publish ? (saved.isHumanPick ? 'Published as DealScout Pick' : 'Published normally') : saved.isHumanPick ? 'DealScout Pick saved' : 'Review saved' });
    } catch (error) {
      toast({ title: 'Review save failed', description: error.message, variant: 'destructive' });
    } finally { setBusyAsin(null); }
  }

  async function reject(deal) {
    setBusyAsin(deal.asin);
    try {
      await editorialApi.save(deal.asin, { editorialNote: (editorialByAsin[deal.asin]?.editorialNote || ''), isHumanPick: false });
      await dealsApi.update(deal.id || deal.asin, { status: 'REJECTED' });
      setDeals((prev) => prev.filter((d) => d.asin !== deal.asin));
      toast({ title: 'Deal rejected', description: 'Removed from the review queue and public feed.' });
    } catch (error) {
      toast({ title: 'Could not reject deal', description: error.message, variant: 'destructive' });
    } finally { setBusyAsin(null); }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 mb-2"><ArrowLeft className="w-3.5 h-3.5" /> Back to Admin</Link>
          <h1 className="text-3xl font-black text-slate-900">Review Exceptions</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">Normal verified deals publish automatically. This queue is reserved for deals with a specific reason to need a human decision.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[[ 'needs-review', 'Needs review' ], [ 'picks', 'DealScout Picks' ], [ 'all', 'All verified' ]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${filter === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 flex gap-3 items-start">
        <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700" />
        <div><strong>Low-touch by design:</strong> valid ordinary deals do not wait for you. Review only exceptions such as suspiciously extreme discounts or incomplete presentation data.</div>
      </div>

      {loading ? <div className="py-24 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div> : visibleDeals.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-slate-200 bg-white"><CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" /><h2 className="font-bold text-slate-900">Queue is clear</h2><p className="text-sm text-slate-500 mt-1">Automation is handling the ordinary deals.</p></div>
      ) : <div className="space-y-4">{visibleDeals.map((deal) => {
        const e = editorialByAsin[deal.asin] || emptyEditorial;
        const busy = busyAsin === deal.asin;
        const held = deal.status === 'PENDING_REVIEW';
        return <div key={deal.asin} className={`bg-white border rounded-3xl p-5 shadow-xs grid lg:grid-cols-[240px_1fr_230px] gap-5 ${held ? 'border-amber-300' : 'border-slate-200'}`}>
          <div className="flex gap-3 min-w-0"><div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 p-1 shrink-0 overflow-hidden"><Image src={deal.imageUrl} alt={deal.title} fittingType="contain" className="w-full h-full" /></div><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Price verified • {deal.sourceProvider || 'Provider'}</div>{held && <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded mt-1"><Clock className="w-3 h-3" /> Needs a decision</div>}<h3 className="text-xs font-bold text-slate-900 mt-1 line-clamp-3">{deal.title}</h3><div className="text-sm font-black text-emerald-700 mt-1">{formatPrice(deal.salePrice)} <span className="text-xs text-slate-400 line-through font-normal">{formatPrice(deal.originalPrice)}</span></div><div className="text-[11px] text-slate-500">{deal.discountPercent}% off • ASIN {deal.asin}</div></div></div>
          <div><label className="text-xs font-bold text-slate-700">Editorial note <span className="font-normal text-slate-400">(optional)</span></label><Textarea value={e.editorialNote || ''} maxLength={600} onChange={(event) => updateDraft(deal.asin, { editorialNote: event.target.value })} className="mt-2 min-h-[88px] rounded-xl text-sm" /><div className="flex justify-between mt-1 text-[10px] text-slate-400"><span>{e.reviewedAt ? `Reviewed ${new Date(Number(e.reviewedAt) * 1000).toLocaleString()}` : 'Not reviewed yet'}</span><span>{(e.editorialNote || '').length}/600</span></div></div>
          <div className="flex lg:flex-col gap-2 justify-center">
            {held && <Button disabled={busy} onClick={() => save(deal, { isHumanPick: false }, true)} className="rounded-xl font-bold gap-1.5 bg-slate-900 hover:bg-slate-800">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish Normally</Button>}
            <Button disabled={busy} onClick={() => save(deal, { isHumanPick: true }, held)} className="rounded-xl font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}{held ? 'Publish as Pick' : 'Make DealScout Pick'}</Button>
            {held && <Button disabled={busy} onClick={() => reject(deal)} variant="outline" className="rounded-xl font-bold gap-1.5 text-red-700 border-red-200 hover:bg-red-50"><XCircle className="w-4 h-4" /> Reject</Button>}
            <Button disabled={busy} onClick={() => save(deal, { isHumanPick: false }, false)} variant="outline" className="rounded-xl font-bold gap-1.5"><Save className="w-4 h-4" /> Save for Later</Button>
          </div>
        </div>;
      })}</div>}
    </div>
  );
}
