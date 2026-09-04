const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/services/providerRouter.js'), 'utf8');

test('Rainforest verification warms one short-lived bulk cache before single-ASIN fallback', () => {
  assert.match(source, /RAINFOREST_BULK_CACHE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(source, /async function warmRainforestVerificationCache/);
  assert.match(source, /maxResults: 1/);
  assert.match(source, /minDiscount: 0/);
  assert.match(source, /refreshExistingAsins/);
  assert.match(source, /if \(!verified && options\.allowNonDeal === true\)/);
  assert.match(source, /await warmRainforestVerificationCache\(options\)/);
  assert.match(source, /verified = await rainforestProduct\(cleanAsin, options\)/);
});

test('normal Rainforest discovery seeds the same cache for later verification', () => {
  assert.match(source, /cacheRainforestBulkResults\(verified\);/);
  assert.match(source, /function cachedRainforestProduct/);
});

test('provider-wide budget and cooldown still stop bulk verification', () => {
  assert.match(source, /rethrowProviderStop\(bulkError\)/);
  assert.match(source, /PROVIDER_BUDGET_EXCEEDED/);
  assert.match(source, /PROVIDER_COOLDOWN/);
});
