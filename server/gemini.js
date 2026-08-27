const { GoogleGenAI } = require('@google/genai');

let aiInstance = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'dealscout' } },
    });
  }
  return aiInstance;
}

function requireGemini() {
  const ai = getGeminiClient();
  if (!ai) {
    const err = new Error('AI analysis is unavailable because GEMINI_API_KEY is not configured');
    err.code = 'AI_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }
  return ai;
}

async function analyzeDealWithGemini({ title, asin, url, price, originalPrice, rawText, category, imageUrl }) {
  const ai = requireGemini();
  const verifiedDiscount = Number.isFinite(Number(originalPrice)) && Number.isFinite(Number(price)) && Number(originalPrice) > 0 && Number(price) >= 0
    ? Number((((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100).toFixed(1))
    : null;

  const prompt = `You are DealScout's product-analysis assistant. Analyze only the supplied product context. Do not invent prices, ratings, review counts, customer reviews, certifications, availability, specifications, or verification claims. If a fact is not present in the supplied context, omit it or state that it is unknown. AI output is editorial enrichment and must never be treated as source verification.\n\nProduct context:\n- Title: ${title || 'Unknown'}\n- ASIN: ${asin || 'Unknown'}\n- URL: ${url || 'Unknown'}\n- Verified current price supplied by caller: ${price ?? 'Unknown'}\n- Verified original/list price supplied by caller: ${originalPrice ?? 'Unknown'}\n- Category: ${category || 'Unknown'}\n- Source context/specs: ${rawText || 'None supplied'}\n\nReturn JSON only with this shape:\n{\n  "title": string,\n  "category": string,\n  "shortBio": string,\n  "fullSummary": string,\n  "pros": string[],\n  "cons": string[],\n  "dealScore": number | null,\n  "editorialAssessment": string,\n  "unknowns": string[]\n}\nDo not include reviews, ratings, rating counts, prices, discount percentages, source verification flags, or claims that the deal is verified.`;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(response.text?.trim() || '{}');
    return {
      ...parsed,
      asin: asin || undefined,
      imageUrl: imageUrl || undefined,
      price: price == null ? undefined : Number(price),
      originalPrice: originalPrice == null ? undefined : Number(originalPrice),
      discountPercent: verifiedDiscount,
      sourceSufficient: false,
      sourceVerified: false,
      aiGenerated: true,
    };
  } catch (err) {
    console.error('[Gemini] Analyze deal failed:', err);
    throw err;
  }
}

async function askDealAssistantWithGemini({ deal, question }) {
  const ai = requireGemini();
  const prompt = `You are DealScout AI, a shopping advisor. Answer using only the supplied deal record. Do not invent specifications, reviews, prices, availability, warranty terms, or verification claims. Distinguish factual fields in the record from editorial summaries. If the record does not answer the question, say so.\n\nProduct: ${deal.title || 'Unknown'}\nPrice: ${deal.sale_price ?? deal.price ?? 'Unknown'}\nOriginal price: ${deal.original_price ?? deal.originalPrice ?? 'Unknown'}\nCategory: ${deal.category || 'Unknown'}\nSummary: ${deal.full_summary || deal.fullSummary || ''}\nPros: ${deal.pros || ''}\nCons: ${deal.cons || ''}\nSource verified: ${deal.source_verified === 1 || deal.sourceVerified === true}\n\nUser question: ${question}\n\nAnswer in 2-4 concise sentences.`;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
      contents: prompt,
    });
    return { answer: response.text?.trim() || 'No response generated.' };
  } catch (err) {
    console.error('[Gemini] Ask deal assistant failed:', err);
    throw err;
  }
}

module.exports = { getGeminiClient, analyzeDealWithGemini, askDealAssistantWithGemini };
