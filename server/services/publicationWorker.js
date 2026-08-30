const publication = require('./publicationService');

function normalizeAdapterResult(result) {
  if (result == null) return { externalPublicationId: null };
  if (typeof result === 'string') return { externalPublicationId: result };
  if (typeof result === 'object') {
    return { externalPublicationId: result.externalPublicationId || result.id || null };
  }
  return { externalPublicationId: null };
}

async function runPublicationOnce(channel, adapter, options = {}) {
  if (!adapter || typeof adapter.publish !== 'function') {
    throw new TypeError('Publication adapter must expose an async publish({ channel, job, deal }) function');
  }

  const leased = await publication.leaseNextPublishable(channel, options);
  if (!leased) return { status: 'idle', channel, jobId: null };

  const { job, deal } = leased;
  try {
    const result = normalizeAdapterResult(await adapter.publish({ channel, job, deal }));
    const completed = await publication.completePublication(job.id, result.externalPublicationId, options);
    if (!completed) throw new Error('Publication lease was lost before completion');
    return {
      status: 'published',
      channel,
      jobId: job.id,
      asin: job.asin,
      externalPublicationId: completed.external_publication_id,
    };
  } catch (error) {
    const failed = await publication.failPublication(job.id, error, options);
    return {
      status: failed?.state === 'failed' ? 'failed' : 'retry_scheduled',
      channel,
      jobId: job.id,
      asin: job.asin,
      error: String(error?.message || error || 'Publication failed'),
      nextAttemptAt: failed?.next_attempt_at || null,
    };
  }
}

module.exports = { runPublicationOnce, normalizeAdapterResult };
