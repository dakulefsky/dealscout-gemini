const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review docs describe policy without provider calls', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.equal(/extra Rainforest|provider request/i.test(source), false);
});
