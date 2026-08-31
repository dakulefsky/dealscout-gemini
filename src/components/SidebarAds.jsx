import { ExternalLink } from 'lucide-react';
import AdSensePlaceholder from '@/components/AdSensePlaceholder';

export default function SidebarAds() {
  const promoOffers = [
    {
      id: 'ad-1',
      badge: 'Amazon Special',
      title: 'Audible Premium Plus — 30-Day Free Trial',
      description: 'Get free audiobooks + unlimited access to thousands of podcasts & Amazon originals.',
      cta: 'Claim Free Trial',
      link: 'https://www.amazon.com/hz/audible/mlp/membership/premiumplus',
      tag: 'Limited Time',
      bgGradient: 'from-amber-500/10 via-amber-50 to-white',
      accentColor: 'text-amber-700 bg-amber-100',
      btnColor: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    {
      id: 'ad-2',
      badge: 'Prime Deal',
      title: 'Amazon Prime 30-Day Free Trial',
      description: 'Free fast delivery, exclusive deals, Prime Video streaming, and early deal access.',
      cta: 'Start Prime Trial',
      link: 'https://www.amazon.com/amazonprime',
      tag: 'Prime Value',
      bgGradient: 'from-blue-500/10 via-blue-50 to-white',
      accentColor: 'text-blue-700 bg-blue-100',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  ];

  return (
    <aside className="space-y-6" aria-label="Product Page Sponsored Ads">
      <div className="space-y-6">
        <AdSensePlaceholder format="sidebar-rectangle" slotId="9876543210" label="Sponsored Ad" className="w-full" />
        <div className="space-y-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            <span>Featured Promotions</span>
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Offer</span>
          </div>
          {promoOffers.map((ad) => (
            <div key={ad.id} className={`rounded-2xl border border-slate-200/90 p-4 bg-gradient-to-b ${ad.bgGradient} shadow-xs hover:shadow-md transition duration-200 relative overflow-hidden group`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${ad.accentColor}`}>{ad.tag}</span>
                <span className="text-[10px] text-slate-400 font-medium">{ad.badge}</span>
              </div>
              <h4 className="font-heading font-bold text-slate-900 text-sm leading-snug group-hover:text-emerald-700 transition">{ad.title}</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{ad.description}</p>
              <a href={ad.link} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-extrabold rounded-xl transition shadow-xs ${ad.btnColor}`}>
                <span>{ad.cta}</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            </div>
          ))}
        </div>
        <AdSensePlaceholder format="sidebar-rectangle" slotId="9876543211" label="Partner Ad" className="w-full" />
      </div>
    </aside>
  );
}
