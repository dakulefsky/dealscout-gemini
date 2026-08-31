const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { securityHeaders, contentSecurityPolicy } = require('../server/middleware/securityBaseline');
const seo = require('../server/services/seoService');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function withNodeEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try { return fn(); }
  finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test('production CSP uses a nonce and keeps executable inline scripts blocked', () => {
  withNodeEnv('production', () => {
    const headers = {};
    const res = {
      locals: {},
      setHeader(name, value) { headers[name] = value; },
    };
    let nextCalled = false;
    securityHeaders({}, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.match(res.locals.cspNonce, /^[A-Za-z0-9+/]+=*$/);
    assert.equal(headers['Content-Security-Policy'], contentSecurityPolicy(res.locals.cspNonce));
    assert.match(headers['Content-Security-Policy'], new RegExp(`script-src 'self' 'nonce-${res.locals.cspNonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    assert.doesNotMatch(headers['Content-Security-Policy'], /script-src[^;]*'unsafe-inline'/);
    assert.match(headers['Content-Security-Policy'], /https:\/\/fonts\.googleapis\.com/);
    assert.match(headers['Content-Security-Policy'], /img-src 'self' data: blob: https:/);
  });
});

test('development does not install a CSP that would interfere with Vite HMR', () => {
  withNodeEnv('development', () => {
    const headers = {};
    const res = { locals: {}, setHeader(name, value) { headers[name] = value; } };
    securityHeaders({}, res, () => {});
    assert.equal(headers['Content-Security-Policy'], undefined);
    assert.equal(res.locals.cspNonce, undefined);
  });
});

test('server-rendered JSON-LD receives the request CSP nonce', () => {
  const html = '<html><head><title>Old</title><meta name="description" content="old" /></head><body></body></html>';
  const rendered = seo.replaceMeta(html, {
    title: 'Deal',
    description: 'Description',
    canonical: 'https://example.com/deal/B000000001',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Product', name: 'Deal' },
    nonce: 'abc123',
  });
  assert.match(rendered, /<script nonce="abc123" type="application\/ld\+json">/);
  assert.match(server, /seo\.replaceMeta\(indexTemplate, \{ \.\.\.meta, nonce: res\.locals\.cspNonce \}\)/);
});
