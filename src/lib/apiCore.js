const SHOPPER_API = '/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

function cleanBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/$/, '');
}

function queryString(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value != null && value !== '');
  return new URLSearchParams(Object.fromEntries(entries)).toString();
}

function createTimeoutController(externalSignal, timeoutMs, {
  AbortControllerImpl = globalThis.AbortController,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  if (typeof AbortControllerImpl !== 'function') {
    throw new Error('AbortController is required by the DealScout API client');
  }
  const controller = new AbortControllerImpl();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener?.('abort', onExternalAbort, { once: true });

  const timeout = Number(timeoutMs) > 0
    ? setTimeoutImpl(() => controller.abort('timeout'), Number(timeoutMs))
    : null;

  return {
    controller,
    cleanup() {
      if (timeout !== null) clearTimeoutImpl(timeout);
      externalSignal?.removeEventListener?.('abort', onExternalAbort);
    },
  };
}

function createDealScoutClient({
  baseUrl = '',
  fetchImpl = globalThis.fetch,
  getToken = async () => null,
  getGuestId = async () => null,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  timers,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
  const resolvedBaseUrl = cleanBaseUrl(baseUrl);

  async function request(method, path, body, options = {}) {
    const [token, guestId] = await Promise.all([getToken(), getGuestId()]);
    const headers = { Accept: 'application/json' };
    if (guestId) headers['x-guest-id'] = String(guestId);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const { controller, cleanup } = createTimeoutController(
      options.signal,
      options.timeoutMs ?? defaultTimeoutMs,
      timers,
    );

    try {
      const response = await fetchImpl(`${resolvedBaseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      let data = {};
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.includes('application/json')) {
        try { data = await response.json(); } catch { data = {}; }
      }

      if (!response.ok) {
        const error = new Error(data.error || `Request failed: ${response.status}`);
        error.status = response.status;
        error.code = data.code || null;
        error.requestId = data.requestId || response.headers?.get?.('x-request-id') || null;
        error.data = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) {
        const timeoutError = new Error('Request timed out');
        timeoutError.name = 'TimeoutError';
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      cleanup();
    }
  }

  const api = {
    get: (path, options) => request('GET', path, undefined, options),
    post: (path, body, options) => request('POST', path, body, options),
    put: (path, body, options) => request('PUT', path, body, options),
    patch: (path, body, options) => request('PATCH', path, body, options),
    delete: (path, options) => request('DELETE', path, undefined, options),
  };

  const auth = {
    me: () => api.get(`${SHOPPER_API}/auth/me`),
    login: (email, password) => api.post(`${SHOPPER_API}/auth/login`, { email, password }),
    register: (email, password) => api.post(`${SHOPPER_API}/auth/register`, { email, password }),
    verifyOtp: (email, otpCode) => api.post(`${SHOPPER_API}/auth/verify-otp`, { email, otpCode }),
    resendOtp: (email) => api.post(`${SHOPPER_API}/auth/resend-otp`, { email }),
    forgotPassword: (email) => api.post(`${SHOPPER_API}/auth/forgot-password`, { email }),
    resetPassword: (resetToken, newPassword) => api.post(`${SHOPPER_API}/auth/reset-password`, { resetToken, newPassword }),
  };

  const deals = {
    list: (params = {}, options) => {
      const qs = queryString(params);
      return api.get(`${SHOPPER_API}/deals${qs ? `?${qs}` : ''}`, options);
    },
    page: (params = {}, options) => {
      const qs = queryString(params);
      return api.get(`${SHOPPER_API}/deals/feed${qs ? `?${qs}` : ''}`, options);
    },
    get: (id, options) => api.get(`${SHOPPER_API}/deals/${encodeURIComponent(id)}`, options),
    create: (data) => api.post(`${SHOPPER_API}/deals`, data),
    update: (id, data) => api.patch(`${SHOPPER_API}/deals/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`${SHOPPER_API}/deals/${encodeURIComponent(id)}`),
    expire: (id) => api.post(`${SHOPPER_API}/deals/${encodeURIComponent(id)}/expire`),
    restore: (id) => api.post(`${SHOPPER_API}/deals/${encodeURIComponent(id)}/restore`),
    approveAll: () => api.post(`${SHOPPER_API}/deals/approve-all`),
    bulkStatus: (ids, status) => api.post(`${SHOPPER_API}/deals/bulk-status`, { ids, status }),
    getPriceHistory: (id, options) => api.get(`${SHOPPER_API}/deals/${encodeURIComponent(id)}/price-history`, options),
    getStats: () => api.get(`${SHOPPER_API}/deals/stats`),
  };

  const categories = {
    list: (params = {}) => {
      const qs = queryString(params);
      return api.get(`${SHOPPER_API}/categories${qs ? `?${qs}` : ''}`);
    },
    get: (id) => api.get(`${SHOPPER_API}/categories/${encodeURIComponent(id)}`),
    create: (data) => api.post(`${SHOPPER_API}/categories`, data),
    update: (id, data) => api.patch(`${SHOPPER_API}/categories/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`${SHOPPER_API}/categories/${encodeURIComponent(id)}`),
  };

  const bookmarks = {
    list: () => api.get(`${SHOPPER_API}/bookmarks`),
    toggle: (dealId, targetPrice) => api.post(`${SHOPPER_API}/bookmarks/toggle`, { dealId, targetPrice }),
    setPriceAlert: (dealId, targetPrice, email) => api.post(`${SHOPPER_API}/bookmarks/price-alert`, { dealId, targetPrice, email }),
  };

  // Private operational surfaces are exposed for the browser admin adapter but
  // deliberately remain outside the stable shopper/mobile v1 compatibility contract.
  const editorial = {
    get: (asin) => api.get(`/api/editorial/${encodeURIComponent(asin)}`),
    batch: (asins) => api.post('/api/editorial/batch', { asins }),
    picks: (limit = 8) => api.get(`/api/editorial/picks?limit=${encodeURIComponent(limit)}`),
    save: (asin, data) => api.put(`/api/editorial/${encodeURIComponent(asin)}`, data),
    remove: (asin) => api.delete(`/api/editorial/${encodeURIComponent(asin)}`),
  };

  const ai = {
    analyzeDeal: (data) => api.post('/api/ai/analyze-deal', data),
    askAssistant: (params) => api.post('/api/ai/ask-deal-assistant', params),
  };

  const functions = {
    amazonRedirect: (url) => api.post('/api/functions/amazon-redirect', { url }),
    fetchDeals: (maxDeals = 10) => api.post('/api/functions/fetch-deals', { maxDeals }),
    rainforestLookup: (input, amazonDomain) => api.post('/api/functions/rainforest-lookup', { input, amazonDomain }),
    rainforestSearch: (query, options = {}) => api.post('/api/functions/rainforest-search', { query, ...options }),
    providerStatus: () => api.get('/api/functions/provider-status'),
    verifyPrices: (limit = 15) => api.post('/api/functions/verify-prices', { limit }),
    imageHealth: () => api.get('/api/functions/image-health'),
    integrityHealth: () => api.get('/api/functions/integrity-health'),
    publicationHealth: () => api.get('/api/functions/publication-health'),
    channelSettings: () => api.get('/api/functions/channel-settings'),
    setWhatsAppStatusEnabled: (enabled) => api.post('/api/functions/channel-settings', { whatsappStatusEnabled: Boolean(enabled) }),
    legacyEnrichmentPreview: () => api.get('/api/functions/legacy-enrichment-cleanup'),
    cleanupLegacyEnrichment: () => api.post('/api/functions/legacy-enrichment-cleanup'),
    adminActivity: (limit = 12) => api.get(`/api/functions/admin-activity?limit=${encodeURIComponent(limit)}`),
    repairImages: (limit = 20) => api.post('/api/functions/repair-images', { limit }),
    purgeExpired: () => api.post('/api/functions/purge-expired'),
    siteStripeImport: (input, autoApprove = false) => api.post('/api/functions/sitestripe-import', typeof input === 'object' ? input : { input, inputUrl: input, autoApprove }),
    siteStripeParse: (input) => api.post('/api/functions/parse-sitestripe', typeof input === 'object' ? input : { input, inputUrl: input }),
  };

  return { api, auth, deals, categories, bookmarks, editorial, ai, functions };
}

export { SHOPPER_API, DEFAULT_TIMEOUT_MS, cleanBaseUrl, queryString, createTimeoutController, createDealScoutClient };
