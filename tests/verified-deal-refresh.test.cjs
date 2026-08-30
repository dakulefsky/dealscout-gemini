const test = require('node:test');
const assert = require('node:assert/strict');
const { verifiedSourceChanges } = require('../server/services/verifiedDealRefresh');

test('verified rediscovery refreshes changed source metadata', () => {
  const changes = verifiedSourceChanges(
    { title: 'Old title', category: 'Old', product_url: 'https://amazon.com/old', image_url: 'https://img/old.jpg' },
    { sourceVerified: true, title: '  New   title ', category: 'Electronics', productUrl: 'https://amazon.com/new', imageUrl: 'https://img/new.jpg' },
  );
  assert.deepEqual(changes, {
    title: 'New title',
    category: 'Electronics',
    product_url: 'https://amazon.com/new',
    image_url: 'https://img/new.jpg',
  });
});

test('unverified or blank provider metadata cannot overwrite stored facts', () => {
  assert.deepEqual(verifiedSourceChanges({ title: 'Good' }, { sourceVerified: false, title: 'Bad' }), {});
  assert.deepEqual(verifiedSourceChanges({ title: 'Good', category: 'Tools' }, { sourceVerified: true, title: ' ', category: '' }), {});
});
