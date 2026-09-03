const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const detail = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');

test('successful Amazon redirect records stronger shopping intent than a detail-page open', () => {
  assert.match(detail, /if \(res\?\.redirectUrl\) \{\s*addCategoryInterest\(deal\.category, 3\);\s*amazonTab\.location\.replace\(res\.redirectUrl\);/s);
});

test('saving from detail page carries the same strong signal as saving from a deal card', () => {
  assert.match(detail, /function handleSave\(\)/);
  assert.match(detail, /if \(!saved\) addCategoryInterest\(deal\.category, 4\)/);
  assert.match(detail, /onClick=\{handleSave\}/);
});

test('removing an existing bookmark does not add a new positive interest signal', () => {
  const saveHandler = detail.match(/function handleSave\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(saveHandler, /if \(!saved\)/);
  assert.match(saveHandler, /toggleBookmark\(deal\)/);
});