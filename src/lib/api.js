/**
 * Thin fetch wrapper that automatically attaches the JWT token from
 * localStorage and throws on non-OK responses.
 */
const BASE_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('ds_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('ds_token', token);
  else localStorage.removeItem('ds_token');
}

function getGuestId() {
  let guestId = localStorage.getItem('ds_guest_id');
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('ds_guest_id', guestId);
  }
  return guestId;
}

async function request(method, path, body) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'x-guest-id': getGuestId(),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
};

export const auth = {
  me:                  ()       => api.get('/api/auth/me'),
  login:               (email, password) => api.post('/api/auth/login', { email, password }),
  register:            (email, password) => api.post('/api/auth/register', { email, password }),
  verifyOtp:           (email, otpCode)  => api.post('/api/auth/verify-otp', { email, otpCode }),
  resendOtp:           (email)           => api.post('/api/auth/resend-otp', { email }),
  forgotPassword:      (email)           => api.post('/api/auth/forgot-password', { email }),
  resetPassword:       (resetToken, newPassword) => api.post('/api/auth/reset-password', { resetToken, newPassword }),
  logout:              ()       => setToken(null),
};

export const deals = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return api.get(`/api/deals${qs ? '?' + qs : ''}`);
  },
  get:    (id)          => api.get(`/api/deals/${id}`),
  create: (data)        => api.post('/api/deals', data),
  update: (id, data)    => api.patch(`/api/deals/${id}`, data),
  delete: (id)          => api.delete(`/api/deals/${id}`),
  expire: (id)          => api.post(`/api/deals/${id}/expire`),
  restore: (id)         => api.post(`/api/deals/${id}/restore`),
  getLifecycleStats: () => api.get('/api/deals/lifecycle-stats'),
  approveAll: ()        => api.post('/api/deals/approve-all'),
  bulkStatus: (ids, status) => api.post('/api/deals/bulk-status', { ids, status }),
  getPriceHistory: (id) => api.get(`/api/deals/${id}/price-history`),
  syncReviews: (id)     => api.post(`/api/deals/${id}/sync-reviews`),
  getStats: ()          => api.get('/api/deals/stats'),
};

export const editorial = {
  get:    (asin)       => api.get(`/api/editorial/${asin}`),
  save:   (asin, data) => api.put(`/api/editorial/${asin}`, data),
  remove: (asin)       => api.delete(`/api/editorial/${asin}`),
};

export const categories = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return api.get(`/api/categories${qs ? '?' + qs : ''}`);
  },
  get:    (id)          => api.get(`/api/categories/${id}`),
  create: (data)        => api.post('/api/categories', data),
  update: (id, data)    => api.patch(`/api/categories/${id}`, data),
  delete: (id)          => api.delete(`/api/categories/${id}`),
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
  amazonRedirect:    (url)                  => api.post('/api/functions/amazon-redirect', { url }),
  fetchDeals:        (maxDeals = 10)        => api.post('/api/functions/fetch-deals', { maxDeals }),
  rainforestStatus:  ()                     => api.get('/api/functions/rainforest-status'),
  rainforestLookup:  (input, amazonDomain)  => api.post('/api/functions/rainforest-lookup', { input, amazonDomain }),
  rainforestSearch:  (query, options = {})  => api.post('/api/functions/rainforest-search', { query, ...options }),
  rainforestReviews: (asin)                 => api.post('/api/functions/rainforest-reviews', { asin }),
  providerStatus:    ()                     => api.get('/api/functions/provider-status'),
  providerSwitch:    (provider)             => api.post('/api/functions/provider-switch', { provider }),
  verifyPrices:      (limit = 15)           => api.post('/api/functions/verify-prices', { limit }),
  purgeExpired:      ()                     => api.post('/api/functions/purge-expired'),
  siteStripeImport:  (input, autoApprove = false) => api.post('/api/functions/sitestripe-import', typeof input === 'object' ? input : { input, inputUrl: input, autoApprove }),
  siteStripeParse:   (input)                      => api.post('/api/functions/parse-sitestripe', typeof input === 'object' ? input : { input, inputUrl: input }),
};
