import * as SecureStore from 'expo-secure-store';

const DISMISSALS_KEY = 'dealscout-feed-dismissed-v1';
const LAST_VISIT_KEY = 'dealscout-feed-last-visit-v1';
const DISMISSAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toEpochMilliseconds(value) {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dealFreshnessTimestampMs(deal) {
  return toEpochMilliseconds(deal?.priceCheckAt ?? deal?.price_check_at)
    || toEpochMilliseconds(deal?.createdAt ?? deal?.created_at ?? deal?.created_date);
}

function parseDismissals(raw, now = Date.now()) {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, expiresAt]) => Number(expiresAt) > now));
  } catch {
    return {};
  }
}

async function loadDismissedIds(now = Date.now()) {
  const current = parseDismissals(await SecureStore.getItemAsync(DISMISSALS_KEY), now);
  await SecureStore.setItemAsync(DISMISSALS_KEY, JSON.stringify(current));
  return new Set(Object.keys(current));
}

async function dismissDeal(id, now = Date.now()) {
  const key = String(id || '').trim();
  if (!key) return loadDismissedIds(now);
  const current = parseDismissals(await SecureStore.getItemAsync(DISMISSALS_KEY), now);
  current[key] = now + DISMISSAL_TTL_MS;
  await SecureStore.setItemAsync(DISMISSALS_KEY, JSON.stringify(current));
  return new Set(Object.keys(current));
}

async function loadPreviousVisit() {
  return toEpochMilliseconds(await SecureStore.getItemAsync(LAST_VISIT_KEY));
}

async function checkpointVisit(now = Date.now()) {
  const timestamp = toEpochMilliseconds(now);
  if (!timestamp) return 0;
  await SecureStore.setItemAsync(LAST_VISIT_KEY, String(timestamp));
  return timestamp;
}

export {
  DISMISSALS_KEY,
  LAST_VISIT_KEY,
  DISMISSAL_TTL_MS,
  toEpochMilliseconds,
  dealFreshnessTimestampMs,
  loadDismissedIds,
  dismissDeal,
  loadPreviousVisit,
  checkpointVisit,
};
