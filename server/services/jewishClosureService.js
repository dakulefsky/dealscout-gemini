const siteSettings = require('./siteRuntimeSettingsService');

const JERUSALEM_GEONAME_ID = 281184;
const NEW_YORK_GEONAME_ID = 5128581;
const CURRENT_TTL_MS = 60 * 1000;
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000;

const LOCATIONS = Object.freeze({
  jerusalem: Object.freeze({
    key: 'jerusalem',
    title: 'Jerusalem, Israel',
    timezone: 'Asia/Jerusalem',
    geonameId: JERUSALEM_GEONAME_ID,
    israel: true,
    candleMinutes: 40,
    havdalahMinutes: 50,
    scheduleLabel: 'Israel holiday schedule',
  }),
  new_york: Object.freeze({
    key: 'new_york',
    title: 'New York, NY',
    timezone: 'America/New_York',
    geonameId: NEW_YORK_GEONAME_ID,
    israel: false,
    candleMinutes: 18,
    havdalahMinutes: 50,
    scheduleLabel: 'Diaspora holiday schedule',
  }),
});

const currentCache = new Map();
const calendarCache = new Map();

function locationConfig(location = 'jerusalem') {
  const key = String(location || '').trim().toLowerCase();
  if (!LOCATIONS[key]) throw new Error(`Unsupported closure location: ${key || 'blank'}`);
  return LOCATIONS[key];
}

async function selectedLocation() {
  const setting = await siteSettings.get('closure_location');
  return locationConfig(setting.value || 'jerusalem');
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'DealScout/1.0 jewish-closure-calendar' } });
  if (!response.ok) throw new Error(`Hebcal request failed with HTTP ${response.status}`);
  return response.json();
}

async function currentStatus(now = new Date(), options = {}) {
  const config = options.location ? locationConfig(options.location) : await selectedLocation();
  const nowMs = now.getTime();
  const cached = currentCache.get(config.key);
  if (cached?.value && nowMs - cached.at < CURRENT_TTL_MS) return cached.value;
  const url = new URL('https://www.hebcal.com/zmanim');
  url.searchParams.set('cfg', 'json');
  url.searchParams.set('im', '1');
  url.searchParams.set('geonameid', String(config.geonameId));
  url.searchParams.set('dt', now.toISOString());
  if (config.israel) url.searchParams.set('i', 'on');
  const payload = await fetchJson(url);
  const value = {
    closed: payload?.status?.isAssurBemlacha === true,
    localTime: payload?.status?.localTime || null,
    location: payload?.location?.title || config.title,
    locationKey: config.key,
    timezone: config.timezone,
    schedule: config.scheduleLabel,
    source: 'Hebcal',
  };
  currentCache.set(config.key, { at: nowMs, value });
  return value;
}

function pairClosures(items = []) {
  const timed = items
    .filter((item) => (item.category === 'candles' || item.category === 'havdalah') && String(item.date || '').includes('T'))
    .map((item) => ({ ...item, at: Date.parse(item.date) }))
    .filter((item) => Number.isFinite(item.at))
    .sort((a, b) => a.at - b.at);
  const periods = [];
  let start = null;
  let labels = [];
  for (const item of timed) {
    if (item.category === 'candles') {
      if (start === null) start = item.at;
      if (item.memo) labels.push(item.memo);
    } else if (item.category === 'havdalah' && start !== null) {
      periods.push({
        start: new Date(start).toISOString(),
        end: new Date(item.at).toISOString(),
        label: [...new Set(labels.filter(Boolean))].join(' / ') || 'Shabbat or Yom Tov',
      });
      start = null;
      labels = [];
    }
  }
  return periods;
}

async function yearCalendar(year, { location = 'jerusalem' } = {}) {
  const config = locationConfig(location);
  const key = `${config.key}:${Number(year)}`;
  const cached = calendarCache.get(key);
  if (cached && Date.now() - cached.at < CALENDAR_TTL_MS) return cached.value;
  const url = new URL('https://www.hebcal.com/hebcal');
  url.searchParams.set('cfg', 'json');
  url.searchParams.set('v', '1');
  url.searchParams.set('year', String(Number(year)));
  url.searchParams.set('yt', 'G');
  if (config.israel) url.searchParams.set('i', 'on');
  url.searchParams.set('maj', 'on');
  url.searchParams.set('c', 'on');
  url.searchParams.set('M', 'on');
  url.searchParams.set('geo', 'geoname');
  url.searchParams.set('geonameid', String(config.geonameId));
  url.searchParams.set('b', String(config.candleMinutes));
  url.searchParams.set('m', String(config.havdalahMinutes));
  const payload = await fetchJson(url);
  const value = pairClosures(payload?.items || []);
  calendarCache.set(key, { at: Date.now(), value });
  return value;
}

async function upcomingClosures({ from = new Date(), limit = 16, location = 'jerusalem' } = {}) {
  const config = locationConfig(location);
  const startYear = from.getUTCFullYear();
  const periods = [...await yearCalendar(startYear, { location: config.key }), ...await yearCalendar(startYear + 1, { location: config.key })]
    .filter((period) => Date.parse(period.end) >= from.getTime())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return periods.slice(0, Math.max(1, Math.min(100, Number(limit) || 16)));
}

function resetCaches() {
  currentCache.clear();
  calendarCache.clear();
}

module.exports = { JERUSALEM_GEONAME_ID, NEW_YORK_GEONAME_ID, LOCATIONS, locationConfig, selectedLocation, currentStatus, upcomingClosures, pairClosures, resetCaches };
