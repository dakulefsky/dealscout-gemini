import { useEffect, useRef } from 'react';

const PLACEHOLDER_SLOTS = new Set(['1234567890', '9876543210', '9876543211', '5432109876']);

function validAdSenseClient(value) {
  return /^ca-pub-\d{10,}$/.test(String(value || '').trim());
}

function validAdSenseSlot(value) {
  const slot = String(value || '').trim();
  return /^\d{6,}$/.test(slot) && !PLACEHOLDER_SLOTS.has(slot);
}

/**
 * Renders a real AdSense unit only after production credentials have been configured.
 * Until then it renders nothing: shoppers should never see fake/reserved ad boxes.
 */
export default function AdSensePlaceholder({
  format = 'sidebar-rectangle',
  slotId = '',
  adClient = import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-7492088381598802',
  className = '',
}) {
  const adRef = useRef(null);
  const enabled = validAdSenseClient(adClient) && validAdSenseSlot(slotId);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (typeof window !== 'undefined' && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch {
      // A blocked/unavailable ad must never break the product page.
    }
  }, [enabled, slotId]);

  if (!enabled) return null;

  const formatConfigs = {
    'sidebar-rectangle': {
      containerClass: 'w-full max-w-[300px] min-h-[250px] mx-auto',
      adFormat: 'rectangle',
    },
    'half-page': {
      containerClass: 'w-full max-w-[300px] min-h-[600px] mx-auto',
      adFormat: 'vertical',
    },
    'in-content': {
      containerClass: 'w-full min-h-[160px] sm:min-h-[200px]',
      adFormat: 'auto',
    },
    leaderboard: {
      containerClass: 'w-full max-w-[728px] min-h-[90px] mx-auto',
      adFormat: 'horizontal',
    },
    responsive: {
      containerClass: 'w-full min-h-[250px]',
      adFormat: 'auto',
    },
  };

  const currentConfig = formatConfigs[format] || formatConfigs['sidebar-rectangle'];

  return (
    <div className={`${currentConfig.containerClass} ${className}`} aria-label="Advertisement">
      <ins
        ref={adRef}
        className="adsbygoogle block w-full"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={slotId}
        data-ad-format={currentConfig.adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export { validAdSenseClient, validAdSenseSlot };
