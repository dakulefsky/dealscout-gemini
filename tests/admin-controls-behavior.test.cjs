const test = require('node:test');
const assert = require('node:assert/strict');
const { mountAdminComponent, deferred, act } = require('./helpers/adminComponentHarness.cjs');

const deal = (asin = 'B000000001', extra = {}) => ({ id: asin, asin, title: asin, status: 'PENDING_REVIEW', sourceVerified: true, salePrice: 50, originalPrice: 100, imageUrl: '', ...extra });
const calendar = location => ({ location, title: location, schedule: 'Saved schedule', timezone: 'UTC', upcoming: [], status: { closed: false } });

test('all dashboard action controls call their intended APIs and disclosure sections open', async () => {
  const calls = [];
  const functions = Object.fromEntries(['providerStatus', 'integrityHealth', 'publicationHealth'].map(name => [name, async () => ({})]));
  Object.assign(functions, { channelSettings: async () => ({ whatsappStatus: { enabled: true } }), legacyEnrichmentPreview: async () => ({ candidates: 1 }), adminActivity: async () => ({ activity: [] }) });
  for (const name of ['fetchDeals', 'verifyPrices', 'repairImages', 'cleanupLegacyEnrichment', 'setWhatsAppStatusEnabled']) functions[name] = async (...args) => { calls.push([name, ...args]); return { created: 1 }; };
  const page = await mountAdminComponent('src/pages/AdminHome.jsx', { functions, deals: { getStats: async () => ({ pendingCount: 2 }) } });
  try {
    const section = page.container.querySelector('details');
    assert.equal(section.open, false);
    await page.click(section.querySelector('summary'));
    assert.equal(section.open, true);
    for (const label of ['Pull deals now', 'Check up to 6 prices', 'Repair images', 'Clean 1 known legacy row', 'Pause Status publishing']) await page.click(page.button(label));
    assert.deepEqual(calls, [['fetchDeals', 15, true], ['verifyPrices', 6], ['repairImages', 3], ['cleanupLegacyEnrichment'], ['setWhatsAppStatusEnabled', false]]);
    assert.equal(page.container.querySelector('a[href="/admin/deals"]') !== null, true);
    assert.equal(page.container.querySelector('a[href="/admin/editorial"]') !== null, true);
    await page.click(page.button('Refresh'));
  } finally { await page.close(); }
});

test('provider pause/resume and closure-location controls persist returned state and reject double clicks', async () => {
  const calls = []; let enabled = true; const pending = deferred();
  const page = await mountAdminComponent('src/components/AdminOperationsControls.jsx', { functions: {
    channelSettings: async () => ({ providerApi: { enabled } }), jewishCalendar: async () => calendar('jerusalem'),
    setProviderApiEnabled: async value => { calls.push(['api', value]); enabled = value; if (!value) await pending.promise; return { providerApi: { enabled: value } }; },
    setJewishCalendarLocation: async value => { calls.push(['calendar', value]); return calendar(value); },
  } });
  try {
    const pause = page.button('Pause provider API');
    await act(async () => { pause.click(); pause.click(); });
    assert.deepEqual(calls, [['api', false]]);
    await act(async () => pending.resolve());
    await page.click(page.button('Resume provider API'));
    await page.click(page.button('New York'));
    await page.click(page.button('Jerusalem'));
    assert.deepEqual(calls, [['api', false], ['api', true], ['calendar', 'new_york'], ['calendar', 'jerusalem']]);
  } finally { await page.close(); }
});

test('failed operational settings expose retry and do not pretend to be loaded', async () => {
  let failing = true;
  const page = await mountAdminComponent('src/components/AdminOperationsControls.jsx', { functions: {
    channelSettings: async () => { if (failing) throw new Error('offline'); return { providerApi: { enabled: false } }; },
    jewishCalendar: async () => { if (failing) throw new Error('offline'); return calendar('new_york'); },
  } });
  try {
    assert.equal(page.button('Provider API unavailable').disabled, true);
    assert.equal(page.button('New York').disabled, true);
    assert.match(page.container.textContent, /UNAVAILABLE/);
    failing = false;
    await page.click(page.button('Retry operational settings'));
    assert.equal(page.button('Resume provider API').disabled, false);
    assert.equal(page.button('New York').disabled, false);
  } finally { await page.close(); }
});

