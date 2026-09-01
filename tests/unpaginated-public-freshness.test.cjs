const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/repositories/dealQueryRepository.js'), 'utf8');

test('legacy public deal list uses the shared 24-hour public policy', () => {
  assert.match(source, /const \{ isPublicDeal, freshPriceThreshold \} = require\('\.\.\/services\/publicDealPolicy'\)/);
  assert.match(source, /return isAdmin \|\| isPublicDeal\(deal\)/);
  assert.match(source, /price_check_at IS NOT NULL AND price_check_at >=/);
  assert.match(source, /price_check_at <=/);
});

test('public stats count only fresh verified live deals', () => {
  const statsBlock = source.match(/if \(!isAdmin\) \{[\s\S]*?return \{[\s\S]*?categoriesCount: row\.categories_count,[\s\S]*?\};\n  \}/)?.[0] || '';
  assert.match(statsBlock, /freshPriceThreshold\(nowSeconds\)/);
  assert.match(statsBlock, /source_verified = 1/);
  assert.match(statsBlock, /price_check_at IS NOT NULL/);
  assert.match(statsBlock, /price_check_at >= \$1/);
  assert.match(statsBlock, /price_check_at <= \$2/);
});

test('admin list and admin stats remain outside the shopper freshness gate', () => {
  assert.match(source, /if \(isAdmin\) \{\n    if \(opts\.status\)/);
  assert.match(source, /if \(isAdmin && opts\.minRating !== null\)/);
  assert.match(source, /COUNT\(\*\) FILTER \(WHERE status = 'PENDING_REVIEW'\)/);
});
