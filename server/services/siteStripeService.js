const axios = require('axios');
const { extractAsin, formatAffiliateUrl, generateAuthenticReviewsForProduct } = require('./rainforestService');

/**
 * SiteStripe Integration & Link Management Service
 * Supports Amazon Associates SiteStripe links (Text, Image, Text+Image)
 * and resolves shortened amzn.to affiliate links.
 */

/**
 * Comprehensive ASIN extractor covering all SiteStripe widget codes,
 * query params, iframe URLs, and raw text.
 */
function robustExtractAsin(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();

  // Try the main extractAsin first
  let asin = extractAsin(raw);
  if (asin) return asin;

  // Check for SiteStripe widget parameters: asins=, placement=, creativeASIN=, pd_rd_i=
  const widgetPatterns = [
    /[?&;](?:asins|placement|creativeASIN|pd_rd_i)=([A-Z0-9]{10})/i,
    /(?:asins%3D|placement%3D|creativeASIN%3D|pd_rd_i%3D)([A-Z0-9]{10})/i,
    /["']https?:\/\/[^"']*(?:asins|placement|creativeASIN)=([A-Z0-9]{10})/i,
    /(?:asins|placement|creativeASIN):["']?([A-Z0-9]{10})/i,
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/d\/([A-Z0-9]{10})/i,
    /\/o\/ASIN\/([A-Z0-9]{10})/i,
  ];

  for (const regex of widgetPatterns) {
    const match = raw.match(regex);
    if (match && match[1]) {
      const candidate = match[1].toUpperCase();
      if (/^[A-Z0-9]{10}$/.test(candidate)) {
        return candidate;
      }
    }
  }

  // Check if any standard Amazon B0 ASIN (starts with B0 followed by 8 alphanumeric chars) is inside the text
  const b0Match = raw.match(/\b(B0[A-Z0-9]{8})\b/i);
  if (b0Match && b0Match[1]) {
    return b0Match[1].toUpperCase();
  }

  return null;
}

/**
 * Parse any SiteStripe URL or HTML embed code into its constituent parts (ASIN, Tag, Clean URL).
 */
function parseSiteStripeInput(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, asin: null, originalInput: input, error: 'Empty input provided' };
  }

  const raw = input.trim();

  // Handle iframe or HTML embed snippet
  let extractedUrl = raw;
  const srcMatch = raw.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    extractedUrl = srcMatch[1];
    if (extractedUrl.startsWith('//')) {
      extractedUrl = 'https:' + extractedUrl;
    }
  } else {
    const hrefMatch = raw.match(/href=["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
      extractedUrl = hrefMatch[1];
    }
  }

  // Extract Associate Tag if present
  let existingTag = null;
  const tagMatch = raw.match(/[?&;](?:tag|tracking_id)=([a-zA-Z0-9._-]+)/i);
  if (tagMatch && tagMatch[1]) {
    existingTag = tagMatch[1];
  }

  // Extract ASIN
  let asin = robustExtractAsin(raw) || robustExtractAsin(extractedUrl);

  // Check if it's a shortlink like https://amzn.to/xxxx or https://a.co/xxxx
  const shortlinkMatch = raw.match(/https?:\/\/(?:amzn\.to|a\.co)\/[a-zA-Z0-9_-]+/i) ||
                         raw.match(/\b(?:amzn\.to|a\.co)\/[a-zA-Z0-9_-]+/i);
  
  const isShortlink = Boolean(shortlinkMatch);
  const shortlinkUrl = isShortlink
    ? (shortlinkMatch[0].startsWith('http') ? shortlinkMatch[0] : `https://${shortlinkMatch[0]}`)
    : null;

  return {
    valid: Boolean(asin || isShortlink),
    asin,
    existingTag,
    isShortlink,
    shortlinkUrl: shortlinkUrl || extractedUrl,
    cleanUrl: asin ? formatAffiliateUrl(`https://www.amazon.com/dp/${asin}`) : extractedUrl,
    originalInput: raw,
  };
}

/**
 * Resolves an amzn.to or a.co shortlink by following redirects to obtain the final ASIN.
 * Uses manual redirect inspection to avoid Amazon 503 Bot Check on target HTML pages.
 */
