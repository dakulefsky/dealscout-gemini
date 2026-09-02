const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyCategory, normalizeCategory } = require('../server/services/categoryClassifier');

test('maps canonical marketplace buckets into DealScout categories', () => {
  assert.equal(normalizeCategory('Amazon Devices & Accessories'), 'Electronics');
  assert.equal(normalizeCategory('Home & Kitchen'), 'Home & Kitchen');
  assert.equal(normalizeCategory('Sports & Outdoors'), 'Sports & Outdoors');
  assert.equal(normalizeCategory('Health & Household'), 'Health & Beauty');
  assert.equal(normalizeCategory('Tools & Home Improvement'), 'Tools & Home Improvement');
  assert.equal(normalizeCategory('Office Products'), 'Office & School');
  assert.equal(normalizeCategory('Grocery & Gourmet Food'), 'Grocery');
});

test('uses product-specific title evidence when provider category is missing or generic', () => {
  assert.equal(classifyCategory({ rawCategory: 'Deals', title: 'Apple AirPods Pro 2 Wireless Earbuds' }), 'Electronics');
  assert.equal(classifyCategory({ rawCategory: 'Featured', title: 'LEGO Star Wars Building Set' }), 'Toys & Games');
  assert.equal(classifyCategory({ rawCategory: '', title: 'Ninja Air Fryer Pro 5 QT' }), 'Home & Kitchen');
  assert.equal(classifyCategory({ rawCategory: 'Other', title: 'DEWALT 20V Cordless Drill Driver Kit' }), 'Tools & Home Improvement');
});

test('distinguishes commonly confused product types', () => {
  assert.equal(classifyCategory({ rawCategory: 'Watches', title: 'Apple Watch Series 10 Smartwatch GPS' }), 'Electronics');
  assert.equal(classifyCategory({ rawCategory: 'Watches', title: 'Timex Weekender Quartz Watch' }), 'Clothing & Accessories');
  assert.equal(classifyCategory({ rawCategory: 'Toys & Games', title: 'Nintendo Switch OLED Video Game Console' }), 'Electronics');
  assert.equal(classifyCategory({ rawCategory: 'Automotive', title: 'Dash Cam Front and Rear 4K' }), 'Automotive');
});

test('avoids substring mistakes from vague words', () => {
  assert.equal(classifyCategory({ rawCategory: '', title: 'Women Cardigan Sweater' }), 'Clothing & Accessories');
  assert.equal(classifyCategory({ rawCategory: '', title: 'Cat6 Ethernet Cable 10 ft' }), 'Electronics');
  assert.equal(classifyCategory({ rawCategory: '', title: 'Dog Food Chicken Recipe 24 lb' }), 'Pet Supplies');
});

test('keeps genuinely unclassified inventory in Other instead of guessing', () => {
  assert.equal(classifyCategory({ rawCategory: 'Deals', title: 'Special Limited Edition Item' }), 'Other');
});
