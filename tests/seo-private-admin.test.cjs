const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const seo = require('../server/services/seoService');

test('sitemap includes fresh live deal and category URLs', () => {
  const nowMs = Date.UTC(2026, 7, 28, 9, 0, 0);
  const checkedAt = Math.floor((nowMs - 2 * 3600000) / 1000);
  const xml = seo.buildSitemap({
    baseUrl: 'https://dealscout.example',
    categories: [{ slug: 'electronics' }],
    deals: [{ id: 'B0GGGQDY9H', asin: 'B0GGGQDY9H', price_check_at: checkedAt }],
    nowMs,
  });
  assert.match(xml, /\/category\/electronics/);
  assert.match(xml, /\/deal\/B0GGGQDY9H/);
  assert.match(xml, /<lastmod>/);
});

test('sitemap omits deals whose successful price check is more than seven days old', () => {
  const nowMs = Date.UTC(2026, 7, 28, 9, 0, 0);
  const staleCheckedAt = Math.floor((nowMs - 8 * 24 * 3600000) / 1000);
  const xml = seo.buildSitemap({
    baseUrl: 'https://dealscout.example',
    categories: [],
    deals: [{ id: 'STALEDEAL1', asin: 'STALEDEAL1', price_check_at: staleCheckedAt }],
    nowMs,
  });
  assert.doesNotMatch(xml, /STALEDEAL1/);
});

test('robots keeps admin and api out of crawl while advertising sitemap', () => {
  const robots = seo.buildRobots('https://dealscout.example');
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/dealscout\.example\/sitemap\.xml/);
});

test('fresh deal metadata is factual and excludes ratings/reviews', () => {
  const nowMs = Date.UTC(2026, 7, 28, 9, 0, 0);
  const meta = seo.dealMeta('https://dealscout.example', {
    id: 'B0GGGQDY9H', asin: 'B0GGGQDY9H', title: 'TCL NXTPAPER Phone', original_price: 249.99,
    sale_price: 179.99, discount_percent: 28, image_url: 'https://example.com/image.jpg',
    price_check_at: Math.floor((nowMs - 2 * 3600000) / 1000),
  }, nowMs);
  assert.match(meta.description, /28% off/);
  assert.match(meta.description, /Price checked recently/);
  assert.equal(meta.image, 'https://example.com/image.jpg');
  assert.equal(meta.jsonLd.aggregateRating, undefined);
  assert.equal(meta.jsonLd.review, undefined);
  assert.equal(meta.jsonLd.offers.price, '179.99');
  assert.equal(meta.jsonLd.offers.availability, 'https://schema.org/InStock');
});

test('fresh SEO discount is derived from the verified price pair, not stored metadata', () => {
  const nowMs = Date.UTC(2026, 7, 28, 9, 0, 0);
  const meta = seo.dealMeta('https://dealscout.example', {
    id: 'B0TRUTH001', asin: 'B0TRUTH001', title: 'Price Truth Product', original_price: 100,
    sale_price: 75, discount_percent: 80,
    price_check_at: Math.floor((nowMs - 3600000) / 1000),
  }, nowMs);
  assert.match(meta.description, /25% off/);
  assert.doesNotMatch(meta.description, /80% off/);
});

test('stale deal metadata contains no stale price or offer claim', () => {
  const nowMs = Date.UTC(2026, 7, 28, 9, 0, 0);
  const meta = seo.dealMeta('https://dealscout.example', {
    id: 'B0GGGQDY9H', asin: 'B0GGGQDY9H', title: 'TCL NXTPAPER Phone', original_price: 249.99,
    sale_price: 179.99, discount_percent: 28,
    price_check_at: Math.floor((nowMs - 96 * 3600000) / 1000),
  }, nowMs);
  assert.match(meta.description, /waiting for a fresh/i);
  assert.doesNotMatch(meta.title, /179\.99/);
  assert.doesNotMatch(meta.description, /179\.99|28% off|save \$/i);
  assert.equal(meta.jsonLd.offers, undefined);
  assert.equal(meta.robots, 'noindex,follow');
});

test('malformed fresh deal metadata is also noindex and contains no offer', () => {
  const nowMs = Date.UTC(2026, 7, 28, 9, 0, 0);
  const meta = seo.dealMeta('https://dealscout.example', {
    id: 'BADPRICE01', asin: 'BADPRICE01', title: 'Bad price record', original_price: 100,
    sale_price: 120, discount_percent: 20,
    price_check_at: Math.floor((nowMs - 2 * 3600000) / 1000),
  }, nowMs);
  assert.equal(meta.robots, 'noindex,follow');
  assert.equal(meta.jsonLd.offers, undefined);
  assert.doesNotMatch(meta.title, /120/);
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
