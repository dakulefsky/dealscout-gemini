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

function parseSecretMappings(value, sourceName) {
  const mappings = new Map();
  for (const entry of cleanCsv(value).split(',').filter(Boolean)) {
    const separator = entry.indexOf('=');
    const key = separator > 0 ? entry.slice(0, separator) : '';
    const secret = separator > 0 ? entry.slice(separator + 1) : '';
    if (!key || !secret.includes(':')) {
      throw new Error(`${sourceName} must use ENV_VAR=SECRET_NAME:VERSION mappings`);
    }
    mappings.set(key, secret);
  }
  return mappings;
}

function requireSecretMappings(value, requiredKeys, sourceName) {
  const mappings = parseSecretMappings(value, sourceName);
  for (const key of requiredKeys) {
    if (!mappings.has(key)) throw new Error(`${sourceName} must map ${key}`);
  }
  return mappings;
}

function serializeSecretMappings(...maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [key, secret] of map) merged.set(key, secret);
  }
  return [...merged.entries()].map(([key, secret]) => `${key}=${secret}`).join(',');
}

function validateProviderSecrets(provider, webSecrets) {
  const hasRainforest = webSecrets.has('RAINFOREST_API_KEY');
  const paapiKeys = ['AMAZON_PAAPI_ACCESS_KEY', 'AMAZON_PAAPI_SECRET_KEY', 'AMAZON_PAAPI_PARTNER_TAG'];
  const hasPaapi = paapiKeys.every((key) => webSecrets.has(key));

  if (provider === 'rainforest' && !hasRainforest) {
    throw new Error('GCP_WEB_SECRETS must map RAINFOREST_API_KEY for DEAL_DATA_PROVIDER=rainforest');
  }
  if (provider === 'amazon_paapi' && !hasPaapi) {
    throw new Error(`GCP_WEB_SECRETS must map ${paapiKeys.join(', ')} for DEAL_DATA_PROVIDER=amazon_paapi`);
  }
  if (provider === 'auto' && !hasRainforest && !hasPaapi) {
    throw new Error('GCP_WEB_SECRETS must configure Rainforest or complete Amazon PA-API credentials for DEAL_DATA_PROVIDER=auto');
  }
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

  const dbSecrets = requireSecretMappings(
    requireValue(env, 'GCP_DB_SECRETS'),
    ['DB_USER', 'DB_PASSWORD', 'DB_NAME'],
    'GCP_DB_SECRETS'
  );
  const webSecrets = requireSecretMappings(
    requireValue(env, 'GCP_WEB_SECRETS'),
    ['JWT_SECRET'],
    'GCP_WEB_SECRETS'
  );
  validateProviderSecrets(dealProvider, webSecrets);
  const publisherSecrets = requireSecretMappings(
    requireValue(env, 'GCP_PUBLISHER_SECRETS'),
    ['WAHA_API_KEY'],
    'GCP_PUBLISHER_SECRETS'
  );

  const combinedWebSecrets = serializeSecretMappings(dbSecrets, webSecrets);
  const combinedPublisherSecrets = serializeSecretMappings(dbSecrets, publisherSecrets);

  const webEnv = encodeEnvVars([
    ['NODE_ENV', 'production'],
    ['PUBLIC_WEB_URL', publicWebUrl],
    ['CORS_ORIGINS', corsOrigins],
    ['CLOUD_SQL_CONNECTION_NAME', cloudSql],
    ['AMAZON_ASSOCIATE_TAG', affiliateTag],
    ['DEAL_DATA_PROVIDER', dealProvider],
    ['RAINFOREST_DOMAIN', text(env, 'RAINFOREST_DOMAIN')],
    ['RAINFOREST_DAILY_REQUEST_LIMIT', text(env, 'RAINFOREST_DAILY_REQUEST_LIMIT')],
    ['RAINFOREST_MONTHLY_REQUEST_LIMIT', text(env, 'RAINFOREST_MONTHLY_REQUEST_LIMIT')],
    ['GEMINI_MODEL', text(env, 'GEMINI_MODEL')],
    ['GEMINI_DAILY_REQUEST_LIMIT', text(env, 'GEMINI_DAILY_REQUEST_LIMIT')],
    ['GEMINI_MONTHLY_REQUEST_LIMIT', text(env, 'GEMINI_MONTHLY_REQUEST_LIMIT')],
  ]);

  const publisherEnv = encodeEnvVars([
    ['NODE_ENV', 'production'],
    ['CLOUD_SQL_CONNECTION_NAME', cloudSql],
    ['PUBLICATION_CHANNEL', 'whatsapp_status'],
    ['PUBLICATION_TRANSPORT', 'waha'],
    ['PUBLICATION_RUN_MODE', 'continuous'],
    ['WAHA_BASE_URL', requireValue(env, 'WAHA_BASE_URL')],
    ['WAHA_SESSION', requireValue(env, 'WAHA_SESSION')],
    ['WAHA_TIMEOUT_MS', text(env, 'WAHA_TIMEOUT_MS')],
    ['PUBLICATION_POLL_MS', text(env, 'PUBLICATION_POLL_MS')],
    ['PUBLICATION_MIN_SPACING_SECONDS', text(env, 'PUBLICATION_MIN_SPACING_SECONDS')],
    ['PUBLICATION_QUEUE_BATCH', text(env, 'PUBLICATION_QUEUE_BATCH')],
    ['PUBLICATION_CANDIDATE_LIMIT', text(env, 'PUBLICATION_CANDIDATE_LIMIT')],
    ['PUBLICATION_MAX_PER_CYCLE', text(env, 'PUBLICATION_MAX_PER_CYCLE')],
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