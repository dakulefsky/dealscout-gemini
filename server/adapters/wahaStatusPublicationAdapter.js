function wahaHeaders(config, { json = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (json) headers['Content-Type'] = 'application/json';
  if (config.wahaApiKey) headers['X-Api-Key'] = config.wahaApiKey;
  return headers;
}

async function withWahaTimeout(config, task, { operation = 'WAHA request' } = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(config.wahaTimeoutMs || config.webhookTimeoutMs) || 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted && error?.name === 'AbortError') {
      const timeoutError = new Error(`${operation} timed out`);
      timeoutError.code = 'WAHA_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function createWahaStatusPublicationAdapter(config, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('WAHA publication adapter requires fetch');
  if (!config?.wahaBaseUrl) throw new Error('WAHA publication adapter requires wahaBaseUrl');
  if (!config?.wahaSession) throw new Error('WAHA publication adapter requires wahaSession');

  return {
    async preflight() {
      return withWahaTimeout(config, async (signal) => {
        const url = new URL(`/api/sessions/${encodeURIComponent(config.wahaSession)}`, config.wahaBaseUrl).toString();
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: wahaHeaders(config),
          signal,
        });
        if (!response.ok) {
          const error = new Error(`WAHA session preflight returned HTTP ${response.status}`);
          error.code = 'WAHA_PREFLIGHT_HTTP_ERROR';
          error.status = response.status;
          throw error;
        }
        let payload = {};
        try { payload = await response.json(); } catch { payload = {}; }
        const status = String(payload?.status || '').trim().toUpperCase();
        if (status !== 'WORKING') {
          const error = new Error(`WAHA session ${config.wahaSession} is not WORKING (status=${status || 'unknown'})`);
          error.code = 'WAHA_SESSION_NOT_WORKING';
          error.sessionStatus = status || null;
          throw error;
        }
        return {
          status,
          session: payload?.name || config.wahaSession,
          engine: payload?.engine?.engine || payload?.engine || null,
        };
      }, { operation: 'WAHA session preflight' });
    },

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

      return withWahaTimeout(config, async (signal) => {
        const url = new URL(`/api/${encodeURIComponent(config.wahaSession)}/status/image`, config.wahaBaseUrl).toString();
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: wahaHeaders(config, { json: true }),
          body: JSON.stringify({
            file: {
              mimetype: 'image/jpeg',
              url: content.imageUrl,
            },
            caption: content.caption,
          }),
          signal,
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
      }, { operation: 'WAHA Status publication' });
    },
  };
}

module.exports = { createWahaStatusPublicationAdapter, wahaHeaders, withWahaTimeout };
