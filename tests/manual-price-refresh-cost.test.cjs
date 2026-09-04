const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiCore = fs.readFileSync(path.join(__dirname, '..', 'src/lib/apiCore.js'), 'utf8');
const providerRouter = fs.readFileSync(path.join(__dirname, '..', 'server/services/providerRouter.js'), 'utf8');

test('manual price verification has a maintenance-specific client timeout', () => {
  assert.match(apiCore, /MAINTENANCE_TIMEOUT_MS = 120000/);
  assert.match(apiCore, /verifyPrices: \(limit = 15\) => api\.post\('\/api\/functions\/verify-prices', \{ limit \}, \{ timeoutMs: MAINTENANCE_TIMEOUT_MS \}\)/);
  assert.match(apiCore, /export \{[^}]*MAINTENANCE_TIMEOUT_MS/);
});

test('Rainforest verification prefers one bulk observation pass before product fallback', () => {
  const warmIndex = providerRouter.indexOf('await warmRainforestVerificationCache(options)');
  const singleIndex = providerRouter.indexOf('verified = await rainforestProduct(cleanAsin, options)');
  assert.ok(warmIndex >= 0, 'bulk cache warm must be wired into verification');
  assert.ok(singleIndex > warmIndex, 'single-product lookup should only happen after the bulk path');
});
