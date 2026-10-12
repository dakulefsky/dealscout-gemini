const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function fixture({ phase, unavailable = false, discovery = false, initialStatus = 'APPROVED', prewriteFailure = false } = {}) {
  const filename = require.resolve('../server/services/cronService');
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  let row = { id: 'B000000001', asin: 'B000000001', title: 'Wireless headphones', category: 'Electronics', status: initialStatus, source_verified: 1, is_expired: 0, price_check_at: 1 };
  const counters = { provider: 0, saved: 0, refreshSuccess: 0, refreshFailure: 0, jobSuccess: 0 };
  const offer = { asin: row.asin, title: row.title, category: 'Electronics', sourceVerified: true, sourceProvider: 'RAINFOREST', originalPrice: 100, salePrice: 60, discountPercent: 40, imageUrl: 'https://example.com/image.jpg', availability: unavailable ? 'Out of stock' : 'In stock' };
  async function write(changes, options) {
    assert.ok(options);
    assert.equal(options.expectedStatus, initialStatus);
    if (prewriteFailure) throw new Error('database write failed');
    if ((phase === 'before-request' && changes.last_verify_attempt_at && !changes.price_check_at)
      || (phase === 'before-discovery-write' && changes.price_check_at)) row.status = 'REJECTED';
    if (row.status !== options.expectedStatus) return null;
    row = { ...row, ...changes };
    counters.saved += 1;
    return { ...row };
  }
  const overrides = {
    '../storage/postgres': { async withAdvisoryLock(_id, task) { return { acquired: true, result: await task() }; } },
    '../repositories/dealRepository': {
      async listAll() { return [{ ...row }]; },
      async findByIdOrAsin() { return { ...row }; },
      async update(_id, changes, options) { return write(changes, options); },
      async expire(_id, _reason, options) { return write({ status: 'EXPIRED', is_expired: 1 }, options); },
    },
    '../repositories/maintenanceCadenceRepository': { async claim() { return { acquired: true }; }, async markSucceeded() { counters.jobSuccess += 1; } },
    '../repositories/refreshStateRepository': { async get() { return null; }, async recordSuccess() { counters.refreshSuccess += 1; }, async recordFailure() { counters.refreshFailure += 1; } },
    './providerRouter': {
      async fetchProductByAsin() { counters.provider += 1; if (phase === 'during-request') row.status = 'REJECTED'; return offer; },
      async fetchDealsList() { counters.provider += 1; return [offer]; },
      async getProviderStatus() { return {}; },
    },
    './departmentSupplyService': { departmentVerificationQueue: rows => rows },
    './priceHistoryService': { async recordObservation() {} },
    './discoveryIntakeMetrics': { async record() {} },
    './primeDayPolicy': { async refresh() {} },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
    module, exports: module.exports, process, console, Date,
  }, { filename });
  return {
    run: () => discovery ? module.exports.syncDailyDeals({ scheduled: true }) : module.exports.checkDealPricesAndAvailability({ scheduled: true }),
    counters, row: () => row,
  };
}

test('a manual rejection before verification starts avoids a provider request', async () => {
  const f = fixture({ phase: 'before-request' });
  const result = await f.run();
  assert.equal(f.row().status, 'REJECTED');
  assert.equal(f.counters.provider, 0);
  assert.equal(result.checkedCount, 0);
  assert.equal(result.deferredCount, 1);
  assert.equal(result.verifiedCount, 0);
});

for (const unavailable of [false, true]) {
  test(`manual rejection during a ${unavailable ? 'ended' : 'qualifying'} offer request stays authoritative`, async () => {
    const f = fixture({ phase: 'during-request', unavailable });
    const result = await f.run();
    assert.equal(f.row().status, 'REJECTED');
    assert.equal(f.row().is_expired, 0);
    assert.equal(result.checkedCount, 1);
    assert.equal(result.verifiedCount, 0);
    assert.equal(result.expiredCount, 0);
    assert.equal(result.supersededCount, 1);
    assert.equal(result.status, undefined); // no artificial provider retry
    assert.equal(f.counters.refreshSuccess, 0);
    assert.equal(f.counters.refreshFailure, 0);
    assert.equal(f.counters.jobSuccess, 1);
  });
}

test('verification and discovery still count successful guarded saves', async () => {
  for (const discovery of [false, true]) {
    const f = fixture({ discovery });
    const result = await f.run();
    assert.equal(discovery ? result.updated : result.verifiedCount, 1);
    assert.equal(f.row().price_check_at > 1, true);
    assert.equal(f.counters.refreshSuccess, 1);
  }
});

test('discovery skips known manual rejections and does not count late rejected writes', async () => {
  const rejected = fixture({ discovery: true, initialStatus: 'REJECTED' });
  const first = await rejected.run();
  assert.equal(first.updated, 0);
  assert.equal(first.rejected, 1);
  assert.equal(rejected.counters.saved, 0);
  assert.equal(rejected.counters.refreshSuccess, 0);
  const race = fixture({ discovery: true, initialStatus: 'EXPIRED', phase: 'before-discovery-write' });
  const second = await race.run();
  assert.equal(second.updated, 0);
  assert.equal(race.row().status, 'REJECTED');
  assert.equal(race.counters.refreshSuccess, 0);
});

test('a pre-request database failure retries maintenance without spending a provider request', async () => {
  const f = fixture({ prewriteFailure: true });
  const result = await f.run();
  assert.equal(result.status, 'NOTICE');
  assert.equal(result.itemFailureCount, 1);
  assert.equal(f.counters.provider, 0);
  assert.equal(f.counters.jobSuccess, 0);
});
