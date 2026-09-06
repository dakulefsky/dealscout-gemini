import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, MapPin, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { functions } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

function localTime(iso, timeZone) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC', weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

export default function AdminOperationsControls() {
  const [settings, setSettings] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const { toast } = useToast();

  async function load() {
    const [settingsResult, calendarResult] = await Promise.allSettled([
      functions.channelSettings(), functions.jewishCalendar(),
    ]);
    if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
    if (calendarResult.status === 'fulfilled') setCalendar(calendarResult.value);
  }

  useEffect(() => { load(); }, []);

  const apiEnabled = settings?.providerApi?.enabled !== false;
  async function toggleApi() {
    if (!settings || busy) return;
    setBusy(true);
    try {
      const next = !apiEnabled;
      const result = await functions.setProviderApiEnabled(next);
      setSettings(result);
      toast({ title: next ? 'Provider API resumed' : 'Provider API paused', description: next ? 'Automated and manual external provider calls can run again.' : 'No new external deal-provider requests will be sent until you resume them.' });
    } catch (error) {
      toast({ title: 'Could not change API state', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function switchLocation(location) {
    if (locationBusy || calendar?.location === location) return;
    setLocationBusy(true);
    try {
      const result = await functions.setJewishCalendarLocation(location);
      setCalendar(result);
      toast({ title: `Closure validation set to ${result.title}`, description: `${result.schedule}. Shabbat and Yom Tov shutdowns now follow ${result.timezone}.` });
    } catch (error) {
      toast({ title: 'Could not change closure location', description: error.message, variant: 'destructive' });
    } finally {
      setLocationBusy(false);
    }
  }

  const selectedLocation = calendar?.location || 'jerusalem';

  return (
    <section className="max-w-6xl mx-auto px-4 pt-8 grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><ShieldCheck className="w-4 h-4" /> External API control</div>
            <h2 className="text-xl font-black text-slate-900 mt-2">Deal-provider API</h2>
            <p className="text-sm text-slate-500 mt-2">Pausing blocks outbound Amazon/Rainforest provider calls before budget reservation. The existing catalog stays online.</p>
          </div>
          <span className={`text-xs font-black ${apiEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>{settings ? (apiEnabled ? 'RUNNING' : 'PAUSED') : 'LOADING'}</span>
        </div>
        <Button onClick={toggleApi} disabled={!settings || busy} variant="outline" className="mt-4 w-full rounded-xl gap-2 font-bold">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : apiEnabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          {apiEnabled ? 'Pause provider API' : 'Resume provider API'}
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><CalendarDays className="w-4 h-4" /> Closure calendar</div>
            <h2 className="text-xl font-black text-slate-900 mt-2">Shabbat &amp; Yom Tov</h2>
            <p className="text-sm text-slate-500 mt-2">Choose which local Jewish calendar controls the shopper-site shutdown.</p>
          </div>
          <span className={`text-xs font-black ${calendar?.status?.closed ? 'text-amber-700' : 'text-emerald-700'}`}>{calendar ? (calendar.status?.closed ? 'CLOSED NOW' : 'OPEN NOW') : 'LOADING'}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Closure validation location">
          <Button type="button" disabled={!calendar || locationBusy} onClick={() => switchLocation('jerusalem')} variant={selectedLocation === 'jerusalem' ? 'default' : 'outline'} className="rounded-xl gap-2 font-bold">
            {locationBusy && selectedLocation !== 'jerusalem' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Jerusalem
          </Button>
          <Button type="button" disabled={!calendar || locationBusy} onClick={() => switchLocation('new_york')} variant={selectedLocation === 'new_york' ? 'default' : 'outline'} className="rounded-xl gap-2 font-bold">
            {locationBusy && selectedLocation !== 'new_york' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} New York
          </Button>
        </div>

        {calendar && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-bold text-slate-800">Active:</span> {calendar.title} · {calendar.schedule} · {calendar.candleMinutes}-minute candle lighting · {calendar.havdalahMinutes}-minute Havdalah
          </div>
        )}

        <div className="mt-4 space-y-2 max-h-48 overflow-auto">
          {(calendar?.upcoming || []).slice(0, 8).map((period) => (
            <div key={`${period.start}-${period.end}`} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0 text-xs">
              <div className="font-bold text-slate-800">{period.label}</div>
              <div className="text-slate-500 mt-0.5">{localTime(period.start, calendar.timezone)} → {localTime(period.end, calendar.timezone)}</div>
            </div>
          ))}
          {calendar && !calendar.upcoming?.length && <div className="text-sm text-slate-500">No upcoming closures loaded.</div>}
        </div>
        <div className="mt-3 text-[11px] text-slate-400">Hebcal Assur Melacha validation · selected location is saved and controls production shutdowns</div>
      </div>
    </section>
  );
}
