const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('server-rendered deal routes use the same public eligibility policy as shopper APIs', () => {
  const server = read('server.js');
  assert.match(server, /const \\{ isPublicDeal \\} = require\\('\.\\/server\\/services\\/publicDealPolicy\\.js'\\)/);
  assert.match(server, /if \\(deal && isPublicDeal\\(deal\\)\\)/);
  assert.doesNotMatch(server, /deal\\.status === 'APPROVED' && deal\\.source_verified === 1 && deal\\.is_expired !== 1/);
});

test('fingerprinted production assets receive immutable cache headers', () => {
  const server = read('server.js');
  assert.match(server, /max-age=31536000, immutable/);
  assert.match(server, /assets/);
});

test('above-fold deal imagery carries explicit loading priority', () => {
  const home = read('src/pages/Home.jsx');
  const detail = read('src/pages/DealDetail.jsx');
  assert.match(home, /fetchPriority=\\{index === 0 \\? 'high'/);
  assert.match(detail, /loading="eager" fetchPriority="high"/);
});
