import { categories as categoriesApi } from '@/lib/api';

const TTL_MS = 10_000;
let activeCategories = null;
let loadedAt = 0;
let inFlight = null;

export function getActiveCategories() {
  if (activeCategories && Date.now() - loadedAt < TTL_MS) return Promise.resolve(activeCategories);
  if (inFlight) return inFlight;

  inFlight = categoriesApi.list()
    .then((rows) => {
      activeCategories = Array.isArray(rows) ? rows : [];
      loadedAt = Date.now();
      return activeCategories;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}
