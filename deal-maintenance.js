import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initializeRuntime } = require('./server/startup/runtimeBootstrap');
const { RUNTIME_ROLES } = require('./server/config/runtimeRequirements');
const { closePool } = require('./server/storage/postgres');
const dealCron = require('./server/services/cronService');
const { runDealMaintenance } = require('./server/services/dealMaintenanceRunner');

runDealMaintenance({
  initializeRuntime,
  runFullCycle: (options) => dealCron.runFullCycle(options),
  closePool,
  isProduction: process.env.NODE_ENV === 'production',
  role: RUNTIME_ROLES.DEAL_MAINTENANCE,
}).catch((error) => {
  console.error('[DealScout maintenance] failed:', error?.message || error);
  process.exitCode = 1;
});
