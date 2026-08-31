const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const removed = [
  'pagination.jsx',
  'form.jsx',
  'sidebar.jsx',
  'alert-dialog.jsx',
  'carousel.jsx',
  'command.jsx',
  'toggle-group.jsx',
];

test('unreachable generated UI primitives stay removed', () => {
  for (const filename of removed) {
    assert.equal(
      fs.existsSync(path.join(root, 'src', 'components', 'ui', filename)),
      false,
      `${filename} should not return without a live consumer`,
    );
  }
});
