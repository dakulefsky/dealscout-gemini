const SEEN_KEY = 'dealscout-deal-drop-seen-v1';
const SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const QUALITY_LOOKAHEAD = 24;

function dealId(deal) {
  return String(deal?.id || deal?.asin || '').trim();
}

export function loadSeenDealDrop(now = Date.now()) {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '{}');
    const next = {};
    let changed = false;
    for (const [id, rawTimestamp] of Object.entries(parsed && typeof parsed === 'object' ? parsed : {})) {
      const timestamp = Number(rawTimestamp) || 0;
      if (!id || !timestamp || now - timestamp > SEEN_TTL_MS) { changed = true; continue; }
      next[id] = timestamp;
    }
    if (changed) window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    return next;
  } catch {
    return {};
  }
}

export function markDealDropSeen(deals, now = Date.now()) {
  if (typeof window === 'undefined') return {};
  const current = loadSeenDealDrop(now);
  const next = { ...current };
  for (const deal of deals || []) {
    const id = dealId(deal);
    if (id) next[id] = now;
  }
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* freshness memory remains optional */ }
  return next;
}

export function freshDealDrop(deals, seen = {}, limit = 8, lookahead = QUALITY_LOOKAHEAD) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  if (!safeLimit) return [];
  const candidates = (deals || []).slice(0, Math.max(safeLimit, Number(lookahead) || QUALITY_LOOKAHEAD));
  const unseen = [];
  const recentlySeen = [];
  for (const deal of candidates) {
    if (seen[dealId(deal)]) recentlySeen.push(deal);
    else unseen.push(deal);
  }
  return [...unseen, ...recentlySeen].slice(0, safeLimit);
}

export { SEEN_KEY, SEEN_TTL_MS, QUALITY_LOOKAHEAD };
