import { useState } from 'react';
import { Link2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { functions } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export default function AddDealCard({ disabled = false, onImported }) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function submit(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value || submitting || disabled) return;
    setSubmitting(true);
    try {
      const result = await functions.siteStripeImport(value, false);
      if (result?.alreadyExists) {
        toast({ title: 'Deal already exists', description: 'That Amazon product is already in the DealScout catalog.' });
      } else {
        setInput('');
        toast({ title: 'Deal imported', description: 'Live product data was verified and the deal was sent to review.' });
      }
      await onImported?.(result);
    } catch (error) {
      toast({ title: 'Could not add deal', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3"><Plus className="w-5 h-5 text-emerald-700" /></div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Manual find</div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Add a deal</h2>
          <p className="text-sm text-slate-500 mt-1">Paste an Amazon product URL, amzn.to link, SiteStripe link, or ASIN. DealScout verifies the live price before importing it.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-5 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input aria-label="Amazon deal URL or ASIN" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste Amazon URL or ASIN" disabled={disabled || submitting} className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50" />
        </div>
        <Button type="submit" disabled={disabled || submitting || !input.trim()} className="rounded-xl gap-2 font-black bg-emerald-600 hover:bg-emerald-500">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Verify & add
        </Button>
      </form>
      <p className="text-xs text-slate-400 mt-3">Nothing is published from the pasted URL alone. The provider must return a verifiable discounted price first.</p>
    </section>
  );
}
