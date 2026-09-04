const SEEN_KEY = 'dealscout-deal-drop-seen-v1';
const SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const QUALITY_LOOKAHEAD = 24;

function dealId(deal) {
  return String(deal?.id || deal?.asin || '').trim();
}

function categoryKey(deal) {
  return String(deal?.category || 'other').trim().toLowerCase();
}

function titleTokens(deal) {
  return new Set(String(deal?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !['with', 'from', 'pack', 'size', 'amazon'].includes(token)));
}

function looksLikeSameProductFamily(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (!a.size || !b.size) return false;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap >= 2 && overlap / Math.min(a.size, b.size) >= 0.5;
}

function diverseOrder(deals, limit) {
  const source = [...(deals || [])];
  const picked = [];
  const categoryCounts = new Map();
  while (source.length && picked.length < limit) {
    let index = source.findIndex((deal) => (categoryCounts.get(categoryKey(deal)) || 0) === 0
      && !picked.some((chosen) => looksLikeSameProductFamily(chosen, deal)));
    if (index < 0) index = source.findIndex((deal) => !picked.some((chosen) => looksLikeSameProductFamily(chosen, deal)));
    if (index < 0) index = 0;
    const [deal] = source.splice(index, 1);
    picked.push(deal);
    const key = categoryKey(deal);
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }
  return picked;
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
  return diverseOrder([...unseen, ...recentlySeen], safeLimit);
}

export { SEEN_KEY, SEEN_TTL_MS, QUALITY_LOOKAHEAD, looksLikeSameProductFamily };
