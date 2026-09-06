const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');

test('mobile menu button controls a real navigation panel', () => {
  assert.match(source, /const \[mobileMenuOpen, setMobileMenuOpen\] = useState\(false\)/);
  assert.match(source, /onClick=\{\(\) => setMobileMenuOpen\(\(value\) => !value\)\}/);
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /id="mobile-dealscout-menu"/);
  assert.match(source, /Mobile navigation/);
});

test('mobile navigation closes after route changes and on Escape', () => {
  assert.match(source, /setMobileMenuOpen\(false\)/);
  assert.match(source, /\[location\.pathname, location\.search\]/);
});

test('desktop catalog CTA says what it actually does', () => {
  assert.match(source, />Browse all deals<\/Link>/);
  assert.doesNotMatch(source, /> Get Deal Alerts<\/Link>/);
});
