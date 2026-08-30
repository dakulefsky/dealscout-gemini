const DEFAULTS = Object.freeze({
  baseDelaySeconds: 15 * 60,
  maxDelaySeconds: 24 * 60 * 60,
  quarantineAfter: 5,
});

function retryDelaySeconds(failureCount, options = {}) {
  const count = Math.max(1, Number.parseInt(failureCount, 10) || 1);
  const base = Math.max(60, Number(options.baseDelaySeconds ?? DEFAULTS.baseDelaySeconds) || DEFAULTS.baseDelaySeconds);
  const maximum = Math.max(base, Number(options.maxDelaySeconds ?? DEFAULTS.maxDelaySeconds) || DEFAULTS.maxDelaySeconds);
  const exponent = Math.min(10, count - 1);
  return Math.min(maximum, base * (2 ** exponent));
}

function refreshFailureState(previous = {}, now = Math.floor(Date.now() / 1000), options = {}) {
  const failureCount = Math.max(0, Number(previous.failure_count ?? previous.failureCount) || 0) + 1;
  const quarantineAfter = Math.max(2, Number.parseInt(options.quarantineAfter ?? DEFAULTS.quarantineAfter, 10) || DEFAULTS.quarantineAfter);
  const delaySeconds = retryDelaySeconds(failureCount, options);
  return {
    failureCount,
    nextAttemptAt: now + delaySeconds,
    quarantinedAt: failureCount >= quarantineAfter
      ? Number(previous.quarantined_at ?? previous.quarantinedAt) || now
      : null,
    delaySeconds,
  };
}

function canAttemptRefresh(state, now = Math.floor(Date.now() / 1000)) {
  if (!state) return true;
  const nextAttemptAt = Number(state.next_attempt_at ?? state.nextAttemptAt) || 0;
  return nextAttemptAt <= now;
}

module.exports = { DEFAULTS, retryDelaySeconds, refreshFailureState, canAttemptRefresh };
