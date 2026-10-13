import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, Save } from 'lucide-react';
import { functions } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function AmazonSeasonalPromotionSettings() {
  const savingRef = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dates, setDates] = useState({ primeDayStart: '', primeDayEnd: '' });
  const [activePromotion, setActivePromotion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await functions.amazonSeasonalPromotion();
      setDates({ primeDayStart: result.primeDayStart || '', primeDayEnd: result.primeDayEnd || '' });
      setActivePromotion(result.activePromotion || null);
    } catch (error) {
      setLoadFailed(true);
      toast({ title: 'Promotion settings unavailable', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    if (loading || loadFailed || savingRef.current) return;
    if (Boolean(dates.primeDayStart) !== Boolean(dates.primeDayEnd)) {
      toast({ title: 'Add both dates or clear both dates', variant: 'destructive' });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await functions.setAmazonPrimeDayDates(dates.primeDayStart, dates.primeDayEnd);
      setDates({ primeDayStart: result.primeDayStart || '', primeDayEnd: result.primeDayEnd || '' });
      setActivePromotion(result.activePromotion || null);
      toast({ title: dates.primeDayStart ? 'Prime Day dates saved' : 'Prime Day dates cleared', description: 'The public banner updates without a redeploy.' });
    } catch (error) {
      toast({ title: 'Could not save promotion dates', description: error.message, variant: 'destructive' });
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
    <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-700" /><h2 className="font-black text-slate-900">Seasonal promotion banner</h2></div>
    <p className="mt-2 text-sm text-slate-600">Halloween Day, Thanksgiving Day, Black Friday, Cyber Monday, and Christmas Day sale banners turn on automatically each year. Add confirmed Prime Day dates from Associates Central when Amazon announces them. Each banner promotes the current selection without claiming every item is discounted.</p>
    {loadFailed && <div role="alert" className="mt-3 text-sm text-amber-800">Could not load promotion dates.<Button onClick={load} disabled={loading} variant="outline" className="ml-3">Retry promotion settings</Button></div>}
    <form onSubmit={save} className="mt-4">
      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <label className="text-xs font-semibold text-slate-700">Prime Day starts
          <input type="date" value={dates.primeDayStart} onChange={(event) => setDates((current) => ({ ...current, primeDayStart: event.target.value }))} disabled={loading || loadFailed || saving} className="mt-1 block w-full h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Prime Day ends
          <input type="date" value={dates.primeDayEnd} onChange={(event) => setDates((current) => ({ ...current, primeDayEnd: event.target.value }))} disabled={loading || loadFailed || saving} className="mt-1 block w-full h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={loading || loadFailed || saving} className="gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save dates</Button>
        <span className="text-xs text-slate-500">No deploy required. The public banner appears only during the saved dates.</span>
      </div>
    </form>
    <p className="mt-4 text-xs text-slate-500" role="status">{loading ? 'Loading seasonal banner…' : loadFailed ? 'Seasonal banner status unavailable.' : activePromotion ? `Banner active: ${activePromotion.title}` : 'No seasonal banner is active today.'}</p>
  </section>;
}
