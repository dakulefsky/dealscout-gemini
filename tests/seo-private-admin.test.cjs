const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const seo = require('../server/services/seoService');

test('sitemap includes live deal and category URLs', () => {
  const xml = seo.buildSitemap({
    baseUrl: 'https://dealscout.example',
    categories: [{ slug: 'electronics' }],
    deals: [{ id: 'B0GGGQDY9H', asin: 'B0GGGQDY9H', price_check_at: 1700000000 }],
  });
  assert.match(xml, /\/category\/electronics/);
  assert.match(xml, /\/deal\/B0GGGQDY9H/);
  assert.match(xml, /<lastmod>/);
});

test('robots keeps admin and api out of crawl while advertising sitemap', () => {
  const robots = seo.buildRobots('https://dealscout.example');
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/dealscout\.example\/sitemap\.xml/);
});

test('deal metadata is factual and excludes ratings/reviews', () => {
  const meta = seo.dealMeta('https://dealscout.example', {
    id: 'B0GGGQDY9H', asin: 'B0GGGQDY9H', title: 'TCL NXTPAPER Phone', original_price: 249.99,
    sale_price: 179.99, discount_percent: 28, image_url: 'https://example.com/image.jpg',
  });
  assert.match(meta.description, /28% off/);
  assert.equal(meta.jsonLd.aggregateRating, undefined);
  assert.equal(meta.jsonLd.review, undefined);
  assert.equal(meta.jsonLd.offers.price, '179.99');
});

test('public app no longer exposes general login/register or legacy admin operations', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');
  const admin = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'AdminHome.jsx'), 'utf8');
  assert.match(app, /\/admin\/access/);
  assert.match(app, /path="\/login" element={<Navigate to="\/"/);
  assert.match(app, /\/admin\/operations" element={<Navigate to="\/admin"/);
  assert.doesNotMatch(layout, />Login</);
  assert.doesNotMatch(admin, /to="\/admin\/operations"/);
});
