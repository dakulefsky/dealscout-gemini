const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('ratings remain outside publication gate', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.equal(/rating\s*[<>]=?/.test(source), false);
});
