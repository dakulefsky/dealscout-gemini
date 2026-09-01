import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function text(env, key, fallback = '') {
  return String(env?.[key] ?? fallback).trim();
}

function requireValue(env, key) {
  const result = text(env, key);
  if (!result) throw new Error(`${key} is required`);
  return result;
}

function cleanCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).join(',');
}

function assertSecretMappings(value, requiredKeys, sourceName) {
  const mappings = new Map(cleanCsv(value).split(',').filter(Boolean).map((entry) => {
    const separator = entry.indexOf('=');
    if (separator <= 0 || !entry.slice(separator + 1).includes(':')) {
      throw new Error(`${sourceName} must use ENV_VAR=SECRET_NAME:VERSION mappings`);
    }
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
  for (const key of requiredKeys) {
    if (!mappings.has(key)) throw new Error(`${sourceName} must map ${key}`);
  }
  return [...mappings.entries()].map(([key, secret]) => `${key}=${secret}`).join(',');
}

function encodeEnvVars(entries) {
  const pairs = entries.filter(([, value]) => value !== undefined && value !== null && String(value) !== '');
  for (const [key, value] of pairs) {
    if (String(key).includes('|') || String(value).includes('|')) throw new Error(`Environment value for ${key} cannot contain |`);
  }
  return `^|^${pairs.map(([key, value]) => `${key}=${value}`).join('|')}`;
}

function pushFlag(args, flag, value) {
  if (value !== undefined && value !== null && String(value).trim() !== '') args.push(flag, String(value));
}

export function buildReleasePlan(env = process.env) {
  const project = requireValue(env, 'GCP_PROJECT_ID');
  const region = text(env, 'GCP_REGION', 'us-central1');
  const image = requireValue(env, 'GCP_IMAGE');
  const cloudSql = requireValue(env, 'CLOUD_SQL_CONNECTION_NAME');
  const publicWebUrl = requireValue(env, 'PUBLIC_WEB_URL');
  const corsOrigins = requireValue(env, 'CORS_ORIGINS');
  const affiliateTag = requireValue(env, 'AMAZON_ASSOCIATE_TAG');
  const dealProvider = text(env, 'DEAL_DATA_PROVIDER', 'auto');
  const webService = text(env, 'GCP_WEB_SERVICE', 'dealscout-web');
  const publisherPool = text(env, 'GCP_PUBLISHER_POOL', 'dealscout-publisher');
  const serviceAccount = text(env, 'GCP_RUNTIME_SERVICE_ACCOUNT');

  const sharedSecrets = assertSecretMappings(
    requireValue(env, 'GCP_SHARED_SECRETS'),
    ['JWT_SECRET', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'],
    'GCP_SHARED_SECRETS'
  );
  const webSecrets = cleanCsv(text(env, 'GCP_WEB_SECRETS'));
  const publisherSecrets = assertSecretMappings(
    requireValue(env, 'GCP_PUBLISHER_SECRETS'),
    ['WAHA_API_KEY'],
    'GCP_PUBLISHER_SECRETS'
  );
  const combinedWebSecrets = cleanCsv([sharedSecrets, webSecrets].filter(Boolean).join(','));
  const combinedPublisherSecrets = cleanCsv([sharedSecrets, publisherSecrets].filter(Boolean).join(','));

  const webEnv = encodeEnvVars([
    ['NODE_ENV', 'production'],
    ['PUBLIC_WEB_URL', publicWebUrl],
    ['CORS_ORIGINS', corsOrigins],
    ['CLOUD_SQL_CONNECTION_NAME', cloudSql],
    ['AMAZON_ASSOCIATE_TAG', affiliateTag],
    ['DEAL_DATA_PROVIDER', dealProvider],
    ['RAINFOREST_DOMAIN', text(env, 'RAINFOREST_DOMAIN')],
  ]);

  const publisherEnv = encodeEnvVars([
    ['NODE_ENV', 'production'],
    ['PUBLIC_WEB_URL', publicWebUrl],
    ['CLOUD_SQL_CONNECTION_NAME', cloudSql],
    ['AMAZON_ASSOCIATE_TAG', affiliateTag],
    ['DEAL_DATA_PROVIDER', dealProvider],
    ['PUBLICATION_CHANNEL', 'whatsapp_status'],
    ['PUBLICATION_TRANSPORT', 'waha'],
    ['PUBLICATION_RUN_MODE', 'continuous'],
    ['WAHA_BASE_URL', requireValue(env, 'WAHA_BASE_URL')],
    ['WAHA_SESSION', requireValue(env, 'WAHA_SESSION')],
    ['PUBLICATION_MIN_DISCOUNT', text(env, 'PUBLICATION_MIN_DISCOUNT')],
    ['PUBLICATION_MIN_QUALITY', text(env, 'PUBLICATION_MIN_QUALITY')],
    ['PUBLICATION_MIN_INTERVAL_MS', text(env, 'PUBLICATION_MIN_INTERVAL_MS')],
    ['PUBLICATION_POLL_MS', text(env, 'PUBLICATION_POLL_MS')],
    ['RAINFOREST_DOMAIN', text(env, 'RAINFOREST_DOMAIN')],
  ]);

  const web = ['run', 'deploy', webService,
    '--project', project,
    '--region', region,
    '--image', image,
    '--platform', 'managed',
    '--allow-unauthenticated',
    '--set-cloudsql-instances', cloudSql,
    '--set-env-vars', webEnv,
    '--set-secrets', combinedWebSecrets,
  ];
  if (serviceAccount) pushFlag(web, '--service-account', serviceAccount);

  const publisher = ['run', 'worker-pools', 'deploy', publisherPool,
    '--project', project,
    '--region', region,
    '--image', image,
    '--instances', '1',
    '--set-cloudsql-instances', cloudSql,
    '--command', 'node',
    '--args', 'publication-worker.js',
    '--set-env-vars', publisherEnv,
    '--set-secrets', combinedPublisherSecrets,
  ];
  if (serviceAccount) pushFlag(publisher, '--service-account', serviceAccount);

  return {
    project,
    region,
    image,
    webService,
    publisherPool,
    commands: [
      { label: 'website/api', executable: 'gcloud', args: web },
      { label: 'whatsapp status publisher', executable: 'gcloud', args: publisher },
    ],
  };
}

function shellQuote(value) {
  const textValue = String(value);
  if (/^[A-Za-z0-9_./:@=,+^|-]+$/.test(textValue)) return textValue;
  return `'${textValue.replaceAll("'", `'\\''`)}'`;
}

export function renderCommand(command) {
  return [command.executable, ...command.args].map(shellQuote).join(' ');
}

export function executePlan(plan, { dryRun = false } = {}) {
  for (const command of plan.commands) {
    console.log(`\n[DealScout release] ${command.label}`);
    if (dryRun) {
      console.log(renderCommand(command));
      continue;
    }
    const result = spawnSync(command.executable, command.args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command.label} deployment failed with exit code ${result.status}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const plan = buildReleasePlan(process.env);
    const dryRun = process.argv.includes('--dry-run');
    executePlan(plan, { dryRun });
  } catch (error) {
    console.error(`[DealScout release] ${error?.message || error}`);
    process.exitCode = 1;
  }
}
