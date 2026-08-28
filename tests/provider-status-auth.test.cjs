const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');

test('provider status requires admin authentication', () => {
  assert.match(functionsRoute, /router\.get\('\/provider-status', requireAdmin, async/);
});

test('provider mutation and diagnostics remain admin-only', () => {
  assert.match(functionsRoute, /router\.post\('\/provider-switch', requireAdmin/);
  assert.match(functionsRoute, /router\.post\('\/set-provider', requireAdmin/);
  assert.match(functionsRoute, /router\.post\('\/test-paapi', requireAdmin/);
  assert.match(functionsRoute, /router\.post\('\/rainforest-lookup', requireAdmin/);
});