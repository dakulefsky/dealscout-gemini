const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');
const privacy = read('src/pages/Privacy.jsx');
const support = read('src/pages/Support.jsx');
const server = read('server.js');
const seo = read('server/services/seoService.js');
const browserApi = read('src/lib/api.js');
const personalization = read('src/lib/feedPersonalization.js');

test('privacy and support are stable public shopper routes linked from the footer', () => {
  assert.match(app, /path="\/privacy" element=\{<Privacy \/>\}/);
  assert.match(app, /path="\/support" element=\{<Support \/>\}/);
  assert.match(layout, /to="\/privacy"/);
  assert.match(layout, /to="\/support"/);
});

test('privacy copy reflects the implemented guest identity and local personalization model', () => {
  assert.match(browserApi, /const GUEST_ID_KEY = 'ds_guest_id'/);
  assert.match(browserApi, /localStorage\.setItem\(GUEST_ID_KEY, guestId\)/);
  assert.match(personalization, /const STORAGE_KEY = 'dealscout-feed-interests-v1'/);
  assert.match(privacy, /random guest identifier/i);
  assert.match(privacy, /recommendation interests.*local device state/i);
  assert.match(privacy, /does not process your Amazon checkout or payment information/i);
});

test('support page keeps retailer responsibilities and DealScout price freshness distinct', () => {
  assert.match(support, /Amazon orders, returns, and payments/);
  assert.match(support, /not the retailer or payment processor/);
  assert.match(support, /Amazon checkout page is the final source/);
});

test('public policy routes have canonical production metadata and sitemap entries', () => {
  assert.match(server, /req\.path === '\/privacy'/);
  assert.match(server, /canonical: `\$\{baseUrl\}\/privacy`/);
  assert.match(server, /req\.path === '\/support'/);
  assert.match(server, /canonical: `\$\{baseUrl\}\/support`/);
  assert.match(seo, /`\$\{baseUrl\}\/privacy`/);
  assert.match(seo, /`\$\{baseUrl\}\/support`/);
});
