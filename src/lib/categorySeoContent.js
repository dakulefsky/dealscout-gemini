import CONTENT from '../../shared/categoryContent.json';

export function categorySeoContent(slug, fallbackDescription = '') {
  return CONTENT[slug] || {
    intro: fallbackDescription || 'Current verified price drops in this department.',
    guidance: 'Prices and availability move quickly. Confirm the final offer on Amazon before buying.',
    related: ['electronics', 'home-kitchen', 'sports-outdoors'],
  };
}
