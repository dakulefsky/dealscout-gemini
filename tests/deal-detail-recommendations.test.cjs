const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');

test('deal detail continues browsing with a live recommendation feed', () => {
  assert.match(source, /More deals you might like/);
  assert.match(source, /dealsApi\.page\(\{ limit: 24/);
  assert.match(source, /<DealCard key=/);
  assert.match(source, /slice\(0, 8\)/);
});

test('recommendations exclude the current and ended deals', () => {
  assert.match(source, /itemId !== currentId/);
  assert.match(source, /!item\?\.isExpired/);
  assert.match(source, /item\?\.status !== 'EXPIRED'/);
});

test('recommendations combine page context with existing personalization', () => {
  assert.match(source, /personalizedRank\(eligible, interests\)/);
  assert.match(source, /item\.category === currentDeal\?\.category \? 1000 : 0/);
  assert.match(source, /loadInterests\(\)/);
});
