const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('code documents sticky human rejection', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/rediscoveryLifecycle.js'), 'utf8');
  assert.match(source, /human rejection is sticky/i);
});
