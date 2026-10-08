const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCron(product) {
  const sourcePath = require.resolve('../server/services/cronService');
  const module = { exports: {} };
  let successes = 0;
  const mocks = {
    '../storage/postgres': { async withAdvisoryLock(_id, task) { return { acquired: true, result: await task() }; } },
    '../repositories/maintenanceCadenceRepository': { async claim() { return { acquired: true }; }, async markSucceeded() { successes += 1; } },
    '../repositories/refreshStateRepository': { async get() { return null; }, async recordFailure() {}, async recordSuccess() {} },
    '../repositories/dealRepository': { async listAll() { return [{ id: 'B000000001', asin: 'B000000001', title: 'Example', status: 'APPROVED', source_verified: 1, is_expired: 0, price_check_at: 1 }]; }, async update() {} },
    './providerRouter': { async fetchProductByAsin() { return product; }, async getProviderStatus() { return {}; } },
    './priceHistoryService': { async recordObservation() {} },
  };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), { module, exports: module.exports, console, setTimeout, clearTimeout, clearInterval,
    require(name) { return mocks[name] || require(path.resolve(path.dirname(sourcePath), name)); },
  });
  return { cron: module.exports, successes: () => successes };
}
test('an all-failed price batch cannot masquerade as a durable successful daily check', async () => {
  const { cron, successes } = loadCron(null);
  const result = await cron.checkDealPricesAndAvailability({ scheduled: true });
  assert.equal(result.checkedCount, 1);
  assert.equal(result.verifiedCount, 0);
  assert.equal(result.status, 'NOTICE');
  assert.equal(successes(), 0);
});
test('a genuine verified price update still records successful scheduled maintenance', async () => {
  const { cron, successes } = loadCron({ asin: 'B000000001', title: 'Example', sourceVerified: true, sourceProvider: 'RAINFOREST', originalPrice: 200, salePrice: 100, discountPercent: 50 });
  const result = await cron.checkDealPricesAndAvailability({ scheduled: true });
  assert.equal(result.verifiedCount, 1);
  assert.equal(result.status, undefined);
  assert.equal(successes(), 1);
});
