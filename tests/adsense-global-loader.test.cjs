const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ads = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AdSensePlaceholder.jsx'), 'utf8');

test('AdSense loader is present globally with the DealScout publisher id', () => {
  assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7492088381598802/);
  assert.match(html, /crossorigin="anonymous"/);
  assert.match(ads, /ca-pub-7492088381598802/);
});
