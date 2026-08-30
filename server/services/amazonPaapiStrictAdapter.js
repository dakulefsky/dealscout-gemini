const { sendPaapiRequest, getPaapiConfig } = require('./amazonPaapiService');
const { isAmazonUrl, formatAffiliateUrl } = require('./amazonUrlService');
const { normalizeAvailability } = require('./availabilityService');

const STRICT_RESOURCES = [
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'ItemInfo.Classifications',
  'Offers.Listings.Price',
  'Offers.Listings.SavingBasis',
  'Offers.Listings.DeliveryInfo.IsPrimeEligible',
  'Offers.Listings.Availability.Message',
  'Images.Primary.Large',
];

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function strictAffiliateUrl(asin, detailPageUrl) {
  const tag = String(process.env.AMAZON_PAAPI_PARTNER_TAG || process.env.AMAZON_ASSOCIATE_TAG || '').trim();
  if (!tag) throw new Error('Amazon Associate tag is required for PA-API product URLs');
  const supplied = cleanText(detailPageUrl);
  const canonical = `https://www.amazon.com/dp/${asin}`;
  const amazonUrl = supplied && isAmazonUrl(supplied) ? supplied : canonical;
  return formatAffiliateUrl(amazonUrl, tag);
}

function normalizeStrictPaapiItem(item, { allowNonDeal = false } = {}) {
  const asin = cleanText(item?.ASIN).toUpperCase();
  const title = cleanText(item?.ItemInfo?.Title?.DisplayValue);
  if (!/^[A-Z0-9]{10}$/.test(asin) || !title) return null;

  const listing = item?.Offers?.Listings?.[0];
  const salePrice = Number(listing?.Price?.Amount);
  const savingBasis = Number(listing?.SavingBasis?.Amount);
  if (!Number.isFinite(salePrice) || salePrice <= 0) return null;

  const hasVerifiedDiscount = Number.isFinite(savingBasis) && savingBasis > salePrice;
  if (!hasVerifiedDiscount && !allowNonDeal) return null;
  const originalPrice = hasVerifiedDiscount ? savingBasis : salePrice;

  const imageUrl = cleanText(item?.Images?.Primary?.Large?.URL) || null;
  const brand = cleanText(item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue) || null;
  const category = cleanText(item?.ItemInfo?.Classifications?.Binding?.DisplayValue)
    || cleanText(item?.ItemInfo?.Classifications?.ProductGroup?.DisplayValue)
    || 'Amazon';
  const availability = normalizeAvailability(listing?.Availability?.Message);
  const discountPercent = Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1));

  return {
    asin,
    title,
    brand,
    category,
    salePrice,
    originalPrice,
    discountPercent,
    savingsAmount: Number((originalPrice - salePrice).toFixed(2)),
    imageUrl,
    imageGallery: imageUrl ? [imageUrl] : [],
    productUrl: strictAffiliateUrl(asin, item.DetailPageURL),
    rawProductUrl: isAmazonUrl(cleanText(item.DetailPageURL)) ? cleanText(item.DetailPageURL) : `https://www.amazon.com/dp/${asin}`,
    rating: null,
    ratingsTotal: 0,
    reviews: [],
    shortBio: '',
    fullSummary: '',
    pros: '',
    cons: '',
    isPrime: listing?.DeliveryInfo?.IsPrimeEligible === true,
    availability,
    sourceProvider: 'AMAZON_PAAPI',
    sourceVerified: true,
    isDeal: hasVerifiedDiscount,
    rawSourceData: `Amazon PA-API verified price facts | ASIN: ${asin}`,
  };
}

function onlyRequestedAsins(items, requestedAsins) {
  const allowed = new Set((requestedAsins || []).map((asin) => cleanText(asin).toUpperCase()));
  return (items || []).filter((item) => allowed.has(cleanText(item?.ASIN).toUpperCase()));
}

async function strictGetItems(itemIds, { resources = STRICT_RESOURCES, condition = 'New', allowNonDeal = false } = {}) {
  const asins = (Array.isArray(itemIds) ? itemIds : [itemIds])
    .map((asin) => cleanText(asin).toUpperCase())
    .filter((asin) => /^[A-Z0-9]{10}$/.test(asin));
  if (!asins.length) return [];

  const response = await sendPaapiRequest('com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems', {
    ItemIds: asins.slice(0, 10),
    ItemIdType: 'ASIN',
    Resources: resources,
    Condition: condition,
  });
  return onlyRequestedAsins(response.ItemsResult?.Items || [], asins)
    .map((item) => normalizeStrictPaapiItem(item, { allowNonDeal }))
    .filter(Boolean);
}

async function strictSearchItems(keywords, { searchIndex = 'All', itemPage = 1, itemCount = 10, resources = STRICT_RESOURCES } = {}) {
  const response = await sendPaapiRequest('com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems', {
    Keywords: keywords,
    SearchIndex: searchIndex,
    ItemPage: itemPage,
    ItemCount: Math.min(10, itemCount),
    Resources: resources,
  });
  const items = response.SearchResult?.Items || [];
  return {
    totalResults: response.SearchResult?.TotalResultCount || items.length,
    results: items.map((item) => normalizeStrictPaapiItem(item)).filter(Boolean),
  };
}

module.exports = {
  STRICT_RESOURCES,
  getPaapiConfig,
  normalizeStrictPaapiItem,
  onlyRequestedAsins,
  strictGetItems,
  strictSearchItems,
};
