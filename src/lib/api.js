import { createDealScoutClient } from './apiCore';
import { createBrowserIdentity } from './browserIdentity';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const identity = createBrowserIdentity({ storage: () => globalThis.localStorage });
export const getToken = identity.getToken;
export const setToken = identity.setToken;
const getGuestId = identity.getGuestId;

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
export const bounties = client.bounties;
export const ai = client.ai;
export const bookmarks = client.bookmarks;
export const functions = client.functions;
