const DISMISSED_KEY = 'dealscout-feed-dismissed-v1';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cleanId(value) {
  return String(value || '').trim();
}

export function loadDismissedDeals(now = Date.now()) {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || '{}');
    const current = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    const active = {};
    let changed = false;
    for (const [id, timestamp] of Object.entries(current)) {
      const dismissedAt = Number(timestamp) || 0;
      if (dismissedAt > 0 && now - dismissedAt < DISMISS_TTL_MS) active[id] = dismissedAt;
      else changed = true;
    }
    if (changed) window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(active));
    return active;
  } catch {
    return {};
  }
}

export function isDealDismissed(id, dismissals = loadDismissedDeals()) {
  return Boolean(dismissals[cleanId(id)]);
}

export function dismissDeal(id, now = Date.now()) {
  if (typeof window === 'undefined') return {};
  const key = cleanId(id);
  if (!key) return loadDismissedDeals(now);
  const next = { ...loadDismissedDeals(now), [key]: now };
  try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* optional local preference */ }
  return next;
}

export function restoreDeal(id) {
  if (typeof window === 'undefined') return {};
  const key = cleanId(id);
  const next = { ...loadDismissedDeals() };
  delete next[key];
  try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* optional local preference */ }
  return next;
}

export { DISMISSED_KEY, DISMISS_TTL_MS };
