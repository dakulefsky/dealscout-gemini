const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const bookmarks = fs.readFileSync(path.join(root, 'server', 'routes', 'bookmarks.js'), 'utf8');
const editorial = fs.readFileSync(path.join(root, 'server', 'routes', 'editorial.js'), 'utf8');

function assertPriceDerivedSerializer(source, functionName) {
  const block = source.match(new RegExp(`function ${functionName}\\([\\s\\S]*?\\n\\}`))?.[0] || '';
  assert.match(block, /const originalPrice = Number\(/);
  assert.match(block, /const salePrice = Number\(/);
  assert.match(block, /\(\(originalPrice - salePrice\) \/ originalPrice\) \* 100/);
  assert.match(block, /originalPrice,\n\s+salePrice,\n\s+discountPercent,/);
  assert.doesNotMatch(block, /discountPercent: Number\([^\n]*discount_percent/);
}

test('saved deal responses derive discount from the verified price pair', () => {
  assertPriceDerivedSerializer(bookmarks, 'rowToPublicDeal');
});

test('editorial pick deal responses derive discount from the verified price pair', () => {
  assertPriceDerivedSerializer(editorial, 'publicDealShape');
});
