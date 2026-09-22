const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('AdSense ads.txt authorizes the configured DealScout publisher', () => {
  const ads = fs.readFileSync(path.join(__dirname, '..', 'public', 'ads.txt'), 'utf8').trim();
  assert.equal(ads, 'google.com, pub-7492088381598802, DIRECT, f08c47fec0942fa0');
});

test('privacy policy discloses advertising and cookie use', () => {
  const privacy = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Privacy.jsx'), 'utf8');
  assert.match(privacy, /Google AdSense/);
  assert.match(privacy, /cookies, local storage/);
});
