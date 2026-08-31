const { CHANNELS, evaluateDistribution } = require('./distributionPolicy');

function cleanText(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return `$${number.toFixed(2).replace(/\.00$/, '')}`;
}

function publicationFacts(deal = {}) {
  const salePrice = Number(deal.sale_price ?? deal.salePrice);
  const originalPrice = Number(deal.original_price ?? deal.originalPrice);
  const discountPercent = Number(deal.discount_percent ?? deal.discountPercent);
  const checkedAt = Number(deal.price_check_at ?? deal.priceCheckAt) || null;
  const savings = Number.isFinite(originalPrice) && Number.isFinite(salePrice) && originalPrice > salePrice
    ? Number((originalPrice - salePrice).toFixed(2))
    : null;

  return {
    asin: String(deal.asin || '').trim().toUpperCase(),
    title: cleanText(deal.title, 140),
    category: cleanText(deal.category, 60) || null,
    salePrice: Number.isFinite(salePrice) ? salePrice : null,
    originalPrice: Number.isFinite(originalPrice) ? originalPrice : null,
    discountPercent: Number.isFinite(discountPercent) ? Math.round(discountPercent * 10) / 10 : null,
    savings,
    imageUrl: String(deal.image_url ?? deal.imageUrl ?? '').trim() || null,
    productUrl: String(deal.product_url ?? deal.productUrl ?? '').trim() || null,
    priceCheckAt: checkedAt,
  };
}

function whatsappCaption(facts) {
  const price = money(facts.salePrice);
  const original = money(facts.originalPrice);
  const savings = money(facts.savings);
  const discount = Number.isFinite(facts.discountPercent) ? `${facts.discountPercent}% off` : null;
  const priceLine = [price, discount].filter(Boolean).join(' • ');
  const comparison = original && original !== price ? [`Was ${original}`, savings ? `Save ${savings}` : null].filter(Boolean).join(' • ') : null;
  return [
    `🔥 ${facts.title}`,
    priceLine,
    comparison,
    facts.productUrl ? `Shop: ${facts.productUrl}` : null,
    'Price verified by DealScout. Amazon pricing can change at any time.',
  ].filter(Boolean).join('\n');
}

function composePublicationContent(channel, deal, options = {}) {
  const evaluation = evaluateDistribution(deal, channel, options.nowUnix);
  if (!evaluation.eligible) {
    const error = new Error(`Deal is not eligible for ${channel}: ${evaluation.reasons.join(', ')}`);
    error.code = 'PUBLICATION_INELIGIBLE';
    error.reasons = evaluation.reasons;
    throw error;
  }

  const facts = publicationFacts(deal);
  const base = {
    channel,
    facts,
    title: facts.title,
    imageUrl: facts.imageUrl,
    destinationUrl: facts.productUrl,
    verification: {
      priceCheckAt: facts.priceCheckAt,
      sourceVerified: true,
    },
  };

  if (channel === CHANNELS.WHATSAPP_STATUS) {
    return { ...base, caption: whatsappCaption(facts), format: 'image_caption' };
  }
  if (channel === CHANNELS.APP) {
    return {
      ...base,
      caption: [money(facts.salePrice), Number.isFinite(facts.discountPercent) ? `${facts.discountPercent}% off` : null].filter(Boolean).join(' • '),
      format: 'deal_card',
    };
  }
  if (channel === CHANNELS.WEB) return { ...base, caption: facts.title, format: 'deal_card' };
  throw new Error(`Unsupported publication channel: ${channel}`);
}

module.exports = { composePublicationContent, publicationFacts, whatsappCaption, cleanText, money };
