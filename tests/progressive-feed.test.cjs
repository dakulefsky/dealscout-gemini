const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('home uses a progressive feed instead of rendering the entire catalog immediately', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
  assert.match(source, /visibleCount/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /INITIAL_FEED_SIZE/);
  assert.match(source, /FEED_PAGE_SIZE/);
  assert.match(source, /Deal Drop/);
  assert.match(source, /caught up/);
});
