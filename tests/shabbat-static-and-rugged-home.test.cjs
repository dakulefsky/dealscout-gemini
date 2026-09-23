const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');

test('public Shabbat closure is static and blocks shopper API execution', () => {
  assert.match(server, /PUBLIC_SURFACE_ONLY !== 'true'/);
  assert.match(server, /req\.path\.startsWith\('\/api\/'\)/);
  assert.match(server, /res\.status\(503\)\.json\(/);
  assert.match(server, /Closed for Shabbat/);
  assert.doesNotMatch(server.match(/function closureHtml[\s\S]*?\n\}/)?.[0] || '', /<script|fetch\(|\/api\//i);
});

test('crawler files and infrastructure health stay available during closure', () => {
  assert.match(server, /req\.path === '\/robots\.txt'/);
  assert.match(server, /req\.path === '\/sitemap\.xml'/);
  assert.match(server, /req\.path === '\/ads\.txt'/);
  assert.match(server, /req\.path === '\/api\/health'/);
  assert.match(server, /req\.path === '\/api\/ready'/);
});

test('homepage uses a restrained department index instead of a giant explanatory hero', () => {
  assert.match(home, /Departments/);
  assert.match(home, /Shop the good stuff\./);
  assert.match(home, /Worth it today/);
  assert.match(home, /We filter hard\. You shop what survives\./);
  assert.doesNotMatch(home, /What are you here for\?/);
  assert.doesNotMatch(home, /text-\[66px\]/);
});
