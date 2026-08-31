function buildPublicationEnvelope({ channel, job, content }) {
  return {
    version: 1,
    channel,
    job: {
      id: job?.id || null,
      asin: job?.asin || content?.facts?.asin || null,
      sourcePriceCheckAt: Number(job?.source_price_check_at || content?.verification?.priceCheckAt || 0) || null,
    },
    content,
  };
}

function createWebhookPublicationAdapter(config, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Webhook publication adapter requires fetch');
  if (!config?.webhookUrl) throw new Error('Webhook publication adapter requires webhookUrl');

  return {
    async publish({ channel, job, content }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(config.webhookTimeoutMs) || 15_000);
      timeout.unref?.();
      try {
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': String(job?.idempotency_key || job?.id || `${channel}:${job?.asin || content?.facts?.asin || 'unknown'}`),
        };
        if (config.webhookToken) headers.Authorization = `Bearer ${config.webhookToken}`;

        const response = await fetchImpl(config.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildPublicationEnvelope({ channel, job, content })),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = new Error(`Publication webhook returned HTTP ${response.status}`);
          error.code = 'PUBLICATION_WEBHOOK_HTTP_ERROR';
          error.status = response.status;
          throw error;
        }

        let payload = {};
        const contentType = response.headers?.get?.('content-type') || '';
        if (contentType.includes('application/json')) {
          try { payload = await response.json(); } catch { payload = {}; }
        }
        return {
          externalPublicationId: payload.externalPublicationId || payload.publicationId || payload.id || response.headers?.get?.('x-publication-id') || null,
        };
      } catch (error) {
        if (controller.signal.aborted && error?.name === 'AbortError') {
          const timeoutError = new Error('Publication webhook timed out');
          timeoutError.code = 'PUBLICATION_WEBHOOK_TIMEOUT';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = { createWebhookPublicationAdapter, buildPublicationEnvelope };
