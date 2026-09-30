export function interleaveCategories(items) {
  const queues = new Map();
  for (const item of items || []) {
    const category = String(item?.category || '').trim().toLocaleLowerCase() || 'uncategorized';
    if (!queues.has(category)) queues.set(category, []);
    queues.get(category).push(item);
  }

  const ordered = [];
  while (queues.size) {
    for (const [category, queue] of queues) {
      ordered.push(queue.shift());
      if (queue.length === 0) queues.delete(category);
    }
  }
  return ordered;
}
