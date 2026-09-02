const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Rainforest search is admin-only and uses the central paid-request guard', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/middleware/amazonContentPolicy.js'), 'utf8');
  assert.match(source, /requireAdmin\(req, res/);
  assert.match(source, /runProviderCall\('rainforest'/);
  assert.match(source, /PROVIDER_BUDGET_EXCEEDED/);
  assert.match(source, /PROVIDER_COOLDOWN/);
});

test('direct Rainforest search cannot execute before admin authorization', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/middleware/amazonContentPolicy.js'), 'utf8');
  const authorization = source.indexOf('return requireAdmin(req, res');
  const providerCall = source.indexOf("runProviderCall('rainforest'");
  assert.ok(authorization >= 0 && providerCall > authorization);
});
