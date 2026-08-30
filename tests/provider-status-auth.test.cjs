const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const functionsRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'functions.js'), 'utf8');
const providerRouter = fs.readFileSync(path.join(root, 'server', 'services', 'providerRouter.js'), 'utf8');
const clientApi = fs.readFileSync(path.join(root, 'src', 'lib', 'api.js'), 'utf8');

test('provider status requires admin authentication', () => {
  assert.match(functionsRoute, /router\.get\('\/provider-status', requireAdmin, async/);
});

test('provider diagnostics remain admin-only', () => {
  assert.match(functionsRoute, /router\.post\('\/test-paapi', requireAdmin/);
  assert.match(functionsRoute, /router\.post\('\/rainforest-lookup', requireAdmin/);
});

test('provider choice is deployment-configured rather than mutable process state', () => {
  assert.match(providerRouter, /process\.env\.DEAL_DATA_PROVIDER/);
  assert.doesNotMatch(providerRouter, /let activeProvider/);
  assert.doesNotMatch(providerRouter, /setActiveProvider/);
  assert.doesNotMatch(functionsRoute, /\/provider-switch|\/set-provider/);
  assert.doesNotMatch(clientApi, /providerSwitch/);
});