async function resolveShortlink(url) {
  let targetUrl = (url || '').trim();
  if (!targetUrl) return { asin: null, finalUrl: url, success: false, error: 'Empty URL' };

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  // First, check if ASIN is already extractable directly from the URL string
  const directAsin = robustExtractAsin(targetUrl);
  if (directAsin) {
    return { asin: directAsin, finalUrl: targetUrl, success: true };
  }

  let currentUrl = targetUrl;
  let hops = 0;
  const maxHops = 5;

  while (hops < maxHops) {
    hops++;
    try {
      // Use maxRedirects: 0 so we catch the 301/302 Location header directly from amzn.to/a.co
      const response = await axios.get(currentUrl, {
        maxRedirects: 0,
        timeout: 6000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Check if response redirected via 301/302
      const location = response.headers?.location;
      if (location) {
        let resolvedLocation = location;
        if (resolvedLocation.startsWith('/')) {
          const base = new URL(currentUrl);
          resolvedLocation = `${base.protocol}//${base.host}${resolvedLocation}`;
        }

        const asinFromLoc = robustExtractAsin(resolvedLocation);
        if (asinFromLoc) {
          return { asin: asinFromLoc, finalUrl: resolvedLocation, success: true };
        }
        currentUrl = resolvedLocation;
        continue;
      }

      // If status 200 returned HTML body, try extracting from response URL or body text
      const finalUrl = response.request?.res?.responseUrl || currentUrl;
      const asinFromFinal = robustExtractAsin(finalUrl);
      if (asinFromFinal) {
        return { asin: asinFromFinal, finalUrl, success: true };
      }

      // Check response body for ASIN if text is returned
      if (typeof response.data === 'string') {
        const asinFromBody = robustExtractAsin(response.data);
        if (asinFromBody) {
          return { asin: asinFromBody, finalUrl, success: true };
        }
      }

      break;
    } catch (err) {
      // Axios with maxRedirects:0 will throw on 3xx or 4xx/5xx
      const redirectLoc = err.response?.headers?.location;
      if (redirectLoc) {
        let nextUrl = redirectLoc;
        if (nextUrl.startsWith('/')) {
          try {
            const base = new URL(currentUrl);
            nextUrl = `${base.protocol}//${base.host}${nextUrl}`;
          } catch {
            nextUrl = `https://www.amazon.com${nextUrl}`;
          }
        }

        const asinFromRedirect = robustExtractAsin(nextUrl);
        if (asinFromRedirect) {
          return { asin: asinFromRedirect, finalUrl: nextUrl, success: true };
        }
        currentUrl = nextUrl;
        continue;
      }

      // Check error config or response for ASIN
      const errUrl = err.request?.res?.responseUrl || err.config?.url || currentUrl;
      const asinFromErr = robustExtractAsin(errUrl);
      if (asinFromErr) {
        return { asin: asinFromErr, finalUrl: errUrl, success: true };
      }

      // Try searching error response body
      if (err.response?.data && typeof err.response.data === 'string') {
        const bodyAsin = robustExtractAsin(err.response.data);
        if (bodyAsin) {
          return { asin: bodyAsin, finalUrl: currentUrl, success: true };
        }
      }

      return { asin: null, finalUrl: currentUrl, success: false, error: err.message };
    }
  }

  const finalCheck = robustExtractAsin(currentUrl);
  return {
    asin: finalCheck,
    finalUrl: currentUrl,
    success: Boolean(finalCheck),
  };
}

/**
 * Parse a multi-line list of SiteStripe links or ASINs for bulk import.
 */
async function parseBulkSiteStripe(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    const parsed = parseSiteStripeInput(line);
    if (parsed.isShortlink && !parsed.asin) {
      const resolved = await resolveShortlink(parsed.shortlinkUrl || line);
      if (resolved.asin) {
        parsed.asin = resolved.asin;
        parsed.cleanUrl = formatAffiliateUrl(`https://www.amazon.com/dp/${resolved.asin}`);
        parsed.valid = true;
      }
    }
    if (parsed.valid && parsed.asin) {
      results.push(parsed);
    }
  }

  return results;
}

module.exports = {
  robustExtractAsin,
  parseSiteStripeInput,
  resolveShortlink,
  parseBulkSiteStripe,
};
