const postgres = require('../storage/postgres');
const dealRepository = require('../repositories/dealRepository');
const userRepository = require('../repositories/userRepository');
const categoryRepository = require('../repositories/categoryRepository');
const bookmarkRepository = require('../repositories/bookmarkRepository');
const editorialRepository = require('../repositories/editorialRepository');
const activityRepository = require('../repositories/activityRepository');
const refreshStateRepository = require('../repositories/refreshStateRepository');
const publicationQueueRepository = require('../repositories/publicationQueueRepository');
const priceHistoryService = require('../services/priceHistoryService');
const { assertProductionRuntime } = require('../config/runtimeRequirements');

async function ensureOperationalSchemas() {
  await Promise.all([
    dealRepository.ensureSchema(),
    userRepository.ensureSchema(),
    categoryRepository.ensureSchema(),
    editorialRepository.ensureSchema(),
    activityRepository.ensureSchema(),
    refreshStateRepository.ensureSchema(),
    publicationQueueRepository.ensureSchema(),
    priceHistoryService.ensureSchema(),
  ]);
  await bookmarkRepository.ensureSchema();
}

async function initializeRuntime({ isProduction = process.env.NODE_ENV === 'production' } = {}) {
  if (isProduction) {
    assertProductionRuntime(process.env, { postgresConfigured: postgres.isConfigured() });
    const database = await postgres.health();
    if (!database.healthy) throw new Error('PostgreSQL readiness check failed during production startup');
  }

  await ensureOperationalSchemas();
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
