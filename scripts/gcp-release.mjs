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
  const sharedSecrets = cleanCsv(requireValue(env, 'GCP_SHARED_SECRETS'));
  const webSecrets = cleanCsv(text(env, 'GCP_WEB_SECRETS'));
  const publisherSecrets = cleanCsv(requireValue(env, 'GCP_PUBLISHER_SECRETS'));
  const combinedWebSecrets = cleanCsv([sharedSecrets, webSecrets].filter(Boolean).join(','));
  const combinedPublisherSecrets = cleanCsv([sharedSecrets, publisherSecrets].filter(Boolean).join(','));

  const webEnv = cleanCsv([
    'NODE_ENV=production',
    `PUBLIC_WEB_URL=${publicWebUrl}`,
    `CORS_ORIGINS=${corsOrigins}`,
    `CLOUD_SQL_CONNECTION_NAME=${cloudSql}`,
    `AMAZON_ASSOCIATE_TAG=${affiliateTag}`,
    `DEAL_DATA_PROVIDER=${dealProvider}`,
    text(env, 'RAINFOREST_DOMAIN') ? `RAINFOREST_DOMAIN=${text(env, 'RAINFOREST_DOMAIN')}` : '',
  ].filter(Boolean).join(','));

  const publisherEnv = cleanCsv([
    'NODE_ENV=production',
    `PUBLIC_WEB_URL=${publicWebUrl}`,
    `CLOUD_SQL_CONNECTION_NAME=${cloudSql}`,
    `AMAZON_ASSOCIATE_TAG=${affiliateTag}`,
    `DEAL_DATA_PROVIDER=${dealProvider}`,
    'PUBLICATION_CHANNEL=whatsapp_status',
    'PUBLICATION_TRANSPORT=waha',
    'PUBLICATION_RUN_MODE=continuous',
    `WAHA_BASE_URL=${requireValue(env, 'WAHA_BASE_URL')}`,
    `WAHA_SESSION=${requireValue(env, 'WAHA_SESSION')}`,
    text(env, 'PUBLICATION_MIN_DISCOUNT') ? `PUBLICATION_MIN_DISCOUNT=${text(env, 'PUBLICATION_MIN_DISCOUNT')}` : '',
    text(env, 'PUBLICATION_MIN_QUALITY') ? `PUBLICATION_MIN_QUALITY=${text(env, 'PUBLICATION_MIN_QUALITY')}` : '',
    text(env, 'PUBLICATION_MIN_INTERVAL_MS') ? `PUBLICATION_MIN_INTERVAL_MS=${text(env, 'PUBLICATION_MIN_INTERVAL_MS')}` : '',
    text(env, 'PUBLICATION_POLL_MS') ? `PUBLICATION_POLL_MS=${text(env, 'PUBLICATION_POLL_MS')}` : '',
    text(env, 'RAINFOREST_DOMAIN') ? `RAINFOREST_DOMAIN=${text(env, 'RAINFOREST_DOMAIN')}` : '',
  ].filter(Boolean).join(','));

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
  if (/^[A-Za-z0-9_./:@=,+-]+$/.test(textValue)) return textValue;
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
