import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createDealScoutClient } from '../../../src/lib/apiCore';

const TOKEN_KEY = 'dealscout-auth-token-v1';
const GUEST_KEY = 'dealscout-guest-id-v1';
const GUEST_ID_RE = /^guest_[a-z0-9_-]{9,80}$/i;
const LEGACY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireApiUrl() {
  const value = String(process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (!value) throw new Error('EXPO_PUBLIC_API_URL is required for the DealScout mobile app');
  if (!/^https:\/\//i.test(value) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value)) {
    throw new Error('DealScout mobile API URL must use HTTPS outside local development');
  }
  return value;
}

async function persistGuestId(value) {
  await SecureStore.setItemAsync(GUEST_KEY, value);
  return value;
}

let guestIdPromise;
async function getGuestId() {
  if (!guestIdPromise) {
    guestIdPromise = (async () => {
      const existing = String(await SecureStore.getItemAsync(GUEST_KEY) || '').trim();
      if (GUEST_ID_RE.test(existing)) return existing;
      if (LEGACY_UUID_RE.test(existing)) return persistGuestId(`guest_${existing}`);
      return persistGuestId(`guest_${Crypto.randomUUID()}`);
    })().catch((error) => {
      guestIdPromise = null;
      throw error;
    });
  }
  return guestIdPromise;
}

async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token) {
  if (!token) await SecureStore.deleteItemAsync(TOKEN_KEY);
  else await SecureStore.setItemAsync(TOKEN_KEY, String(token));
}

const client = createDealScoutClient({
  baseUrl: requireApiUrl(),
  getGuestId,
  getToken,
});

export const { deals, categories, bookmarks, auth } = client;
export { getGuestId, getToken, setToken };
