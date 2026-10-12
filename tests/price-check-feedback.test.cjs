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

test('manual pauses explain resume rather than promising automatic provider calls', () => {
  const text = describePriceCheck({ checkedCount: 1, verifiedCount: 0, providerDeferred: true,
    providerDeferredReason: 'PROVIDER_PAUSED', providerRetryAt: 1791800000 });
  assert.match(text, /0 verified/);
  assert.match(text, /Provider API paused; resume it to continue/);
  assert.doesNotMatch(text, /PROVIDER_PAUSED|retry after/);
});

test('provider retry timestamps accept Unix seconds returned by maintenance', () => {
  const at = 1791800000;
  const text = describePriceCheck({ providerDeferred: true,
    providerDeferredReason: 'PROVIDER_BUDGET_EXCEEDED', providerRetryAt: at });
  assert.ok(text.includes(`Provider allowance reached; retry after ${new Date(at * 1000).toLocaleString()}`));
});

test('checks superseded by manual edits are distinguished from saved verifications', () => {
  const text = describePriceCheck({ checkedCount: 3, verifiedCount: 2, supersededCount: 1 });
  assert.match(text, /3 checked · 2 verified · 1 skipped after manual changes/);
});
