export const INITIAL_FEED_SIZE = 16;
export const FEED_PAGE_SIZE = 12;

export function nextVisibleCount(current, total, pageSize = FEED_PAGE_SIZE) {
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePage = Math.max(1, Number(pageSize) || FEED_PAGE_SIZE);
  return Math.min(safeTotal, safeCurrent + safePage);
}

export function dealDrop(deals, limit = 8) {
  return (deals || []).slice(0, Math.max(0, limit));
}
