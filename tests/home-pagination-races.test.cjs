const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');
const category = fs.readFileSync(path.join(__dirname, '..', 'src/pages/CategoryPage.jsx'), 'utf8');

test('filter changes invalidate pagination before waiting for the search debounce', () => {
  const start = home.indexOf('const generation = ++feedGeneration.current');
  const debounce = home.indexOf('const timer = window.setTimeout', start);
  assert.ok(start >= 0 && debounce > start);
  const reset = home.slice(start, debounce);
  assert.match(reset, /paginationRequest.current\?\.abort\(\)/);
  assert.match(reset, /setNextCursor\(null\)/);
  assert.match(reset, /setDeals\(\[\]\)/);
});

test('department page guards concurrent and stale pagination and distinguishes API errors from missing categories', () => {
  assert.match(category, /isIntersecting\) \|\| paginationRequest.current\) return/);
  assert.match(category, /cursor: nextCursor \}, \{ signal: controller.signal \}/);
  assert.match(category, /controller.signal.aborted \|\| generation !== feedGeneration.current\) return/);
  assert.match(category, /paginationRequest.current === controller/);
  assert.ok(category.indexOf(') : error && visibleDeals.length === 0 ? (') < category.indexOf(') : !category ? ('));
});

function harness() {
  const body = home.match(/const loadRemotePage = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[/)?.[1];
  assert.ok(body, 'extract the real pagination callback');
  const state = { items: [], cursor: 'next', error: null, loadingMore: false };
  const generation = { current: 1 };
  const request = { current: null };
  const calls = [];
  let resolve, reject;
  const api = { page(params, options) {
    calls.push({ params, options });
    return new Promise((yes, no) => { resolve = yes; reject = no; });
  } };
  const run = new Function('nextCursor', 'loading', 'loadingMore', 'paginationRequest', 'feedGeneration', 'AbortController', 'setLoadingMore', 'dealsApi', 'feedParams', 'setDeals', 'mergeDeals', 'setNextCursor', 'setError', body);
  return { state, generation, request, calls,
    run: () => run(state.cursor, false, state.loadingMore, request, generation, AbortController,
      (v) => { state.loadingMore = v; }, api, { category: 'Clothing' },
      (fn) => { state.items = fn(state.items); }, (a, b) => [...a, ...b],
      (v) => { state.cursor = v; }, (v) => { state.error = v; }),
    resolve: (v) => resolve(v), reject: (e) => reject(e),
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('rapid observer events issue only one request for a cursor', async () => {
  const h = harness();
  h.run();
  // React state can still be stale until the next render; the ref must guard it.
  h.state.loadingMore = false;
  h.run();
  assert.equal(h.calls.length, 1);
  h.resolve({ items: [{ id: 'new' }], nextCursor: 'later' });
  await flush();
  assert.deepEqual(h.state.items, [{ id: 'new' }]);
  assert.equal(h.state.cursor, 'later');
  assert.equal(h.request.current, null);
});

test('a late page from a previous filter cannot append items or change the new cursor', async () => {
  const h = harness();
  h.run();
  h.generation.current++;
  h.state.cursor = 'different-category';
  h.resolve({ items: [{ id: 'old-category' }], nextCursor: 'old-cursor' });
  await flush();
  assert.deepEqual(h.state.items, []);
  assert.equal(h.state.cursor, 'different-category');
});

test('aborted or stale failures do not replace the new filter error state', async () => {
  const h = harness();
  h.run();
  h.request.current.abort();
  h.generation.current++;
  h.reject(new Error('old failure'));
  await flush();
  assert.equal(h.state.error, null);
});

test('All deals reveals the second remote page rather than remaining capped at 24', async () => {
  const { nextVisibleCount } = await import('../src/lib/progressiveFeed.js');
  const slice = home.match(/const progressiveDeals = (.*);/)[1];
  const more = home.match(/const hasLocalMore = (.*);/)[1];
  const items = Array.from({ length: 48 }, (_, id) => ({ id }));
  const visibleCount = nextVisibleCount(24, items.length);
  const shown = new Function('exploreDeals', 'visibleCount', 'flatAllMode', 'REMOTE_PAGE_SIZE', `return ${slice}`)(items, visibleCount, true, 24);
  assert.equal(shown.length, 36);
  const hasMore = new Function('exploreDeals', 'visibleCount', 'flatAllMode', 'REMOTE_PAGE_SIZE', `return ${more}`)(items, 48, true, 24);
  assert.equal(hasMore, false);
});
