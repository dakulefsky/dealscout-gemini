const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');
const category = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'CategoryPage.jsx'), 'utf8');
const saved = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'SavedDeals.jsx'), 'utf8');

test('shopper surfaces avoid slogan-heavy AI-template copy', () => {
  assert.doesNotMatch(home, /Shop the good stuff|We filter hard|what survives/i);
  assert.doesNotMatch(saved, /shortlist worth revisiting|clean place/i);
  assert.doesNotMatch(category, /Category edit|current edit/i);
});

test('deal cards use flat catalog treatment instead of floaty SaaS cards', () => {
  assert.match(card, /border-t-2/);
  assert.doesNotMatch(card, /hover:shadow|hover:-translate-y/);
});
