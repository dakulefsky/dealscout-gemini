const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(file, overrides, globals = {}) {
  const filename = require.resolve(file);
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
    module, exports: module.exports, process, console, Date, setTimeout, ...globals,
  }, { filename });
  return module.exports;
}

test('a pause during provider pacing blocks the outbound call before spending credit', async () => {
  let paused = false;
  let reservations = 0;
  let calls = 0;
  const throttle = load('../server/services/providerThrottle', {
    './channelSettingsService': { async get() { return { enabled: !paused }; } },
    './providerBudgetService': { async reserveRequest() { reservations += 1; } },
  }, { setTimeout(resolve) { paused = true; resolve(); } });
  throttle.recordSuccess('rainforest', 2500, { ewmaAlpha: 1 });
  await assert.rejects(throttle.runProviderCall('rainforest', async () => { calls += 1; }), error => error.code === 'PROVIDER_PAUSED');
  assert.equal(reservations, 0);
  assert.equal(calls, 0);
  assert.equal(throttle.getProviderThrottleStatus('rainforest').consecutiveFailures, 0);
});

test('resumed paced requests and ordinary unpaced requests retain one reservation per call', async () => {
  for (const paced of [false, true]) {
    let reservations = 0;
    let reads = 0;
    const throttle = load('../server/services/providerThrottle', {
      './channelSettingsService': { async get() { reads += 1; return { enabled: true }; } },
      './providerBudgetService': { async reserveRequest() { reservations += 1; } },
    }, { setTimeout(resolve) { resolve(); } });
    if (paced) throttle.recordSuccess('rainforest', 2500, { ewmaAlpha: 1 });
    assert.equal(await throttle.runProviderCall('rainforest', async () => 'verified'), 'verified');
    assert.equal(reservations, 1);
    assert.equal(reads, paced ? 2 : 1);
  }
});

function cronFixture({ succeedFirst = false } = {}) {
  const counters = { attempts: 0, failures: 0, successfulJobs: 0, successfulRefreshes: 0, retry: null };
  const rows = [1, 2, 3].map(n => ({ id: `B00000000${n}`, asin: `B00000000${n}`, status: 'APPROVED', source_verified: 1, is_expired: 0, price_check_at: 1 }));
  const paused = Object.assign(new Error('Provider calls paused by administrator'), { code: 'PROVIDER_PAUSED' });
  async function provider() {
    counters.attempts += 1;
    if (succeedFirst && counters.attempts === 1) return { sourceVerified: true, originalPrice: 100, salePrice: 50, discountPercent: 50 };
    throw paused;
  }
  const cron = load('../server/services/cronService', {
    '../storage/postgres': { async withAdvisoryLock(_id, task) { return { acquired: true, result: await task() }; } },
    '../repositories/dealRepository': { async listAll() { return rows; }, async update(id, changes) { return { ...rows.find(row => row.id === id), ...changes }; } },
    '../repositories/maintenanceCadenceRepository': {
      async claim() { return { acquired: true }; },
      async reschedule(_key, at) { counters.retry = at; },
      async markSucceeded() { counters.successfulJobs += 1; },
    },
    '../repositories/refreshStateRepository': { async get() { return null; }, async recordFailure() { counters.failures += 1; }, async recordSuccess() { counters.successfulRefreshes += 1; } },
    './providerRouter': { fetchProductByAsin: provider, fetchDealsList: provider, async getProviderStatus() { return {}; } },
    './priceHistoryService': { async recordObservation() {} },
    './departmentSupplyService': { departmentVerificationQueue: rows => rows },
    './primeDayPolicy': { async refresh() {} },
  });
  return { cron, counters };
}

test('a paused verification batch stops immediately without quarantining items or claiming success', async () => {
  const { cron, counters } = cronFixture();
  const before = Math.floor(Date.now() / 1000);
  const result = await cron.checkDealPricesAndAvailability({ scheduled: true });
  assert.equal(result.providerDeferredReason, 'PROVIDER_PAUSED');
  assert.equal(result.checkedCount, 1);
  assert.equal(result.verifiedCount, 0);
  assert.equal(counters.attempts, 1);
  assert.equal(counters.failures, 0);
  assert.equal(counters.successfulJobs, 0);
  assert.ok(counters.retry >= before + 1800 && counters.retry <= Math.floor(Date.now() / 1000) + 1800);
  assert.equal(result.status, undefined);
});

test('completed verification before a pause still counts without continuing the batch', async () => {
  const { cron, counters } = cronFixture({ succeedFirst: true });
  const result = await cron.checkDealPricesAndAvailability({ scheduled: true });
  assert.equal(result.providerDeferred, true);
  assert.equal(result.verifiedCount, 1);
  assert.equal(counters.attempts, 2);
  assert.equal(counters.successfulRefreshes, 1);
  assert.equal(counters.successfulJobs, 1);
  assert.equal(counters.failures, 0);
});

test('a paused discovery pull is deferred instead of being marked failed or successful', async () => {
  const { cron, counters } = cronFixture();
  const result = await cron.syncDailyDeals({ scheduled: true });
  assert.equal(result.status, 'DEFERRED');
  assert.equal(result.code, 'PROVIDER_PAUSED');
  assert.equal(counters.attempts, 1);
  assert.equal(counters.successfulJobs, 0);
  assert.ok(counters.retry > Math.floor(Date.now() / 1000));
});

test('scheduled cycles keep provider work blocked until an administrator resumes it', async () => {
  let enabled = false;
  let providerLanes = 0;
  const cron = load('../server/services/cronService', {
    './channelSettingsService': { async get() { return { enabled }; } },
  });
  cron.purgeOldExpiredDeals = async () => ({ purgedCount: 0 });
  cron.syncDailyDeals = async () => { providerLanes += 1; return { status: 'SUCCESS' }; };
  cron.checkDealPricesAndAvailability = async () => { providerLanes += 1; return { verifiedCount: 1 }; };
  const paused = await cron.runFullCycle({ scheduled: true });
  assert.equal(paused.discovery.reason, 'PROVIDER_PAUSED');
  assert.equal(paused.verification.reason, 'PROVIDER_PAUSED');
  assert.equal(providerLanes, 0);
  enabled = true;
  await cron.runFullCycle({ scheduled: true });
  assert.equal(providerLanes, 2);
});
