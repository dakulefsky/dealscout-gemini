const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dismissals = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedDismissals.js'), 'utf8');
const personalization = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedPersonalization.js'), 'utf8');
const personalizationCore = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'personalizationCore.js'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');

test('not interested hides an exact deal temporarily and locally', () => {
  assert.match(dismissals, /dealscout-feed-dismissed-v1/);
  assert.match(dismissals, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(dismissals, /dismissDeal/);
  assert.match(dismissals, /restoreDeal/);
  assert.match(dismissals, /localStorage/);
  assert.doesNotMatch(dismissals, /fetch\(/);
});

test('negative category feedback is modest and never goes below zero', () => {
  assert.match(personalization, /reduceCategoryInterest\(category, weight = 3\)/);
  assert.match(personalizationCore, /Math\.max\(0,/);
  assert.match(card, /reduceCategoryInterest\(deal\.category, 3\)/);
});

test('deal cards expose a not interested control in grid and list views', () => {
  assert.match(card, /EyeOff/);
  assert.match(card, /title="Not interested"/);
  assert.match(card, /dismissDeal\(dealId\)/);
  assert.match(card, /Deal hidden/);
});

test('dismissal offers a two-second undo and reverses both local signals', () => {
  assert.match(card, /setTimeout\(\(\) => \{[\s\S]*?\}, 2000\)/);
  assert.match(card, /restoreDeal\(dealId\)/);
  assert.match(card, /addCategoryInterest\(deal\.category, 3\)/);
  assert.match(card, />Undo<\/button>/);
});
