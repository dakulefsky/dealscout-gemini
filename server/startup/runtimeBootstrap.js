const postgres = require('../storage/postgres');
const dealRepository = require('../repositories/dealRepository');
const userRepository = require('../repositories/userRepository');
const categoryRepository = require('../repositories/categoryRepository');
const bookmarkRepository = require('../repositories/bookmarkRepository');
const editorialRepository = require('../repositories/editorialRepository');
const activityRepository = require('../repositories/activityRepository');
const refreshStateRepository = require('../repositories/refreshStateRepository');
const publicationQueueRepository = require('../repositories/publicationQueueRepository');
const maintenanceCadenceRepository = require('../repositories/maintenanceCadenceRepository');
const providerBudgetService = require('../services/providerBudgetService');
const channelSettingsService = require('../services/channelSettingsService');
const { RUNTIME_ROLES, assertProductionRuntime } = require('../config/runtimeRequirements');
const { waitForDatabase } = require('./databaseReadiness');

async function ensureOperationalSchemas() {
  // Reuse the connection warmed by readiness instead of launching ten schema
  // tasks into a five-client pool. Cold connections and queued DDL can otherwise
  // exhaust the acquisition deadline even though SELECT 1 already succeeded.
  await dealRepository.ensureSchema();
  await userRepository.ensureSchema();
  await categoryRepository.ensureSchema();
  await editorialRepository.ensureSchema();
  await activityRepository.ensureSchema();
  await refreshStateRepository.ensureSchema();
  await publicationQueueRepository.ensureSchema();
  await maintenanceCadenceRepository.ensureSchema();
  await providerBudgetService.ensureSchema();
  await channelSettingsService.ensureSchema();
  await bookmarkRepository.ensureSchema();
  await categoryRepository.repairImportedCategories();
}

async function initializeRuntime({
  isProduction = process.env.NODE_ENV === 'production',
  role = RUNTIME_ROLES.WEB,
} = {}) {
  if (isProduction) {
    assertProductionRuntime(process.env, { postgresConfigured: postgres.isConfigured(), role });
    // Direct VPC + NAT can need a minute to establish a cold instance's route.
    // Keep individual connection/request bounds while allowing bounded startup
    // retries before any HTTP listener or maintenance lane is opened.
    await waitForDatabase({ health: () => postgres.health() });
  }

  await ensureOperationalSchemas();
  await require('../services/primeDayPolicy').refresh();
  if (isProduction) await dealRepository.hardenProduction();
}

async function readinessStatus({ isProduction = process.env.NODE_ENV === 'production' } = {}) {
  if (!isProduction && !postgres.isConfigured()) return { ready: true };
  const database = await postgres.health();
  return { ready: database.configured && database.healthy };
}

async function readinessEndpoint(req, res) {
  try {
    const result = await readinessStatus();
    return res.status(result.ready ? 200 : 503).json({ status: result.ready ? 'ready' : 'not_ready' });
  } catch {
    return res.status(503).json({ status: 'not_ready' });
  }
}

module.exports = { ensureOperationalSchemas, initializeRuntime, readinessStatus, readinessEndpoint };
