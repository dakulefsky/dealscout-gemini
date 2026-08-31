const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const mobilePackage = JSON.parse(read('apps/mobile/package.json'));
const appConfig = JSON.parse(read('apps/mobile/app.json'));
const eas = JSON.parse(read('apps/mobile/eas.json'));
const home = read('apps/mobile/app/index.jsx');
const detail = read('apps/mobile/app/deal/[id].jsx');
const saved = read('apps/mobile/app/saved.jsx');
const api = read('apps/mobile/src/api.js');

test('native app targets the current Expo 57 / React Native 0.86 baseline', () => {
  assert.match(mobilePackage.dependencies.expo, /^~57\./);
  assert.match(mobilePackage.dependencies['react-native'], /^0\.86\./);
  assert.equal(appConfig.expo.name, 'DealScout');
  assert.equal(appConfig.expo.scheme, 'dealscout');
});

test('native app consumes the shared platform-neutral shopper client instead of copying API logic', () => {
  assert.match(api, /createDealScoutClient/);
  assert.match(api, /\.\.\/\.\.\/\.\.\/src\/lib\/apiCore/);
  assert.match(api, /expo-secure-store/);
  assert.match(api, /Crypto\.randomUUID\(\)/);
  assert.match(api, /EXPO_PUBLIC_API_URL/);
  assert.match(api, /must use HTTPS outside local development/);
});

test('native home mirrors the core website deal experience', () => {
  assert.match(home, /Good deals\. No digging\./);
  assert.match(home, /Freshly checked/);
  assert.match(home, /Today’s best finds/);
  assert.match(home, /balancedFeatured/);
  assert.match(home, /deals\.page/);
  assert.match(home, /nextCursor/);
  assert.match(home, /bookmarks\.toggle/);
  assert.match(home, /Search deals/);
});

test('native app includes the same deal-detail and saved-deals shopper loop', () => {
  assert.match(detail, /deals\.get/);
  assert.match(detail, /bookmarks\.toggle/);
  assert.match(detail, /Linking\.openURL/);
  assert.match(detail, /Price and availability can change on Amazon/);
  assert.match(saved, /bookmarks\.list/);
  assert.match(saved, /result\?\.deals/);
});

test('native deployment has production EAS profiles without exposing admin surfaces', () => {
  assert.ok(eas.build.production);
  assert.equal(eas.build.production.autoIncrement, true);
  assert.doesNotMatch(home + detail + saved, /AdminHome|provider-status|integrity-health|publication-health/);
});
