const siteSettings = require('./siteRuntimeSettingsService');
const CACHE_MS = 30_000;
let window = null;
let loadedAt = 0;
let pending = null;

function invalidate() { window = null; loadedAt = 0; }
async function refresh() {
  if (loadedAt && Date.now() - loadedAt < CACHE_MS) return;
  if (pending) return pending;
  pending = (async () => {
    try {
      const [start, end] = await Promise.all([
        siteSettings.get('amazon_prime_day_start'), siteSettings.get('amazon_prime_day_end'),
      ]);
      const days = (Date.parse(end.value) - Date.parse(start.value)) / 86400000;
      window = start.value && end.value && days >= 0 && days <= 6 ? { start: start.value, end: end.value } : null;
    } catch {
      // Never relax selection or budgets when settings cannot be read.
      window = null;
    }
    loadedAt = Date.now();
  })().finally(() => { pending = null; });
  return pending;
}
function isPrimeDay(now = Date.now()) {
  if (!window || !loadedAt || Date.now() - loadedAt >= CACHE_MS) return false;
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) return false;
  // Match the existing admin-controlled seasonal banner's calendar.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return day >= window.start && day <= window.end;
}
module.exports = { isPrimeDay, refresh, invalidate };
