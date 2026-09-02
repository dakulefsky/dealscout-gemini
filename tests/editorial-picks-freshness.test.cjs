const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('public DealScout Picks use the same freshness policy as the shopper feed', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/routes/editorial.js'), 'utf8');
  assert.match(source, /const \{ isPublicDeal \} = require\('\.\.\/services\/publicDealPolicy'\)/);
  assert.match(source, /if \(!isPublicDeal\(deal\)\) continue/);
  assert.match(source, /req\.user\?\.role === 'admin' \|\| isPublicDeal\(deal\)/);
});

test('public pick shape exposes price check timestamp for shopper context', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/routes/editorial.js'), 'utf8');
  assert.match(source, /priceCheckAt: row\.price_check_at \|\| null/);
});
