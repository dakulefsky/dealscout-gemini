const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiCore = fs.readFileSync(path.join(__dirname, '..', 'src/lib/apiCore.js'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '..', 'server/routes/notifications.js'), 'utf8');
const mobileApi = fs.readFileSync(path.join(__dirname, '..', 'apps/mobile/src/api.js'), 'utf8');

test('shared client registers Expo tokens with the server field names', () => {
  assert.match(apiCore, /registerDevice: \(expoPushToken, platform\) => api\.post\(`\$\{SHOPPER_API\}\/notifications\/devices`, \{ token: expoPushToken, platform \}\)/);
});

test('push disable uses an encoded path parameter supported by the server', () => {
  assert.match(apiCore, /disableDevice: \(expoPushToken\) => api\.delete\(`\$\{SHOPPER_API\}\/notifications\/devices\/\$\{encodeURIComponent\(expoPushToken\)\}`\)/);
  assert.match(route, /router\.delete\('\/devices\/:token'/);
  assert.match(route, /req\.params\?\.token/);
  assert.doesNotMatch(route, /router\.delete\('\/devices',/);
});

test('native app exports the shared notification client', () => {
  assert.match(apiCore, /return \{ api, auth, deals, categories, bookmarks, notifications, editorial, ai, functions \}/);
  assert.match(mobileApi, /export const \{ deals, categories, bookmarks, auth, functions, notifications \} = client/);
});
