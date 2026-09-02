const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('../server/services/cronService');

test('provider budget and cooldown stop the verification batch', () => {
  assert.equal(cron.shouldStopProviderBatch({ code: 'PROVIDER_BUDGET_EXCEEDED' }), true);
  assert.equal(cron.shouldStopProviderBatch({ code: 'PROVIDER_COOLDOWN' }), true);
});

test('ordinary item failures do not stop the entire verification batch', () => {
  assert.equal(cron.shouldStopProviderBatch({ code: 'UNVERIFIED_REFRESH' }), false);
  assert.equal(cron.shouldStopProviderBatch(new Error('temporary item issue')), false);
});
