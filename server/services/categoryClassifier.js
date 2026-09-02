const CATEGORY_RULES = [
  {
    category: 'Electronics',
    strong: [
      /\b(?:iphone|ipad|macbook|chromebook|laptop|notebook computer|desktop computer|monitor|smartphone|cell phone|android phone|tablet|kindle|echo|alexa|fire tv|fire tablet|ring doorbell|blink camera|router|modem|wifi|wi-fi|bluetooth|earbuds?|headphones?|headset|speaker|soundbar|television|\btv\b|projector|camera|webcam|microphone|keyboard|mouse|ssd|hard drive|flash drive|usb(?:-c)?|power bank|charger|charging cable|smartwatch|fitness tracker|gaming console|playstation|xbox|nintendo switch|video game)\b/i,
    ],
    broad: [/\b(?:amazon devices?|electronics?|computers?|audio|home theater|cell phones?|camera & photo|video games?|gaming)\b/i],
  },
  {
    category: 'Home & Kitchen',
    strong: [
      /\b(?:air fryer|coffee maker|espresso machine|blender|mixer|toaster|microwave|cookware|frying pan|skillet|knife set|vacuum|robot vacuum|mop|bedding|mattress|pillow|sheet set|towel|furniture|sofa|desk chair|storage bin|humidifier|air purifier|fan|space heater|lamp|lighting|curtain|rug|patio furniture)\b/i,
    ],
    broad: [/\b(?:home & kitchen|home and kitchen|kitchen|household|furniture|bedding|bath|garden|patio|home décor|home decor|appliances?)\b/i],
  },
  {
    category: 'Sports & Outdoors',
    strong: [
      /\b(?:treadmill|dumbbells?|kettlebell|exercise bike|yoga mat|tent|sleeping bag|camping|hiking|backpack|bicycle|bike helmet|golf|pickleball|tennis racket|basketball|football|soccer ball|fishing|kayak|cooler|running shoes?)\b/i,
    ],
    broad: [/\b(?:sports? & outdoors?|sports? and outdoors?|fitness|exercise & fitness|outdoor recreation|cycling|camping & hiking)\b/i],
  },
  {
    category: 'Health & Beauty',
    strong: [
      /\b(?:shampoo|conditioner|skincare|skin care|moisturizer|serum|sunscreen|makeup|mascara|lipstick|foundation|razor|shaver|toothbrush|water flosser|hair dryer|hair straightener|curling iron|perfume|cologne|deodorant|body wash|lotion|massage gun|heating pad)\b/i,
    ],
    broad: [/\b(?:beauty|health & household|health and household|personal care|grooming|skin care|hair care|wellness)\b/i],
  },
  {
    category: 'Toys & Games',
    strong: [/\b(?:lego|building blocks?|action figure|doll|board game|card game|puzzle|remote control car|rc car|toy|playset|stuffed animal|arts? & crafts?)\b/i],
    broad: [/\b(?:toys? & games?|toys? and games?|hobbies?|games?)\b/i],
  },
  {
    category: 'Baby',
    strong: [/\b(?:diapers?|baby wipes?|stroller|car seat|crib|bassinet|baby monitor|bottle warmer|breast pump|high chair|baby carrier|pacifier|toddler)\b/i],
    broad: [/\b(?:baby|infant|nursery)\b/i],
  },
  {
    category: 'Pet Supplies',
    strong: [/\b(?:dog food|cat food|pet food|dog treats?|cat litter|litter box|dog bed|cat tree|pet carrier|dog leash|dog collar|aquarium|fish tank|pet fountain)\b/i],
    broad: [/\b(?:pet supplies|pets?|dogs?|cats?)\b/i],
  },
  {
    category: 'Automotive',
    strong: [/\b(?:dash cam|car charger|car vacuum|car seat cover|floor mats?|jump starter|tire inflator|car battery|windshield wiper|motor oil|automotive|truck accessories?|motorcycle)\b/i],
    broad: [/\b(?:automotive|car & vehicle|car and vehicle|motorcycle & powersports)\b/i],
  },
  {
    category: 'Tools & Home Improvement',
    strong: [/\b(?:drill|impact driver|circular saw|miter saw|tool set|socket set|wrench|screwdriver|stud finder|level|work light|pressure washer|shop vac|ladder|door lock|faucet|shower head|thermostat)\b/i],
    broad: [/\b(?:tools? & home improvement|tools? and home improvement|power tools?|hand tools?|hardware|home improvement)\b/i],
  },
  {
    category: 'Office & School',
    strong: [/\b(?:printer paper|notebook|planner|pen set|pencils?|markers?|stapler|office chair|standing desk|desk organizer|label maker|laminator|shredder|calculator|school supplies?)\b/i],
    broad: [/\b(?:office products?|office & school|office and school|school supplies?|stationery)\b/i],
  },
  {
    category: 'Clothing & Accessories',
    strong: [/\b(?:t-shirt|shirt|hoodie|sweater|jacket|coat|jeans|pants|dress|skirt|shorts|sneakers?|boots?|sandals?|slippers?|handbag|wallet|backpack purse|sunglasses|jewelry|necklace|bracelet|earrings?|analog watch|quartz watch)\b/i],
    broad: [/\b(?:clothing|fashion|apparel|shoes?|jewelry|watches?|accessories)\b/i],
  },
  {
    category: 'Grocery',
    strong: [/\b(?:coffee beans?|ground coffee|tea bags?|protein bars?|snacks?|cereal|cookies?|chips|chocolate|candy|olive oil|pasta|rice|soda|sparkling water|energy drink|grocery)\b/i],
    broad: [/\b(?:grocery|food & beverage|food and beverage|gourmet food|pantry|beverages?|snacks?)\b/i],
  },
];

