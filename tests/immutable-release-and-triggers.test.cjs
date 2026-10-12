const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { immutableBuiltImage, assertPinnedParity } = require('../scripts/release-image.mjs');
const { consolidateBuildTriggers } = require('../scripts/consolidate-build-triggers.mjs');
const sha = 'a'.repeat(40), digest = 'sha256:' + 'b'.repeat(64);
const tag = `gcr.io/project/dealscout:${sha}`, pinned = `gcr.io/project/dealscout@${digest}`;

test('release uses the completed build digest instead of a mutable commit tag', () => {
  assert.equal(immutableBuiltImage({ results: { images: [{ name: tag, digest }] } }, tag), pinned);
  for (const build of [{}, { results: { images: [{ name: 'another-tag', digest }] } }, { results: { images: [{ name: tag, digest: 'bad' }] } }]) assert.throws(() => immutableBuiltImage(build, tag), /valid digest/);
  const workflow = fs.readFileSync('.github/workflows/deploy-web.yml', 'utf8');
  assert.match(workflow, /json\(results.images\).*node scripts\/release-image.mjs/);
  assert.match(workflow, /node scripts\/verify-deployment-parity.mjs/);
  assert.ok(workflow.indexOf('Retire verified duplicate Cloud Build triggers') < workflow.indexOf('Build immutable production image'));
});

test('the build-pinning CLI emits only the verified digest and fails on missing build results', () => {
  const good = spawnSync(process.execPath, ['scripts/release-image.mjs', tag], { input: JSON.stringify({ results: { images: [{ name: tag, digest }] } }), encoding: 'utf8' });
  assert.equal(good.status, 0); assert.equal(good.stdout.trim(), pinned);
  const bad = spawnSync(process.execPath, ['scripts/release-image.mjs', tag], { input: '{}', encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.equal(bad.stdout, ''); assert.match(bad.stderr, /Unable to pin/);
});

test('parity checks actual ready digests, latest revisions and 100% traffic', () => {
  const services = ['dealscout-web', 'dealscout'].map(service => ({ service, desiredImage: pinned, readyImageDigest: pinned, latestCreatedRevision: service + '-ready', latestReadyRevision: service + '-ready', traffic: [{ revision: service + '-ready', percent: 100 }] }));
  assert.equal(assertPinnedParity(services, pinned).length, 2);
  for (const extra of [{ desiredImage: tag }, { readyImageDigest: 'gcr.io/project/dealscout@sha256:' + 'c'.repeat(64) }, { latestCreatedRevision: 'pending' }, { traffic: [{ revision: 'old', percent: 100 }] }, { traffic: [{ revision: 'dealscout-ready', percent: 99 }] }]) assert.throws(() => assertPinnedParity([services[0], { ...services[1], ...extra }], pinned), /not serving 100%/);
  assert.throws(() => assertPinnedParity(services, tag), /immutable image digest/);
  assert.throws(() => assertPinnedParity([services[0], services[0]], pinned), /Both production services/);
});

const ids = ['c097dcdf-c21e-46c4-b05a-c7aa114afbc0', '49867c90-ece8-4c76-be8b-749e1be8d1f3', '157f3cab-9ed6-4876-879d-bf3933c0ba39'];
function fixtures() {
  return new Map(ids.map((id, index) => [id, { id, github: { owner: 'dakulefsky', name: 'dealscout-gemini', push: { branch: '^main$' } }, ...(index === 1 ? { filename: 'cloudbuild.yaml' } : { substitutions: { _SERVICE_NAME: 'dealscout', _PRIVATE: 'PRIVATE_VALUE' } }) }]));
}
function commands(rows, calls) {
  return (_command, args) => {
    calls.push(args);
    if (args[0] === 'auth') return { status: 0, stdout: 'TEST_TOKEN' };
    return rows.has(args[3]) ? { status: 0, stdout: JSON.stringify(rows.get(args[3])) } : { status: 1, stderr: 'NOT_FOUND' };
  };
}

test('only verified duplicates are disabled and only the disabled field is patched', async () => {
  const rows = fixtures(), calls = [], writes = [];
  const result = await consolidateBuildTriggers({}, commands(rows, calls), async (url, options) => {
    assert.equal(calls.filter(args => args[0] === 'builds').length >= 3, true, 'all sources are read before mutations');
    assert.match(url, /cloudbuild.googleapis.com\/v1\/projects\/project-1c568b10-6e24-4dc2-b2b\/triggers\/[^?]+\?updateMask=disabled$/);
    assert.equal(options.method, 'PATCH'); assert.deepEqual(JSON.parse(options.body), { disabled: true });
    assert.equal(options.headers.Authorization, 'Bearer TEST_TOKEN');
    const id = url.split('/triggers/')[1].split('?')[0]; writes.push(id); rows.get(id).disabled = true;
    return { ok: true, json: async () => ({ disabled: true }) };
  });
  assert.deepEqual(writes, ids); assert.ok(result.every(row => row.state === 'disabled'));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE|TEST_TOKEN/);
});

test('changed trigger sources stop every write; absent or disabled triggers are idempotent', async () => {
  let rows = fixtures(); rows.get(ids[2]).github.name = 'another-repository';
  let writes = 0;
  await assert.rejects(() => consolidateBuildTriggers({}, commands(rows, []), async () => { writes++; }), /source changed/);
  assert.equal(writes, 0);
  rows = fixtures(); rows.delete(ids[0]); for (const row of rows.values()) row.disabled = true;
  const calls = [], result = await consolidateBuildTriggers({}, commands(rows, calls), async () => { writes++; });
  assert.deepEqual(result.map(row => row.state), ['absent', 'alreadyDisabled', 'alreadyDisabled']);
  assert.ok(calls.every(args => args[0] !== 'auth')); assert.equal(writes, 0);
});

test('denied consolidation fails without leaking credentials or widening permissions', async () => {
  await assert.rejects(() => consolidateBuildTriggers({}, commands(fixtures(), []), async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(() => consolidateBuildTriggers({ GCP_PROJECT_ID: 'different-project' }, () => { throw new Error('must not execute'); }), /verified DealScout project/);
  const source = fs.readFileSync('scripts/consolidate-build-triggers.mjs', 'utf8');
  assert.doesNotMatch(source, /set-iam-policy|add-iam-policy-binding|delete|--impersonate/);
});
