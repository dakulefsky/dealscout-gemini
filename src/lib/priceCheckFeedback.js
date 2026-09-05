function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function retryLabel(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleString();
}

export function describePriceCheck(result = {}) {
  const checked = count(result.checkedCount);
  const expired = count(result.expiredCount);
  const deferred = count(result.deferredCount);
  const failures = count(result.itemFailureCount);
  const requested = count(result.requestedLimit);
  const parts = [`${checked}${requested ? `/${requested}` : ''} checked`];

  if (expired) parts.push(`${expired} ended`);
  if (deferred) parts.push(`${deferred} deferred`);
  if (failures) parts.push(`${failures} failed`);

  if (result.providerDeferred) {
    const reason = String(result.providerDeferredReason || 'Provider temporarily deferred').trim();
    const retryAt = retryLabel(result.providerRetryAt);
    parts.push(retryAt ? `${reason}; retry after ${retryAt}` : reason);
  } else if (requested && checked < requested) {
    parts.push('No more eligible deals were available in this run');
  }

  return `${parts.join(' · ')}.`;
}
