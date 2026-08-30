const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule() {
  const url = pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'feedPersonalization.js')).href;
  return import(`${url}?test=${Date.now()}`);
}

function deal(id, category) {
  return { id, category };
}

test('personalization is bounded to a small quality look-ahead window', async () => {
  const { personalizedRank, PERSONALIZATION_WINDOW } = await loadModule();
  assert.equal(PERSONALIZATION_WINDOW, 8);
  const deals = [
    deal('0', 'Home'), deal('1', 'Audio'), deal('2', 'Audio'), deal('3', 'Audio'),
    deal('4', 'Kitchen'), deal('5', 'Audio'), deal('6', 'Books'), deal('7', 'Audio'),
    deal('8', 'Audio'), deal('9', 'Garden'), deal('10', 'Audio'), deal('11', 'Toys'),
  ];
  const ranked = personalizedRank(deals, { audio: 24 });
  const originalPosition = new Map(deals.map((item, index) => [item.id, index]));
  ranked.forEach((item, outputIndex) => {
    assert.ok(originalPosition.get(item.id) - outputIndex < PERSONALIZATION_WINDOW, `${item.id} jumped too far ahead`);
  });
});

test('the feed reserves regular exploration outside strongest interests', async () => {
  const { personalizedRank, EXPLORATION_EVERY } = await loadModule();
  assert.equal(EXPLORATION_EVERY, 4);
  const deals = [
    deal('0', 'Home'), deal('1', 'Audio'), deal('2', 'Audio'), deal('3', 'Audio'),
    deal('4', 'Kitchen'), deal('5', 'Audio'), deal('6', 'Books'), deal('7', 'Audio'),
  ];
  const ranked = personalizedRank(deals, { audio: 24 });
  assert.notEqual(ranked[3].category.toLowerCase(), 'audio');
});

test('strong interest cannot create long same-category streaks', async () => {
  const { personalizedRank, MAX_CATEGORY_STREAK } = await loadModule();
  assert.equal(MAX_CATEGORY_STREAK, 2);
  const deals = [
    deal('0', 'Audio'), deal('1', 'Audio'), deal('2', 'Audio'), deal('3', 'Home'),
    deal('4', 'Audio'), deal('5', 'Kitchen'), deal('6', 'Audio'), deal('7', 'Books'),
  ];
  const ranked = personalizedRank(deals, { audio: 24 });
  let streak = 0;
  let previous = '';
  for (const item of ranked) {
    const category = item.category.toLowerCase();
    streak = category === previous ? streak + 1 : 1;
    assert.ok(streak <= MAX_CATEGORY_STREAK, `category streak exceeded ${MAX_CATEGORY_STREAK}`);
    previous = category;
  }
});

test('without positive interests the original quality order is unchanged', async () => {
  const { personalizedRank } = await loadModule();
  const deals = [deal('0', 'Home'), deal('1', 'Audio'), deal('2', 'Books')];
  assert.deepEqual(personalizedRank(deals, {}), deals);
});
