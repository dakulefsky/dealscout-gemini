const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile guest IDs satisfy the backend identity contract and migrate legacy UUIDs', () => {
  const mobileApi = read('apps/mobile/src/api.js');
  const identity = read('server/services/clientIdentityService.js');

  assert.match(identity, /\^guest_/);
  assert.match(mobileApi, /`guest_\$\{Crypto\.randomUUID\(\)\}`/);
  assert.match(mobileApi, /LEGACY_UUID_RE/);
  assert.match(mobileApi, /persistGuestId\(`guest_\$\{existing\}`\)/);
  assert.match(mobileApi, /GUEST_ID_RE\.test\(existing\)/);
});