for (const [file, get, set, retry, save, snapshot] of [
  ['src/components/admin/SearchVisibilitySettings.jsx', 'seoSettings', 'setSeoVerificationToken', 'Retry verification settings', 'Save verification tag', { token: 'existing-token' }],
  ['src/components/admin/AmazonSeasonalPromotionSettings.jsx', 'amazonSeasonalPromotion', 'setAmazonPrimeDayDates', 'Retry promotion settings', 'Save dates', { primeDayStart: '2026-10-13', primeDayEnd: '2026-10-14' }],
]) test(`${save} cannot erase unloaded settings and can retry and save successfully`, async () => {
  let failing = true; const calls = []; const pending = deferred();
  const page = await mountAdminComponent(file, { functions: {
    [get]: async () => { if (failing) throw new Error('offline'); return snapshot; },
    [set]: async (...values) => { calls.push(values); await pending.promise; return snapshot; },
  } });
  try {
    assert.equal(page.button(save).disabled, true);
    await page.submit(page.container.querySelector('form'));
    assert.equal(calls.length, 0);
    failing = false;
    await page.click(page.button(retry));
    assert.equal(page.container.querySelector('input').value, Object.values(snapshot)[0]);
    const form = page.container.querySelector('form');
    await act(async () => { form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true })); });
    assert.deepEqual(calls, [Object.values(snapshot)]);
    await act(async () => pending.resolve());
    assert.equal(page.button(save).disabled, false);
  } finally { await page.close(); }
});

function reviewApi(rows, calls = []) { return {
  deals: { list: async params => { calls.push(['list', params]); return rows; }, update: async (asin, values) => { calls.push(['update', asin, values]); return { ...rows[0], ...values }; }, delete: async asin => calls.push(['delete', asin]) },
  editorial: { batch: async () => ({ byAsin: {} }), save: async (asin, values) => { calls.push(['editorial', asin, values]); return { asin, ...values }; } },
}; }

test('review, rejection, ended and picks filters request the whole matching catalog on the server', async () => {
  const calls = []; const page = await mountAdminComponent('src/pages/EditorialReview.jsx', reviewApi([], calls));
  try {
    for (const label of ['Rejected', 'Ended', 'DealScout Picks', 'All catalog']) await page.click(page.button(label));
    assert.deepEqual(calls.filter(call => call[0] === 'list').map(call => call[1]), [
      { limit: 100, offset: 0, q: undefined, status: 'PENDING_REVIEW' },
      { limit: 100, offset: 0, q: undefined, status: 'REJECTED' },
      { limit: 100, offset: 0, q: undefined, ended: '1' },
      { limit: 100, offset: 0, q: undefined, humanPick: '1' },
      { limit: 100, offset: 0, q: undefined },
    ]);
  } finally { await page.close(); }
});

test('unverified pending deals can be rejected without editorial approval', async () => {
  const calls = []; const page = await mountAdminComponent('src/pages/EditorialReview.jsx', reviewApi([deal(undefined, { sourceVerified: false })], calls));
  try {
    await page.click(page.button('Reject'));
    assert.equal(calls.some(call => call[0] === 'editorial'), false);
    assert.deepEqual(calls.find(call => call[0] === 'update'), ['update', 'B000000001', { status: 'REJECTED' }]);
    assert.equal(page.button('Reject'), undefined);
  } finally { await page.close(); }
});

for (const [label, pick, publish] of [['Publish Normally', false, true], ['Publish as Pick', true, true], ['Save for Later', false, false]]) test(`${label} sends the intended review decision`, async () => {
  const calls = []; const page = await mountAdminComponent('src/pages/EditorialReview.jsx', reviewApi([deal()], calls));
  try {
    await page.click(page.button(label));
    assert.deepEqual(calls.find(call => call[0] === 'editorial'), ['editorial', 'B000000001', { editorialNote: '', isHumanPick: pick }]);
    assert.equal(calls.some(call => call[0] === 'update'), publish);
    if (publish) assert.equal(page.button(label), undefined);
  } finally { await page.close(); }
});

test('permanent removal requires confirmation and deletes only the selected deal', async () => {
  const calls = []; const page = await mountAdminComponent('src/pages/EditorialReview.jsx', reviewApi([deal()], calls));
  try {
    page.window.confirm = () => false;
    await page.click(page.button('Remove Permanently'));
    assert.equal(calls.some(call => call[0] === 'delete'), false);
    page.window.confirm = () => true;
    await page.click(page.button('Remove Permanently'));
    assert.deepEqual(calls.find(call => call[0] === 'delete'), ['delete', 'B000000001']);
  } finally { await page.close(); }
});

test('catalog navigation defaults to all deals and load more retrieves beyond the first 100', async () => {
  const calls = []; const rows = Array.from({ length: 100 }, (_, index) => deal(`B${String(index).padStart(9, '0')}`));
  const api = reviewApi(rows, calls);
  api.deals.list = async params => { calls.push(params); return params.offset ? [deal('B999999999')] : rows; };
  const page = await mountAdminComponent('src/pages/EditorialReview.jsx', api, { pathname: '/admin/deals' });
  try {
    assert.equal(page.button('All catalog').getAttribute('aria-pressed'), 'true');
    await page.click(page.button('Load more deals'));
    assert.deepEqual(calls, [{ limit: 100, offset: 0, q: undefined }, { limit: 100, offset: 100, q: undefined }]);
    assert.match(page.container.textContent, /B999999999/);
  } finally { await page.close(); }
});

