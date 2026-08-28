const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const functionsRoute = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'functions.js'), 'utf8');

test('production startup requires an explicit Amazon Associate tag', () => {
  assert.match(server, /isProduction && !String\(process\.env\.AMAZON_ASSOCIATE_TAG \|\| ''\)\.trim\(\)/);
  assert.match(server, /AMAZON_ASSOCIATE_TAG must be configured in production/);
});

test('active affiliate routes do not use the legacy placeholder tag', () => {
  assert.match(functionsRoute, /String\(process\.env\.AMAZON_ASSOCIATE_TAG \|\| ''\)\.trim\(\)/);
  assert.doesNotMatch(functionsRoute, /dealscout-20/);
  const guardIndex = server.indexOf('AMAZON_ASSOCIATE_TAG must be configured in production');
  const routeLoadIndex = server.indexOf("app.use('/api/functions'");
  assert.ok(guardIndex > -1 && routeLoadIndex > guardIndex);
});
