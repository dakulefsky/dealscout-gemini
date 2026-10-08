const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transform } = require('esbuild');
const source = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');

async function renderFeed({ items = [{ id: 'hidden', title: 'Hidden deal' }], cursor = 'next', error = null, dismissals = { hidden: true }, loading = false } = {}) {
  // Render the actual component with deterministic state; no browser or live API requests.
  const states = [items, loading, false, error, 0, cursor, 'all', '', 'best', 0, 'all', 'grid', false, {}, dismissals, 12, { canScrollLeft: false, canScrollRight: false }];
  let stateIndex = 0;
  const component = source.replace(/^import .*;\n/gm, '').replace('export default function Home()', 'function Home()');
  const compiled = await transform(component, { loader: 'jsx', jsx: 'transform', format: 'cjs' });
  const element = ({ children }) => React.createElement('span', null, children);
  const mocks = { React, useState: () => [states[stateIndex++], () => {}], useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: () => {}, useRef: () => ({ current: null }), useSearchParams: () => [new URLSearchParams('category=all'), () => {}], useActiveCategories: () => [], personalizedRank: (items) => items, rankDeals: (items) => items, interleaveCategories: (items) => items, INITIAL_FEED_SIZE: 12, dealCollections: [], Link: element, Input: element, Button: element, DealCard: element, MembershipOffers: element, SeasonalPromotionBanner: element };
  for (const name of ['ArrowRight', 'ChevronLeft', 'ChevronRight', 'TrendingDown', 'Search', 'LayoutGrid', 'List', 'RotateCcw', 'SlidersHorizontal', 'ShoppingBag', 'Laptop', 'House', 'Shirt', 'HeartPulse', 'PawPrint', 'Blocks']) mocks[name] = element;
  const Home = new Function(...Object.keys(mocks), `${compiled.code}\nreturn Home;`)(...Object.values(mocks));
  return renderToStaticMarkup(React.createElement(Home));
}

test('a dismissed first page still offers and observes the next remote page', async () => {
  const html = await renderFeed();
  assert.match(html, /data-feed-sentinel/);
  assert.match(html, /Load more deals/);
  assert.match(html, /More deals are available/);
  assert.doesNotMatch(html, /No current deals right now|reached the end/);
});

test('pagination failures expose retry without automatically observing another request', async () => {
  const html = await renderFeed({ error: 'temporary outage' });
  assert.match(html, /Couldn’t load more deals/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /data-feed-sentinel|Load more deals/);
});

test('an exhausted hidden feed displays a genuine empty state without extra requests', async () => {
  const html = await renderFeed({ cursor: null });
  assert.match(html, /No current deals right now/);
  assert.doesNotMatch(html, /data-feed-sentinel|Load more deals|More deals are available/);
});

test('initial loading does not expose the sentinel or paging controls', async () => {
  const html = await renderFeed({ loading: true });
  assert.match(html, /Loading deals/);
  assert.doesNotMatch(html, /data-feed-sentinel|Load more deals/);
});
