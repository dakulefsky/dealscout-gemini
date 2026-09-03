const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const apiCore = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js'), 'utf8');
const mobileApi = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'src', 'api.js'), 'utf8');

test('shared shopper client exposes push device registration and disable calls', () => {
  assert.match(apiCore, /const notifications = \{/);
  assert.match(apiCore, /registerDevice: \(expoPushToken, platform\)/);
  assert.match(apiCore, /POST|api\.post/);
  assert.match(apiCore, /notifications\/devices/);
  assert.match(apiCore, /disableDevice: \(expoPushToken\)/);
  assert.match(apiCore, /api\.delete/);
  assert.match(apiCore, /encodeURIComponent\(expoPushToken\)/);
  assert.match(apiCore, /bookmarks, notifications, editorial/);
});

test('native API surface exports notifications from the shared client', () => {
  assert.match(mobileApi, /bookmarks, notifications, auth/);
  assert.doesNotMatch(mobileApi, /fetch\([^)]*notifications/);
});
