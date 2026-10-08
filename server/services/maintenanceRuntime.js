async function runMaintenanceOnce({ bootstrap, cron, postgres }) {
  try {
    await bootstrap.initializeRuntime({ isProduction: true, role: 'maintenance' });
    const result = await cron.runFullCycle({ scheduled: true });
    // Quota deferral and not-due/locked lanes are normal. Real lane failures
    // must make the job fail visibly rather than report a false green run.
    const failed = Object.entries(result).filter(([, lane]) => lane?.status === 'NOTICE' && lane.error);
    if (failed.length) {
      throw new Error(`Maintenance lanes failed: ${failed.map(([key]) => key).join(', ')}`);
    }
    return result;
  } finally {
    cron.stop();
    await postgres.closePool();
  }
}

module.exports = { runMaintenanceOnce };
