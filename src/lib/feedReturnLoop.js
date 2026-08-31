const LAST_VISIT_KEY = 'dealscout-feed-last-visit-v1';

export function toEpochMilliseconds(value) {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dealCreatedTimestampMs(deal) {
  return toEpochMilliseconds(deal?.createdAt ?? deal?.created_at ?? deal?.created_date);
}

export function dealFreshnessTimestampMs(deal) {
  return toEpochMilliseconds(deal?.priceCheckAt ?? deal?.price_check_at) || dealCreatedTimestampMs(deal);
}

export function loadPreviousVisit() {
  if (typeof window === 'undefined') return 0;
  try { return toEpochMilliseconds(window.localStorage.getItem(LAST_VISIT_KEY)); }
  catch { return 0; }
}

export function checkpointVisit(now = Date.now()) {
  if (typeof window === 'undefined') return 0;
  const timestamp = toEpochMilliseconds(now);
  if (!timestamp) return 0;
  try { window.localStorage.setItem(LAST_VISIT_KEY, String(timestamp)); } catch { /* optional return-loop memory */ }
  return timestamp;
}

export { LAST_VISIT_KEY };