const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function page(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', name), 'utf8');
}

const category = page('CategoryPage.jsx');
const detail = page('DealDetail.jsx');
const saved = page('SavedDeals.jsx');

test('category page uses the shared editorial retail shell instead of floating SaaS cards', () => {
  assert.match(category, /className="ds-shell py-7 sm:py-10 pb-20"/);
  assert.match(category, /border-y border-emerald-950\/10/);
  assert.match(category, /font-heading text-4xl sm:text-5xl lg:text-6xl/);
  assert.match(category, /What makes a .* deal worth showing/);
  assert.doesNotMatch(category, /rounded-3xl|shadow-xs/);
});

test('deal detail is product-first and keeps core commerce actions intact', () => {
  assert.match(detail, /grid lg:grid-cols-\[minmax\(0,1\.65fr\)_minmax\(320px,0\.8fr\)\]/);
  assert.match(detail, /bg-\[#f4f1e9\]/);
  assert.match(detail, /View deal on Amazon/);
  assert.match(detail, /functions\.amazonRedirect\(deal\.productUrl\)/);
  assert.match(detail, /toggleBookmark\(deal\)/);
  assert.match(detail, /navigator\.clipboard\.writeText/);
  assert.match(detail, /focus-visible:ring-2/);
  assert.doesNotMatch(detail, /rounded-3xl/);
});

test('saved deals reads as a curated shortlist while preserving DealCard behavior', () => {
  assert.match(saved, /Your shortlist/);
  assert.match(saved, /Build a shortlist worth revisiting/);
  assert.match(saved, /savedDealsList\.map\(\(deal\) => <DealCard/);
  assert.match(saved, /ds-shell py-8 sm:py-12 pb-20/);
  assert.doesNotMatch(saved, /rounded-3xl|shadow-xs/);
});
