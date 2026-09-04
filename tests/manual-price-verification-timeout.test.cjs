const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiCore = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js'), 'utf8');

test('manual price verification uses a maintenance-sized client timeout', () => {
  assert.match(apiCore, /const MAINTENANCE_TIMEOUT_MS = 120000;/);
  assert.match(apiCore, /verifyPrices: \(limit = 15\) => api\.post\('\/api\/functions\/verify-prices', \{ limit \}, \{ timeoutMs: MAINTENANCE_TIMEOUT_MS \}\)/);
  assert.match(apiCore, /export \{ SHOPPER_API, DEFAULT_TIMEOUT_MS, MAINTENANCE_TIMEOUT_MS,/);
});
