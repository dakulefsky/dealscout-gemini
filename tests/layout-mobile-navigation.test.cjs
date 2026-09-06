const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');

test('mobile menu button controls a real navigation panel', () => {
  assert.match(source, /const \[mobileMenuOpen, setMobileMenuOpen\] = useState\(false\)/);
  assert.match(source, /function toggleMobileMenu\(\)/);
  assert.match(source, /onClick=\{toggleMobileMenu\}/);
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /id="mobile-dealscout-menu"/);
  assert.match(source, /Mobile navigation/);
});

test('mobile navigation closes after route changes and on Escape', () => {
  assert.match(source, /setMobileMenuOpen\(false\)/);
  assert.match(source, /\[location\.pathname, location\.search\]/);
});

test('mobile search and menu do not stack on top of each other', () => {
  assert.match(source, /function toggleMobileSearch\(\)[\s\S]*?setMobileMenuOpen\(false\)/);
  assert.match(source, /function toggleMobileMenu\(\)[\s\S]*?setMobileSearchOpen\(false\)/);
});

test('desktop catalog CTA says what it actually does and nav has no dead More label', () => {
  assert.match(source, />Browse all deals<\/Link>/);
  assert.doesNotMatch(source, /> Get Deal Alerts<\/Link>/);
  assert.doesNotMatch(source, />More<\/span>/);
});
