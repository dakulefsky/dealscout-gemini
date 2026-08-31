const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');
const apiCore = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js'), 'utf8');

test('active functions route no longer exposes or imports legacy Rainforest status behavior', () => {
  assert.doesNotMatch(functionsRoute, /\/rainforest-status/);
  assert.doesNotMatch(functionsRoute, /getAccountStatus/);
  assert.doesNotMatch(functionsRoute, /isQuotaExhausted/);
  assert.doesNotMatch(functionsRoute, /services\/rainforestService/);
  assert.match(functionsRoute, /amazonUrlService/);
  assert.match(functionsRoute, /\/provider-status/);
});

test('frontend no longer calls legacy Rainforest status endpoint', () => {
  assert.doesNotMatch(apiCore, /rainforestStatus/);
  assert.doesNotMatch(apiCore, /\/rainforest-status/);
  assert.match(apiCore, /providerStatus/);
});
