import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck, Star, Save, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

  async function load() {
    setLoading(true);
    try {
      const liveDeals = await dealsApi.list({ status: 'APPROVED', limit: 100 });
      const verified = (liveDeals || []).filter((d) => d.sourceVerified && !d.isExpired);
      setDeals(verified);
      const rows = await Promise.all(verified.map(async (deal) => {
        try { return [deal.asin, await editorialApi.get(deal.asin)]; }
        catch { return [deal.asin, emptyEditorial]; }
      }));
      setEditorialByAsin(Object.fromEntries(rows));
    } catch (error) {
      toast({ title: 'Could not load editorial queue', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visibleDeals = useMemo(() => deals.filter((deal) => {
    const e = editorialByAsin[deal.asin] || emptyEditorial;
    if (filter === 'needs-review') return !e.reviewedAt;
    if (filter === 'picks') return e.isHumanPick;
    return true;
  }), [deals, editorialByAsin, filter]);

  function updateDraft(asin, patch) {
    setEditorialByAsin((prev) => ({ ...prev, [asin]: { ...(prev[asin] || emptyEditorial), ...patch } }));
  }

  async function save(deal, override = {}) {
    const current = { ...(editorialByAsin[deal.asin] || emptyEditorial), ...override };
    setBusyAsin(deal.asin);
    try {
      const saved = await editorialApi.save(deal.asin, {
        editorialNote: current.editorialNote || '',
        isHumanPick: Boolean(current.isHumanPick),
      });
      setEditorialByAsin((prev) => ({ ...prev, [deal.asin]: saved }));
      toast({
        title: saved.isHumanPick ? 'DealScout Pick saved' : 'Editorial review saved',
        description: saved.isHumanPick ? 'This deal now has explicit human editorial approval.' : 'Human review recorded without marking it as a DealScout Pick.',
      });
    } catch (error) {
      toast({ title: 'Editorial save failed', description: error.message, variant: 'destructive' });
    } finally {
      setBusyAsin(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-black text-slate-900">Editorial Review</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">Rainforest owns the factual product data. This page only records your human judgment and optional commentary, so automation stays fast while editorial approval remains real and auditable.</p>
        </div>
        <div className="flex gap-2">
          {[
            ['needs-review', 'Needs review'],
            ['picks', 'DealScout Picks'],
            ['all', 'All verified'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${filter === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 flex gap-3 items-start">
        <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700" />
        <div><strong>Truth-first editorial rule:</strong> do not claim personal use unless you actually used the product. Good notes explain why the price/value stood out, what tradeoff you noticed, or why you chose to feature it.</div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
      ) : visibleDeals.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-slate-200 bg-white">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
          <h2 className="font-bold text-slate-900">Queue is clear</h2>
          <p className="text-sm text-slate-500 mt-1">No verified deals match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleDeals.map((deal) => {
            const e = editorialByAsin[deal.asin] || emptyEditorial;
            const busy = busyAsin === deal.asin;
            return (
              <div key={deal.asin} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs grid lg:grid-cols-[240px_1fr_190px] gap-5">
                <div className="flex gap-3 min-w-0">
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 p-1 shrink-0 overflow-hidden">
                    <Image src={deal.imageUrl} alt={deal.title} fittingType="contain" className="w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Verified • {deal.sourceProvider || 'Provider'}</div>
                    <h3 className="text-xs font-bold text-slate-900 mt-1 line-clamp-3">{deal.title}</h3>
                    <div className="text-sm font-black text-emerald-700 mt-1">{formatPrice(deal.salePrice)} <span className="text-xs text-slate-400 line-through font-normal">{formatPrice(deal.originalPrice)}</span></div>
                    <div className="text-[11px] text-slate-500">{deal.discountPercent}% off • ASIN {deal.asin}</div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Why I chose this deal <span className="font-normal text-slate-400">(optional, max 600 characters)</span></label>
                  <Textarea
                    value={e.editorialNote || ''}
                    maxLength={600}
                    onChange={(event) => updateDraft(deal.asin, { editorialNote: event.target.value })}
                    placeholder="Example: $70 below the current list price, and the discount is unusually strong for this model."
                    className="mt-2 min-h-[88px] rounded-xl text-sm"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                    <span>{e.reviewedAt ? `Reviewed ${new Date(Number(e.reviewedAt) * 1000).toLocaleString()}` : 'Not yet human-reviewed'}</span>
                    <span>{(e.editorialNote || '').length}/600</span>
                  </div>
                </div>

                <div className="flex lg:flex-col gap-2 justify-center">
                  <Button
                    disabled={busy}
                    onClick={() => save(deal, { isHumanPick: true })}
                    className={`rounded-xl font-bold gap-1.5 ${e.isHumanPick ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                    {e.isHumanPick ? 'Update Pick' : 'Make DealScout Pick'}
                  </Button>
                  <Button disabled={busy} onClick={() => save(deal, { isHumanPick: false })} variant="outline" className="rounded-xl font-bold gap-1.5">
                    <Save className="w-4 h-4" /> Save Review Only
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
