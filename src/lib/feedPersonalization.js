const STORAGE_KEY = 'dealscout-feed-interests-v1';
const MAX_SCORE = 24;

function cleanCategory(value) {
  return String(value || '').trim().toLowerCase();
}

export function loadInterests() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function addCategoryInterest(category, weight = 1) {
  if (typeof window === 'undefined') return {};
  const key = cleanCategory(category);
  if (!key) return loadInterests();
  const current = loadInterests();
  const next = { ...current, [key]: Math.min(MAX_SCORE, Math.max(0, Number(current[key]) || 0) + Math.max(0, Number(weight) || 0)) };
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* personalization remains optional */ }
  return next;
}

export function personalizedRank(deals, interests = {}) {
  return (deals || [])
    .map((deal, index) => ({ deal, index, boost: Number(interests[cleanCategory(deal?.category)]) || 0 }))
    .sort((a, b) => b.boost - a.boost || a.index - b.index)
    .map(({ deal }) => deal);
}

export function dwellWeight(milliseconds) {
  const ms = Number(milliseconds) || 0;
  if (ms >= 12000) return 2;
  if (ms >= 5000) return 1;
  return 0;
}

export { STORAGE_KEY };
