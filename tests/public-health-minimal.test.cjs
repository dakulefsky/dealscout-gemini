const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const healthLine = serverSource
  .split('\n')
  .find((line) => line.includes("app.get('/api/health'"));

test('public health endpoint exposes only a minimal status', () => {
  assert.ok(healthLine, 'health endpoint should exist');
  assert.match(healthLine, /app\.get\('\/api\/health'.*res\.json\(\{ status: 'ok' \}\)\);/);
  assert.doesNotMatch(healthLine, /cronStatus|scheduler|DATABASE_URL|postgres|priceHistory|storage|error:/);
});
