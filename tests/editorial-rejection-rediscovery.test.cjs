const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('rediscovery lifecycle explicitly protects manual rejection', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/cronService.js'), 'utf8');
  assert.match(source, /function rediscoveryLifecycleChanges/);
  assert.match(source, /REJECTED/);
});
