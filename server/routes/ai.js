const express = require('express');
const router = express.Router();
const { analyzeDealWithGemini, askDealAssistantWithGemini } = require('../gemini');
const deals = require('../repositories/dealRepository');
const { requireAdmin } = require('../middleware/auth');
const { robustExtractAsin, resolveShortlink } = require('../services/siteStripeService');
const { fetchProductByAsin } = require('../services/providerRouter');

const ASSISTANT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ASSISTANT_BUCKETS = 5000;
const assistantRate = new Map();
let assistantRateOps = 0;

function pruneAssistantRate(now) {
  assistantRateOps += 1;
  if (assistantRateOps % 100 !== 0 && assistantRate.size < MAX_ASSISTANT_BUCKETS) return;
  for (const [key, bucket] of assistantRate) {
    if (!bucket?.startedAt || now - bucket.startedAt > ASSISTANT_WINDOW_MS) assistantRate.delete(key);
  }
  while (assistantRate.size >= MAX_ASSISTANT_BUCKETS) {
    const oldestKey = assistantRate.keys().next().value;
    if (oldestKey === undefined) break;
    assistantRate.delete(oldestKey);
  }
}

function rateLimitAssistant(req, res, next) {
  const now = Date.now();
  pruneAssistantRate(now);
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const current = assistantRate.get(key);
  if (!current || now - current.startedAt > ASSISTANT_WINDOW_MS) {
    assistantRate.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > 20) return res.status(429).json({ error: 'Too many AI requests. Please try again later.' });
  next();
}

router.post('/analyze-deal', requireAdmin, async (req, res) => {
  try {
    let { title, asin, url, rawText, category } = req.body || {};
    let targetUrl = String(url || '').trim();
    let extractedAsin = asin ? (robustExtractAsin(asin) || String(asin).trim().toUpperCase()) : null;
    if (!extractedAsin && targetUrl) extractedAsin = robustExtractAsin(targetUrl);

    if (!extractedAsin && targetUrl && /amzn\.to|a\.co|amazon\./i.test(targetUrl)) {
      const resolved = await resolveShortlink(targetUrl);
      extractedAsin = resolved.asin || null;
      targetUrl = resolved.finalUrl || targetUrl;
    }
    if (!extractedAsin) return res.status(400).json({ error: 'A valid Amazon ASIN is required for deal analysis.' });

    const liveDetails = await fetchProductByAsin(extractedAsin, { customUrl: targetUrl });
    if (!liveDetails?.sourceVerified) {
      return res.status(422).json({ error: 'The product could not be verified from a live source. AI analysis was not run.' });
    }

    title = liveDetails.title;
    category = category && category !== 'All' ? category : liveDetails.category;
    if (!rawText) {
      rawText = [liveDetails.shortBio, liveDetails.fullSummary, Array.isArray(liveDetails.pros) ? liveDetails.pros.join('\n') : liveDetails.pros]
        .filter(Boolean)
        .join('\n');
    }

    const analysis = await analyzeDealWithGemini({
      title,
      asin: liveDetails.asin || extractedAsin,
      url: targetUrl || liveDetails.productUrl,
      price: liveDetails.salePrice,
      originalPrice: liveDetails.originalPrice,
      rawText,
      category,
      imageUrl: liveDetails.imageUrl,
    });

    analysis.asin = liveDetails.asin || extractedAsin;
    analysis.title = liveDetails.title;
    analysis.price = liveDetails.salePrice;
    analysis.originalPrice = liveDetails.originalPrice;
    analysis.imageUrl = liveDetails.imageUrl;
    analysis.sourceVerified = true;
    analysis.sourceProvider = liveDetails.sourceProvider;
    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[API /ai/analyze-deal error]', err);
    res.status(500).json({ error: 'AI deal analysis failed' });
  }
});

router.post('/ask-deal-assistant', rateLimitAssistant, async (req, res) => {
  try {
    const { dealId, question } = req.body || {};
    if (!question || typeof question !== 'string' || question.trim().length === 0) return res.status(400).json({ error: 'Question is required' });
    if (question.length > 1000) return res.status(400).json({ error: 'Question is too long' });
    if (!dealId) return res.status(400).json({ error: 'Deal ID is required' });

    const deal = await deals.findByIdOrAsin(dealId);
    if (!deal || deal.status !== 'APPROVED' || deal.is_expired === 1 || deal.source_verified !== 1) {
      return res.status(404).json({ error: 'Deal context not found' });
    }

    const response = await askDealAssistantWithGemini({ deal, question: question.trim() });
    res.json({ success: true, answer: response.answer });
  } catch (err) {
    console.error('[API /ai/ask-deal-assistant error]', err);
    res.status(500).json({ error: 'AI shopping assistant failed' });
  }
});

module.exports = router;
