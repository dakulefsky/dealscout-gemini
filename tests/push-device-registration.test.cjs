const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const db = fs.readFileSync(path.join(__dirname, '..', 'server', 'db.js'), 'utf8');
const repository = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'pushDeviceRepository.js'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'notifications.js'), 'utf8');
const shopperApi = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'shopperApi.js'), 'utf8');

test('push devices are durable in PostgreSQL with a development fallback', () => {
  assert.match(db, /push_devices: \[\]/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS push_devices/);
  assert.match(repository, /expo_push_token TEXT NOT NULL UNIQUE/);
  assert.match(repository, /idx_push_devices_user_enabled/);
  assert.match(repository, /db\.tables\.push_devices/);
});

test('device registration shares the existing guest and authenticated identity boundary', () => {
  assert.match(route, /x-guest-id/);
  assert.match(route, /jwt\.verify/);
  assert.match(route, /tokenVersion === currentVersion/);
  assert.match(route, /A valid user or guest identity is required/);
});

test('notification device API validates Expo tokens and platform before persistence', () => {
  assert.match(route, /ExponentPushToken\|ExpoPushToken/);
  assert.match(route, /new Set\(\['ios', 'android'\]\)/);
  assert.match(route, /router\.post\('\/devices'/);
  assert.match(route, /pushDevices\.upsertDevice/);
  assert.match(route, /router\.delete\('\/devices'/);
  assert.match(route, /pushDevices\.disableDevice/);
  assert.match(shopperApi, /router\.use\('\/notifications', require\('\.\/notifications'\)\)/);
});
