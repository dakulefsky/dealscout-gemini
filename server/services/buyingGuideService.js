const guide = require('../../shared/buyingGuide.json');
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function metadata(baseUrl) {
  const canonical = `${baseUrl}/guides/${guide.slug}`;
  return { title: `${guide.title} — DealScout`, description: guide.description, canonical,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: guide.title,
      description: guide.description, url: canonical, mainEntityOfPage: canonical,
      author: { '@type': 'Organization', name: 'DealScout', url: `${baseUrl}/about` },
      publisher: { '@id': `${baseUrl}/#organization` },
      isPartOf: { '@id': `${baseUrl}/#website` },
    } };
}
function initialContent(deals = []) {
  return `<main data-server-crawl-content="guide"><article><p><a href="/">Browse departments</a></p><h1>${escape(guide.title)}</h1><p>${escape(guide.intro)}</p><p>${escape(guide.disclosure)}</p>${guide.sections.map(section => `<section id="${escape(section.id)}"><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</section>`).join('')}<section><h2>Compare two offers</h2><p>Delivered total = item price + shipping + tax at checkout − eligible discount. Divide each total by its quantity in the same unit. The interactive calculator loads when JavaScript is available.</p></section><section><h2>Current verified offers</h2>${deals.length ? `<ul>${deals.map(deal => `<li><a href="/deal/${encodeURIComponent(deal.id || deal.asin)}">${escape(deal.title)}</a> — $${Number(deal.sale_price).toFixed(2)}</li>`).join('')}</ul>` : '<p>Browse departments for current offers. Offer availability does not change the checklist above.</p>'}</section><section><h2>Sources and pricing policy</h2><ul>${guide.sources.map(source => `<li><a href="${escape(source.url)}"${source.url.startsWith('https://') ? ' rel="nofollow noopener"' : ''}>${escape(source.label)}</a></li>`).join('')}</ul></section><p>As an Amazon Associate we earn from qualifying purchases.</p></article></main>`;
}
module.exports = { metadata, initialContent };
