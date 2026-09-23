const CONTENT = {
  electronics: {
    intro: 'Headphones, TVs, computers, cameras, gaming gear, and the everyday tech that gets discounted often enough to be worth watching.',
    guidance: 'Model numbers matter. So do bundle contents and storage size. We care more about the exact item and the checked price than a dramatic list-price badge.',
    related: ['home-kitchen', 'office-school', 'tools-home-improvement'],
  },
  'home-kitchen': {
    intro: 'Cookware, small appliances, cleaning gear, storage, bedding, and the useful household stuff that is easy to overpay for.',
    guidance: 'For appliances and home gear, the exact size and version can change the value fast. We favor clean price drops on products that are easy to compare like-for-like.',
    related: ['tools-home-improvement', 'grocery', 'electronics'],
  },
  'sports-outdoors': {
    intro: 'Fitness, camping, hiking, cycling, training gear, and outdoor equipment with a current price worth checking.',
    guidance: 'Outdoor pricing moves with season and inventory. Recent verification matters more here than an old percentage badge that looked great last week.',
    related: ['health-beauty', 'automotive', 'tools-home-improvement'],
  },
  'health-beauty': {
    intro: 'Grooming, skincare, hair care, personal care, and other repeat-buy items where a real price cut can add up.',
    guidance: 'We judge the price, not whether a product is right for you. Check ingredients, directions, and product-specific claims on the retailer listing.',
    related: ['baby', 'grocery', 'clothing-accessories'],
  },
  'toys-games': {
    intro: 'Toys, board games, puzzles, hobby products, and family entertainment without the holiday-season price fog.',
    guidance: 'Toy prices can swing hard around promotions. We put more weight on a recent checked price than on a giant crossed-out number.',
    related: ['baby', 'electronics', 'sports-outdoors'],
  },
  baby: {
    intro: 'Feeding, nursery, travel, care, and toddler essentials—especially the things families end up buying again and again.',
    guidance: 'A lower price never replaces a safety check. Verify age guidance, recalls, fit, and manufacturer instructions before buying.',
    related: ['toys-games', 'health-beauty', 'home-kitchen'],
  },
  'pet-supplies': {
    intro: 'Pet gear, food, care items, accessories, and the repeat purchases where unit price usually tells the real story.',
    guidance: 'Pack size and recurring-purchase economics matter more than a headline discount. Compare the amount you are actually getting.',
    related: ['home-kitchen', 'grocery', 'health-beauty'],
  },
  automotive: {
    intro: 'Car accessories, maintenance gear, tools, electronics, and vehicle essentials with current verified price drops.',
    guidance: 'Fitment comes first. Check model year, dimensions, connector type, and installation requirements before treating a low price as a good buy.',
    related: ['tools-home-improvement', 'electronics', 'sports-outdoors'],
  },
  'tools-home-improvement': {
    intro: 'Power tools, hand tools, hardware, lighting, repair supplies, and project gear with enough of a price move to notice.',
    guidance: 'Compare exact model numbers, battery platforms, kit contents, and included accessories. Near-identical tool listings can be very different deals.',
    related: ['home-kitchen', 'automotive', 'electronics'],
  },
  'office-school': {
    intro: 'Workspace gear, stationery, organization, school supplies, and useful desk equipment at better-than-usual prices.',
    guidance: 'Pack quantity and included accessories can completely change the effective price. Compare the actual configuration, not just the title.',
    related: ['electronics', 'home-kitchen', 'tools-home-improvement'],
  },
  'clothing-accessories': {
    intro: 'Apparel, shoes, watches, bags, jewelry, and accessories where the deal may only apply to certain sizes or colors.',
    guidance: 'Variant pricing is the trap here. Confirm the exact size, color, and style you want before assuming the displayed discount applies.',
    related: ['health-beauty', 'sports-outdoors', 'baby'],
  },
  grocery: {
    intro: 'Pantry items, snacks, beverages, household staples, and consumables where a good unit price beats a flashy percentage.',
    guidance: 'Look at unit price, pack count, subscription terms, and shipping eligibility. Those details usually matter more than the headline discount.',
    related: ['home-kitchen', 'health-beauty', 'pet-supplies'],
  },
  other: {
    intro: 'Good verified deals that do not fit cleanly into one of the main departments.',
    guidance: 'We would rather leave something in Other than force it into the wrong aisle. Cleaner classification makes the rest of the site easier to trust.',
    related: ['electronics', 'home-kitchen', 'sports-outdoors'],
  },
};

export function categorySeoContent(slug, fallbackDescription = '') {
  return CONTENT[slug] || {
    intro: fallbackDescription || 'Current verified price drops in this department.',
    guidance: 'Prices and availability move quickly. Confirm the final offer on Amazon before buying.',
    related: ['electronics', 'home-kitchen', 'sports-outdoors'],
  };
}
