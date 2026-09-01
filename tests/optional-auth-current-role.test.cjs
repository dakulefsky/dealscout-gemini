const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const users = require('../server/repositories/userRepository');

const SECRET = 'test-secret-that-is-longer-than-32-characters';
const originalSecret = process.env.JWT_SECRET;
const originalFindById = users.findById;

function loadAuth() {
  process.env.JWT_SECRET = SECRET;
  const path = require.resolve('../server/middleware/auth');
  delete require.cache[path];
  return require('../server/middleware/auth');
}

function runOptional(optionalAuth, req) {
  return new Promise((resolve) => optionalAuth(req, {}, resolve));
}

test.afterEach(() => {
  users.findById = originalFindById;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  delete require.cache[require.resolve('../server/middleware/auth')];
});

test('optional auth uses the current stored role instead of a stale JWT role', async () => {
  users.findById = async () => ({ id: 'user-1', email: 'user@example.com', role: 'user', verified: 1 });
  const { optionalAuth } = loadAuth();
  const token = jwt.sign({ id: 'user-1', email: 'old@example.com', role: 'admin' }, SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };

  await runOptional(optionalAuth, req);

  assert.equal(req.user.role, 'user');
  assert.equal(req.user.email, 'user@example.com');
});

test('optional auth fails closed when the token user no longer exists', async () => {
  users.findById = async () => null;
  const { optionalAuth } = loadAuth();
  const token = jwt.sign({ id: 'missing', role: 'admin' }, SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };

  await runOptional(optionalAuth, req);

  assert.equal(req.user, null);
});
