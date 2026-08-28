const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');

test('active functions route no longer exposes legacy Rainforest status endpoint', () => {
  assert.doesNotMatch(functionsRoute, /\/rainforest-status/);
  assert.doesNotMatch(functionsRoute, /getAccountStatus/);
  assert.doesNotMatch(functionsRoute, /isQuotaExhausted/);
  const rainforestImport = functionsRoute.match(/const \{([\s\S]*?)\} = require\('\.\.\/services\/rainforestService'\);/);
  assert.ok(rainforestImport, 'Rainforest helper import should exist');
  assert.doesNotMatch(rainforestImport[1], /\bisConfigured\b/);
  assert.match(rainforestImport[1], /extractAsin/);
  assert.match(rainforestImport[1], /formatAffiliateUrl/);
  assert.match(functionsRoute, /\/provider-status/);
});

test('frontend no longer calls legacy Rainforest status endpoint', () => {
  assert.doesNotMatch(api, /rainforestStatus/);
  assert.doesNotMatch(api, /\/rainforest-status/);
  assert.match(api, /providerStatus/);
});
