const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { formatAffiliateUrl } = require('../server/services/amazonUrlService');
const { publicSurfaceOnly } = require('../server/middleware/publicSurfaceOnly');
const source = fs.readFileSync(require.resolve('../server/routes/functions'), 'utf8');
let handler;
vm.runInNewContext(source.slice(source.indexOf("router.get('/amazon-redirect'"), source.indexOf("router.post('/amazon-redirect'")), {
  router: { get: (_path, callback) => { handler = callback; } }, URL,
  formatAffiliateUrl, AMAZON_ASSOCIATE_TAG: 'owner-20',
});
function run(url) {
  const result = {};
  const res = {
    status(code) { result.status = code; return this; },
    type() { return this; }, send(body) { result.body = body; return this; },
    set(name, value) { result[name] = value; return this; },
    redirect(code, destination) { result.status = code; result.destination = destination; },
  };
  handler({ query: { url } }, res);
  return result;
}
test('native redirect preserves affiliate tag and product options, removes scroll fragment', () => {
  const result = run('https://www.amazon.com/dp/B08PZHYWJS?th=1&tag=other-20#customerReviews');
  const destination = new URL(result.destination);
  assert.equal(result.status, 302);
  assert.equal(destination.searchParams.get('tag'), 'owner-20');
  assert.equal(destination.searchParams.get('th'), '1');
  assert.equal(destination.hash, '');
  assert.equal(result['Cache-Control'], 'no-store');
});
test('native redirect rejects non-Amazon and malformed destinations', () => {
  for (const value of ['https://evil.example/', 'javascript:alert(1)', ['https://amazon.com'], undefined, 'https://amazon.com.evil.example/']) {
    assert.equal(run(value).status, 400);
    assert.equal(run(value).destination, undefined);
  }
});
test('public service allows native affiliate GET without allowing operational endpoints', () => {
  const previous = process.env.PUBLIC_SURFACE_ONLY;
  process.env.PUBLIC_SURFACE_ONLY = 'true';
  try {
    let allowed = false;
    publicSurfaceOnly({path:'/api/functions/amazon-redirect', method:'GET'}, {}, () => { allowed = true; });
    assert.equal(allowed, true);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_SURFACE_ONLY;
    else process.env.PUBLIC_SURFACE_ONLY = previous;
  }
});
