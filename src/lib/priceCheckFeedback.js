function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function retryLabel(value) {
  const timestamp = typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value * 1000 : Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleString();
}

export function describePriceCheck(result = {}) {
  const checked = count(result.checkedCount);
  const expired = count(result.expiredCount);
  const deferred = count(result.deferredCount);
  const failures = count(result.itemFailureCount);
  const requested = count(result.requestedLimit);
  const superseded = count(result.supersededCount);
  const parts = [`${checked}${requested ? `/${requested}` : ''} checked`];

  if (result.verifiedCount !== undefined) parts.push(`${count(result.verifiedCount)} verified`);
  if (expired) parts.push(`${expired} ended`);
  if (deferred) parts.push(`${deferred} deferred`);
  if (failures) parts.push(`${failures} failed`);
  if (superseded) parts.push(`${superseded} skipped after manual changes`);

  if (result.providerDeferred) {
    const code = String(result.providerDeferredReason || '').trim();
    const reason = {
      PROVIDER_PAUSED: 'Provider API paused; resume it to continue',
      PROVIDER_BUDGET_EXCEEDED: 'Provider allowance reached',
      PROVIDER_COOLDOWN: 'Provider temporarily cooling down',
    }[code] || code || 'Provider temporarily deferred';
    const retryAt = code === 'PROVIDER_PAUSED' ? null : retryLabel(result.providerRetryAt);
    parts.push(retryAt ? `${reason}; retry after ${retryAt}` : reason);
  } else if (requested && checked < requested) {
    parts.push('No more eligible deals were available in this run');
  }

  return `${parts.join(' · ')}.`;
}
