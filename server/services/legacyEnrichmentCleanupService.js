const deals = require('../repositories/dealRepository');

const MACHINE_MARKER = /Gemini AI Ingest|AI-assisted editorial content|AI-assisted product verification only/i;

function isKnownMachineEnrichment(deal) {
  if (!deal) return false;
  if (String(deal.source_provider || '').toUpperCase() === 'CURATED_DEMO') return true;
  return MACHINE_MARKER.test(String(deal.raw_source_data || ''));
}

function hasLegacyEnrichment(deal) {
  return Boolean(
    String(deal?.short_bio || '').trim() ||
    String(deal?.full_summary || '').trim() ||
    String(deal?.pros || '').trim() ||
    String(deal?.cons || '').trim() ||
    (Array.isArray(deal?.reviews) && deal.reviews.length)
  );
}

async function previewLegacyEnrichmentCleanup() {
  const all = await deals.listAll();
  const candidates = all.filter((deal) => isKnownMachineEnrichment(deal) && hasLegacyEnrichment(deal));
  return {
    candidates: candidates.length,
    asins: candidates.slice(0, 50).map((deal) => deal.asin).filter(Boolean),
  };
}

async function cleanupLegacyEnrichment() {
  const all = await deals.listAll();
  const candidates = all.filter((deal) => isKnownMachineEnrichment(deal) && hasLegacyEnrichment(deal));
  let cleaned = 0;
  const asins = [];

  for (const deal of candidates) {
    await deals.update(deal.id, {
      short_bio: '',
      full_summary: '',
      pros: '',
      cons: '',
      reviews: [],
    });
    cleaned += 1;
    if (deal.asin) asins.push(deal.asin);
  }

  return { cleaned, asins: asins.slice(0, 100) };
}

module.exports = {
  isKnownMachineEnrichment,
  hasLegacyEnrichment,
  previewLegacyEnrichmentCleanup,
  cleanupLegacyEnrichment,
};
