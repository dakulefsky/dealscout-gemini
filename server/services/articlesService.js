const articles = require('../../shared/articles.json');
const guide = require('../../shared/buyingGuide.json');
const { htmlEscape: escape } = require('./seoService');
const catalog = [{ ...guide, path: `/guides/${guide.slug}` }, ...articles.map(article => ({ ...article, path: `/articles/${article.slug}` }))];

function page(baseUrl, slug) {
  if (!slug) {
    const canonical = `${baseUrl}/articles`;
    return { status: 200, meta: { title: 'Articles — DealScout', description: 'Practical help comparing offers, understanding savings, and choosing a deal that fits what you need.', canonical,
      jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'DealScout articles', url: canonical, mainEntity: { '@type': 'ItemList', itemListElement: catalog.map((article, index) => ({ '@type': 'ListItem', position: index + 1, name: article.title, url: `${baseUrl}${article.path}` })) } } },
      html: `<main data-server-crawl-content="articles"><h1>Articles</h1><p>Practical help comparing offers, understanding savings, and choosing a deal that fits what you need.</p>${catalog.map(article => `<article><h2><a href="${escape(article.path)}">${escape(article.title)}</a></h2><p>${escape(article.description)}</p></article>`).join('')}</main>` };
  }
  const article = articles.find(item => item.slug === slug);
  if (!article) return { status: 404, meta: { title: 'Article not found — DealScout', description: 'Browse DealScout articles for help comparing offers.', canonical: null, robots: 'noindex,follow' }, html: '<main><h1>Article not found</h1><p><a href="/articles">Browse articles</a></p></main>' };
  const canonical = `${baseUrl}/articles/${article.slug}`;
  return { status: 200, meta: { title: `${article.title} — DealScout`, description: article.description, canonical,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description, url: canonical, mainEntityOfPage: canonical, author: { '@type': 'Organization', name: 'DealScout', url: `${baseUrl}/about` }, publisher: { '@id': `${baseUrl}/#organization` }, isPartOf: { '@id': `${baseUrl}/#website` } } },
    html: `<main data-server-crawl-content="article"><article><nav><a href="/articles">Articles</a></nav><h1>${escape(article.title)}</h1><p>${escape(article.intro)}</p>${article.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}</section>`).join('')}<nav><h2>Useful next steps</h2><ul>${article.links.map(link => `<li><a href="${escape(link.path)}">${escape(link.label)}</a></li>`).join('')}</ul></nav><p>Examples illustrate comparisons; they are not live offers or hands-on product reviews.</p></article></main>` };
}
module.exports = { page, catalog };
