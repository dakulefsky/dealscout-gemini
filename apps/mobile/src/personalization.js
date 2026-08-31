import * as SecureStore from 'expo-secure-store';
import { addInterest, decayInterests, reduceInterest, DECAY_INTERVAL_MS } from '../../../src/lib/personalizationCore';

const INTERESTS_KEY = 'dealscout-feed-interests-v1';
const DECAY_KEY = 'dealscout-feed-interests-decay-v1';

function parseInterests(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function loadInterests(now = Date.now()) {
  const [rawInterests, rawDecay] = await Promise.all([
    SecureStore.getItemAsync(INTERESTS_KEY),
    SecureStore.getItemAsync(DECAY_KEY),
  ]);
  const interests = parseInterests(rawInterests);
  const lastDecay = Number(rawDecay) || 0;
  if (!lastDecay) {
    await SecureStore.setItemAsync(DECAY_KEY, String(now));
    return interests;
  }
  if (now - lastDecay < DECAY_INTERVAL_MS) return interests;
  const decayed = decayInterests(interests, now - lastDecay);
  await Promise.all([
    SecureStore.setItemAsync(INTERESTS_KEY, JSON.stringify(decayed)),
    SecureStore.setItemAsync(DECAY_KEY, String(now)),
  ]);
  return decayed;
}

async function addCategoryInterest(category, weight = 1) {
  const current = await loadInterests();
  const next = addInterest(current, category, weight);
  await SecureStore.setItemAsync(INTERESTS_KEY, JSON.stringify(next));
  return next;
}

async function reduceCategoryInterest(category, weight = 3) {
  const current = await loadInterests();
  const next = reduceInterest(current, category, weight);
  await SecureStore.setItemAsync(INTERESTS_KEY, JSON.stringify(next));
  return next;
}

async function resetInterests() {
  await Promise.all([
    SecureStore.deleteItemAsync(INTERESTS_KEY),
    SecureStore.deleteItemAsync(DECAY_KEY),
  ]);
  return {};
}

export { INTERESTS_KEY, DECAY_KEY, loadInterests, addCategoryInterest, reduceCategoryInterest, resetInterests };
