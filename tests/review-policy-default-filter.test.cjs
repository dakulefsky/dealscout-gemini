const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin opens directly to actual review exceptions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.ok(source.includes("const [filter, setFilter] = useState('needs-review')"));
});
