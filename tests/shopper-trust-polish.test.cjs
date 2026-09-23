const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('shopper copy avoids opaque personalization language', () => {
  const home = read('src/pages/Home.jsx');
  const chapters = read('src/lib/feedChapters.js');
  const detail = read('src/pages/DealDetail.jsx');
  const mobileHome = read('apps/mobile/app/index.jsx');
  const mobileDetail = read('apps/mobile/app/deal/[id].jsx');
  assert.doesNotMatch(home, /Best for you/);
  assert.doesNotMatch(mobileHome, /Best for you/);
  assert.doesNotMatch(chapters, /Picked for you|Because you’re checking out|Quick wins/);
  assert.match(detail, /Keep browsing/);
  assert.match(mobileDetail, /KEEP BROWSING/);
});

test('production CSP does not opt back into unsafe eval', () => {
  const security = read('server/middleware/securityBaseline.js');
  assert.doesNotMatch(security, /unsafe-eval/);
  assert.match(security, /strict-dynamic/);
});
