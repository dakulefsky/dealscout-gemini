const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');

test('deal cards measure dwell from viewport visibility', () => {
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /intersectionRatio >= 0\.65/);
  assert.match(source, /threshold: \[0, 0\.65, 1\]/);
  assert.match(source, /ref: cardRef/);
});

test('passive dwell is recorded at most once per mounted card', () => {
  assert.match(source, /dwellRecorded = useRef\(false\)/);
  assert.match(source, /dwellRecorded\.current = true/);
  assert.match(source, /if \(weight\)/);
});

test('explicit save and click signals remain stronger than passive dwell', () => {
  assert.match(source, /addCategoryInterest\(deal\.category, 4\)/);
  assert.match(source, /addCategoryInterest\(deal\.category, 2\)/);
  assert.match(source, /dwellWeight/);
});
