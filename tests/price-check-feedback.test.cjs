const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadFormatter() {
  const source = fs.readFileSync(new URL('../src/lib/priceCheckFeedback.js', `file://${__dirname}/`), 'utf8')
    .replace('export function describePriceCheck', 'function describePriceCheck')
    .concat('\nmodule.exports = { describePriceCheck };');
  const sandbox = { module: { exports: {} }, exports: {}, Date };
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports.describePriceCheck;
}

const describePriceCheck = loadFormatter();

test('summarizes a successful manual price check', () => {
  assert.equal(
    describePriceCheck({ requestedLimit: 25, checkedCount: 25, expiredCount: 2, deferredCount: 1 }),
    '25/25 checked · 2 ended · 1 deferred.'
  );
});

test('explains provider deferral instead of reporting generic success', () => {
  const text = describePriceCheck({
    requestedLimit: 25,
    checkedCount: 6,
    providerDeferred: true,
    providerDeferredReason: 'Rainforest daily budget reached',
  });
  assert.match(text, /^6\/25 checked/);
  assert.match(text, /Rainforest daily budget reached/);
});

test('explains a short run when no more eligible deals exist', () => {
  assert.match(
    describePriceCheck({ requestedLimit: 25, checkedCount: 12 }),
    /No more eligible deals were available/
  );
});
