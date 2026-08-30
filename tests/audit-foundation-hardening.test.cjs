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
  assert.match(authMiddleware, /await users\.findById\(req\.user\.id\)/);
  assert.match(authMiddleware, /currentUser\.role !== 'admin'/);
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
  const source = read('src/lib/api.js');
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
  const source = read('src/lib/api.js');
  assert.match(source, /DEFAULT_TIMEOUT_MS/);
  assert.match(source, /AbortController/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /crypto\?\.randomUUID|crypto\.randomUUID|globalThis\.crypto\?\.randomUUID/);
});

test('admin dashboard surfaces partial load failures instead of silently treating them as zero', () => {
  const source = read('src/pages/AdminHome.jsx');
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /loadFailures/);
  assert.match(source, /lifecycle\.expiredCount/);
  assert.match(source, /provider\.rainforest\?\.isConfigured/);
});
