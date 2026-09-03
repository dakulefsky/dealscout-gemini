const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'server/routes/editorial.js'), 'utf8');
const repository = fs.readFileSync(path.join(root, 'server/repositories/editorialRepository.js'), 'utf8');

test('public DealScout Picks use a set-based query with the shopper freshness and price guards', () => {
  assert.match(route, /editorial\.listPublicHumanPicks\(limit\)/);
  assert.doesNotMatch(route, /for \(const row of rows\)[\s\S]*findByIdOrAsin/);
  assert.match(repository, /JOIN deals d ON d\.asin = e\.asin/);
  assert.match(repository, /d\.status = 'APPROVED'/);
  assert.match(repository, /d\.source_verified = 1/);
  assert.match(repository, /d\.sale_price < d\.original_price/);
  assert.match(repository, /d\.price_check_at >= \$1/);
  assert.match(repository, /d\.price_check_at <= \$2/);
  assert.match(repository, /freshPriceThreshold\(nowSeconds\)/);
  assert.match(route, /req\.user\?\.role === 'admin' \|\| isPublicDeal\(deal\)/);
});

test('public pick shape exposes price check timestamp for shopper context', () => {
  assert.match(route, /priceCheckAt: row\.price_check_at \|\| null/);
});
