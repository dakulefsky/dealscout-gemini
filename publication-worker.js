import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function startPublicationWorker() {
  const isProduction = process.env.NODE_ENV === 'production';
  const postgres = require('./server/storage/postgres.js');
  const runtimeBootstrap = require('./server/startup/runtimeBootstrap.js');
  const { RUNTIME_ROLES } = require('./server/config/runtimeRequirements.js');
  const { resolvePublicationWorkerConfig } = require('./server/config/publicationWorker.js');
  const { createPublicationAdapter } = require('./server/adapters/publicationAdapterFactory.js');
  const { runPublicationCycle, runPublicationLoop } = require('./server/services/publicationWorkerRuntime.js');

  const config = resolvePublicationWorkerConfig(process.env, { isProduction });
  await runtimeBootstrap.initializeRuntime({ isProduction, role: RUNTIME_ROLES.PUBLICATION_WORKER });
  const adapter = createPublicationAdapter(config);
  const controller = new AbortController();
  let shuttingDown = false;

  function requestShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[DealScout publisher] ${signal} received; stopping after active work`);
    controller.abort();
  }

  process.once('SIGTERM', () => requestShutdown('SIGTERM'));
  process.once('SIGINT', () => requestShutdown('SIGINT'));

  try {
    if (config.runMode === 'once') {
      const result = await runPublicationCycle(config, adapter);
      console.log(`[DealScout publisher] cycle complete transport=${config.transport} channel=${result.channel} candidates=${result.candidates} enqueued=${result.enqueued} published=${result.published} retries=${result.retriesScheduled} failed=${result.failed}`);
      return;
    }

    console.log(`[DealScout publisher] started transport=${config.transport} channel=${config.channel} pollMs=${config.pollMs}`);
    await runPublicationLoop(config, adapter, {
      signal: controller.signal,
      onCycle(result) {
        if (result.enqueued || result.published || result.retriesScheduled || result.failed) {
          console.log(`[DealScout publisher] cycle transport=${config.transport} channel=${result.channel} candidates=${result.candidates} enqueued=${result.enqueued} published=${result.published} retries=${result.retriesScheduled} failed=${result.failed}`);
        }
      },
      onError(error) {
        console.error('[DealScout publisher] cycle failed:', error?.message || error);
      },
    });
  } finally {
    await postgres.closePool();
    console.log('[DealScout publisher] stopped');
  }
}

startPublicationWorker().catch((error) => {
  console.error('[DealScout publisher] fatal startup error:', error?.message || error);
  process.exitCode = 1;
});