test('manual import verifies once, enters review and keeps failed or duplicate input available', async () => {
  const calls = []; const pending = deferred(); let fail = false; let duplicate = false;
  const page = await mountAdminComponent('src/components/admin/AddDealCard.jsx', { functions: { siteStripeImport: async (...args) => {
    calls.push(args); await pending.promise; if (fail) throw new Error('Provider allowance reached'); return { alreadyExists: duplicate };
  } } });
  try {
    const input = page.container.querySelector('input');
    await page.change(input, 'B000000001');
    assert.equal(page.button('Verify & add').disabled, false);
    const form = page.container.querySelector('form');
    await act(async () => { form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true })); });
    assert.deepEqual(calls, [['B000000001', false]]);
    await act(async () => pending.resolve());
    assert.equal(input.value, '');
    fail = true;
    await page.change(input, 'B000000002');
    await page.submit(form);
    assert.equal(input.value, 'B000000002');
    assert.equal(page.notices.at(-1).variant, 'destructive');
    fail = false; duplicate = true;
    await page.submit(form);
    assert.equal(input.value, 'B000000002');
    assert.equal(page.notices.at(-1).title, 'Deal already exists');
  } finally { await page.close(); }
});

test('late catalog responses cannot overwrite a newer filter and errors offer retry', async () => {
  const stale = deferred(); let request = 0; let fail = false;
  const api = reviewApi([]);
  api.deals.list = async () => { if (++request === 1) return stale.promise; if (fail) throw new Error('Catalog unavailable'); return [deal('B000000002', { status: 'REJECTED' })]; };
  const page = await mountAdminComponent('src/pages/EditorialReview.jsx', api);
  try {
    await page.click(page.button('Rejected'));
    assert.match(page.container.textContent, /B000000002/);
    await act(async () => stale.resolve([deal('B000000001')]));
    assert.doesNotMatch(page.container.textContent, /B000000001/);
    fail = true;
    await page.click(page.button('All catalog'));
    assert.match(page.container.querySelector('[role="alert"]').textContent, /Catalog unavailable/);
    fail = false;
    await page.click(page.button('Retry catalog'));
    assert.match(page.container.textContent, /B000000002/);
  } finally { await page.close(); }
});

test('search respects the selected filter and requests the entered title or ASIN', async () => {
  const calls = []; const page = await mountAdminComponent('src/pages/EditorialReview.jsx', reviewApi([], calls));
  try {
    await page.change(page.container.querySelector('input'), '  headphones  ');
    await page.flush(270);
    assert.deepEqual(calls.at(-1), ['list', { limit: 100, offset: 0, q: 'headphones', status: 'PENDING_REVIEW' }]);
  } finally { await page.close(); }
});

test('simultaneous review actions on different rows cannot overlap', async () => {
  const pending = deferred(); const calls = []; const api = reviewApi([deal(), deal('B000000002')], calls);
  api.editorial.save = async (...args) => { calls.push(['editorial', ...args]); await pending.promise; return { ...args[1] }; };
  const page = await mountAdminComponent('src/pages/EditorialReview.jsx', api);
  try {
    const buttons = [...page.container.querySelectorAll('button')].filter(button => button.textContent.trim() === 'Publish Normally');
    await act(async () => { buttons[0].click(); buttons[1].click(); });
    assert.equal(calls.filter(call => call[0] === 'editorial').length, 1);
    assert.equal(page.button('Rejected').disabled, true);
    await act(async () => pending.resolve());
    assert.equal(calls.filter(call => call[0] === 'update').length, 1);
  } finally { await page.close(); }
});

test('existing pick can be updated or removed without changing its approval status', async () => {
  const calls = []; const row = deal(undefined, { status: 'APPROVED' }); const api = reviewApi([row], calls);
  api.editorial.batch = async () => ({ byAsin: { [row.asin]: { isHumanPick: true, editorialNote: 'Current note' } } });
  const page = await mountAdminComponent('src/pages/EditorialReview.jsx', api, { pathname: '/admin/deals' });
  try {
    await page.click(page.button('Update Pick'));
    await page.click(page.button('Remove Pick'));
    assert.deepEqual(calls.filter(call => call[0] === 'editorial').map(call => call[2]), [{ editorialNote: 'Current note', isHumanPick: true }, { editorialNote: 'Current note', isHumanPick: false }]);
    assert.equal(calls.some(call => call[0] === 'update'), false);
    assert.ok(page.button('Make DealScout Pick'));
  } finally { await page.close(); }
});
