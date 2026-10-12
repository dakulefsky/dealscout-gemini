const test = require('node:test');
const assert = require('node:assert/strict');

test('runtime evidence reports actual ready image without printing environment or secrets', async () => {
  const { summarizeRuntime } = await import('../scripts/deployment-evidence.mjs');
  const service = { spec: { template: { metadata: { labels: { 'commit-sha': 'abc123', private: 'PRIVATE_LABEL' } }, spec: { containers: [{ image: 'desired-image', env: [{ name: 'DB_PASSWORD', value: 'PRIVATE_ENV' }] }] } } }, status: { latestCreatedRevisionName: 'new', latestReadyRevisionName: 'old', traffic: [{ revisionName: 'old', percent: 100, tag: 'PRIVATE_TAG' }] } };
  const revision = { spec: { containers: [{ image: 'actual-ready-image', env: [{ value: 'PRIVATE_REVISION_ENV' }] }] }, status: { imageDigest: 'sha256:digest' }, metadata: { labels: { 'gcb-trigger-id': 'trigger-123', private: 'PRIVATE_REVISION_LABEL' } } };
  const result = summarizeRuntime('dealscout', service, revision);
  assert.equal(result.desiredImage, 'desired-image'); assert.equal(result.readyImage, 'actual-ready-image');
  assert.equal(result.latestCreatedRevision, 'new'); assert.equal(result.latestReadyRevision, 'old');
  assert.equal(result.readyRevisionLabels['gcb-trigger-id'], 'trigger-123');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|DB_PASSWORD/);
});

test('deployment evidence only describes the two services and their ready revisions', async () => {
  const { collectDeploymentEvidence } = await import('../scripts/deployment-evidence.mjs');
  const commands = [];
  const result = collectDeploymentEvidence({}, (command, args) => {
    commands.push([command, ...args]);
    return { status: 0, stdout: JSON.stringify(args[1] === 'services' ? { status: { latestReadyRevisionName: args[3] + '-ready' } } : { spec: { containers: [{ image: 'image' }] } }) };
  });
  assert.equal(result.length, 2); assert.equal(commands.length, 4);
  assert.ok(commands.every(row => row[0] === 'gcloud' && row[1] === 'run' && row[3] === 'describe'));
  assert.ok(commands.every(row => !row.includes('deploy') && !row.includes('execute') && !row.includes('get-iam-policy')));
  assert.throws(() => collectDeploymentEvidence({}, () => ({ status: 1, stderr: 'PRIVATE_FAILURE' })), /unavailable/);
});
