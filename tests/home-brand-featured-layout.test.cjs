const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');
test('home presents departments before products and an accessible browse toolbar', () => {
  assert.match(home, /Shop by department/);
  assert.ok(home.indexOf('aria-label="Shop by department"') < home.indexOf('aria-labelledby="best-deals-heading"'));
  assert.match(home, /to=\{`\/category\/\$\{category\.slug\}`\}/);
  assert.match(home, /\.map\(\(category\)/);
  assert.match(home, /aria-labelledby="best-deals-heading"/);
  assert.match(home, /aria-labelledby="browse-deals-heading"/);
  assert.doesNotMatch(home, /Standouts|Selected deals|chapterBlock|Departments<\/h1>/);
  assert.match(home, /aria-label="Department"/);
  assert.match(home, /imagePriority=\{prioritizeImages && index < 2\}/);
  assert.match(home, /featuredDealCandidates\(visibleDeals\)/);
  assert.match(home, /Scroll best deals left/);
  assert.match(home, /Scroll best deals right/);
  assert.match(home, /id="best-deals-track"[^>]*overflow-x-auto/);
  assert.match(home, /const step = firstVisibleCard\.getBoundingClientRect\(\)\.width \+ gap/);
  assert.match(home, /scrollBy\(\{ left: direction \* step, behavior: 'smooth' \}\)/);
  assert.match(home, /disabled=\{!spotlightScroll\.canScrollLeft\}/);
  assert.match(home, /disabled=\{!spotlightScroll\.canScrollRight\}/);
  assert.doesNotMatch(home, /Strong recorded discounts\. Check current prices on Amazon\./);
  assert.match(home, /if \(!node \|\| !hasMore/);
  assert.doesNotMatch(home, />Load more deals<\/button>/);
  assert.match(home, /grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6/);
});

test('membership offers stay below shopping and out of primary navigation', () => {
  const layout = fs.readFileSync(path.join(__dirname, '..', 'src/components/Layout.jsx'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src/App.jsx'), 'utf8');
  const offers = fs.readFileSync(path.join(__dirname, '..', 'src/components/MembershipOffers.jsx'), 'utf8');
  assert.doesNotMatch(layout, /\/memberships|Prime & Audible/);
  assert.doesNotMatch(app, /\/memberships|pages\/Memberships/);
  assert.match(offers, /Memberships and subscriptions/);
  assert.match(offers, /Offers, eligibility, and terms are set by Amazon/);
});
