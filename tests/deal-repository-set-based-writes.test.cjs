const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repository = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'dealRepository.js'), 'utf8');

test('PostgreSQL bulk status updates are set-based and preserve verified approval boundary', () => {
  assert.match(repository, /id = ANY\(\$1::text\[\]\) OR asin = ANY\(\$1::text\[\]\)/);
  assert.match(repository, /\$2 <> 'APPROVED' OR source_verified = 1/);
  assert.match(repository, /return result\.rowCount/);
});

test('approve-all verified is one guarded SQL update in PostgreSQL', () => {
  assert.match(repository, /WHERE status = 'PENDING_REVIEW' AND source_verified = 1/);
  assert.match(repository, /SET status = 'APPROVED', is_expired = 0, expired_at = NULL/);
});

test('production hardening uses a set-based PostgreSQL update', () => {
  assert.match(repository, /WHERE source_verified <> 1\s+AND \(source_sufficient <> 0 OR status = 'APPROVED'\)/);
});
