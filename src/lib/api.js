/**
 * Small fetch client shared by the shopper and admin UI.
 *
 * - attaches the local auth token and anonymous guest id
 * - bounds requests with a timeout
 * - supports caller cancellation for search/navigation races
 * - normalizes API and network failures into Error objects
 */
const BASE_URL = import.meta.env.VITE_API_URL || '';
const DEFAULT_TIMEOUT_MS = 15000;

function getToken() {
  return localStorage.getItem('ds_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('ds_token', token);
  else localStorage.removeItem('ds_token');
}

function randomGuestId() {
  if (globalThis.crypto?.randomUUID) return `guest_${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean)) return `guest_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getGuestId() {
  let guestId = localStorage.getItem('ds_guest_id');
  if (!guestId) {
    guestId = randomGuestId();
    localStorage.setItem('ds_guest_id', guestId);
  }
  return guestId;
}

function linkedAbortController(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  const timeout = Number(timeoutMs) > 0
    ? window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), Number(timeoutMs))
    : null;

  return {
    controller,
    cleanup() {
      if (timeout !== null) window.clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function request(method, path, body, options = {}) {
  const token = getToken();
  const headers = {
    Accept: 'application/json',
    'x-guest-id': getGuestId(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const { controller, cleanup } = linkedAbortController(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = {};
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { data = await res.json(); } catch { data = {}; }
    }

    if (!res.ok) {
      const err = new Error(data.error || `Request failed: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw err;
  } finally {
    cleanup();
  }
}

export const api = {
  get:    (path, options)       => request('GET', path, undefined, options),
  post:   (path, body, options) => request('POST', path, body, options),
  put:    (path, body, options) => request('PUT', path, body, options),
  patch:  (path, body, options) => request('PATCH', path, body, options),
  delete: (path, options)       => request('DELETE', path, undefined, options),
};

export const auth = {
  me:             () => api.get('/api/auth/me'),
  login:          (email, password) => api.post('/api/auth/login', { email, password }),
  register:       (email, password) => api.post('/api/auth/register', { email, password }),
  verifyOtp:      (email, otpCode) => api.post('/api/auth/verify-otp', { email, otpCode }),
  resendOtp:      (email) => api.post('/api/auth/resend-otp', { email }),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword:  (resetToken, newPassword) => api.post('/api/auth/reset-password', { resetToken, newPassword }),
  logout:         () => setToken(null),
};

export const deals = {
  list: (params = {}, options) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== ''))
    ).toString();
    return api.get(`/api/deals${qs ? `?${qs}` : ''}`, options);
  },
  get:    (id, options) => api.get(`/api/deals/${id}`, options),
  create: (data) => api.post('/api/deals', data),
  update: (id, data) => api.patch(`/api/deals/${id}`, data),
  delete: (id) => api.delete(`/api/deals/${id}`),
  expire: (id) => api.post(`/api/deals/${id}/expire`),
  restore: (id) => api.post(`/api/deals/${id}/restore`),
  approveAll: () => api.post('/api/deals/approve-all'),
  bulkStatus: (ids, status) => api.post('/api/deals/bulk-status', { ids, status }),
  getPriceHistory: (id, options) => api.get(`/api/deals/${id}/price-history`, options),
  getStats: () => api.get('/api/deals/stats'),
};

export const editorial = {
  get:    (asin) => api.get(`/api/editorial/${asin}`),
  batch:  (asins) => api.post('/api/editorial/batch', { asins }),
  picks:  (limit = 8) => api.get(`/api/editorial/picks?limit=${encodeURIComponent(limit)}`),
  save:   (asin, data) => api.put(`/api/editorial/${asin}`, data),
  remove: (asin) => api.delete(`/api/editorial/${asin}`),
};

export const categories = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== ''))
    ).toString();
    return api.get(`/api/categories${qs ? `?${qs}` : ''}`);
  },
  get:    (id) => api.get(`/api/categories/${id}`),
  create: (data) => api.post('/api/categories', data),
  update: (id, data) => api.patch(`/api/categories/${id}`, data),
  delete: (id) => api.delete(`/api/categories/${id}`),
};

export const ai = {
  analyzeDeal: (data) => api.post('/api/ai/analyze-deal', data),
  askAssistant: (params) => api.post('/api/ai/ask-deal-assistant', params),
};

export const bookmarks = {
  list: () => api.get('/api/bookmarks'),
  toggle: (dealId, targetPrice) => api.post('/api/bookmarks/toggle', { dealId, targetPrice }),
  setPriceAlert: (dealId, targetPrice, email) => api.post('/api/bookmarks/price-alert', { dealId, targetPrice, email }),
};

export const functions = {
  amazonRedirect:    (url) => api.post('/api/functions/amazon-redirect', { url }),
  fetchDeals:        (maxDeals = 10) => api.post('/api/functions/fetch-deals', { maxDeals }),
  rainforestLookup:  (input, amazonDomain) => api.post('/api/functions/rainforest-lookup', { input, amazonDomain }),
  rainforestSearch:  (query, options = {}) => api.post('/api/functions/rainforest-search', { query, ...options }),
  providerStatus:    () => api.get('/api/functions/provider-status'),
  providerSwitch:    (provider) => api.post('/api/functions/provider-switch', { provider }),
  verifyPrices:      (limit = 15) => api.post('/api/functions/verify-prices', { limit }),
  imageHealth:       () => api.get('/api/functions/image-health'),
  integrityHealth:   () => api.get('/api/functions/integrity-health'),
  legacyEnrichmentPreview: () => api.get('/api/functions/legacy-enrichment-cleanup'),
  cleanupLegacyEnrichment: () => api.post('/api/functions/legacy-enrichment-cleanup'),
  adminActivity:     (limit = 12) => api.get(`/api/functions/admin-activity?limit=${encodeURIComponent(limit)}`),
  repairImages:      (limit = 20) => api.post('/api/functions/repair-images', { limit }),
  purgeExpired:      () => api.post('/api/functions/purge-expired'),
  siteStripeImport:  (input, autoApprove = false) => api.post('/api/functions/sitestripe-import', typeof input === 'object' ? input : { input, inputUrl: input, autoApprove }),
  siteStripeParse:   (input) => api.post('/api/functions/parse-sitestripe', typeof input === 'object' ? input : { input, inputUrl: input }),
};
