const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('../server/services/cronService');
const { rethrowProviderStop } = require('../server/services/providerRouter');

test('provider budget and cooldown stop the verification batch', () => {
  assert.equal(cron.shouldStopProviderBatch({ code: 'PROVIDER_BUDGET_EXCEEDED' }), true);
  assert.equal(cron.shouldStopProviderBatch({ code: 'PROVIDER_COOLDOWN' }), true);
});

test('provider router propagates provider-wide stop conditions to callers', () => {
  for (const code of ['PROVIDER_BUDGET_EXCEEDED', 'PROVIDER_COOLDOWN']) {
    const error = Object.assign(new Error(code), { code });
    assert.throws(() => rethrowProviderStop(error), (thrown) => thrown === error);
  }
  assert.doesNotThrow(() => rethrowProviderStop(Object.assign(new Error('item issue'), { code: 'UNVERIFIED_REFRESH' })));
});

test('ordinary item failures do not stop the entire verification batch', () => {
  assert.equal(cron.shouldStopProviderBatch({ code: 'UNVERIFIED_REFRESH' }), false);
  assert.equal(cron.shouldStopProviderBatch(new Error('temporary item issue')), false);
});
