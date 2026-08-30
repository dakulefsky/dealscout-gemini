function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function verifiedSourceRefreshChanges(existing, item) {
  const changes = {};
  const title = cleanText(item?.title);
  const category = cleanText(item?.category);
  const productUrl = cleanText(item?.productUrl || item?.product_url);
  const imageUrl = cleanText(item?.imageUrl || item?.image_url);

  if (title && title !== existing?.title) changes.title = title;
  if (category && category !== existing?.category) changes.category = category;
  if (productUrl && productUrl !== existing?.product_url) changes.product_url = productUrl;
  if (imageUrl && imageUrl !== existing?.image_url) changes.image_url = imageUrl;

  return changes;
}

module.exports = { verifiedSourceRefreshChanges };
