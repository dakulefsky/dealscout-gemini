const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('publication scoring remains a pure local decision', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]axios|https?:\/\/|RAINFOREST_API_KEY/);
});
