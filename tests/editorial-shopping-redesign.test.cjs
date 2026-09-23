const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');

test('homepage uses a department-led retail hierarchy instead of a SaaS hero', () => {
  assert.match(home, /Current deals by department/);
  assert.match(home, /Worth it today/);
  assert.match(home, /spotlightDeals/);
  assert.doesNotMatch(home, /Better deals for real life|Featured deal|What are you here for/);
  assert.doesNotMatch(home, /bg-gradient-to-b from-white to-slate-50/);
});

test('homepage does not repeat spotlight merchandise in the deal drop', () => {
  assert.match(home, /visibleDeals\.filter\(\(deal\) => !spotlightIds\.has/);
  assert.match(home, /const dropIds = useMemo\(\(\) => new Set\(\[\.\.\.spotlightIds/);
});

test('consumer shell has brand masthead, retail search, and category navigation', () => {
  assert.match(layout, /Verified Amazon deals/);
  assert.match(layout, /Search deals, brands, products/);
  assert.match(layout, /All Deals/);
  assert.match(layout, /Browse all/);
  assert.doesNotMatch(layout, /Get Deal Alerts/);
});

test('deal cards are retail first and avoid universal rounded-card treatment', () => {
  assert.match(card, /bg-\[#f7f5f0\]/);
  assert.match(card, /ds-price/);
  assert.match(card, /border-t-2/);
  assert.doesNotMatch(card, /hover:shadow|hover:-translate-y/);
});

test('design tokens keep compact radii and restrained system typography', () => {
  assert.match(css, /--radius: 0\.375rem/);
  assert.match(css, /--font-heading: Inter/);
  assert.match(css, /\.ds-section-title/);
});
