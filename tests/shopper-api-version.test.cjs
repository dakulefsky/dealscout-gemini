const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const shopperRouterSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'shopperApi.js'), 'utf8');
const clientSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');

test('v1 is the canonical web and mobile API while legacy routes remain aliases', () => {
  assert.match(serverSource, /app\.use\('\/api\/v1', buildShopperApi\(\{ version: 1 \}\)\)/);
  assert.match(serverSource, /app\.use\('\/api', buildShopperApi\(\)\)/);
  assert.match(clientSource, /const SHOPPER_API = '\/api\/v1'/);
  assert.match(shopperRouterSource, /X-DealScout-API-Version/);
  assert.match(shopperRouterSource, /apiVersion: String\(version\)/);
});

test('versioned registration cannot bypass the product registration gate', () => {
  assert.match(shopperRouterSource, /router\.use\('\/auth\/register', registrationGate\)/);
  assert.match(shopperRouterSource, /ALLOW_PUBLIC_REGISTRATION === 'true'/);
  assert.match(shopperRouterSource, /status\(404\)\.json\(\{ error: 'Not found' \}\)/);
});

test('deal route ordering preserves price history and verified ingest boundaries', () => {
  const historyIndex = shopperRouterSource.indexOf("router.use('/deals', require('./priceHistory'))");
  const guardIndex = shopperRouterSource.indexOf("router.use('/deals', require('../middleware/verifiedAiIngestGuard').verifiedAiIngestGuard)");
  const dealsIndex = shopperRouterSource.indexOf("router.use('/deals', require('./deals'))");
  assert.ok(historyIndex >= 0 && guardIndex > historyIndex && dealsIndex > guardIndex);
});

test('web resource clients use v1 while internal automation endpoints stay unversioned', () => {
  for (const resource of ['auth', 'deals', 'categories', 'bookmarks']) {
    assert.ok(clientSource.includes(`export const ${resource} =`));
  }
  assert.match(clientSource, /`\$\{SHOPPER_API\}\/deals\/feed/);
  assert.match(clientSource, /`\$\{SHOPPER_API\}\/bookmarks/);
  assert.match(clientSource, /'\/api\/functions\/provider-status'/);
  assert.match(clientSource, /`\/api\/editorial\/\$\{asin\}`/);
  assert.match(clientSource, /'\/api\/ai\/analyze-deal'/);
});
