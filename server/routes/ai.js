const express = require('express');
const router = express.Router();
const { analyzeDealWithGemini, askDealAssistantWithGemini } = require('../gemini');
const db = require('../db');
const { robustExtractAsin, resolveShortlink } = require('../services/siteStripeService');
const { fetchProductByAsin } = require('../services/providerRouter');

// POST /api/ai/analyze-deal
router.post('/analyze-deal', async (req, res) => {
  try {
    let { title, asin, url, price, originalPrice, rawText, category, imageUrl } = req.body || {};

    let targetUrl = (url || '').trim();
    let extractedAsin = asin ? (robustExtractAsin(asin) || asin.trim()) : null;

    if (!extractedAsin && targetUrl) {
      extractedAsin = robustExtractAsin(targetUrl);
    }

    if ((!extractedAsin || !title || !imageUrl) && targetUrl && (targetUrl.includes('amzn.to') || targetUrl.includes('a.co') || targetUrl.includes('amazon.'))) {
      try {
        const resolved = await resolveShortlink(targetUrl);
        if (resolved.asin) {
          extractedAsin = resolved.asin;
          targetUrl = resolved.finalUrl || targetUrl;
        }
      } catch (err) {
        console.warn('[AI Analyze shortlink resolve notice]:', err.message);
      }
    }

    // If we have an ASIN, fetch ground-truth product data to guarantee accurate title, real photo, and real price
    if (extractedAsin && (!title || !price || !imageUrl || imageUrl.includes('unsplash.com'))) {
      try {
        const liveDetails = await fetchProductByAsin(extractedAsin, { customUrl: targetUrl });
        if (liveDetails) {
          title = title || liveDetails.title;
          extractedAsin = liveDetails.asin || extractedAsin;
          price = price !== undefined && price !== null && price !== '' ? price : liveDetails.salePrice;
          originalPrice = originalPrice !== undefined && originalPrice !== null && originalPrice !== '' ? originalPrice : liveDetails.originalPrice;
          category = (category && category !== 'All') ? category : (liveDetails.category || 'Electronics');
          imageUrl = liveDetails.imageUrl || imageUrl;
          if (!rawText && (liveDetails.shortBio || liveDetails.fullSummary)) {
            rawText = `${liveDetails.shortBio || ''}\n${liveDetails.fullSummary || ''}\n${Array.isArray(liveDetails.pros) ? liveDetails.pros.join('\n') : ''}`;
          }
        }
      } catch (err) {
        console.warn('[AI Analyze live ground-truth fetch notice]:', err.message);
      }
    }

    const analysis = await analyzeDealWithGemini({
      title,
      asin: extractedAsin,
      url: targetUrl,
      price: price ? Number(price) : undefined,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      rawText,
      category,
      imageUrl,
    });

    if (imageUrl && (!analysis.imageUrl || analysis.imageUrl.includes('unsplash.com'))) {
      analysis.imageUrl = imageUrl;
    }
    if (extractedAsin && !analysis.asin) {
      analysis.asin = extractedAsin;
    }

    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[API /ai/analyze-deal error]', err);
    res.status(500).json({ error: err.message || 'AI deal analysis failed' });
  }
});

// POST /api/ai/ask-deal-assistant
router.post('/ask-deal-assistant', async (req, res) => {
  try {
    const { dealId, dealData, question } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    let deal = dealData;
    if (!deal && dealId) {
      deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId);
    }

    if (!deal) {
      return res.status(404).json({ error: 'Deal context not found' });
    }

    const response = await askDealAssistantWithGemini({ deal, question });
    res.json({ success: true, answer: response.answer });
  } catch (err) {
    console.error('[API /ai/ask-deal-assistant error]', err);
    res.status(500).json({ error: err.message || 'AI shopping assistant failed' });
  }
});

module.exports = router;
