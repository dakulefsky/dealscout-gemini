const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'app', 'index.jsx'), 'utf8');

test('mobile feed owns a separate cancellable pagination request', () => {
  assert.match(source, /const paginationRequestRef = useRef\(null\)/);
  assert.match(source, /paginationRequestRef\.current\?\.abort\(\)/);
  assert.match(source, /deals\.page\(\{ \.\.\.feedParams, cursor: nextCursor \}, \{ signal: controller\.signal \}\)/);
});

test('starting a first page invalidates every older pagination generation', () => {
  assert.match(source, /const feedGenerationRef = useRef\(0\)/);
  assert.match(source, /const generation = feedGenerationRef\.current \+ 1/);
  assert.match(source, /feedGenerationRef\.current = generation/);
  assert.match(source, /controller\.signal\.aborted \|\| generation !== feedGenerationRef\.current/);
});

test('stale pagination responses cannot merge into a newly filtered feed', () => {
  assert.match(source, /const generation = feedGenerationRef\.current;[\s\S]*setLoadingMore\(true\)/);
  assert.match(source, /if \(controller\.signal\.aborted \|\| generation !== feedGenerationRef\.current\) return;[\s\S]*setItems\(\(current\) => mergeDeals/);
  assert.match(source, /if \(err\?\.name !== 'AbortError' && generation === feedGenerationRef\.current\)/);
  assert.match(source, /if \(generation === feedGenerationRef\.current\) setLoadingMore\(false\)/);
});

test('feed effect cleanup aborts first-page and pagination requests', () => {
  assert.match(source, /clearTimeout\(timer\);\s*requestRef\.current\?\.abort\(\);\s*paginationRequestRef\.current\?\.abort\(\);/);
});
