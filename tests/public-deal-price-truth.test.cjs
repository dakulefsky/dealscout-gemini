const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'deals.js'), 'utf8');

test('shopper deal responses derive discount from the verified price pair', () => {
  const block = source.match(/function rowToDeal\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(block, /const originalPrice = Number\(r\.original_price/);
  assert.match(block, /const salePrice = Number\(r\.sale_price/);
  assert.match(block, /\(\(originalPrice - salePrice\) \/ originalPrice\) \* 100/);
  assert.match(block, /originalPrice,\n\s+salePrice,\n\s+discountPercent,/);
  assert.doesNotMatch(block, /discountPercent: Number\(r\.discount_percent/);
});
