const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const healthMatch = serverSource.match(/app\.get\('\/api\/health'[\s\S]*?\n  \}\);/);

test('public health endpoint exposes only a minimal status', () => {
  assert.ok(healthMatch, 'health endpoint should exist');
  const source = healthMatch[0];
  assert.match(source, /res\.json\(\{ status: 'ok' \}\)/);
  assert.doesNotMatch(source, /cronStatus|scheduler|DATABASE_URL|postgres|priceHistory|storage|error:/);
});
