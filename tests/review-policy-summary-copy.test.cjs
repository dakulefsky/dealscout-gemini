const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review page is framed as exceptions rather than an inbox', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /Review Exceptions/);
  assert.match(source, /valid ordinary deals do not wait for you/i);
});
