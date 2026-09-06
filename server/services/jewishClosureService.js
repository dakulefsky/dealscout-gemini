const JERUSALEM_GEONAME_ID = 281184;
const CURRENT_TTL_MS = 60 * 1000;
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000;

let currentCache = { at: 0, value: null };
const calendarCache = new Map();

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'DealScout/1.0 jewish-closure-calendar' } });
  if (!response.ok) throw new Error(`Hebcal request failed with HTTP ${response.status}`);
  return response.json();
}

async function currentStatus(now = new Date()) {
  const nowMs = now.getTime();
  if (currentCache.value && nowMs - currentCache.at < CURRENT_TTL_MS) return currentCache.value;
  const url = new URL('https://www.hebcal.com/zmanim');
  url.searchParams.set('cfg', 'json');
  url.searchParams.set('im', '1');
  url.searchParams.set('geonameid', String(JERUSALEM_GEONAME_ID));
  url.searchParams.set('dt', now.toISOString());
  const payload = await fetchJson(url);
  const value = {
    closed: payload?.status?.isAssurBemlacha === true,
    localTime: payload?.status?.localTime || null,
    location: payload?.location?.title || 'Jerusalem, Israel',
    source: 'Hebcal',
  };
  currentCache = { at: nowMs, value };
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

async function yearCalendar(year) {
  const key = Number(year);
  const cached = calendarCache.get(key);
  if (cached && Date.now() - cached.at < CALENDAR_TTL_MS) return cached.value;
  const url = new URL('https://www.hebcal.com/hebcal');
  url.searchParams.set('cfg', 'json');
  url.searchParams.set('v', '1');
  url.searchParams.set('year', String(key));
  url.searchParams.set('yt', 'G');
  url.searchParams.set('i', 'on');
  url.searchParams.set('maj', 'on');
  url.searchParams.set('c', 'on');
  url.searchParams.set('M', 'on');
  url.searchParams.set('geo', 'geoname');
  url.searchParams.set('geonameid', String(JERUSALEM_GEONAME_ID));
  url.searchParams.set('b', '40');
  const payload = await fetchJson(url);
  const value = pairClosures(payload?.items || []);
  calendarCache.set(key, { at: Date.now(), value });
  return value;
}

async function upcomingClosures({ from = new Date(), limit = 16 } = {}) {
  const startYear = from.getUTCFullYear();
  const periods = [...await yearCalendar(startYear), ...await yearCalendar(startYear + 1)]
    .filter((period) => Date.parse(period.end) >= from.getTime())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return periods.slice(0, Math.max(1, Math.min(100, Number(limit) || 16)));
}

function resetCaches() {
  currentCache = { at: 0, value: null };
  calendarCache.clear();
}

module.exports = { JERUSALEM_GEONAME_ID, currentStatus, upcomingClosures, pairClosures, resetCaches };
