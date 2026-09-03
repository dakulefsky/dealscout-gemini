const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const detail = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');

test('web Amazon CTA keeps DealScout open and resolves affiliate URL into a new tab', () => {
  assert.match(detail, /window\.open\('about:blank', '_blank'\)/);
  assert.match(detail, /amazonTab\.opener = null/);
  assert.match(detail, /amazonTab\.location\.replace\(res\.redirectUrl\)/);
  assert.doesNotMatch(detail, /window\.location\.href = res\.redirectUrl/);
});

test('failed affiliate resolution closes the blank tab instead of abandoning it', () => {
  assert.match(detail, /amazonTab\.close\(\)/);
  assert.match(detail, /Please allow pop-ups for DealScout and try again/);
});
