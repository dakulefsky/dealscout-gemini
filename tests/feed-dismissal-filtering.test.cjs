const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');


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
