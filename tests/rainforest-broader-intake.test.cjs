const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/services/rainforestStrictDiscovery.js'), 'utf8');

test('Rainforest broadening stays on one paid deals page', () => {
  assert.match(source, /type: 'deals'/);
  assert.doesNotMatch(source, /max_page/);
  assert.match(source, /Keep this to one paid deals page/);
});

test('single paid page retains a wider new-deal pool and reviewable discount band', () => {
  assert.match(source, /SINGLE_PAGE_NEW_DEAL_FLOOR = 25/);
  assert.match(source, /REVIEWABLE_DISCOUNT_FLOOR = 12/);
  assert.match(source, /Math\.max\(SINGLE_PAGE_NEW_DEAL_FLOOR/);
  assert.match(source, /Math\.min\(REVIEWABLE_DISCOUNT_FLOOR/);
});
