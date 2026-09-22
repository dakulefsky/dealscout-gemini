const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAdminWebUrl } = require('../server/services/mailService');

test('admin reset links prefer the private admin origin', () => {
  assert.equal(resolveAdminWebUrl({
    NODE_ENV: 'production',
    ADMIN_WEB_URL: 'https://private-admin.example/path',
    PUBLIC_WEB_URL: 'https://dealscouted.com',
  }), 'https://private-admin.example');
});

test('admin reset origin falls back to public origin for legacy single-service deployments', () => {
  assert.equal(resolveAdminWebUrl({
    NODE_ENV: 'production',
    PUBLIC_WEB_URL: 'https://dealscouted.com',
  }), 'https://dealscouted.com');
});

test('production admin reset origin must use HTTPS', () => {
  assert.throws(() => resolveAdminWebUrl({
    NODE_ENV: 'production',
    ADMIN_WEB_URL: 'http://private-admin.example',
  }), /HTTPS/);
});
