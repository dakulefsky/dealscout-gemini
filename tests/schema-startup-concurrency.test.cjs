const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture({ failAt } = {}) {
  let active = 0;
  let peak = 0;
  const finished = [];
  const poolCapacity = 5;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/startup/runtimeBootstrap.js'), 'utf8'), {
    module, process: { env: {} }, require: (name) => {
      if (name.endsWith('runtimeRequirements')) return { RUNTIME_ROLES: { WEB: 'web' } };
      if (name.endsWith('databaseReadiness')) return {};
      return {
        ensureSchema: async () => {
          active++;
          peak = Math.max(peak, active);
          try {
            if (active > poolCapacity) throw new Error('timeout exceeded when trying to connect');
            await new Promise(resolve => setTimeout(resolve, 2));
            if (name.includes(failAt || 'NEVER_FAIL')) throw new Error('schema initialization failed');
            finished.push(name);
          } finally { active--; }
        },
        repairImportedCategories: async () => finished.push('category-repair'),
      };
    },
  });
  return { bootstrap: module.exports, finished, peak: () => peak };
}
test('startup schemas fit the bounded pool and finish before category repair', async () => {
  const f = fixture();
  await f.bootstrap.ensureOperationalSchemas();
  assert.equal(f.peak(), 1);
  assert.equal(f.finished.length, 12);
  assert.equal(f.finished.at(-1), 'category-repair');
  assert.ok(f.finished[0].endsWith('dealRepository'));
  assert.ok(f.finished[10].endsWith('bookmarkRepository'));
});
test('schema failure aborts startup instead of continuing repairs or other schemas', async () => {
  const f = fixture({ failAt: 'editorialRepository' });
  await assert.rejects(f.bootstrap.ensureOperationalSchemas(), /schema initialization failed/);
  assert.equal(f.finished.length, 3);
  assert.ok(!f.finished.includes('category-repair'));
  assert.equal(f.peak(), 1);
});
