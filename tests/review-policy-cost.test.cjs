const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('editorial cadence is provider-independent', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/editorialCadenceService.js'), 'utf8');
  assert.doesNotMatch(source, /provider|rainforest|axios|fetch\(/i);
});
