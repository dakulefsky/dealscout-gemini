const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/pages/AdminHome.jsx'), 'utf8');

test('admin maintenance runner has a synchronous in-flight guard', () => {
  assert.match(source, /useRef/);
  assert.match(source, /const busyRef = useRef\(false\);/);
  assert.match(source, /async function run\(name, fn, success, describe\) \{\n    if \(busyRef\.current\) return;\n    busyRef\.current = true;/);
  assert.match(source, /finally \{\n      busyRef\.current = false;\n      setBusy\(null\);/);
});

test('all operational controls share one disabled state', () => {
  assert.match(source, /const actionInFlight = Boolean\(busy\);/);
  const sharedDisabled = source.match(/disabled=\{actionInFlight\}/g) || [];
  assert.equal(sharedDisabled.length, 5, 'Refresh plus four maintenance controls should share the in-flight disabled state');
  assert.doesNotMatch(source, /disabled=\{busy === '(verify|sync|images|cleanup)'\}/);
});

test('the active operation alone keeps its spinner label', () => {
  for (const name of ['verify', 'sync', 'images', 'cleanup']) {
    assert.match(source, new RegExp(`busy === '${name}'`));
  }
});
