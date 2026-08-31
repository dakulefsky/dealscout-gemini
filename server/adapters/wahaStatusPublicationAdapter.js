function createWahaStatusPublicationAdapter(config, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('WAHA publication adapter requires fetch');
  if (!config?.wahaBaseUrl) throw new Error('WAHA publication adapter requires wahaBaseUrl');
  if (!config?.wahaSession) throw new Error('WAHA publication adapter requires wahaSession');

  return {
    async publish({ channel, content }) {
      if (channel !== 'whatsapp_status') {
        const error = new Error('WAHA publication adapter only supports whatsapp_status');
        error.code = 'WAHA_UNSUPPORTED_CHANNEL';
        throw error;
      }
      if (content?.format !== 'image_caption' || !content?.imageUrl || !content?.caption) {
        const error = new Error('WAHA Status requires prepared image_caption content with imageUrl and caption');
        error.code = 'WAHA_INVALID_CONTENT';
        throw error;
      }

      const controller = new AbortController();
      const timeoutMs = Number(config.wahaTimeoutMs || config.webhookTimeoutMs) || 15_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      timeout.unref?.();
      try {
        const url = new URL(`/api/${encodeURIComponent(config.wahaSession)}/status/image`, config.wahaBaseUrl).toString();
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        };
        if (config.wahaApiKey) headers['X-Api-Key'] = config.wahaApiKey;

        const response = await fetchImpl(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            file: {
              mimetype: 'image/jpeg',
              url: content.imageUrl,
            },
            caption: content.caption,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = new Error(`WAHA Status returned HTTP ${response.status}`);
          error.code = 'WAHA_HTTP_ERROR';
          error.status = response.status;
          throw error;
        }

        let payload = {};
        try { payload = await response.json(); } catch { payload = {}; }
        const externalPublicationId = payload?.key?.id || payload?.id || null;
        if (!externalPublicationId) {
          const error = new Error('WAHA Status response did not include a message id');
          error.code = 'WAHA_MISSING_MESSAGE_ID';
          throw error;
        }
        return { externalPublicationId };
      } catch (error) {
        if (controller.signal.aborted && error?.name === 'AbortError') {
          const timeoutError = new Error('WAHA Status publication timed out');
          timeoutError.code = 'WAHA_TIMEOUT';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = { createWahaStatusPublicationAdapter };
