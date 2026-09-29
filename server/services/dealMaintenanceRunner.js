async function runDealMaintenance({ initializeRuntime, runFullCycle, closePool, isProduction, role, log = console }) {
  try {
    await initializeRuntime({ isProduction, role });
    const result = await runFullCycle({ scheduled: true });
    log.log('[DealScout maintenance] cycle:', JSON.stringify(result));
    if (result?.discovery?.status === 'NOTICE') {
      throw new Error(`Deal discovery failed: ${result.discovery.error || 'unknown error'}`);
    }
    return result;
  } finally {
    await closePool();
  }
}

module.exports = { runDealMaintenance };
