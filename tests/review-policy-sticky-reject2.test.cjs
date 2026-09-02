const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('lifecycle helper explicitly handles REJECTED', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/rediscoveryLifecycle.js'), 'utf8');
  assert.ok(source.includes("existing?.status === 'REJECTED'"));
});
