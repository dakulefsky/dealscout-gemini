const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Layout.jsx'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');



test('consumer shell has brand masthead, retail search, and category navigation', () => {
  assert.match(layout, /Verified Amazon deals/);
  assert.match(layout, /Search deals, brands, products/);
  assert.match(layout, /All Deals/);
  assert.match(layout, /Browse all/);
  assert.doesNotMatch(layout, /Get Deal Alerts/);
});


test('design tokens keep compact radii and restrained system typography', () => {
  assert.match(css, /--radius: 0\.125rem/);
  assert.match(css, /--font-heading: Inter/);
  assert.match(css, /\.ds-section-title/);
});
