const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'apps/mobile/src/amazonUrl.js'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'apps/mobile/app/deal/[id].jsx'), 'utf8');

function makeValidator() {
  const source = helper
    .replace('export function isAmazonOwnedUrl', 'function isAmazonOwnedUrl')
    + '\nmodule.exports = { isAmazonOwnedUrl };';
  const module = { exports: {} };
  new Function('module', 'exports', source)(module, module.exports);
  return module.exports.isAmazonOwnedUrl;
}

test('mobile Amazon URL boundary only accepts HTTPS Amazon-owned hosts', () => {
  const isAmazonOwnedUrl = makeValidator();
  assert.equal(isAmazonOwnedUrl('https://www.amazon.com/dp/B012345678'), true);
  assert.equal(isAmazonOwnedUrl('https://smile.amazon.co.uk/dp/B012345678'), true);
  assert.equal(isAmazonOwnedUrl('https://amzn.to/example'), true);
  assert.equal(isAmazonOwnedUrl('https://a.co/example'), true);

  assert.equal(isAmazonOwnedUrl('http://amazon.com/dp/B012345678'), false);
  assert.equal(isAmazonOwnedUrl('https://amazon.com.evil.example/dp/B012345678'), false);
  assert.equal(isAmazonOwnedUrl('https://evil-amazon.com/dp/B012345678'), false);
  assert.equal(isAmazonOwnedUrl('https://user:pass@amazon.com/dp/B012345678'), false);
  assert.equal(isAmazonOwnedUrl('javascript:alert(1)'), false);
  assert.equal(isAmazonOwnedUrl('not a url'), false);
});

test('native deal detail validates stored product URLs before opening them', () => {
  assert.match(detail, /import \{ isAmazonOwnedUrl \} from '\.\.\/\.\.\/src\/amazonUrl';/);
  assert.match(detail, /if \(!isAmazonOwnedUrl\(url\)\) return;/);
  assert.match(detail, /Linking\.canOpenURL\(url\)/);
  assert.match(detail, /Linking\.openURL\(url\)/);
  assert.doesNotMatch(detail, /\^https:\\\/\\\//);
});
