const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dealCard = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');
const editorial = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'EditorialReview.jsx'), 'utf8');

test('DealCard stabilizes dwell completion before using it from IntersectionObserver effects', () => {
  assert.match(dealCard, /useCallback/);
  assert.match(dealCard, /const finishDwell = useCallback/);
  assert.match(dealCard, /\[deal\.category\]\)/);
  assert.match(dealCard, /\[dealId, finishDwell\]/);
});

test('EditorialReview stabilizes its async loader and includes it in effect dependencies', () => {
  assert.match(editorial, /const load = useCallback\(async \(\) =>/);
  assert.match(editorial, /\}, \[toast\]\);/);
  assert.match(editorial, /useEffect\(\(\) => \{ load\(\); \}, \[load\]\)/);
});
