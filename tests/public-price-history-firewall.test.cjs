const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'priceHistory.js'), 'utf8');

test('public price history strips provider internals', () => {
  assert.match(source, /const publicHistory = history\.map/);
  assert.match(source, /date: point\.date/);
  assert.match(source, /price: Number\(point\.price\)/);
  assert.match(source, /listPrice: Number\(point\.listPrice\)/);
  const publicBlock = source.match(/const publicHistory = history\.map[\s\S]*?\}\);/)?.[0] || '';
  assert.equal(publicBlock.includes('sourceProvider'), false);
});

test('public price history is only available while the deal passes the shared freshness policy', () => {
  assert.match(source, /const \{ isPublicDeal \} = require\('\.\.\/services\/publicDealPolicy'\)/);
  assert.match(source, /req\.user\?\.role === 'admin' \|\| isPublicDeal\(deal\)/);
});
