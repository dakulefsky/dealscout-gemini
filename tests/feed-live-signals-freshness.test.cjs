const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const homeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

function fakeBrowser() {
  const values = new Map();
  const events = [];
  return {
    events,
    window: {
      localStorage: {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
      },
      dispatchEvent(event) { events.push(event); return true; },
      addEventListener() {},
      removeEventListener() {},
    },
  };
}

test('same-tab personalization changes dispatch an immediate browser event', async () => {
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  const browser = fakeBrowser();
  global.window = browser.window;
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };
  try {
    const moduleUrl = `${pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'feedPersonalization.js')).href}?live=${Date.now()}`;
    const personalization = await import(moduleUrl);
    personalization.addCategoryInterest('Audio', 4);
    assert.equal(browser.events.at(-1).type, personalization.INTERESTS_CHANGED_EVENT);
    assert.equal(browser.events.at(-1).detail.interests.audio, 4);
  } finally {
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
});

test('Home listens for same-tab interest events instead of polling every four seconds', () => {
  assert.match(homeSource, /addEventListener\(INTERESTS_CHANGED_EVENT, refresh\)/);
  assert.doesNotMatch(homeSource, /setInterval\(refresh, 4000\)/);
});

test('Deal Drop prefers unseen deals only within a bounded quality lookahead and fills with strong seen deals', async () => {
  const moduleUrl = `${pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'dealDropFreshness.js')).href}?fresh=${Date.now()}`;
  const { freshDealDrop } = await import(moduleUrl);
  const deals = Array.from({ length: 30 }, (_, index) => ({ id: `deal-${index + 1}` }));
  const seen = Object.fromEntries(deals.slice(0, 8).map((deal) => [deal.id, 1]));
  const drop = freshDealDrop(deals, seen, 8, 12);

  assert.deepEqual(drop.map((deal) => deal.id), [
    'deal-9', 'deal-10', 'deal-11', 'deal-12',
    'deal-1', 'deal-2', 'deal-3', 'deal-4',
  ]);
  assert.equal(drop.some((deal) => deal.id === 'deal-13'), false);
});

test('Deal Drop seen memory expires after seven days', async () => {
  const previousWindow = global.window;
  const browser = fakeBrowser();
  global.window = browser.window;
  try {
    const moduleUrl = `${pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'dealDropFreshness.js')).href}?ttl=${Date.now()}`;
    const freshness = await import(moduleUrl);
    const now = 2_000_000_000_000;
    browser.window.localStorage.setItem(freshness.SEEN_KEY, JSON.stringify({
      recent: now - freshness.SEEN_TTL_MS + 1,
      expired: now - freshness.SEEN_TTL_MS - 1,
    }));
    const loaded = freshness.loadSeenDealDrop(now);
    assert.deepEqual(loaded, { recent: now - freshness.SEEN_TTL_MS + 1 });
  } finally {
    global.window = previousWindow;
  }
});

test('Home only marks the balanced Deal Drop as seen after its marker enters the viewport', () => {
  assert.match(homeSource, /const \[initialSeenDrop\] = useState\(\(\) => loadSeenDealDrop\(\)\)/);
  assert.match(homeSource, /balancedFeatured\(freshDealDrop\(visibleDeals, initialSeenDrop, 8\), 8\)/);
  assert.match(homeSource, /markDealDropSeen\(dropDeals\)/);
  assert.match(homeSource, /dealDropMarked\.current = true/);
  assert.match(homeSource, /Today’s best finds/);
});
