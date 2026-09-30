const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');



test('deal cards surface factual verification recency instead of a vague trust badge', () => {
  const card = read('src/components/DealCard.jsx');
  assert.match(card, /Checked now/);
  assert.match(card, /Checked \$\{Math\.floor\(freshness\.ageSeconds \/ 3600\)\}h/);
  assert.doesNotMatch(card, />Verified<\/span>/);
});
