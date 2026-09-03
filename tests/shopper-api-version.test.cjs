const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const shopperRouterSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'shopperApi.js'), 'utf8');
const clientCoreSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js'), 'utf8');
const browserAdapterSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');

test('v1 is the canonical web and mobile API while legacy routes remain aliases', () => {
  assert.match(serverSource, /app\.use\('\/api\/v1', buildShopperApi\(\{ version: 1 \}\)\)/);
  assert.match(serverSource, /app\.use\('\/api', buildShopperApi\(\)\)/);
  assert.match(clientCoreSource, /const SHOPPER_API = '\/api\/v1'/);
  assert.match(shopperRouterSource, /X-DealScout-API-Version/);
  assert.match(shopperRouterSource, /apiVersion: String\(version\)/);
});

test('versioned registration cannot bypass the product registration gate', () => {
  assert.match(shopperRouterSource, /router\.use\('\/auth\/register', registrationGate\)/);
  assert.match(shopperRouterSource, /ALLOW_PUBLIC_REGISTRATION === 'true'/);
  assert.match(shopperRouterSource, /status\(404\)\.json\(\{ error: 'Not found' \}\)/);
});

test('deal route ordering preserves verified ingest boundary without exposing price history', () => {
  const guardIndex = shopperRouterSource.indexOf("router.use('/deals', require('../middleware/verifiedAiIngestGuard').verifiedAiIngestGuard)");
  const dealsIndex = shopperRouterSource.indexOf("router.use('/deals', require('./deals'))");
  assert.ok(guardIndex >= 0 && dealsIndex > guardIndex);
  assert.doesNotMatch(shopperRouterSource, /priceHistory/);
  assert.doesNotMatch(clientCoreSource, /getPriceHistory/);
});

test('web and mobile resource clients use v1 while internal automation endpoints stay unversioned', () => {
  for (const resource of ['auth', 'deals', 'categories', 'bookmarks']) {
    assert.match(clientCoreSource, new RegExp(`const ${resource} =`));
    assert.match(browserAdapterSource, new RegExp(`export const ${resource} =`));
  }
  assert.match(clientCoreSource, /`\$\{SHOPPER_API\}\/deals\/feed/);
  assert.match(clientCoreSource, /`\$\{SHOPPER_API\}\/bookmarks/);
  assert.match(clientCoreSource, /'\/api\/functions\/provider-status'/);
  assert.match(clientCoreSource, /`\/api\/editorial\/\$\{encodeURIComponent\(asin\)\}`/);
  assert.match(clientCoreSource, /'\/api\/ai\/analyze-deal'/);
  assert.match(browserAdapterSource, /createDealScoutClient/);
});
