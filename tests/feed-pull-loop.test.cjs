const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('home wires progressive feed helpers into the live feed', () => {
  assert.match(home, /INITIAL_FEED_SIZE, nextVisibleCount, dealDrop/);
  assert.match(home, /new IntersectionObserver/);
  assert.match(home, /setVisibleCount\(\(current\) => nextVisibleCount/);
  assert.match(home, /rootMargin: '700px 0px'/);
});

test('home exposes Deal Drop and avoids immediate Explore duplicates', () => {
  assert.match(home, /dealDrop\(visibleDeals, 8\)/);
  assert.match(home, /Deal Drop/);
  assert.match(home, /dropIds\.has/);
  assert.match(home, /8 deals worth seeing right now/);
});

test('home creates a local return loop and a finite caught-up state', () => {
  assert.match(home, /dealscout-feed-last-visit-v1/);
  assert.match(home, /newSinceLastVisit/);
  assert.match(home, /new .*since your last visit/);
  assert.match(home, /You’ve seen today’s best deals/);
});
