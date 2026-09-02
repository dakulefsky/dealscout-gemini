const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review policy introduces no network client', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.equal(source.includes('axios'), false);
});
