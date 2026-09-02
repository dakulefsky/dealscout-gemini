const { reserveRequest } = require('./providerBudgetService');

const DEFAULTS = Object.freeze({
  slowLatencyMs: 1500,
  maxInterRequestDelayMs: 5000,
  baseCooldownMs: 5000,
  maxCooldownMs: 15 * 60 * 1000,
  ewmaAlpha: 0.25,
});

const state = new Map();

class ProviderCooldownError extends Error {
  constructor(provider, retryAfterMs) {
    super(`${provider} is cooling down after transient provider failures`);
    this.name = 'ProviderCooldownError';
    this.code = 'PROVIDER_COOLDOWN';
    this.provider = provider;
    this.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
    this.statusCode = 503;
  }
}

function nowMs() { return Date.now(); }
function cleanProvider(provider) { return String(provider || '').trim().toLowerCase() || 'unknown'; }

function currentState(provider) {
  const key = cleanProvider(provider);
  if (!state.has(key)) {
    state.set(key, {
      provider: key, consecutiveFailures: 0, cooldownUntil: 0, latencyEwmaMs: 0,
      lastLatencyMs: 0, lastStatusCode: null, lastFailureAt: null, lastSuccessAt: null,
    });
  }
  return state.get(key);
}

function statusCodeFromError(error) {
  const candidates = [error?.statusCode, error?.status, error?.response?.status, error?.cause?.statusCode];
  for (const value of candidates) {
    const code = Number(value);
    if (Number.isInteger(code) && code >= 100 && code <= 599) return code;
  }
  return null;
}

function isTransientProviderFailure(error) {
  const status = statusCodeFromError(error);
  if (status === 429 || status === 503 || status === 502 || status === 504 || status === 408) return true;
  if (status !== null) return status >= 500;
  const code = String(error?.code || '').toUpperCase();
  return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'API_REQUEST_FAILED', 'THROTTLED'].includes(code);
}

function updateLatency(entry, latencyMs, { ewmaAlpha = DEFAULTS.ewmaAlpha } = {}) {
  const latency = Math.max(0, Number(latencyMs) || 0);
  entry.lastLatencyMs = latency;
  entry.latencyEwmaMs = entry.latencyEwmaMs > 0 ? (ewmaAlpha * latency) + ((1 - ewmaAlpha) * entry.latencyEwmaMs) : latency;
}

function recordSuccess(provider, latencyMs, options = {}) {
  const entry = currentState(provider);
  updateLatency(entry, latencyMs, options);
  entry.consecutiveFailures = 0;
  entry.cooldownUntil = 0;
  entry.lastStatusCode = 200;
  entry.lastSuccessAt = nowMs();
  return { ...entry };
}

function recordFailure(provider, error, latencyMs, options = {}) {
  const entry = currentState(provider);
  updateLatency(entry, latencyMs, options);
  const status = statusCodeFromError(error);
  entry.lastStatusCode = status;
  entry.lastFailureAt = nowMs();
  if (isTransientProviderFailure(error)) {
    entry.consecutiveFailures += 1;
    const base = Math.max(250, Number(options.baseCooldownMs ?? DEFAULTS.baseCooldownMs) || DEFAULTS.baseCooldownMs);
    const maximum = Math.max(base, Number(options.maxCooldownMs ?? DEFAULTS.maxCooldownMs) || DEFAULTS.maxCooldownMs);
    const exponent = Math.min(10, Math.max(0, entry.consecutiveFailures - 1));
    const cooldownMs = Math.min(maximum, base * (2 ** exponent));
    entry.cooldownUntil = Math.max(entry.cooldownUntil, nowMs() + cooldownMs);
  }
  return { ...entry };
}

function recommendedDelayMs(provider, options = {}) {
  const entry = currentState(provider);
  const threshold = Math.max(1, Number(options.slowLatencyMs ?? DEFAULTS.slowLatencyMs) || DEFAULTS.slowLatencyMs);
  if (entry.latencyEwmaMs <= threshold) return 0;
  const maximum = Math.max(0, Number(options.maxInterRequestDelayMs ?? DEFAULTS.maxInterRequestDelayMs) || DEFAULTS.maxInterRequestDelayMs);
  return Math.min(maximum, Math.round(entry.latencyEwmaMs - threshold));
}

function retryAfterMs(provider) { return Math.max(0, currentState(provider).cooldownUntil - nowMs()); }
function isCoolingDown(provider) { return retryAfterMs(provider) > 0; }
function delay(ms) { return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve(); }

async function runProviderCall(provider, task, options = {}) {
  if (typeof task !== 'function') throw new TypeError('runProviderCall requires a task function');
  const key = cleanProvider(provider);
  const remaining = retryAfterMs(key);
  if (remaining > 0) throw new ProviderCooldownError(key, remaining);

  const pacingDelay = recommendedDelayMs(key, options);
  if (pacingDelay > 0) await delay(pacingDelay);

  // Reserve immediately before the outbound task. Failed network attempts still
  // consume the provider allowance, while cooldown-blocked calls do not.
  await reserveRequest(key);

  const startedAt = nowMs();
  try {
    const result = await task();
    recordSuccess(key, nowMs() - startedAt, options);
    return result;
  } catch (error) {
    recordFailure(key, error, nowMs() - startedAt, options);
    throw error;
  }
}

function getProviderThrottleStatus(provider) {
  const entry = currentState(provider);
  return {
    provider: entry.provider,
    consecutiveFailures: entry.consecutiveFailures,
    coolingDown: isCoolingDown(provider),
    retryAfterMs: retryAfterMs(provider),
    latencyEwmaMs: Math.round(entry.latencyEwmaMs),
    lastLatencyMs: Math.round(entry.lastLatencyMs),
    lastStatusCode: entry.lastStatusCode,
    lastFailureAt: entry.lastFailureAt,
    lastSuccessAt: entry.lastSuccessAt,
    recommendedDelayMs: recommendedDelayMs(provider),
  };
}

function resetProviderThrottle(provider) {
  if (provider) state.delete(cleanProvider(provider));
  else state.clear();
}

module.exports = {
  DEFAULTS, ProviderCooldownError, statusCodeFromError, isTransientProviderFailure,
  recordSuccess, recordFailure, recommendedDelayMs, retryAfterMs, isCoolingDown,
  runProviderCall, getProviderThrottleStatus, resetProviderThrottle,
};
