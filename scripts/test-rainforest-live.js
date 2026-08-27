/* eslint-disable no-console */
import { createRequire } from 'module';
import axios from 'axios';

process.env.DEAL_DATA_PROVIDER = 'rainforest';

const require = createRequire(import.meta.url);
const { getProviderStatus, fetchProductByAsin, fetchDealsList } = require('../server/services/providerRouter');
const { formatAffiliateUrl } = require('../server/services/rainforestService');

const TEST_ASIN = process.env.TEST_ASIN || 'B0GGGQDY9H';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  return Object.fromEntries(keys.filter((key) => obj[key] !== undefined).map((key) => [key, obj[key]]));
}

async function printSafeRainforestDiagnostics() {
  try {
    const response = await axios.get('https://api.rainforestapi.com/request', {
      params: {
        api_key: process.env.RAINFOREST_API_KEY,
        type: 'product',
        amazon_domain: 'amazon.com',
        asin: TEST_ASIN,
      },
      timeout: 20000,
    });
    const data = response.data || {};
    const product = data.product || {};
    const buybox = product.buybox_winner || {};

    console.log('\nSafe Rainforest diagnostic');
    console.log(`request_info.success: ${data.request_info?.success}`);
    console.log(`product keys: ${Object.keys(product).sort().join(', ')}`);
    console.log('product pricing fields:', JSON.stringify(pick(product, [
      'price', 'list_price', 'rrp', 'was_price', 'deal_price', 'deal_badge', 'availability', 'rating', 'ratings_total',
    ])));
    console.log(`buybox keys: ${Object.keys(buybox).sort().join(', ')}`);
    console.log('buybox pricing fields:', JSON.stringify(pick(buybox, [
      'price', 'list_price', 'rrp', 'was_price', 'deal_price', 'availability', 'is_prime', 'condition',
    ])));
  } catch (error) {
    console.error(`Rainforest diagnostic request failed: ${error.response?.status || ''} ${error.message}`.trim());
    if (error.response?.data?.request_info?.message) {
      console.error(`Rainforest message: ${error.response.data.request_info.message}`);
    }
  }
}

async function main() {
  if (!process.env.RAINFOREST_API_KEY) return fail('RAINFOREST_API_KEY is not configured');
  if (!process.env.AMAZON_ASSOCIATE_TAG) return fail('AMAZON_ASSOCIATE_TAG is not configured');

  const status = await getProviderStatus();
  console.log(`Provider configured: ${status.configuredProvider}`);
  console.log(`Provider effective: ${status.effectiveProvider}`);
  console.log(`Rainforest ready: ${status.rainforest.isConfigured && !status.rainforest.isQuotaExhausted}`);
  console.log(`Affiliate tag configured: ${process.env.AMAZON_ASSOCIATE_TAG === 'dankul-20' ? 'dankul-20' : 'YES (non-default)'}`);

  if (status.effectiveProvider !== 'rainforest') return fail(`Expected Rainforest, got ${status.effectiveProvider}`);

  const product = await fetchProductByAsin(TEST_ASIN);
  if (!product) {
    await printSafeRainforestDiagnostics();
    return fail(`Rainforest did not return a verifiable deal for ${TEST_ASIN}`);
  }

  console.log('\nASIN lookup');
  console.log(`ASIN: ${product.asin}`);
  console.log(`Provider: ${product.sourceProvider}`);
  console.log(`Verified: ${product.sourceVerified}`);
  console.log(`Title: ${product.title}`);
  console.log(`Sale price: ${product.salePrice}`);
  console.log(`Original price: ${product.originalPrice}`);
  console.log(`Discount: ${product.discountPercent}%`);
  console.log(`Affiliate URL: ${formatAffiliateUrl(`https://www.amazon.com/dp/${product.asin}`)}`);

  if (product.sourceProvider !== 'RAINFOREST' || product.sourceVerified !== true) {
    return fail('ASIN lookup was not Rainforest-verified');
  }

  console.log('\nAutomatic deal discovery');
  const deals = await fetchDealsList({ maxResults: 5, minDiscount: 10 });
  console.log(`Verified deals discovered: ${deals.length}`);
  deals.slice(0, 5).forEach((deal, index) => {
    console.log(`${index + 1}. ${deal.asin} | ${deal.discountPercent}% off | ${deal.title}`);
  });

  if (!deals.length) return fail('Rainforest returned no verifiable automatic deals');
  if (deals.some((deal) => deal.sourceProvider !== 'RAINFOREST' || deal.sourceVerified !== true)) {
    return fail('Automatic discovery returned a non-Rainforest/non-verified record');
  }

  console.log('\nPASS: Rainforest lookup and automatic deal discovery are live.');
}

main().catch((error) => fail(error?.message || String(error)));
