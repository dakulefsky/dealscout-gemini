// Crawlers may fetch public data to render shopper pages, but API JSON is not
// a search landing page. Authentication and authorization are separate.
function apiIndexing(_req, res, next) {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
}
module.exports = { apiIndexing };
