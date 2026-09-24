const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DealCard.jsx'), 'utf8');

test('deal-card action buttons are siblings of the product link instead of nested inside it', () => {
  assert.match(source, /const actionButtons = \(/);
  assert.match(source, /<Link to=\{`\/deal\/\$\{dealId\}`\}[\s\S]*?<\/Link>\s*\{actionButtons\}/);
  assert.match(source, /<\/Link>\s*<div className="flex justify-end border-t border-emerald-950\/10 px-2 py-2">\{actionButtons\}<\/div>/);
  assert.doesNotMatch(source, /absolute[^"\n]*>\{actionButtons\}/);
  assert.doesNotMatch(source, /<Link[^>]*>[\s\S]*?<button[^>]*>[\s\S]*?<\/button>[\s\S]*?<\/Link>/);
});

test('card actions and product links have explicit accessible names and focus treatment', () => {
  assert.match(source, /aria-label=\{`View deal: \$\{deal\.title\}`\}/);
  assert.match(source, /aria-label=\{`Not interested in \$\{deal\.title\}`\}/);
  assert.match(source, /aria-label=\{saved \? `Remove \$\{deal\.title\} from saved deals` : `Save \$\{deal\.title\}`\}/);
  assert.match(source, /focus-visible:ring-2/);
});

test('action clicks no longer rely on preventing parent link navigation', () => {
  const bookmarkHandler = source.match(/function handleBookmarkClick\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  const dismissHandler = source.match(/function handleDismissClick\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.doesNotMatch(bookmarkHandler, /preventDefault|stopPropagation/);
  assert.doesNotMatch(dismissHandler, /preventDefault|stopPropagation/);
});
