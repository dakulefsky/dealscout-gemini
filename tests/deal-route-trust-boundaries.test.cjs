const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/routes/deals.js'), 'utf8');

test('single-deal public visibility uses the shared freshness policy', () => {
  assert.match(source, /const \{ isPublicDeal \} = require\('\.\.\/services\/publicDealPolicy'\)/);
  assert.match(source, /return req\.user\?\.role === 'admin' \|\| isPublicDeal\(deal\);/);
  assert.match(source, /if \(!row \|\| !canSeeDeal\(req, row\)\) return res\.status\(404\)/);
});

test('admin deal writes validate product URLs against Amazon-owned HTTPS hosts', () => {
  assert.match(source, /const \{ isAmazonUrl \} = require\('\.\.\/services\/amazonUrlService'\)/);
  assert.match(source, /function validateProductUrl\(value, asin\)/);
  assert.match(source, /if \(!isAmazonUrl\(url\)\) throw new Error\('Product URL must use an Amazon-owned host'\)/);
  assert.match(source, /if \(parsed\.protocol !== 'https:'\) throw new Error\('Product URL must use HTTPS'\)/);
  assert.match(source, /product_url: validateProductUrl\(b\.productUrl, asin\)/);
  assert.match(source, /changes\.product_url = validateProductUrl\(b\.productUrl, changes\.asin \|\| deal\.asin\)/);
});

test('changing an ASIN without a replacement URL cannot retain the old product destination', () => {
  assert.match(source, /else if \(changes\.asin\) changes\.product_url = validateProductUrl\(null, changes\.asin\);/);
});
