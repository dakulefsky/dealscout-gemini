const DISMISSED_KEY = 'dealscout-feed-dismissed-v1';
const DISMISSALS_CHANGED_EVENT = 'dealscout:dismissals-changed';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cleanId(value) {
  return String(value || '').trim();
}

function notifyDismissalsChanged(dismissals) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(DISMISSALS_CHANGED_EVENT, { detail: { dismissals } }));
  } catch {
    try { window.dispatchEvent(new Event(DISMISSALS_CHANGED_EVENT)); } catch { /* optional local preference */ }
  }
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
    if (changed) {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(active));
      notifyDismissalsChanged(active);
    }
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
  notifyDismissalsChanged(next);
  return next;
}

export function restoreDeal(id) {
  if (typeof window === 'undefined') return {};
  const key = cleanId(id);
  const next = { ...loadDismissedDeals() };
  delete next[key];
  try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* optional local preference */ }
  notifyDismissalsChanged(next);
  return next;
}

export { DISMISSED_KEY, DISMISSALS_CHANGED_EVENT, DISMISS_TTL_MS };