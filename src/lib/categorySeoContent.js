const CONTENT = {
  electronics: {
    intro: 'Track current electronics price drops across headphones, TVs, computers, smart-home gear, tablets, cameras, gaming accessories, and everyday tech. DealScout keeps this page permanent while the individual deals rotate, so you can come back to one place for fresh electronics savings.',
    guidance: 'A strong electronics deal is not just a large percentage badge. We prioritize verified current prices, meaningful savings against the observed original price, and products with enough source data to judge the offer responsibly.',
    related: ['home-kitchen', 'office-school', 'tools-home-improvement'],
  },
  'home-kitchen': {
    intro: 'Browse current Home & Kitchen deals across cookware, small appliances, cleaning gear, furniture, bedding, storage, and everyday household essentials. The page stays useful even as individual Amazon offers expire and new ones take their place.',
    guidance: 'For home products, compare the sale price with the product’s normal selling range, not only the displayed list price. DealScout highlights verified price drops and removes stale public offers as they age out.',
    related: ['tools-home-improvement', 'grocery', 'electronics'],
  },
  'sports-outdoors': {
    intro: 'Find current Sports & Outdoors deals for fitness, camping, hiking, cycling, training, and outdoor equipment. This is a durable category page built to keep surfacing fresh offers instead of disappearing when one product deal ends.',
    guidance: 'Seasonality can move outdoor prices quickly. A useful deal page needs recent price verification and a steady flow of replacements when older offers expire.',
    related: ['health-beauty', 'automotive', 'tools-home-improvement'],
  },
  'health-beauty': {
    intro: 'See current Health & Beauty deals across grooming, skincare, hair care, personal care, and wellness products. DealScout refreshes the live deal inventory while keeping this category page stable for repeat visits and search discovery.',
    guidance: 'We focus on price and availability signals rather than making health claims. Final product suitability, ingredients, and usage should always be checked on the retailer listing before purchase.',
    related: ['baby', 'grocery', 'clothing-accessories'],
  },
  'toys-games': {
    intro: 'Browse current Toys & Games price drops across toys, puzzles, board games, hobby products, and family entertainment. The live offers change, while this page remains a lasting destination for the category.',
    guidance: 'Toy pricing can change sharply around holidays and promotions, so recent verification matters more than an old headline discount.',
    related: ['baby', 'electronics', 'sports-outdoors'],
  },
  baby: {
    intro: 'Find current Baby deals across feeding, nursery, travel, care, and toddler essentials. The page keeps a stable home for the category while DealScout rotates in newly verified offers.',
    guidance: 'Savings are useful, but safety, age suitability, recalls, and manufacturer instructions matter more. DealScout surfaces price information; shoppers should verify product-specific safety details before buying.',
    related: ['toys-games', 'health-beauty', 'home-kitchen'],
  },
  'pet-supplies': {
    intro: 'Track current Pet Supplies deals for everyday pet gear, accessories, food, care products, and home essentials. New verified offers can replace expired ones without changing the category URL.',
    guidance: 'For consumables and repeat-purchase items, the real value often comes from the current unit price and reorder economics rather than the headline discount alone.',
    related: ['home-kitchen', 'grocery', 'health-beauty'],
  },
  automotive: {
    intro: 'Browse current Automotive deals for car accessories, maintenance gear, tools, electronics, and vehicle essentials. The category stays permanent while time-sensitive product offers come and go.',
    guidance: 'Compatibility matters. Always verify fitment, model-year support, dimensions, and installation requirements on the retailer listing before ordering.',
    related: ['tools-home-improvement', 'electronics', 'sports-outdoors'],
  },
  'tools-home-improvement': {
    intro: 'Find current Tools & Home Improvement deals across power tools, hand tools, hardware, lighting, repair supplies, and project essentials. DealScout keeps the category page durable while refreshing the live offers beneath it.',
    guidance: 'For tools, compare the exact kit, battery platform, accessory bundle, and model number. Similar-looking variants can have very different normal prices.',
    related: ['home-kitchen', 'automotive', 'electronics'],
  },
  'office-school': {
    intro: 'Browse current Office & School deals for workspace gear, stationery, organization, supplies, and productivity essentials. The category page stays stable while its live deal inventory changes over time.',
    guidance: 'Bulk quantity, pack size, and included accessories can change the effective price substantially, so compare like-for-like configurations when judging a deal.',
    related: ['electronics', 'home-kitchen', 'tools-home-improvement'],
  },
  'clothing-accessories': {
    intro: 'See current Clothing & Accessories deals across apparel, shoes, watches, jewelry, bags, and everyday accessories. Fresh offers rotate into a permanent category destination instead of creating a trail of short-lived pages.',
    guidance: 'Sizes, colors, and variants often have different prices. The displayed deal should be treated as a current observed offer, with final variant pricing confirmed on Amazon.',
    related: ['health-beauty', 'sports-outdoors', 'baby'],
  },
  grocery: {
    intro: 'Track current Grocery deals across pantry items, snacks, beverages, household staples, and everyday consumables. The category remains useful over time as temporary offers expire and new verified price drops appear.',
    guidance: 'For grocery deals, unit price, pack quantity, subscription terms, and shipping eligibility can matter more than the headline percentage discount.',
    related: ['home-kitchen', 'health-beauty', 'pet-supplies'],
  },
  other: {
    intro: 'Browse current verified deals that do not fit neatly into another DealScout category. As the catalog grows, products are normalized into clearer categories whenever possible.',
    guidance: 'DealScout favors clean classification and recent price verification over forcing every product into a misleading category.',
    related: ['electronics', 'home-kitchen', 'sports-outdoors'],
  },
};

export function categorySeoContent(slug, fallbackDescription = '') {
  return CONTENT[slug] || {
    intro: fallbackDescription || 'Browse current verified price drops in this category. DealScout keeps the page stable while the live offers refresh over time.',
    guidance: 'Prices and availability can change quickly, so confirm the final offer on Amazon before purchase.',
    related: ['electronics', 'home-kitchen', 'sports-outdoors'],
  };
}
