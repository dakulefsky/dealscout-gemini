const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('docs list the four review actions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  for (const action of ['Publish Normally', 'Publish as Pick', 'Reject', 'Save for Later']) assert.ok(source.includes(action));
});
