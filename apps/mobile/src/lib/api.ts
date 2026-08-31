import * as SecureStore from 'expo-secure-store';

const API_URL = String(process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const API_PREFIX = '/api/v1';
const GUEST_KEY = 'dealscout_guest_id';
const REQUEST_TIMEOUT_MS = 15000;

export type Deal = {
  id: string;
  asin: string;
  title: string;
  category: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  imageUrl?: string | null;
  productUrl?: string | null;
  qualityScore?: number;
  sourceVerified: boolean;
  priceCheckAt?: number | null;
  created_date?: string | null;
  savedAt?: number | null;
  targetPrice?: number | null;
};

export type FeedPage = {
  items: Deal[];
  nextCursor: string | null;
};

let guestIdCache: string | null = null;

function createGuestId() {
  const entropy = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 16)}`.replace(/[^a-z0-9]/gi, '');
  return `guest_${entropy}`;
}

export async function getGuestId() {
  if (guestIdCache) return guestIdCache;
  const stored = await SecureStore.getItemAsync(GUEST_KEY);
  if (stored) {
    guestIdCache = stored;
    return stored;
  }
  const created = createGuestId();
  await SecureStore.setItemAsync(GUEST_KEY, created);
  guestIdCache = created;
  return created;
}

function assertConfigured() {
  if (!API_URL) throw new Error('DealScout API is not configured for this build. Set EXPO_PUBLIC_API_URL.');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  const guestId = await getGuestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${API_PREFIX}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-guest-id': guestId,
        ...(init.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function getFeed({ cursor, limit = 20, category }: { cursor?: string | null; limit?: number; category?: string } = {}) {
  const params = new URLSearchParams({ limit: String(limit), sort: 'quality' });
  if (cursor) params.set('cursor', cursor);
  if (category) params.set('category', category);
  return request<FeedPage>(`/deals/feed?${params.toString()}`);
}

export function getDeal(id: string) {
  return request<Deal>(`/deals/${encodeURIComponent(id)}`);
}

export function getSavedDeals() {
  return request<{ deals: Deal[]; bookmarkIds: string[] }>('/bookmarks');
}

export function toggleSaved(dealId: string) {
  return request<{ success: boolean; isSaved: boolean; dealId: string; totalSaved: number }>('/bookmarks/toggle', {
    method: 'POST',
    body: JSON.stringify({ dealId }),
  });
}

export function apiConfiguration() {
  return { apiUrl: API_URL, version: 1 };
}
