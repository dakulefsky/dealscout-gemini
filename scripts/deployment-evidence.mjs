import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function labels(metadata = {}) {
  return Object.fromEntries(['commit-sha', 'gcb-build-id', 'gcb-trigger-id', 'managed-by'].flatMap(key => {
    const value = metadata.labels?.[key];
    return typeof value === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(value) ? [[key, value]] : [];
  }));
}

export function summarizeRuntime(serviceName, service, revision) {
  return {
    service: serviceName,
    desiredImage: service.spec?.template?.spec?.containers?.[0]?.image || null,
    latestCreatedRevision: service.status?.latestCreatedRevisionName || null,
    latestReadyRevision: service.status?.latestReadyRevisionName || null,
    traffic: (service.status?.traffic || []).map(row => ({ revision: row.revisionName || null, latestRevision: row.latestRevision === true, percent: row.percent })),
    templateLabels: labels(service.spec?.template?.metadata),
    readyImage: revision?.spec?.containers?.[0]?.image || null,
    readyImageDigest: revision?.status?.imageDigest || null,
    readyRevisionLabels: labels(revision?.metadata),
    readyCreatedAt: revision?.metadata?.creationTimestamp || null,
  };
}

export function collectDeploymentEvidence(env = process.env, spawn = spawnSync) {
  const project = env.GCP_PROJECT_ID || 'project-1c568b10-6e24-4dc2-b2b';
  const region = env.GCP_REGION || 'us-central1';
  const read = (kind, name) => {
    const result = spawn('gcloud', ['run', kind, 'describe', name, '--project', project, '--region', region, '--format=json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error('Runtime deployment evidence unavailable; no settings or permissions were changed.');
    return JSON.parse(result.stdout);
  };
  return [env.GCP_WEB_SERVICE || 'dealscout-web', env.GCP_ADMIN_SERVICE || 'dealscout'].map(name => {
    const service = read('services', name);
    const ready = service.status?.latestReadyRevisionName;
    return summarizeRuntime(name, service, ready ? read('revisions', ready) : null);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(collectDeploymentEvidence(), null, 2)); }
  catch { console.error('Runtime deployment evidence unavailable; no settings or permissions were changed.'); process.exitCode = 1; }
}
