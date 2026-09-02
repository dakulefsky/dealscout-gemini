const test = require('node:test');
const assert = require('node:assert/strict');
const budget = require('../server/services/providerBudgetService');

function withLimits(daily, monthly, fn) {
  const oldDaily = process.env.RAINFOREST_DAILY_REQUEST_LIMIT;
  const oldMonthly = process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT;
  process.env.RAINFOREST_DAILY_REQUEST_LIMIT = String(daily);
  process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT = String(monthly);
  budget.resetLocalUsage();
  return Promise.resolve(fn()).finally(() => {
    budget.resetLocalUsage();
    if (oldDaily === undefined) delete process.env.RAINFOREST_DAILY_REQUEST_LIMIT; else process.env.RAINFOREST_DAILY_REQUEST_LIMIT = oldDaily;
    if (oldMonthly === undefined) delete process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT; else process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT = oldMonthly;
  });
}

test('Rainforest defaults to a bounded daily and monthly allowance', () => {
  const oldDaily = process.env.RAINFOREST_DAILY_REQUEST_LIMIT;
  const oldMonthly = process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT;
  delete process.env.RAINFOREST_DAILY_REQUEST_LIMIT;
  delete process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT;
  try { assert.deepEqual(budget.limitsFor('rainforest'), { daily: 16, monthly: 500 }); }
  finally {
    if (oldDaily !== undefined) process.env.RAINFOREST_DAILY_REQUEST_LIMIT = oldDaily;
    if (oldMonthly !== undefined) process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT = oldMonthly;
  }
});

test('local budget counts attempts and blocks before exceeding daily cap', async () => withLimits(2, 10, async () => {
  const now = new Date('2026-09-02T12:00:00Z');
  await budget.reserveRequest('rainforest', now);
  await budget.reserveRequest('rainforest', now);
  await assert.rejects(() => budget.reserveRequest('rainforest', now), (error) => error?.code === 'PROVIDER_BUDGET_EXCEEDED' && error.scope === 'day');
  const status = await budget.usageStatus('rainforest', now);
  assert.equal(status.dayCount, 2);
  assert.equal(status.blockedToday, 1);
  assert.equal(status.remainingToday, 0);
}));

test('non-billed provider has no hard request budget', async () => {
  const status = await budget.reserveRequest('amazon_paapi', new Date('2026-09-02T12:00:00Z'));
  assert.equal(status.limits.daily, null);
  assert.equal(status.remainingToday, null);
});
