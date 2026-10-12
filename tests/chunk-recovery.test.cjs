const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { installChunkRecovery } = require('../src/lib/chunkRecovery.js');

function browser(values = new Map()) {
  const listeners = new Map();
  let reloads = 0;
  return { listeners, values, target: {
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    location: { reload: () => { reloads++; } },
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key),
  }, get reloads() { return reloads; }, fail() { let prevented = false; listeners.get('vite:preloadError')({ preventDefault: () => { prevented = true; } }); return prevented; } };
}

test('a failed lazy import reloads the current page once and leaves other errors alone', () => {
  const page = browser();
  const remove = installChunkRecovery(page.target, () => 1000000);
  assert.deepEqual([...page.listeners.keys()], ['vite:preloadError']);
  assert.equal(page.fail(), true); assert.equal(page.reloads, 1);
  assert.equal(page.fail(), false); assert.equal(page.reloads, 1);
  remove(); assert.equal(page.listeners.size, 0);
  const entry = fs.readFileSync('src/main.jsx', 'utf8');
  assert.ok(entry.indexOf('installChunkRecovery(window)') < entry.indexOf('ReactDOM.createRoot('));
});

test('the guard survives page reloads and allows a later deployment to recover', () => {
  const storage = new Map();
  const old = browser(storage); installChunkRecovery(old.target, () => 1000000); old.fail();
  const reloaded = browser(storage); installChunkRecovery(reloaded.target, () => 1001000);
  assert.equal(reloaded.fail(), false); assert.equal(reloaded.reloads, 0);
  const later = browser(storage); installChunkRecovery(later.target, () => 1200000);
  assert.equal(later.fail(), true); assert.equal(later.reloads, 1);
});

test('blocked session storage leaves manual recovery rather than risking a reload loop', () => {
  const page = browser();
  Object.defineProperty(page.target, 'sessionStorage', { get() { throw new Error('blocked'); } });
  installChunkRecovery(page.target, () => 1000000);
  assert.equal(page.fail(), false); assert.equal(page.reloads, 0);
});
