const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('personalization is category based and locally stored', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedPersonalization.js'), 'utf8');
  assert.match(source, /localStorage/);
  assert.match(source, /category/);
  assert.match(source, /MAX_SCORE = 24/);
  assert.match(source, /ms >= 12000/);
  assert.match(source, /ms >= 5000/);
});

test('deal cards give saves stronger weight than passive dwell', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');
  assert.match(source, /addCategoryInterest\(deal\.category, 4\)/);
  assert.match(source, /addCategoryInterest\(deal\.category, 2\)/);
  assert.match(source, /dwellWeight/);
});

test('best-for-you ranking keeps base deal quality before category personalization', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
  assert.match(source, /personalizedRank\(rankDeals\(list\), interests\)/);
  assert.match(source, /Reset recommendations/);
});
