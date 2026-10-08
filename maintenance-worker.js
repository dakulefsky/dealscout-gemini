import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runMaintenanceOnce } = require('./server/services/maintenanceRuntime');

runMaintenanceOnce({
  bootstrap: require('./server/startup/runtimeBootstrap'),
  cron: require('./server/services/cronService'),
  postgres: require('./server/storage/postgres'),
}).then((result) => {
  console.log('[DealScout maintenance]', JSON.stringify(result));
}).catch((error) => {
  console.error('[DealScout maintenance] failed:', error.message);
  process.exitCode = 1;
});
