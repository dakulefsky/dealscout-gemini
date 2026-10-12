import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROJECT = 'project-1c568b10-6e24-4dc2-b2b';
const VERIFIED = [
  { id: 'c097dcdf-c21e-46c4-b05a-c7aa114afbc0', service: 'dealscout' },
  { id: '49867c90-ece8-4c76-be8b-749e1be8d1f3', filename: 'cloudbuild.yaml' },
  { id: '157f3cab-9ed6-4876-879d-bf3933c0ba39', service: 'dealscout' },
];

export async function consolidateBuildTriggers(env = process.env, spawn = spawnSync, fetchImpl = globalThis.fetch) {
  const project = env.GCP_PROJECT_ID || PROJECT;
  if (project !== PROJECT || (env.GCP_WEB_SERVICE && env.GCP_WEB_SERVICE !== 'dealscout-web') || (env.GCP_ADMIN_SERVICE && env.GCP_ADMIN_SERVICE !== 'dealscout')) throw new Error('The verified DealScout project and automatic deployment services are required');
  const read = id => {
    const result = spawn('gcloud', ['builds', 'triggers', 'describe', id, '--project', project, '--region', 'global', '--format=json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      if (!result.error && /NOT_FOUND|does not exist/i.test(result.stderr || '')) return null;
      throw new Error('Could not validate the verified duplicate build triggers; no permissions were changed');
    }
    try { return JSON.parse(result.stdout); }
    catch { throw new Error('Invalid duplicate trigger metadata response'); }
  };
  // Validate every source before the first write. Never disable an unrelated or
  // repurposed trigger; no build settings, credentials, or IAM fields are edited.
  const planned = VERIFIED.map(expected => {
    const trigger = read(expected.id);
    if (!trigger) return { ...expected, absent: true };
    if (trigger.id !== expected.id || trigger.github?.owner !== 'dakulefsky' || trigger.github?.name !== 'dealscout-gemini' || trigger.github?.push?.branch !== '^main$' || (expected.service && trigger.substitutions?._SERVICE_NAME !== expected.service) || (expected.filename && trigger.filename !== expected.filename)) throw new Error('A duplicate trigger source changed; consolidation stopped before any writes');
    return { ...expected, disabled: trigger.disabled === true };
  });
  if (planned.every(row => row.absent || row.disabled)) return planned.map(row => ({ id: row.id, state: row.absent ? 'absent' : 'alreadyDisabled' }));
  const auth = spawn('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' });
  if (auth.error || auth.status !== 0 || !auth.stdout.trim()) throw new Error('Existing deployment authentication is unavailable');
  const token = auth.stdout.trim();
  if (!/^[\x21-\x7e]+$/.test(token)) throw new Error('Existing deployment authentication is invalid');
  const results = [];
  for (const row of planned) {
    if (row.absent || row.disabled) { results.push({ id: row.id, state: row.absent ? 'absent' : 'alreadyDisabled' }); continue; }
    let response;
    try {
      response = await fetchImpl(`https://cloudbuild.googleapis.com/v1/projects/${project}/triggers/${row.id}?updateMask=disabled`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ disabled: true }), signal: AbortSignal.timeout(15000),
      });
    } catch { throw new Error('Duplicate trigger update unavailable; no permissions were changed'); }
    if (!response.ok) throw new Error(`The verified duplicate trigger could not be disabled (HTTP ${response.status}); no permissions were changed`);
    if ((await response.json()).disabled !== true || read(row.id)?.disabled !== true) throw new Error('Duplicate trigger disablement could not be confirmed');
    results.push({ id: row.id, state: 'disabled' });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  consolidateBuildTriggers().then(results => console.log(JSON.stringify(results, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
