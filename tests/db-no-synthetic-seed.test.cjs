const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dbSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'db.js'), 'utf8');

test('JSON fallback no longer contains a default admin password or synthetic product catalog', () => {
  assert.doesNotMatch(dbSource, /admin123/);
  assert.doesNotMatch(dbSource, /Apple AirPods Pro/);
  assert.doesNotMatch(dbSource, /Sony WH-1000XM5/);
  assert.doesNotMatch(dbSource, /Rainforest API \| ASIN:/);
  assert.doesNotMatch(dbSource, /const initialDeals/);
});

test('JSON fallback seeds categories only', () => {
  assert.match(dbSource, /DEFAULT_CATEGORIES/);
  assert.match(dbSource, /seedCategories\(\)/);
  assert.doesNotMatch(dbSource, /bcrypt/);
  assert.doesNotMatch(dbSource, /uuidv4/);
});

test('legacy JSON fallback has no price history shim or synthetic history', () => {
  assert.doesNotMatch(dbSource, /getDealPriceHistory/);
  assert.doesNotMatch(dbSource, /simulated 30-day price history/i);
});
