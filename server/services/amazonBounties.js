const { formatAffiliateUrl } = require('./amazonUrlService');

const PROGRAMS = Object.freeze([
  { id: 'prime', name: 'Amazon Prime', description: 'Explore shipping, shopping, and entertainment benefits.', homepage: 'https://www.amazon.com/prime' },
  { id: 'prime-video', name: 'Prime Video', description: 'Explore movies, shows, and live events available through Amazon.', homepage: 'https://www.amazon.com/gp/video/primesignup' },
  { id: 'audible', name: 'Audible', description: 'Explore audiobook and listening membership options.', homepage: 'https://www.amazon.com/hz/audible/mlp' },
  { id: 'kindle-unlimited', name: 'Kindle Unlimited', description: 'Explore the Kindle Unlimited reading catalog.', homepage: 'https://www.amazon.com/kindleunlimited' },
]);

function getAmazonBounties(associateTag = process.env.AMAZON_ASSOCIATE_TAG) {
  const tag = String(associateTag || '').trim();
  if (!tag) return [];
  return PROGRAMS.map(({ id, name, description, homepage }) => ({
    id, name, description, url: formatAffiliateUrl(homepage, tag),
  }));
}

module.exports = { getAmazonBounties };
