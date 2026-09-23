const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('homepage standout rail is selected from the live verified catalog', () => {
  assert.match(home, /trustworthyDiscountPercent\(deal\)/);
  assert.match(home, /filter\(\(item\) => item\.discount >= 30\)/);
  assert.match(home, /slice\(0, 3\)/);
  assert.match(home, /const spotlightIds/);
});

test('homepage remains useful when no deal clears the standout threshold', () => {
  assert.match(home, /Nothing clears our standout threshold right now/);
  assert.match(home, /Current deals by department/);
});
