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

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
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
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
};

// ── Auth ─────────────────────────────────────────────────────────────────
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

// ── Entities ───────────────────────────────────────────────────────────
export const deals = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return api.get(`/api/deals${qs ? '?' + qs : ''}`);
  },
  get:    (id)          => api.get(`/api/deals/${id}`),
  create: (data)        => api.post('/api/deals', data),
  update: (id, data)    => api.patch(`/api/deals/${id}`, data),
  delete: (id)          => api.delete(`/api/deals/${id}`),
};

export const categories = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return api.get(`/api/categories${qs ? '?' + qs : ''}`);
  },
  get:    (id)          => api.get(`/api/categories/${id}`),
  create: (data)        => api.post('/api/categories', data),
  update: (id, data)    => api.patch(`/api/categories/${id}`, data),
  delete: (id)          => api.delete(`/api/categories/${id}`),
};

// ── Functions ──────────────────────────────────────────────────────────
export const functions = {
  amazonRedirect: (url)          => api.post('/api/functions/amazon-redirect', { url }),
  fetchDeals:     (maxDeals = 10) => api.post('/api/functions/fetch-deals', { maxDeals }),
};
