const STORAGE_KEY = 'dealscout-feed-interests-v1';
const DECAY_KEY = 'dealscout-feed-interests-decay-v1';
const MAX_SCORE = 24;
const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DAILY_DECAY = 0.97;
const MIN_RETAINED_SCORE = 0.25;
const PERSONALIZATION_WINDOW = 8;
const EXPLORATION_EVERY = 4;
const MAX_CATEGORY_STREAK = 2;

function cleanCategory(value) {
  return String(value || '').trim().toLowerCase();
}

function interestScore(deal, interests) {
  return Number(interests[cleanCategory(deal?.category)]) || 0;
}

function categoryStreak(deals) {
  if (!deals.length) return { category: '', count: 0 };
  const category = cleanCategory(deals[deals.length - 1]?.category);
  let count = 0;
  for (let index = deals.length - 1; index >= 0; index -= 1) {
    if (cleanCategory(deals[index]?.category) !== category) break;
    count += 1;
  }
  return { category, count };
}

export function decayInterests(interests = {}, elapsedMs = 0) {
  const days = Math.floor(Math.max(0, Number(elapsedMs) || 0) / DECAY_INTERVAL_MS);
  if (days < 1) return interests;
  const factor = DAILY_DECAY ** days;
  const next = {};
  for (const [category, rawScore] of Object.entries(interests || {})) {
    const score = Math.max(0, Number(rawScore) || 0) * factor;
    if (score >= MIN_RETAINED_SCORE) next[category] = Math.round(score * 100) / 100;
  }
  return next;
}

export function loadInterests() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    const interests = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    const now = Date.now();
    const lastDecay = Number(window.localStorage.getItem(DECAY_KEY)) || 0;
    if (!lastDecay) {
      window.localStorage.setItem(DECAY_KEY, String(now));
      return interests;
    }
    if (now - lastDecay < DECAY_INTERVAL_MS) return interests;
    const decayed = decayInterests(interests, now - lastDecay);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decayed));
    window.localStorage.setItem(DECAY_KEY, String(now));
    return decayed;
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

export function reduceCategoryInterest(category, weight = 3) {
  if (typeof window === 'undefined') return {};
  const key = cleanCategory(category);
  if (!key) return loadInterests();
  const current = loadInterests();
  const reduced = Math.max(0, (Number(current[key]) || 0) - Math.max(0, Number(weight) || 0));
  const next = { ...current };
  if (reduced >= MIN_RETAINED_SCORE) next[key] = Math.round(reduced * 100) / 100;
  else delete next[key];
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* personalization remains optional */ }
  return next;
}

export function personalizedRank(deals, interests = {}) {
  const base = [...(deals || [])];
  const positiveInterests = Object.entries(interests || {})
    .map(([category, score]) => [cleanCategory(category), Number(score) || 0])
    .filter(([category, score]) => category && score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!positiveInterests.length || base.length < 2) return base;

  const familiar = new Set(positiveInterests.slice(0, 2).map(([category]) => category));
  const remaining = base.map((deal, baseIndex) => ({ deal, baseIndex }));
  const ranked = [];

  while (remaining.length) {
    const poolSize = Math.min(PERSONALIZATION_WINDOW, remaining.length);
    const pool = remaining.slice(0, poolSize);
    const { category: lastCategory, count: streak } = categoryStreak(ranked);
    const explorationTurn = (ranked.length + 1) % EXPLORATION_EVERY === 0;

    let selected = -1;
    if (explorationTurn) {
      selected = pool.findIndex(({ deal }) => {
        const category = cleanCategory(deal?.category);
        return category && !familiar.has(category) && category !== lastCategory;
      });
    }

    if (selected < 0) {
      const candidates = pool
        .map((item, poolIndex) => ({ ...item, poolIndex, boost: interestScore(item.deal, interests), category: cleanCategory(item.deal?.category) }))
        .filter((item) => streak < MAX_CATEGORY_STREAK || item.category !== lastCategory)
        .sort((a, b) => b.boost - a.boost || a.baseIndex - b.baseIndex);
      selected = candidates[0]?.poolIndex ?? 0;
    }

    const [{ deal }] = remaining.splice(selected, 1);
    ranked.push(deal);
  }

  return ranked;
}

export function dwellWeight(milliseconds) {
  const ms = Number(milliseconds) || 0;
  if (ms >= 12000) return 2;
  if (ms >= 5000) return 1;
  return 0;
}

export { STORAGE_KEY, PERSONALIZATION_WINDOW, EXPLORATION_EVERY, MAX_CATEGORY_STREAK };
