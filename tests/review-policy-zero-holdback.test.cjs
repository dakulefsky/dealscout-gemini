const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('source defaults editorial holdback to zero', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/editorialCadenceService.js'), 'utf8');
  assert.ok(source.includes('?? 0'));
});
