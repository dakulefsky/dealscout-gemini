const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const guideService = require('../server/services/buyingGuideService');
const guide = require('../shared/buyingGuide.json');
const offer = (price, quantity, extras = {}) => ({ price, quantity, ...extras });

test('delivered-cost calculator uses checkout charges and comparable quantities', async () => {
  const { compareDeliveredOffers } = await import('../shared/deliveredCost.mjs');
  const example = compareDeliveredOffers(offer('18', '6', { shipping: '3' }), offer('16', '4', { discount: '2' }));
  assert.equal(example.offerA.total, 21);
  assert.equal(example.offerB.total, 14);
  assert.equal(example.offerA.unitPrice, 3.5);
  assert.equal(example.cheaper, null);
  const withTax = compareDeliveredOffers(offer('10', '2', { shipping: '2', tax: '1', discount: '1' }), offer('8', '1'));
  assert.equal(withTax.offerA.unitPrice, 6);
  assert.equal(withTax.cheaper, 'A');
  assert.equal(withTax.savingPercent, 25);
});

test('calculator distinguishes blank prices from free offers and rejects invalid charges', async () => {
  const { deliveredOffer, compareDeliveredOffers } = await import('../shared/deliveredCost.mjs');
  for (const item of [offer('', 1), offer(10, 0), offer(10, Infinity), offer(10, 1, { tax: '-1' }),
    offer(10, 1, { discount: 11 }), offer('1.234', 1), offer('0.000000001', 1), offer('invalid', 1), offer(1e20, 1)]) assert.equal(deliveredOffer(item), null);
  const free = compareDeliveredOffers(offer(0, 1), offer(10, 1));
  assert.equal(free.cheaper, 'A');
  assert.equal(free.savingPercent, 100);
  assert.equal(compareDeliveredOffers(offer(0, 1), offer(0, 2)).cheaper, null);
});

test('guide remains crawlable without offers and escapes product content', () => {
  const empty = guideService.initialContent([]);
  assert.ok(empty.includes(guide.title));
  for (const section of guide.sections) assert.ok(empty.includes(section.title.replace(/&/g, '&amp;')));
  assert.match(empty, /Delivered total =/);
  assert.match(empty, /follows DealScout/);
  assert.doesNotMatch(empty, /AI assistance/);
  assert.match(empty, /Sources and pricing policy/);
  const html = guideService.initialContent([{ asin: 'B000000001', title: '<script>unsafe</script>', sale_price: 12 }]);
  assert.match(html, /&lt;script&gt;unsafe/);
  assert.doesNotMatch(html, /<script>unsafe/);
  const meta = guideService.metadata('https://dealscouted.com');
  assert.equal(meta.canonical, 'https://dealscouted.com/guides/amazon-deal-checklist');
  assert.equal(meta.jsonLd['@type'], 'Article');
  assert.equal(meta.jsonLd.author['@type'], 'Organization');
});

test('the evergreen guide is in the sitemap without requiring stock', () => {
  const xml = require('../server/services/seoService').buildSitemap({ baseUrl: 'https://dealscouted.com' });
  assert.match(xml, /<loc>https:\/\/dealscouted.com\/guides\/amazon-deal-checklist<\/loc>/);
});

test('guide offer fallback uses public DTO bootstrap and stays fresh on API failure', async () => {
  const { freshInitialFeed } = await import('../shared/shoppingTools.mjs');
  const now = 200000000;
  const valid = { id: 'valid', status: 'APPROVED', sourceVerified: true, priceCheckAt: now / 1000 - 10, salePrice: 20, originalPrice: 40 };
  const items = [valid, { ...valid, id: 'expired', priceCheckAt: now / 1000 - 86401 },
    { ...valid, id: 'rejected', status: 'REJECTED' }, { ...valid, id: 'unverified', sourceVerified: false }];
  assert.deepEqual(freshInitialFeed({ items }, { sort: 'best' }, now).items.map(x => x.id), ['valid']);
  const server = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  assert.match(server, /Guide offers temporarily unavailable/);
  assert.match(server, /initial-guide-deals/);
  assert.match(server, /page\.items\.map\(row => require\('\.\/server\/services\/publicDealDto'\)\.rowToDeal\(row\)\)/);
  const client = fs.readFileSync(require.resolve('../src/pages/BuyingGuide.jsx'), 'utf8');
  assert.match(client, /freshInitialFeed\(\{ items \}/);
  assert.match(client, /clearInterval\(timer\)/);
});
