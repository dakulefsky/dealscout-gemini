const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('authentication hot paths do not use synchronous bcrypt and admin role is revalidated', () => {
  const authRoutes = read('server/routes/auth.js');
  const authMiddleware = read('server/middleware/auth.js');
  const userRepository = read('server/repositories/userRepository.js');

  assert.doesNotMatch(authRoutes, /bcrypt\.(?:hashSync|compareSync)/);
  assert.doesNotMatch(userRepository, /bcrypt\.hashSync/);
  assert.match(authRoutes, /await bcrypt\.compare/);
  assert.match(authRoutes, /await bcrypt\.hash/);
  assert.match(authMiddleware, /const currentUser = await users\.findById\(tokenUser\.id\)/);
  assert.match(authMiddleware, /req\.user\.role !== 'admin'/);
  assert.match(authMiddleware, /requireAuth\(req, res, \(\) => \{/);
});

test('PA-API normalization never invents commercial facts', () => {
  const source = read('server/services/amazonPaapiService.js');
  const forbidden = [
    /salePrice \* 1\.25/,
    /Verified Amazon Customer/,
    /rating[^\n]*4\.7/,
    /ratingsTotal[^\n]*1250/,
    /images\.unsplash\.com/,
    /dealscout-20/,
    /\|\| 'In Stock'/,
    /precision-engineered hardware/,
    /certified manufacturer warranty/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
  assert.match(source, /Missing commerce facts stay/);
  assert.match(source, /reviews: \[\]/);
});

test('client API surface contains no nonexistent lifecycle endpoint', () => {
  const source = `${read('src/lib/api.js')}\n${read('src/lib/apiCore.js')}`;
  assert.doesNotMatch(source, /getLifecycleStats/);
  assert.doesNotMatch(source, /\/api\/deals\/lifecycle-stats/);
});

test('unreachable public auth pages stay removed and backend manifest is only a module boundary', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/pages/Register.jsx')), false);
  assert.equal(fs.existsSync(path.join(root, 'src/pages/ForgotPassword.jsx')), false);
  const serverManifest = JSON.parse(read('server/package.json'));
  assert.deepEqual(serverManifest, { private: true, type: 'commonjs' });
});

test('shared API client bounds requests and supports cancellation', () => {
  const core = read('src/lib/apiCore.js');
  const browser = read('src/lib/api.js');
  assert.match(core, /DEFAULT_TIMEOUT_MS/);
  assert.match(core, /AbortController/);
  assert.match(core, /signal: controller\.signal/);
  assert.match(browser, /globalThis\.crypto\?\.randomUUID/);
  assert.match(browser, /createDealScoutClient/);
});

test('admin dashboard surfaces partial load failures instead of silently treating them as zero', () => {
  const source = read('src/pages/AdminHome.jsx');
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /loadFailures/);
  assert.match(source, /lifecycle\.expiredCount/);
  assert.match(source, /provider\.rainforest\?\.isConfigured/);
});
