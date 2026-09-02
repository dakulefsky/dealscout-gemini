const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review automation policy is documented for operators', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '../docs/review-automation.md')), true);
});
