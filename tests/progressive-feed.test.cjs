const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('progressive feed helper exists with bounded paging', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'progressiveFeed.js'), 'utf8');
  assert.match(source, /INITIAL_FEED_SIZE = 16/);
  assert.match(source, /FEED_PAGE_SIZE = 12/);
  assert.match(source, /Math\.min\(safeTotal, safeCurrent \+ safePage\)/);
});
