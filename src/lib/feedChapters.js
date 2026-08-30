const CHAPTER_SIZE = 4;
const MAX_INTEREST_CATEGORIES = 2;

function categoryKey(value) {
  return String(value || '').trim().toLowerCase();
}

function dealId(deal) {
  return deal?.id || deal?.asin || '';
}

function takeUnique(deals, used, limit = CHAPTER_SIZE) {
  const picked = [];
  for (const deal of deals || []) {
    const id = dealId(deal);
    if (!id || used.has(id)) continue;
    used.add(id);
    picked.push(deal);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function strongestInterestCategories(interests = {}, limit = MAX_INTEREST_CATEGORIES) {
  return Object.entries(interests || {})
    .map(([category, score]) => ({ category: categoryKey(category), score: Number(score) || 0 }))
    .filter((item) => item.category && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

export function buildFeedChapters(deals = [], interests = {}, initiallyUsedIds = []) {
  const used = new Set(initiallyUsedIds);
  const chapters = [];
  const topInterests = strongestInterestCategories(interests);
  const topCategory = topInterests[0]?.category;

  if (topCategory) {
    const matching = deals.filter((deal) => categoryKey(deal?.category) === topCategory);
    const items = takeUnique(matching, used);
    if (items.length >= 2) {
      const displayCategory = items[0]?.category || topCategory;
      chapters.push({ key: 'personalized-category', eyebrow: 'Picked for you', title: `Because you’re checking out ${displayCategory}`, items });
    }
  }

  const biggestDrops = takeUnique(
    [...deals].sort((a, b) => (Number(b?.discountPercent) || 0) - (Number(a?.discountPercent) || 0)),
    used,
  );
  if (biggestDrops.length >= 2) chapters.push({ key: 'biggest-drops', eyebrow: 'Price movement', title: 'Biggest price drops', items: biggestDrops });

  const under25 = takeUnique(
    deals.filter((deal) => Number(deal?.salePrice) > 0 && Number(deal?.salePrice) < 25),
    used,
  );
  if (under25.length >= 2) chapters.push({ key: 'under-25', eyebrow: 'Quick wins', title: 'Good finds under $25', items: under25 });

  const familiar = new Set(topInterests.map((item) => item.category));
  const discovery = takeUnique(
    deals.filter((deal) => !familiar.has(categoryKey(deal?.category))),
    used,
  );
  if (discovery.length >= 2) chapters.push({ key: 'discovery', eyebrow: 'Explore', title: 'Something different', items: discovery });

  return chapters.slice(0, 4);
}

export function chapterDealIds(chapters = []) {
  return new Set(chapters.flatMap((chapter) => chapter.items || []).map(dealId).filter(Boolean));
}

export { CHAPTER_SIZE };
