const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { buildDealRss } = require('../server/services/dealRssService');
const nowMs = Date.UTC(2026, 9, 13, 11);
const deal = { id: 'B000000001', asin: 'B000000001', title: 'Coffee & tea <kit>', category: 'Home & Kitchen', status: 'APPROVED', source_verified: 1, is_expired: 0, price_check_at: nowMs / 1000 - 60, original_price: 100, sale_price: 50, created_at: nowMs / 1000 - 3600 };

test('RSS is valid XML and only includes fresh approved verified deals with checked-price context', () => {
  const rows = [deal, ...[
    { status: 'REJECTED' }, { status: 'PENDING_REVIEW' }, { source_verified: 0 }, { is_expired: 1 },
    { price_check_at: nowMs / 1000 - 86401 }, { price_check_at: nowMs / 1000 + 1 }, { sale_price: 99 }, { sale_price: NaN }, { title: '' },
  ].map((change, index) => ({ ...deal, id: `bad-${index}`, ...change }))];
  const xml = buildDealRss({ baseUrl: 'https://dealscouted.com', deals: rows, nowMs });
  const dom = new JSDOM(xml, { contentType: 'application/xml' });
  const items = dom.window.document.querySelectorAll('item');
  assert.equal(items.length, 1);
  assert.equal(items[0].querySelector('title').textContent, deal.title);
  assert.match(items[0].querySelector('description').textContent, /Checked price: \$50.00.*reference price: \$100.00/);
  assert.match(items[0].querySelector('description').textContent, /Price checked.*confirm the final offer/);
  assert.equal(items[0].querySelector('link').textContent, 'https://dealscouted.com/deal/B000000001');
  assert.equal(items[0].querySelector('pubDate').textContent, new Date(deal.created_at * 1000).toUTCString());
  dom.window.close();
});

test('empty and departmental feeds are valid, bounded and do not reveal operational data', () => {
  const xml = buildDealRss({ baseUrl: 'https://dealscouted.com/', deals: [], category: { slug: 'home-kitchen', name: 'Home & Kitchen' }, nowMs });
  const empty = new JSDOM(xml, { contentType: 'application/xml' });
  assert.equal(empty.window.document.querySelectorAll('item').length, 0);
  assert.match(empty.window.document.querySelector('title').textContent, /Home & Kitchen/);
  assert.match(xml, /feed.xml\?category=home-kitchen/);
  empty.window.close();
  const bulk = buildDealRss({ baseUrl: 'https://dealscouted.com', deals: Array.from({ length: 50 }, (_, i) => ({ ...deal, id: `product-${i}`, title: '<script>bad\u0001</script>', raw_source_data: 'private-source', editorial_note: 'private-review' })), nowMs });
  const dom = new JSDOM(bulk, { contentType: 'application/xml' });
  assert.equal(dom.window.document.querySelectorAll('item').length, 24);
  assert.doesNotMatch(bulk, /private-source|private-review|<script>/);
  dom.window.close();
});

test('feed route stays behind the existing closure and uses only the bounded public catalog', () => {
  const source = fs.readFileSync('server.js', 'utf8');
  assert.ok(source.indexOf("app.get('/feed.xml'") > source.indexOf('const closure = await jewishClosure.currentStatus()'));
  const feed = source.slice(source.indexOf("app.get('/feed.xml'"), source.indexOf("app.use('/api/v1'"));
  assert.match(feed, /dealFeedRepository\.page\(\{ limit: 24/);
  assert.match(feed, /activeOnly: false/);
  assert.match(feed, /no-store/);
  assert.doesNotMatch(feed, /fetchDeals|fetchProduct|rainforest|provider/i);
});

test('HTML advertises one feed link and private/no-feed pages do not inherit it', () => {
  const { replaceMeta } = require('../server/services/seoService');
  const meta = { title: 'DealScout', description: 'Deals', feedUrl: 'https://dealscouted.com/feed.xml' };
  const once = replaceMeta('<head><title>Site</title></head>', meta);
  const twice = replaceMeta(once, meta);
  assert.equal((twice.match(/type="application\/rss\+xml"/g) || []).length, 1);
  assert.doesNotMatch(replaceMeta(twice, { title: 'Admin', robots: 'noindex,nofollow' }), /application\/rss\+xml/);
});
