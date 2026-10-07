import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { shareDeal } from '@/lib/shareDeal';

export default function ShareDeal({ deal }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const share = shareDeal(deal);
  async function copy() {
    try {
      await navigator.clipboard.writeText(share.message);
      toast({ title: 'Deal copied', description: 'Product details and link are ready to paste.' });
    } catch {
      toast({ title: 'Select and copy the message below', variant: 'destructive' });
    }
  }
  async function nativeShare() {
    try {
      await navigator.share({ title: share.title, text: share.text, url: share.url });
    } catch (error) {
      if (error.name !== 'AbortError') toast({ title: 'Try Copy deal or WhatsApp instead', variant: 'destructive' });
    }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" aria-label="Share deal" className="w-9 h-9 border border-emerald-950/15 flex items-center justify-center text-slate-500 hover:text-emerald-900 focus-visible:ring-2 focus-visible:ring-emerald-800"><Share2 className="w-4 h-4" /></button></DialogTrigger>
    <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md bg-white">
      <DialogTitle>Share this find</DialogTitle>
      <DialogDescription>Send the product details and a link to the deal.</DialogDescription>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {deal.imageUrl && <img src={deal.imageUrl} alt={share.title} className="h-40 w-full object-contain p-4 bg-white" />}
        <div className="p-4 bg-slate-50"><p className="font-semibold text-sm line-clamp-3">{share.title}</p>{share.price && <p className="mt-2 text-lg font-bold text-emerald-900">{share.price}</p>}<p className="text-xs text-slate-500 mt-2">dealscouted.com</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(share.message)}`} target="_blank" rel="noopener noreferrer" className="rounded-md bg-emerald-950 text-white px-4 py-2 text-sm font-semibold">WhatsApp</a>
        <button type="button" onClick={copy} className="rounded-md border px-4 py-2 text-sm font-semibold">Copy deal</button>
        {typeof navigator.share === 'function' && <button type="button" onClick={nativeShare} className="rounded-md border px-4 py-2 text-sm font-semibold">More options</button>}
      </div>
      <label className="text-xs text-slate-500">Message<textarea readOnly value={share.message} className="mt-1 w-full rounded border p-2 text-sm text-slate-700" rows={5} /></label>
      <p className="text-xs text-slate-500">The receiving app decides how the link preview appears.</p>
    </DialogContent>
  </Dialog>;
}
