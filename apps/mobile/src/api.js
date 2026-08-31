import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createDealScoutClient } from '../../../src/lib/apiCore';

const TOKEN_KEY = 'dealscout-auth-token-v1';
const GUEST_KEY = 'dealscout-guest-id-v1';

function requireApiUrl() {
  const value = String(process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (!value) throw new Error('EXPO_PUBLIC_API_URL is required for the DealScout mobile app');
  if (!/^https:\/\//i.test(value) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value)) {
    throw new Error('DealScout mobile API URL must use HTTPS outside local development');
  }
  return value;
}

let guestIdPromise;
async function getGuestId() {
  if (!guestIdPromise) {
    guestIdPromise = (async () => {
      const existing = await SecureStore.getItemAsync(GUEST_KEY);
      if (existing) return existing;
      const created = Crypto.randomUUID();
      await SecureStore.setItemAsync(GUEST_KEY, created);
      return created;
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
