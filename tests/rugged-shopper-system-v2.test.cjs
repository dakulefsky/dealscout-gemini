const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');



test('price-check recency lives on the product detail page instead of every card', () => {
  const card = read('src/components/DealCard.jsx');
  const freshness = read('src/lib/verificationFreshness.js');
  assert.doesNotMatch(card, /Check price|freshness/);
  assert.match(read('src/pages/DealDetail.jsx'), /<span>\{freshness\.label\}<\/span>/);
  assert.ok(freshness.includes("Price checked ${hours}h ago"));
  assert.doesNotMatch(card, />Verified<\/span>/);
});
