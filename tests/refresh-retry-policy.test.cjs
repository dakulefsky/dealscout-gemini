const test = require('node:test');
const assert = require('node:assert/strict');
const { retryDelaySeconds, refreshFailureState, canAttemptRefresh } = require('../server/services/refreshRetryPolicy');
const refreshStates = require('../server/repositories/refreshStateRepository');

const ASIN = 'B012345678';

test('refresh failures back off exponentially and eventually quarantine', () => {
  const options = { baseDelaySeconds: 60, maxDelaySeconds: 600, quarantineAfter: 3 };
  assert.equal(retryDelaySeconds(1, options), 60);
  assert.equal(retryDelaySeconds(2, options), 120);
  assert.equal(retryDelaySeconds(5, options), 600);

  const first = refreshFailureState({}, 1000, options);
  assert.equal(first.failureCount, 1);
  assert.equal(first.nextAttemptAt, 1060);
  assert.equal(first.quarantinedAt, null);

  const third = refreshFailureState({ failure_count: 2 }, 2000, options);
  assert.equal(third.failureCount, 3);
  assert.equal(third.quarantinedAt, 2000);
});

test('refresh eligibility obeys next-attempt time', () => {
  assert.equal(canAttemptRefresh(null, 1000), true);
  assert.equal(canAttemptRefresh({ next_attempt_at: 1200 }, 1000), false);
  assert.equal(canAttemptRefresh({ next_attempt_at: 1200 }, 1200), true);
});

test('fallback refresh state records failures and resets on success', async () => {
  refreshStates.resetFallback();
  const error = Object.assign(new Error('normalization failed'), { code: 'UNVERIFIED_REFRESH' });

  const first = await refreshStates.recordFailure(ASIN, error, {
    at: 1000,
    provider: 'RAINFOREST',
    policyOptions: { baseDelaySeconds: 60, quarantineAfter: 3 },
  });
  assert.equal(first.failure_count, 1);
  assert.equal(first.last_error_code, 'UNVERIFIED_REFRESH');
  assert.equal(first.last_provider, 'RAINFOREST');
  assert.equal(first.next_attempt_at, 1060);

  const second = await refreshStates.recordFailure(ASIN, error, {
    at: 1100,
    provider: 'RAINFOREST',
    policyOptions: { baseDelaySeconds: 60, quarantineAfter: 3 },
  });
  assert.equal(second.failure_count, 2);
  assert.equal(second.next_attempt_at, 1220);

  const success = await refreshStates.recordSuccess(ASIN, { at: 1300, provider: 'AMAZON_PAAPI' });
  assert.equal(success.failure_count, 0);
  assert.equal(success.next_attempt_at, null);
  assert.equal(success.quarantined_at, null);
  assert.equal(success.last_success_at, 1300);
  assert.equal(success.last_provider, 'AMAZON_PAAPI');
});
