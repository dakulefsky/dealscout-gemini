const test = require('node:test');
const assert = require('node:assert/strict');
const { getAmazonBounties } = require('../server/services/amazonBounties');

test('bounty destinations are direct tagged Amazon program homepages', () => {
  const programs = getAmazonBounties('dankul-20');
  assert.deepEqual(programs.map(({ id }) => id), ['prime', 'prime-video', 'audible', 'kindle-unlimited']);
  for (const program of programs) {
    const url = new URL(program.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'www.amazon.com');
    assert.equal(url.searchParams.get('tag'), 'dankul-20');
    assert.ok(program.name && program.description);
  }
  assert.equal(new URL(programs[0].url).pathname, '/prime');
  assert.equal(new URL(programs[2].url).pathname, '/hz/audible/mlp');
});

test('unconfigured associate tag cannot publish untracked bounty links', () => {
  assert.deepEqual(getAmazonBounties(''), []);
});
