const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

test('provider retry timing respects cooldown and budget reset boundaries', () => {
  const nowMs = Date.UTC(2026, 8, 3, 10, 15, 0);
  assert.equal(
    cron.providerRetryAt({ code: 'PROVIDER_COOLDOWN', retryAfterMs: 5 * 60 * 1000 }, nowMs),
    Math.floor(nowMs / 1000) + 5 * 60,
  );
  assert.equal(
    cron.providerRetryAt({ code: 'PROVIDER_BUDGET_EXCEEDED', scope: 'day' }, nowMs),
    Math.floor(Date.UTC(2026, 8, 4, 0, 1, 0) / 1000),
  );
  assert.equal(
    cron.providerRetryAt({ code: 'PROVIDER_BUDGET_EXCEEDED', scope: 'month' }, nowMs),
    Math.floor(Date.UTC(2026, 9, 1, 0, 1, 0) / 1000),
  );
});

test('scheduled full cycle gives one-call bulk discovery priority over single-ASIN verification', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');
  const block = source.match(/async runFullCycle[\s\S]*?return \{ purge, verification, discovery \};/)?.[0] || '';
  assert.ok(block.indexOf('syncDailyDeals') < block.indexOf('checkDealPricesAndAvailability'));
});

test('ordinary item failures do not stop the entire verification batch', () => {
  assert.equal(cron.shouldStopProviderBatch({ code: 'UNVERIFIED_REFRESH' }), false);
  assert.equal(cron.shouldStopProviderBatch(new Error('temporary item issue')), false);
});
