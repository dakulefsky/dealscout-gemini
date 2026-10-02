const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');



test('deal cards surface plain-language price-check recency instead of a vague trust badge', () => {
  const card = read('src/components/DealCard.jsx');
  const freshness = read('src/lib/verificationFreshness.js');
  assert.ok(card.includes("freshness.stale ? 'Check price' : freshness.label"));
  assert.ok(freshness.includes("Price checked ${hours}h ago"));
  assert.doesNotMatch(card, />Verified<\/span>/);
});
