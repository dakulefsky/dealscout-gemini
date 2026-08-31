const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

function fakeBrowser() {
  const values = new Map();
  const events = [];
  return {
    values,
    events,
    window: {
      localStorage: {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
      },
      dispatchEvent(event) { events.push(event); return true; },
    },
  };
}

test('dismissal helpers broadcast same-tab changes immediately', async () => {
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  const browser = fakeBrowser();
  global.window = browser.window;
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };
  try {
    const moduleUrl = `${pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'feedDismissals.js')).href}?dismiss=${Date.now()}`;
    const dismissals = await import(moduleUrl);
    dismissals.dismissDeal('B000000001', 1000);
    assert.equal(browser.events.at(-1).type, dismissals.DISMISSALS_CHANGED_EVENT);
    assert.equal(browser.events.at(-1).detail.dismissals.B000000001, 1000);
  } finally {
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
});

test('Home removes dismissed inventory before ranking, Deal Drop, chapters and progressive counts', () => {
  assert.match(home, /const \[dismissals, setDismissals\] = useState\(\(\) => loadDismissedDeals\(\)\)/);
  assert.match(home, /const availableDeals = useMemo\(\(\) => deals\.filter\(\(deal\) => !dismissals\[dealIdentity\(deal\)\]\)/);
  assert.match(home, /const list = \[\.\.\.availableDeals\]/);
  assert.match(home, /freshDealDrop\(visibleDeals/);
  assert.match(home, /buildFeedChapters\(visibleDeals/);
});

test('Home reacts to dismissals immediately while server paging owns global filter scope', () => {
  assert.match(home, /addEventListener\(DISMISSALS_CHANGED_EVENT, refresh\)/);
  assert.match(home, /dealsApi\.page\(feedParams/);
  assert.match(home, /filteredPicks/);
  assert.match(home, /availableDeals\.length} loaded/);
});

test('refreshed-since-last-visit cue excludes loaded deals the shopper dismissed', () => {
  assert.match(home, /availableDeals\.filter\(\(deal\) => dealFreshnessTimestampMs\(deal\) > lastVisit\)/);
});
