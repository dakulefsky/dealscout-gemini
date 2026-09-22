const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AdSensePlaceholder.jsx'), 'utf8');

test('production UI does not render fake AdSense reservation boxes', () => {
  assert.match(source, /VITE_ADSENSE_CLIENT/);
  assert.match(source, /if \(!enabled\) return null/);
  assert.match(source, /PLACEHOLDER_SLOTS/);
  assert.doesNotMatch(source, /AdSense Ad Space Reserved/);
  assert.doesNotMatch(source, /Reserved Vertical Space/);
  assert.doesNotMatch(source, /Targeted Product Sponsor/);
});
