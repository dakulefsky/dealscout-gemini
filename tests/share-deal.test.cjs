const test = require('node:test');
const assert = require('node:assert/strict');
test('shared message includes product and fresh savings, but never stale prices', async () => {
  const { shareDeal } = await import('../src/lib/shareDeal.js');
  const now = 1800000000000;
  const deal = { id: 'B123', title: 'Coffee maker', salePrice: 40, originalPrice: 80, sourceVerified: true, priceCheckAt: now / 1000 };
  const fresh = shareDeal(deal, now);
  assert.match(fresh.message, /Coffee maker\n\$40.00 · 50% off/);
  assert.equal(fresh.url, 'https://dealscouted.com/deal/B123');
  for (const change of [{ priceCheckAt: now / 1000 - 86401 }, { isExpired: true }, { sourceVerified: false }, { priceCheckAt: now / 1000 + 100 }]) {
    assert.doesNotMatch(shareDeal({ ...deal, ...change }, now).message, /\$|% off/);
  }
});
test('product HTML supplies one large image card with escaped product metadata', () => {
  const seo = require('../server/services/seoService');
  const html = seo.replaceMeta('<head><title>Site</title><meta name="twitter:card" content="summary" /></head>', {
    title: 'Coffee & tea', description: 'A deal', image: 'https://example.com/product.jpg'
  });
  assert.equal((html.match(/name="twitter:card"/g) || []).length, 1);
  assert.match(html, /summary_large_image/);
  assert.match(html, /og:image:alt" content="Coffee &amp; tea/);
});
