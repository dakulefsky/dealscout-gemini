function verificationBatchSize(activeCount, { intervalHours = 6, targetHours = 24, minBatch = 10, maxBatch = 50 } = {}) {
  const count = Math.max(0, Number.parseInt(activeCount, 10) || 0);
  const interval = Number(intervalHours);
  const target = Number(targetHours);
  const minimum = Math.max(1, Number.parseInt(minBatch, 10) || 10);
  const maximum = Math.max(minimum, Number.parseInt(maxBatch, 10) || 50);
  if (count === 0) return 0;
  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(target) || target <= 0) return Math.min(maximum, Math.max(minimum, count));
  const cyclesPerTarget = Math.max(1, Math.floor(target / interval));
  const required = Math.ceil(count / cyclesPerTarget);
  return Math.min(maximum, Math.max(minimum, required));
}

module.exports = { verificationBatchSize };
