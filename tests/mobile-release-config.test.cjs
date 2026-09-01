const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps', 'mobile', 'app.config.js'), 'utf8');

test('mobile dynamic config preserves the checked-in Expo base configuration', () => {
  assert.match(source, /require\('\.\/app\.json'\)\.expo/);
  assert.match(source, /\.\.\.base/);
});

test('EAS identity and public store URLs are injected from release environment', () => {
  assert.match(source, /process\.env\.EAS_PROJECT_ID/);
  assert.match(source, /process\.env\.EXPO_OWNER/);
  assert.match(source, /process\.env\.EXPO_PUBLIC_PRIVACY_URL/);
  assert.match(source, /process\.env\.EXPO_PUBLIC_SUPPORT_URL/);
  assert.match(source, /eas: \{ \.\.\.\(base\.extra\?\.eas \|\| \{\}\), projectId \}/);
});

test('release metadata remains optional for local Expo development', () => {
  assert.match(source, /projectId \? \{ eas:/);
  assert.match(source, /owner \? \{ owner \} : \{\}/);
  assert.match(source, /privacyUrl \? \{ privacyUrl \} : \{\}/);
  assert.match(source, /supportUrl \? \{ supportUrl \} : \{\}/);
});
