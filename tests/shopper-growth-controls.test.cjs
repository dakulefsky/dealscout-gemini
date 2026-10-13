const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { mountAdminComponent } = require('./helpers/adminComponentHarness.cjs');

const wrapper = ({ children }) => React.createElement('div', null, children);

test('copy link shares the public URL and clipboard failure selects a manual-copy fallback', async () => {
  const { shareDeal } = await import('../src/lib/shareDeal.js');
  const previousNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  const copied = []; let blocked = false;
  Object.defineProperty(global, 'navigator', { configurable: true, value: { userAgent: 'jsdom test', clipboard: { writeText: async text => { if (blocked) throw new Error('Clipboard denied'); copied.push(text); } } } });
  const page = await mountAdminComponent('src/components/ShareDeal.jsx', {}, { props: { deal: { id: 'B000000001', title: 'Product', sourceVerified: true, status: 'APPROVED', priceCheckAt: Date.now() / 1000, salePrice: 50, originalPrice: 100 } }, mocks: { shareDeal, Dialog: wrapper, DialogContent: wrapper, DialogTitle: wrapper, DialogDescription: wrapper, DialogTrigger: wrapper } });
  try {
    await page.click(page.button('Copy link'));
    assert.equal(copied[0], 'https://dealscouted.com/deal/B000000001');
    await page.click(page.button('Copy deal'));
    assert.match(copied[1], /50% off reference price/);
    blocked = true;
    await page.click(page.button('Copy link'));
    const input = page.container.querySelector('input');
    assert.equal(page.window.document.activeElement, input);
    assert.equal(input.selectionStart, 0);
    assert.equal(input.selectionEnd, input.value.length);
    assert.equal(page.notices.at(-1).title, 'Link selected — copy it');
  } finally { await page.close(); if (previousNavigator) Object.defineProperty(global, 'navigator', previousNavigator); else delete global.navigator; }
});

test('saved-list load failure is explicit and retry restores the real saved list', async () => {
  let failing = true;
  const row = { id: 'B000000001', title: 'Saved product' };
  const page = await mountAdminComponent('src/lib/BookmarksContext.jsx', { bookmarks: { list: async () => { if (failing) throw new Error('Offline'); return { bookmarkIds: [row.id], deals: [row] }; } } }, {
    url: 'https://dealscouted.com/saved', componentName: 'BookmarksProvider', extraExports: ['useBookmarks'],
    renderChildren: exported => {
      const Consumer = () => { const state = exported.useBookmarks(); return React.createElement('section', null, React.createElement('p', { role: 'status' }, state.loadError || `${state.savedDealsList.length} saved`), React.createElement('button', { onClick: state.refreshBookmarks }, 'Retry saved deals')); };
      return React.createElement(Consumer);
    },
  });
  try {
    assert.match(page.container.textContent, /could not be loaded/);
    failing = false;
    await page.click(page.button('Retry saved deals'));
    assert.match(page.container.textContent, /1 saved/);
    assert.doesNotMatch(page.container.textContent, /could not be loaded/);
  } finally { await page.close(); }
});

test('saved page does not claim an empty shortlist when loading failed', async () => {
  let retries = 0;
  const page = await mountAdminComponent('src/pages/SavedDeals.jsx', {}, { mocks: { useBookmarks: () => ({ savedDealsList: [], isLoading: false, loadError: 'Could not load saved deals', refreshBookmarks: () => { retries++; } }), DealCard: wrapper } });
  try {
    assert.match(page.container.querySelector('[role="alert"]').textContent, /Could not load/);
    assert.doesNotMatch(page.container.textContent, /Nothing saved yet/);
    await page.click(page.button('Retry saved deals'));
    assert.equal(retries, 1);
  } finally { await page.close(); }
});
