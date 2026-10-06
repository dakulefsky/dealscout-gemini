import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function databaseRelease(env = process.env) {
  const mode = String(env.GCP_DATABASE_MODE || 'cloudsql').trim();
  const required = (key) => {
    const value = String(env[key] || '').trim();
    if (!value || /[\n\r|]/.test(value)) throw new Error(`${key} is required and must be a single value`);
    return value;
  };
  if (mode === 'cloudsql') {
    const connection = required('CLOUD_SQL_CONNECTION_NAME');
    return { mode, flags: ['--set-cloudsql-instances', connection], entries: [['CLOUD_SQL_CONNECTION_NAME', connection]], secrets: required('GCP_DB_SECRETS') };
  }
  if (mode !== 'rds') throw new Error('GCP_DATABASE_MODE must be cloudsql or rds');
  const secret = (key) => {
    const value = required(key);
    if (!/^[a-zA-Z0-9_-]+:(latest|[1-9][0-9]*)$/.test(value)) throw new Error(`${key} must be SECRET_NAME:VERSION`);
    return value;
  };
  const caPath = '/etc/rds-ca/aws-ca.pem';
  return {
    mode,
    flags: ['--clear-cloudsql-instances', '--network', required('GCP_DB_NETWORK'), '--subnet', required('GCP_DB_SUBNET'), '--vpc-egress', 'all-traffic'],
    entries: [['PGSSL', 'verify-full'], ['NODE_EXTRA_CA_CERTS', caPath]],
    secrets: `DATABASE_URL=${secret('GCP_RDS_DATABASE_SECRET')},${caPath}=${secret('GCP_RDS_CA_SECRET')}`,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = databaseRelease();
    switch (process.argv[2]) {
      case 'flags': console.log(config.flags.join('\n')); break;
      case 'env': console.log(config.entries.map(([key, value]) => `${key}=${value}`).join('|')); break;
      case 'secrets': console.log(config.secrets); break;
      case 'validate': break;
      default: throw new Error('Expected flags, env, secrets or validate');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
