import { createDealScoutClient } from './apiCore';

const TOKEN_KEY = 'ds_token';
const GUEST_ID_KEY = 'ds_guest_id';
const BASE_URL = import.meta.env.VITE_API_URL || '';

function randomGuestId() {
  if (globalThis.crypto?.randomUUID) return `guest_${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean)) return `guest_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function getGuestId() {
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = randomGuestId();
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

const client = createDealScoutClient({
  baseUrl: BASE_URL,
  fetchImpl: (...args) => globalThis.fetch(...args),
  getToken,
  getGuestId,
});

export const api = client.api;
export const auth = { ...client.auth, logout: () => setToken(null) };
export const deals = client.deals;
export const editorial = client.editorial;
export const categories = client.categories;
export const ai = client.ai;
export const bookmarks = client.bookmarks;
export const functions = client.functions;
