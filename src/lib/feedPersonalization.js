import {
  DECAY_INTERVAL_MS,
  addInterest,
  decayInterests,
  dwellWeight,
  personalizedRank,
  reduceInterest,
  PERSONALIZATION_WINDOW,
  EXPLORATION_EVERY,
  MAX_CATEGORY_STREAK,
} from './personalizationCore';

const STORAGE_KEY = 'dealscout-feed-interests-v1';
const DECAY_KEY = 'dealscout-feed-interests-decay-v1';
const INTERESTS_CHANGED_EVENT = 'dealscout:interests-changed';

function notifyInterestsChanged(interests) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(INTERESTS_CHANGED_EVENT, { detail: { interests } }));
  } catch {
    try { window.dispatchEvent(new Event(INTERESTS_CHANGED_EVENT)); } catch { /* personalization remains optional */ }
  }
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
    notifyInterestsChanged(decayed);
    return decayed;
  } catch {
    return {};
  }
}

export function addCategoryInterest(category, weight = 1) {
  if (typeof window === 'undefined') return {};
  const next = addInterest(loadInterests(), category, weight);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* personalization remains optional */ }
  notifyInterestsChanged(next);
  return next;
}

export function reduceCategoryInterest(category, weight = 3) {
  if (typeof window === 'undefined') return {};
  const next = reduceInterest(loadInterests(), category, weight);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* personalization remains optional */ }
  notifyInterestsChanged(next);
  return next;
}

export {
  decayInterests,
  personalizedRank,
  dwellWeight,
  STORAGE_KEY,
  INTERESTS_CHANGED_EVENT,
  PERSONALIZATION_WINDOW,
  EXPLORATION_EVERY,
  MAX_CATEGORY_STREAK,
};
