const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  resolvePublicWebUrl,
  resolveCorsOrigins,
  createCorsOriginPolicy,
} = require('../server/config/publicSurface');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const mailSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'mailService.js'), 'utf8');

function evaluateOrigin(policy, origin) {
  return new Promise((resolve, reject) => {
    policy(origin, (error, allowed) => error ? reject(error) : resolve(allowed));
  });
}

test('public website URL is separate from browser CORS origins with legacy fallback', () => {
  const env = {
    PUBLIC_WEB_URL: 'https://www.deals.example/path-ignored',
    CORS_ORIGINS: 'https://www.deals.example, https://admin.deals.example,https://www.deals.example',
  };
  assert.equal(resolvePublicWebUrl(env, { isProduction: true }), 'https://www.deals.example');
  assert.deepEqual(resolveCorsOrigins(env, { isProduction: true }), [
    'https://www.deals.example',
    'https://admin.deals.example',
  ]);
  assert.equal(resolvePublicWebUrl({ FRONTEND_URL: 'https://legacy.example' }, { isProduction: true }), 'https://legacy.example');
});

test('production origins fail closed on insecure or malformed browser origins', () => {
  assert.throws(() => resolvePublicWebUrl({ PUBLIC_WEB_URL: 'http://example.com' }, { isProduction: true }), /https/);
  assert.throws(() => resolveCorsOrigins({ CORS_ORIGINS: 'https://good.example,not-a-url' }, { isProduction: true }), /Invalid absolute URL/);
});

test('production CORS allows configured browser origins and originless native/server clients', async () => {
  const policy = createCorsOriginPolicy(['https://web.example', 'https://admin.example'], { isProduction: true });
  assert.equal(await evaluateOrigin(policy, 'https://web.example'), true);
  assert.equal(await evaluateOrigin(policy, 'https://unknown.example'), false);
  assert.equal(await evaluateOrigin(policy, undefined), true);
});

test('server and password reset links use the split public-surface configuration', () => {
  assert.match(serverSource, /resolvePublicWebUrl/);
  assert.match(serverSource, /resolveCorsOrigins/);
  assert.match(serverSource, /createCorsOriginPolicy/);
  assert.match(serverSource, /seo\.siteBase\(req, publicWebUrl\)/);
  assert.match(mailSource, /resolvePublicWebUrl/);
  assert.doesNotMatch(mailSource, /process\.env\.FRONTEND_URL/);
});