const GENERIC_CATEGORY_TEXT = /^(?:all|deals?|featured|today'?s deals?|amazon deals?|other|unknown)$/i;

function clean(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function matchesAny(text, patterns) {
  return Boolean(text) && patterns.some((pattern) => pattern.test(text));
}

function scoreText(text, rule, weight) {
  if (!text) return 0;
  let score = 0;
  if (matchesAny(text, rule.strong)) score += 5 * weight;
  if (matchesAny(text, rule.broad)) score += 3 * weight;
  return score;
}

function classifyCategory({ rawCategory = '', title = '', searchAlias = '' } = {}) {
  const categoryText = clean(rawCategory);
  const aliasText = clean(searchAlias);
  const titleText = clean(title);
  const usableCategory = GENERIC_CATEGORY_TEXT.test(categoryText) ? '' : categoryText;
  const usableAlias = GENERIC_CATEGORY_TEXT.test(aliasText) ? '' : aliasText;

  // A specific product phrase in the title is usually more reliable than a broad
  // Amazon browse bucket (for example Smartwatch inside Watches, or Switch inside Toys & Games).
  const strongTitleMatches = CATEGORY_RULES
    .map((rule, index) => ({ category: rule.category, index, matched: matchesAny(titleText, rule.strong) }))
    .filter((entry) => entry.matched);
  const strongProviderMatches = CATEGORY_RULES
    .map((rule, index) => ({ category: rule.category, index, matched: matchesAny(`${usableCategory} ${usableAlias}`.trim(), rule.strong) }))
    .filter((entry) => entry.matched);
  if (strongTitleMatches.length === 1 && strongProviderMatches.length === 0) return strongTitleMatches[0].category;

  const scores = CATEGORY_RULES.map((rule, index) => ({
    category: rule.category,
    index,
    score:
      scoreText(usableCategory, rule, 4)
      + scoreText(usableAlias, rule, 3)
      + scoreText(titleText, rule, 1),
  }));

  scores.sort((a, b) => b.score - a.score || a.index - b.index);
  const winner = scores[0];
  return winner && winner.score > 0 ? winner.category : 'Other';
}

function normalizeCategory(value = '') {
  return classifyCategory({ rawCategory: value });
}

module.exports = { CATEGORY_RULES, classifyCategory, normalizeCategory };
