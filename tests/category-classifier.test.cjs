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
  assert.equal(classifyCategory({ rawCategory: 'Grocery', title: 'CUSHIONAIRE Brooklyn Genuine Suede Slingback Clogs for Women' }), 'Clothing & Accessories');
  assert.equal(classifyCategory({ rawCategory: 'Grocery', title: 'CUSHIONAIRE Brooklyn Genuine Suede Slingback Clogs for Women with Buckle Chocolate Genuine Suede 8.5' }), 'Clothing & Accessories');
});

test('food words used as retail color labels do not misclassify products', () => {
  assert.equal(classifyCategory({ rawCategory: 'Other', title: 'Chocolate Brown Genuine Suede Loafers for Women' }), 'Clothing & Accessories');
  assert.equal(classifyCategory({ rawCategory: 'Other', title: 'Hershey Milk Chocolate Bar, 1.55 oz' }), 'Grocery');
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

test('specific product types outrank incidental Bluetooth, Wi-Fi and USB features', () => {
  const examples = [
    ['Lefant Robot Vacuum and Mop, Smart Mapping, 2.4G/5G WiFi App Control', 'Home & Kitchen'],
    ['roborock Robot Vacuum and Mop, Wi-Fi and Alexa Control', 'Home & Kitchen'],
    ['iHealth Upper Arm Blood Pressure Monitor Bluetooth for iOS and Android', 'Health & Beauty'],
    ['Etekcity Smart Scale for Body Weight, Body Fat and BMI, Bluetooth App Sync', 'Health & Beauty'],
    ['Baby Monitor with Wi-Fi Camera and USB Charging', 'Baby'],
    ['Automatic Pet Feeder with WiFi App Control', 'Pet Supplies'],
    ['USB C Car Charger and Bluetooth Adapter', 'Automotive'],
    ['USB Rechargeable Work Light', 'Tools & Home Improvement'],
    ['Bluetooth Headphones with USB-C Charging', 'Electronics'],
    ['Gaming Monitor with USB Hub', 'Electronics'],
  ];
  for (const [title, expected] of examples) assert.equal(classifyCategory({ rawCategory: 'Electronics', title }), expected, title);
  assert.equal(classifyCategory({ rawCategory: 'Home & Kitchen', title: 'Kitchen Scale with Bluetooth' }), 'Home & Kitchen');
  const { strongTitleCategory } = require('../server/services/categoryClassifier');
  assert.equal(strongTitleCategory('Robot Vacuum and Bluetooth Headphones Bundle with Baby Monitor'), null);
});

test('recognizes live apparel, security, and household imports that previously fell into Other', () => {
  for (const title of ['Trendy Queen Women Pajamas Set Sleepwear Fall 2 Piece Soft Lounge Pjs', 'Trendy Queen Womens Hoodies Oversized Sweatshirt']) {
    assert.equal(classifyCategory({ rawCategory: 'Other', title }), 'Clothing & Accessories');
  }
  for (const title of ['Ring Battery Doorbell 2K', 'Ring Floodlight Cam Wired Plus', 'Ring Outdoor Cam 2K', 'Ring Wired Doorbell 4K Pro']) {
    assert.equal(classifyCategory({ rawCategory: 'Other', title }), 'Electronics');
  }
  for (const title of ['Ninja Luxe Café Pro Espresso Machine', 'BISSELL Little Green Mini Portable Carpet Cleaner', 'Amazon Basics 2-Ply Soft Toilet Paper']) {
    assert.equal(classifyCategory({ rawCategory: 'Other', title }), 'Home & Kitchen');
  }
});
