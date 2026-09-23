import { categories as categoriesApi } from '@/lib/api';

const TTL_MS = 60_000;
let activeCategories = null;
let loadedAt = 0;
let inFlight = null;

export async function getActiveCategories({ force = false } = {}) {
  const now = Date.now();
  if (!force && activeCategories && now - loadedAt < TTL_MS) return activeCategories;
  if (!force && inFlight) return inFlight;

  inFlight = categoriesApi.list()
    .then((rows) => {
      activeCategories = Array.isArray(rows) ? rows : [];
      loadedAt = Date.now();
      return activeCategories;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function clearActiveCategoriesCache() {
  activeCategories = null;
  loadedAt = 0;
  inFlight = null;
}
