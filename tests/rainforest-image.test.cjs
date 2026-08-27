const test = require('node:test');
const assert = require('node:assert/strict');
const { imageUrl, imageCandidates } = require('../server/services/rainforestImage');

test('extracts image URLs from common Rainforest shapes', () => {
  assert.equal(imageUrl('https://images.example/a.jpg'), 'https://images.example/a.jpg');
  assert.equal(imageUrl({ link: 'https://images.example/b.jpg' }), 'https://images.example/b.jpg');
  assert.equal(imageUrl({ url: 'https://images.example/c.jpg' }), 'https://images.example/c.jpg');
  assert.equal(imageUrl({ hi_res: { link: 'https://images.example/d.jpg' } }), 'https://images.example/d.jpg');
});

test('builds a unique fallback gallery from mixed image fields', () => {
  const gallery = imageCandidates(
    { link: 'https://images.example/main.jpg' },
    ['https://images.example/second.jpg', { url: 'https://images.example/third.jpg' }],
    { link: 'https://images.example/main.jpg' }
  );
  assert.deepEqual(gallery, [
    'https://images.example/main.jpg',
    'https://images.example/second.jpg',
    'https://images.example/third.jpg',
  ]);
});

test('ignores missing and non-http image values', () => {
  assert.equal(imageUrl(null), null);
  assert.equal(imageUrl('not-a-url'), null);
  assert.deepEqual(imageCandidates(null, '', { link: null }), []);
});
