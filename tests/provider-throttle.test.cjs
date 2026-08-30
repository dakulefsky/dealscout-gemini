const test = require('node:test');
const assert = require('node:assert/strict');
const throttle = require('../server/services/providerThrottle');

function transient(statusCode) {
  const error = new Error(`provider ${statusCode}`);
  error.statusCode = statusCode;
  return error;
}

test('provider throttle classifies common transient failures', () => {
  assert.equal(throttle.isTransientProviderFailure(transient(429)), true);
  assert.equal(throttle.isTransientProviderFailure(transient(503)), true);
  assert.equal(throttle.isTransientProviderFailure(transient(500)), true);
  assert.equal(throttle.isTransientProviderFailure(transient(404)), false);
  assert.equal(throttle.isTransientProviderFailure(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), true);
});

test('transient failures back off exponentially and cap cooldown', () => {
  throttle.resetProviderThrottle('rainforest');
  const options = { baseCooldownMs: 1000, maxCooldownMs: 4000 };

  throttle.recordFailure('rainforest', transient(503), 100, options);
  const first = throttle.getProviderThrottleStatus('rainforest');
  assert.equal(first.consecutiveFailures, 1);
  assert.ok(first.retryAfterMs > 0 && first.retryAfterMs <= 1000);

  throttle.recordFailure('rainforest', transient(503), 100, options);
  const second = throttle.getProviderThrottleStatus('rainforest');
  assert.equal(second.consecutiveFailures, 2);
  assert.ok(second.retryAfterMs > 1000 && second.retryAfterMs <= 2000);

  throttle.recordFailure('rainforest', transient(503), 100, options);
  throttle.recordFailure('rainforest', transient(503), 100, options);
  const capped = throttle.getProviderThrottleStatus('rainforest');
  assert.equal(capped.consecutiveFailures, 4);
  assert.ok(capped.retryAfterMs > 0 && capped.retryAfterMs <= 4000);
});

test('successful provider response resets failure streak and cooldown', () => {
  throttle.resetProviderThrottle('amazon_paapi');
  throttle.recordFailure('amazon_paapi', transient(429), 120, { baseCooldownMs: 1000 });
  assert.equal(throttle.getProviderThrottleStatus('amazon_paapi').coolingDown, true);

  throttle.recordSuccess('amazon_paapi', 300);
  const status = throttle.getProviderThrottleStatus('amazon_paapi');
  assert.equal(status.consecutiveFailures, 0);
  assert.equal(status.coolingDown, false);
  assert.equal(status.retryAfterMs, 0);
});

test('sustained slow latency produces bounded pacing delay', () => {
  throttle.resetProviderThrottle('rainforest');
  throttle.recordSuccess('rainforest', 2500, { ewmaAlpha: 1 });
  assert.equal(throttle.recommendedDelayMs('rainforest', { slowLatencyMs: 1500, maxInterRequestDelayMs: 5000 }), 1000);

  throttle.recordSuccess('rainforest', 12000, { ewmaAlpha: 1 });
  assert.equal(throttle.recommendedDelayMs('rainforest', { slowLatencyMs: 1500, maxInterRequestDelayMs: 5000 }), 5000);
});

test('runProviderCall refuses calls during cooldown', async () => {
  throttle.resetProviderThrottle('rainforest');
  throttle.recordFailure('rainforest', transient(503), 50, { baseCooldownMs: 1000 });

  let called = false;
  await assert.rejects(
    () => throttle.runProviderCall('rainforest', async () => { called = true; return 'unexpected'; }),
    (error) => error?.code === 'PROVIDER_COOLDOWN' && error.retryAfterMs > 0,
  );
  assert.equal(called, false);
});
