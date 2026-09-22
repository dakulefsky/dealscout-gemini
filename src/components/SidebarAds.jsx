import AdSensePlaceholder, { validAdSenseClient, validAdSenseSlot } from '@/components/AdSensePlaceholder';

export default function SidebarAds() {
  const adClient = import.meta.env.VITE_ADSENSE_CLIENT || '';
  const primarySlot = import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT_1 || '';
  const secondarySlot = import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT_2 || '';
  const configured = validAdSenseClient(adClient) && (validAdSenseSlot(primarySlot) || validAdSenseSlot(secondarySlot));

  if (!configured) return null;

  return (
    <aside className="space-y-6" aria-label="Advertisements">
      {validAdSenseSlot(primarySlot) && <AdSensePlaceholder format="sidebar-rectangle" slotId={primarySlot} adClient={adClient} className="w-full" />}
      {validAdSenseSlot(secondarySlot) && <AdSensePlaceholder format="sidebar-rectangle" slotId={secondarySlot} adClient={adClient} className="w-full" />}
    </aside>
  );
}
