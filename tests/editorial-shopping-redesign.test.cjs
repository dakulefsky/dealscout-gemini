const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');

test('homepage uses editorial shopping hierarchy instead of SaaS hero cards', () => {
  assert.match(home, /Better deals for real life\./);
  assert.match(home, /Today’s Top Deals/);
  assert.match(home, /Featured deal/);
  assert.doesNotMatch(home, /bg-gradient-to-b from-white to-slate-50/);
  assert.doesNotMatch(home, /rounded-2xl sm:rounded-3xl border border-orange-200/);
});

test('consumer shell has brand masthead, retail search, and category navigation', () => {
  assert.match(layout, /Good deals\. No digging\./);
  assert.match(layout, /Search products, brands, or categories/);
  assert.match(layout, /All Deals/);
  assert.match(layout, /Browse all deals/);
  assert.doesNotMatch(layout, /Get Deal Alerts/);
});

test('deal cards are retail first and avoid universal rounded-card treatment', () => {
  assert.match(card, /bg-\[#f7f5f0\]/);
  assert.match(card, /ds-price/);
  assert.doesNotMatch(card, /rounded-2xl border overflow-hidden/);
});

test('design tokens establish serif editorial heading and compact radius', () => {
  assert.match(css, /Georgia, 'Times New Roman', serif/);
  assert.match(css, /--radius: 0\.375rem/);
  assert.match(css, /\.ds-section-title/);
});
