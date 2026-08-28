const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const router = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'providerRouter.js'), 'utf8');
const envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');

test('active provider router is decoupled from legacy Rainforest synthetic fallbacks', () => {
  assert.doesNotMatch(router, /rainforestService/);
  assert.doesNotMatch(router, /SAMPLE_DEAL_POOL/);
  assert.doesNotMatch(router, /getCuratedSampleDeals/);
  assert.doesNotMatch(router, /normalizeDemoProduct/);
  assert.doesNotMatch(router, /CURATED_DEMO/);
});

test('curated is not a selectable runtime provider', () => {
  assert.match(router, /const VALID_PROVIDERS = \['auto', 'amazon_paapi', 'rainforest'\]/);
  assert.doesNotMatch(router, /activeProvider === 'curated'/);
  assert.doesNotMatch(envExample, /auto \| amazon_paapi \| rainforest \| curated/);
});

test('provider router still fails closed after verified providers', () => {
  assert.match(router, /Never fall back to legacy scraper, curated, or synthetic metadata/);
  assert.match(router, /return null;/);
  assert.match(router, /return \[\];/);
});