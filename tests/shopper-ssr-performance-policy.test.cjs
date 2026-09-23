const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('server-rendered deal routes use the same public eligibility policy as shopper APIs', () => {
  const server = read('server.js');
  assert.ok(server.includes("const { isPublicDeal } = require('./server/services/publicDealPolicy.js')"));
  assert.ok(server.includes('if (deal && isPublicDeal(deal))'));
  assert.equal(server.includes("deal.status === 'APPROVED' && deal.source_verified === 1 && deal.is_expired !== 1"), false);
});

test('fingerprinted production assets receive immutable cache headers', () => {
  const server = read('server.js');
  assert.ok(server.includes('max-age=31536000, immutable'));
  assert.ok(server.includes('assets'));
});

test('above-fold deal imagery carries explicit loading priority', () => {
  const home = read('src/pages/Home.jsx');
  const detail = read('src/pages/DealDetail.jsx');
  assert.ok(home.includes("fetchPriority={index === 0 ? 'high' : 'auto'}"));
  assert.ok(detail.includes('loading="eager" fetchPriority="high"'));
});
