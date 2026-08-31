import { useEffect, useRef } from 'react';

/**
 * AdSensePlaceholder
 * Reserves strict vertical space for Google AdSense ad units on Product Detail pages
 * to prevent Cumulative Layout Shift (CLS) and ensure seamless AdSense compliance.
 */
export default function AdSensePlaceholder({
  format = 'sidebar-rectangle',
  slotId = '1234567890',
  adClient = 'ca-pub-XXXXXXXXXXXXXXXX',
  className = '',
  label = 'Advertisement',
  showNotice = true,
}) {
  const adRef = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.adsbygoogle && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch {
      // Ignore in dev/preview if script not loaded yet.
    }
  }, []);

  const formatConfigs = {
    'sidebar-rectangle': {
      containerClass: 'w-full max-w-[300px] min-h-[250px] mx-auto',
      aspectClass: 'h-[250px]',
      dimensionText: '300 × 250 Medium Rectangle',
      adFormat: 'rectangle',
    },
    'half-page': {
      containerClass: 'w-full max-w-[300px] min-h-[600px] mx-auto',
      aspectClass: 'h-[600px]',
      dimensionText: '300 × 600 Half-Page Tower',
      adFormat: 'vertical',
    },
    'in-content': {
      containerClass: 'w-full min-h-[160px] sm:min-h-[200px]',
      aspectClass: 'h-[160px] sm:h-[200px]',
      dimensionText: 'Responsive In-Article Display Ad',
      adFormat: 'auto',
    },
    leaderboard: {
      containerClass: 'w-full max-w-[728px] min-h-[90px] mx-auto',
      aspectClass: 'h-[90px]',
      dimensionText: '728 × 90 Leaderboard Banner',
      adFormat: 'horizontal',
    },
    responsive: {
      containerClass: 'w-full min-h-[250px]',
      aspectClass: 'h-[250px]',
      dimensionText: 'Responsive Google AdSense Unit',
      adFormat: 'auto',
    },
  };

  const currentConfig = formatConfigs[format] || formatConfigs['sidebar-rectangle'];

  return (
    <div
      id={`adsense-slot-${format}-${slotId}`}
      className={`adsense-reserved-slot relative rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-3 flex flex-col justify-between overflow-hidden shadow-xs select-none transition-all ${currentConfig.containerClass} ${className}`}
      style={{ minHeight: 'inherit' }}
      aria-label="Sponsored Google Ad Placement"
    >
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          {label}
        </span>
        <span className="text-[9px] font-semibold text-slate-400 bg-white/80 border border-slate-200/70 px-1.5 py-0.5 rounded shadow-2xs">Google AdSense</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center my-2 text-center p-3 rounded-xl border border-dashed border-slate-300/80 bg-white/70">
        <ins
          ref={adRef}
          className="adsbygoogle block w-full h-full"
          style={{ display: 'block', minHeight: 'inherit' }}
          data-ad-client={adClient}
          data-ad-slot={slotId}
          data-ad-format={currentConfig.adFormat}
          data-full-width-responsive="true"
        />
        <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <span className="text-xs font-bold text-slate-600">AdSense Ad Space Reserved</span>
          <span className="text-[11px] text-slate-400 font-medium">{currentConfig.dimensionText}</span>
        </div>
      </div>

      {showNotice && (
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1 border-t border-slate-200/60 font-medium">
          <span>Targeted Product Sponsor</span>
          <span className="text-[9px] text-slate-400">Reserved Vertical Space</span>
        </div>
      )}
    </div>
  );
}
