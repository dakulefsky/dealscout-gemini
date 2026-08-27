const fs = require('fs');
const path = require('path');

describe('public deal enrichment boundary', () => {
  test('deal detail does not render legacy unproven enrichment fields', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');
    expect(source).not.toContain('deal.fullSummary');
    expect(source).not.toContain('deal.shortBio');
    expect(source).not.toContain('deal.pros');
    expect(source).not.toContain('deal.cons');
  });

  test('strict Rainforest adapter does not carry customer review content', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'rainforestStrictAdapter.js'), 'utf8');
    expect(source).toContain('reviews: []');
    expect(source).not.toContain('top_reviews');
    expect(source).not.toContain('normalizeReviews');
  });

  test('live provider routing cannot fall back to legacy scraper metadata', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'providerRouter.js'), 'utf8');
    expect(source).not.toContain("require('./amazonScraperService')");
    expect(source).not.toContain('resolveProductDetails');
    expect(source).toContain("process.env.NODE_ENV !== 'production'");
    expect(source).toContain('Fail closed');
  });
});
