const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { aggregateFallback } = require('../server/repositories/dealQueryRepository');

test('admin separates approved catalog size from actually shopper-visible inventory', () => {
  const now = Math.floor(Date.now() / 1000);
  const rows = [
    { id: 'FRESH00001', status: 'APPROVED', source_verified: 1, is_expired: 0, original_price: 100, sale_price: 70, price_check_at: now - 60, discount_percent: 30 },
    { id: 'STALE00001', status: 'APPROVED', source_verified: 1, is_expired: 0, original_price: 100, sale_price: 75, price_check_at: now - 25 * 60 * 60, discount_percent: 25 },
    { id: 'REVIEW0001', status: 'PENDING_REVIEW', source_verified: 1, is_expired: 0, original_price: 100, sale_price: 20, price_check_at: now - 60, discount_percent: 80 },
  ];
  const stats = aggregateFallback(rows, true);
  assert.equal(stats.approvedCount, 2);
  assert.equal(stats.publicVisibleCount, 1);
  assert.equal(stats.lifecycle.activeCount, 2);
});

test('production admin stats compute shopper-visible count with freshness and verification guards', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'dealQueryRepository.js'), 'utf8');
  assert.match(source, /AS public_visible_count/i);
  assert.match(source, /source_verified = 1/);
  assert.match(source, /sale_price < original_price/);
  assert.match(source, /price_check_at >= \$2/);
  assert.match(source, /price_check_at <= \$3/);
});

test('admin dashboard labels live inventory from publicVisibleCount and explains freshness holdback', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'AdminHome.jsx'), 'utf8');
  assert.match(source, /stats\.publicVisibleCount/);
  assert.match(source, /approved waiting for a fresh price check/);
  assert.match(source, /Visible deals:<\/span> \{publicVisibleCount/);
});
