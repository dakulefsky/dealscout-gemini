const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const authRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'auth.js'), 'utf8');
const authMiddleware = fs.readFileSync(path.join(root, 'server', 'middleware', 'auth.js'), 'utf8');
const userRepository = fs.readFileSync(path.join(root, 'server', 'repositories', 'userRepository.js'), 'utf8');
const bookmarksRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'bookmarks.js'), 'utf8');

test('users persist a backwards-compatible token version', () => {
  assert.match(userRepository, /token_version INTEGER NOT NULL DEFAULT 0/);
  assert.match(userRepository, /ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0/);
  assert.match(userRepository, /'token_version'/);
});

test('new JWTs carry the current account auth version', () => {
  assert.match(authRoute, /authVersion: Number\(user\.token_version \|\| 0\)/);
});

test('password reset invalidates every previously issued JWT for the account', () => {
  assert.match(authRoute, /token_version: Number\(user\.token_version \|\| 0\) \+ 1/);
  assert.match(authRoute, /password: await bcrypt\.hash\(newPassword, 12\)/);
});

test('authenticated middleware resolves current account state and rejects stale token versions', () => {
  assert.match(authMiddleware, /async function resolveCurrentUser\(tokenUser\)/);
  assert.match(authMiddleware, /tokenVersionOf\(tokenUser\.authVersion\) !== tokenVersionOf\(currentUser\.token_version\)/);
  assert.match(authMiddleware, /const currentUser = await resolveCurrentUser\(tokenUser\)/);
  assert.match(authMiddleware, /req\.user = currentUser/);
  assert.doesNotMatch(authMiddleware, /req\.user = user;\s*next\(\);/);
});

test('admin authorization uses the same current-user session boundary', () => {
  assert.match(authMiddleware, /requireAuth\(req, res, \(\) => \{/);
  assert.match(authMiddleware, /req\.user\.role !== 'admin'/);
  assert.match(authMiddleware, /!req\.user\.verified/);
});

test('bookmark bearer identities also reject revoked account sessions', () => {
  assert.match(bookmarksRoute, /const tokenVersion = Number\(decoded\.authVersion \|\| 0\)/);
  assert.match(bookmarksRoute, /const currentVersion = Number\(user\?\.token_version \|\| 0\)/);
  assert.match(bookmarksRoute, /user && tokenVersion === currentVersion/);
});
