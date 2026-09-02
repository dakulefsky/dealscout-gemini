const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('legacy score 75 is no longer the human-review gate', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.doesNotMatch(source, /score >= 75 \? 'AUTO_APPROVE' : 'PENDING_REVIEW'/);
});
