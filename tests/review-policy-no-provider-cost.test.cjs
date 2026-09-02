const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review policy uses ingestion data without provider calls', () => {
  for (const file of ['dealQualityService.js', 'editorialCadenceService.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../server/services', file), 'utf8');
    assert.doesNotMatch(source, /rainforestapi\.com|RAINFOREST_API_KEY|axios|fetch\(/);
  }
});
