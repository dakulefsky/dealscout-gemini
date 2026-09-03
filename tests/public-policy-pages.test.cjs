const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('public privacy and support pages are routed and linked', () => {
  const app = read('src/App.jsx');
  const layout = read('src/components/Layout.jsx');
  assert.match(app, /path="\/privacy"/);
  assert.match(app, /path="\/support"/);
  assert.match(layout, /to="\/privacy"/);
  assert.match(layout, /to="\/support"/);
});

test('privacy page describes current guest/local personalization boundaries', () => {
  const privacy = read('src/pages/Privacy.jsx');
  assert.match(privacy, /randomly generated guest identifier/i);
  assert.match(privacy, /stored on your device/i);
  assert.match(privacy, /does not process Amazon checkout or payment information/i);
  assert.match(privacy, /outbound Status updates/i);
});

test('policy pages have production metadata and sitemap exposure', () => {
  const server = read('server.js');
  const seo = read('server/services/seoService.js');
  assert.match(server, /req\.path === '\/privacy'/);
  assert.match(server, /req\.path === '\/support'/);
  assert.match(seo, /\$\{baseUrl\}\/privacy/);
  assert.match(seo, /\$\{baseUrl\}\/support/);
});
