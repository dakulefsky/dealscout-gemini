const crypto = require('crypto');
const axios = require('axios');

class AmazonPaapiError extends Error {
  constructor(message, { statusCode = 500, code = 'PAAPI_ERROR', details = null, rawError = null } = {}) {
    super(message);
    this.name = 'AmazonPaapiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.rawError = rawError;
  }
}

function isPaapiConfigured() {
  const accessKey = String(process.env.AMAZON_PAAPI_ACCESS_KEY || '').trim();
  const secretKey = String(process.env.AMAZON_PAAPI_SECRET_KEY || '').trim();
  const partnerTag = String(process.env.AMAZON_PAAPI_PARTNER_TAG || process.env.AMAZON_ASSOCIATE_TAG || '').trim();
  return Boolean(accessKey && secretKey && partnerTag);
}

function getPaapiConfig() {
  const accessKey = String(process.env.AMAZON_PAAPI_ACCESS_KEY || '').trim();
  const secretKey = String(process.env.AMAZON_PAAPI_SECRET_KEY || '').trim();
  const partnerTag = String(process.env.AMAZON_PAAPI_PARTNER_TAG || process.env.AMAZON_ASSOCIATE_TAG || '').trim();
  const host = String(process.env.AMAZON_PAAPI_HOST || 'webservices.amazon.com').trim();
  const region = String(process.env.AMAZON_PAAPI_REGION || 'us-east-1').trim();
  return {
    accessKey,
    secretKey,
    partnerTag,
    host,
    region,
    isConfigured: Boolean(accessKey && secretKey && partnerTag),
    maskedAccessKey: accessKey ? `${accessKey.slice(0, 4)}...${accessKey.slice(-4)}` : null,
    partnerTagSet: Boolean(partnerTag),
  };
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function hash(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function signAwsV4Request({ host, region, target, payload, accessKey, secretKey }) {
  const service = 'ProductAdvertisingAPI';
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/paapi5/${target.split('.').pop().toLowerCase()}`;
  const payloadHash = hash(payload);
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      host,
      'x-amz-date': amzDate,
      'x-amz-target': target,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    url: `https://${host}${canonicalUri}`,
  };
}

async function sendPaapiRequest(target, payloadObj) {
  const config = getPaapiConfig();
  if (!config.isConfigured) {
    throw new AmazonPaapiError('Amazon PA-API v5 is not fully configured (missing Access Key, Secret Key, or Partner Tag).', {
      statusCode: 401,
      code: 'NOT_CONFIGURED',
    });
  }

  const payload = JSON.stringify({ PartnerTag: config.partnerTag, PartnerType: 'Associates', ...payloadObj });
  const { headers, url } = signAwsV4Request({
    host: config.host,
    region: config.region,
    target,
    payload,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  try {
    const response = await axios.post(url, payload, { headers, timeout: 10000 });
    if (Array.isArray(response.data?.Errors) && response.data.Errors.length) {
      const firstError = response.data.Errors[0];
      throw new AmazonPaapiError(`Amazon PA-API error: ${firstError.Message} (${firstError.Code})`, {
        statusCode: 400,
        code: firstError.Code,
        details: response.data.Errors,
      });
    }
    return response.data;
  } catch (err) {
    if (err instanceof AmazonPaapiError) throw err;
    const status = err.response?.status || 500;
    const data = err.response?.data || {};
    const message = data.Errors?.[0]?.Message || data.message || err.message;
    const code = data.Errors?.[0]?.Code || (status === 429 ? 'THROTTLED' : 'API_REQUEST_FAILED');
    throw new AmazonPaapiError(`Amazon PA-API request failed: ${message}`, {
      statusCode: status,
      code,
      details: data,
      rawError: err,
    });
  }
}

const DEFAULT_PAAPI_RESOURCES = [
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'ItemInfo.Features',
  'ItemInfo.Classifications',
  'Offers.Listings.Price',
  'Offers.Listings.SavingBasis',
  'Offers.Listings.DeliveryInfo.IsPrimeEligible',
  'Offers.Listings.Availability.Message',
  'Images.Primary.Large',
  'CustomerReviews.StarRating',
  'CustomerReviews.Count',
];

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function observedNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function canonicalProductUrl(asin, detailPageUrl) {
  const supplied = cleanText(detailPageUrl);
  if (/^https:\/\/(?:www\.)?amazon\.com\//i.test(supplied)) return supplied;
  const tag = String(process.env.AMAZON_PAAPI_PARTNER_TAG || process.env.AMAZON_ASSOCIATE_TAG || '').trim();
  const base = `https://www.amazon.com/dp/${asin}`;
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base;
}

/**
 * Normalize only facts explicitly returned by PA-API. Missing commerce facts stay
 * missing; they are never replaced with guessed prices, ratings, reviews, images,
 * availability, or marketing copy.
 */
function normalizePaapiItem(item) {
  const asin = cleanText(item?.ASIN).toUpperCase();
  const title = cleanText(item?.ItemInfo?.Title?.DisplayValue);
  if (!/^[A-Z0-9]{10}$/.test(asin) || !title) return null;

  const listing = item?.Offers?.Listings?.[0] || null;
  const salePrice = observedNumber(listing?.Price?.Amount);
  const savingBasis = observedNumber(listing?.SavingBasis?.Amount);
  const hasObservedDiscount = salePrice !== null && salePrice > 0 && savingBasis !== null && savingBasis > salePrice;
  const originalPrice = hasObservedDiscount ? savingBasis : salePrice;
  const discountPercent = hasObservedDiscount
    ? Number((((savingBasis - salePrice) / savingBasis) * 100).toFixed(1))
    : 0;
  const features = Array.isArray(item?.ItemInfo?.Features?.DisplayValues)
    ? item.ItemInfo.Features.DisplayValues.map(cleanText).filter(Boolean)
    : [];
  const imageUrl = cleanText(item?.Images?.Primary?.Large?.URL) || null;
  const rating = observedNumber(item?.CustomerReviews?.StarRating?.Value);
  const ratingsTotal = observedNumber(item?.CustomerReviews?.Count);

  return {
    asin,
    title,
    brand: cleanText(item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue) || null,
    category: cleanText(item?.ItemInfo?.Classifications?.Binding?.DisplayValue)
      || cleanText(item?.ItemInfo?.Classifications?.ProductGroup?.DisplayValue)
      || null,
    salePrice: salePrice !== null && salePrice > 0 ? salePrice : null,
    originalPrice: originalPrice !== null && originalPrice > 0 ? originalPrice : null,
    discountPercent,
    savingsAmount: hasObservedDiscount ? Number((savingBasis - salePrice).toFixed(2)) : 0,
    imageUrl,
    productUrl: canonicalProductUrl(asin, item?.DetailPageURL),
    rating,
    ratingsTotal: ratingsTotal !== null && ratingsTotal >= 0 ? ratingsTotal : null,
    shortBio: features[0] || '',
    fullSummary: features.join(' '),
    pros: '',
    cons: '',
    reviews: [],
    isPrime: listing?.DeliveryInfo?.IsPrimeEligible === true,
    availability: cleanText(listing?.Availability?.Message) || null,
    sourceProvider: 'AMAZON_PAAPI_V5',
    rawSourceData: `Amazon PA-API v5 observed product facts | ASIN: ${asin}`,
  };
}

async function getItems(itemIds, { resources = DEFAULT_PAAPI_RESOURCES, condition = 'New' } = {}) {
  const asins = (Array.isArray(itemIds) ? itemIds : [itemIds])
    .map((value) => cleanText(value).toUpperCase())
    .filter((asin) => /^[A-Z0-9]{10}$/.test(asin));
  if (!asins.length) return [];
  const response = await sendPaapiRequest('com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems', {
    ItemIds: asins.slice(0, 10),
    ItemIdType: 'ASIN',
    Resources: resources,
    Condition: condition,
  });
  const allowed = new Set(asins.slice(0, 10));
  return (response.ItemsResult?.Items || [])
    .filter((item) => allowed.has(cleanText(item?.ASIN).toUpperCase()))
    .map(normalizePaapiItem)
    .filter(Boolean);
}

async function searchItems(keywords, { searchIndex = 'All', itemPage = 1, itemCount = 10, resources = DEFAULT_PAAPI_RESOURCES } = {}) {
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
    results: items.map(normalizePaapiItem).filter(Boolean),
  };
}

module.exports = {
  AmazonPaapiError,
  isPaapiConfigured,
  getPaapiConfig,
  getItems,
  searchItems,
  normalizePaapiItem,
  sendPaapiRequest,
};
