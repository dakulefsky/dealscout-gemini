import { databaseRelease } from './database-release.mjs';
import { parseSecretMappings, validateProviderSecrets, encodeEnvVars } from './gcp-release.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function maintenanceRelease(env = process.env) {
  const required = (key) => {
    const value = String(env[key] || '').trim();
    if (!value || /[\r\n|]/.test(value)) throw new Error(`${key} must be a single configured value`);
    return value;
  };
  const database = databaseRelease(env);
  const provider = String(env.DEAL_DATA_PROVIDER || 'auto').trim();
  const webSecrets = parseSecretMappings(required('GCP_WEB_SECRETS'), 'GCP_WEB_SECRETS');
  validateProviderSecrets(provider, webSecrets);
  const allowed = new Set(['RAINFOREST_API_KEY', 'AMAZON_PAAPI_ACCESS_KEY', 'AMAZON_PAAPI_SECRET_KEY', 'AMAZON_PAAPI_PARTNER_TAG']);
  const providerSecrets = [...webSecrets].filter(([key]) => allowed.has(key)).map(([key, secret]) => `${key}=${secret}`);
  const jobFlags = database.flags.flatMap((flag) => flag === '--clear-cloudsql-instances' ? ['--set-cloudsql-instances', ''] : [flag]);
  const entries = [['NODE_ENV', 'production'], ...database.entries, ['AMAZON_ASSOCIATE_TAG', required('AMAZON_ASSOCIATE_TAG')], ['DEAL_DATA_PROVIDER', provider]];
  for (const key of ['RAINFOREST_DOMAIN', 'RAINFOREST_DAILY_REQUEST_LIMIT', 'RAINFOREST_MONTHLY_REQUEST_LIMIT']) {
    if (env[key]) entries.push([key, String(env[key]).trim()]);
  }
  return ['run', 'jobs', 'deploy', String(env.GCP_MAINTENANCE_JOB || 'dealscout-maintenance'),
    '--project', required('GCP_PROJECT_ID'), '--region', required('GCP_REGION'), '--image', required('GCP_IMAGE'),
    '--service-account', required('GCP_RUNTIME_SERVICE_ACCOUNT'),
    ...jobFlags, '--command', 'node', '--args', 'maintenance-worker.js',
    '--tasks', '1', '--parallelism', '1', '--max-retries', '0', '--task-timeout', '600s', '--cpu', '1', '--memory', '512Mi',
    '--set-env-vars', encodeEnvVars(entries), '--set-secrets', [database.secrets, ...providerSecrets].join(','), '--quiet'];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = maintenanceRelease();
    const result = spawnSync('gcloud', args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Maintenance job deployment failed (${result.status})`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
