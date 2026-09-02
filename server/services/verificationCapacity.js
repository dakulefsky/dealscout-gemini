function verificationBatchSize(activeCount, { intervalHours = 12, targetHours = 72, minBatch = 2, maxBatch = 6 } = {}) {
  const count = Math.max(0, Number.parseInt(activeCount, 10) || 0);
  const interval = Number(intervalHours);
  const target = Number(targetHours);
  const minimum = Math.max(1, Number.parseInt(minBatch, 10) || 2);
  const maximum = Math.max(minimum, Number.parseInt(maxBatch, 10) || 6);
  if (count === 0) return 0;
  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(target) || target <= 0) return Math.min(maximum, Math.max(minimum, count));
  const cyclesPerTarget = Math.max(1, Math.floor(target / interval));
  const required = Math.ceil(count / cyclesPerTarget);
  return Math.min(maximum, Math.max(minimum, required));
}

module.exports = { verificationBatchSize };
