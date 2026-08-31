const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { resolveTrustProxy, MAX_TRUSTED_PROXY_HOPS } = require('../server/config/trustProxy');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('proxy trust defaults preserve direct development and one-hop production behavior', () => {
  assert.equal(resolveTrustProxy(undefined, { isProduction: false }), false);
  assert.equal(resolveTrustProxy(undefined, { isProduction: true }), 1);
});

test('proxy trust accepts only explicit bounded hop counts or off values', () => {
  assert.equal(resolveTrustProxy('0', { isProduction: true }), false);
  assert.equal(resolveTrustProxy('off', { isProduction: true }), false);
  assert.equal(resolveTrustProxy('2', { isProduction: true }), 2);
  assert.equal(MAX_TRUSTED_PROXY_HOPS, 5);
  assert.throws(() => resolveTrustProxy('true', { isProduction: true }), /hop count/);
  assert.throws(() => resolveTrustProxy('6', { isProduction: true }), /hop count/);
  assert.throws(() => resolveTrustProxy('loopback', { isProduction: true }), /hop count/);
});

test('server applies the resolved trust value instead of a hard-coded proxy setting', () => {
  assert.match(server, /resolveTrustProxy\(process\.env\.TRUST_PROXY, \{ isProduction \}\)/);
  assert.match(server, /if \(trustProxy !== false\) app\.set\('trust proxy', trustProxy\)/);
  assert.doesNotMatch(server, /if \(isProduction\) app\.set\('trust proxy', 1\)/);
});
