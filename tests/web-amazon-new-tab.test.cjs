const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const detail = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');

test('web Amazon CTA uses native links without a blank popup', () => {
  assert.equal((detail.match(/href=\{amazonHref\} target="_blank" rel="noopener noreferrer"/g) || []).length, 2);
  assert.doesNotMatch(detail, /window\.open|about:blank|amazonTab/);
  assert.match(detail, /encodeURIComponent\(deal\?\.productUrl/);
});
