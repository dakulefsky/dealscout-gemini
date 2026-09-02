const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin exposes durable WhatsApp Status pause and resume controls', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/AdminHome.jsx'), 'utf8');
  assert.match(source, /functions\.channelSettings\(\)/);
  assert.match(source, /functions\.setWhatsAppStatusEnabled\(!whatsappStatusEnabled\)/);
  assert.match(source, /Pause Status publishing/);
  assert.match(source, /Resume Status publishing/);
});

test('admin shows Rainforest daily and monthly budget usage', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/AdminHome.jsx'), 'utf8');
  assert.match(source, /Rainforest today/);
  assert.match(source, /rainforestBudget\.dayCount/);
  assert.match(source, /Rainforest month/);
  assert.match(source, /rainforestBudget\.monthCount/);
  assert.match(source, /Requests blocked today/);
});

test('channel setting mutation gets a distinct activity label', () => {
  const audit = fs.readFileSync(path.join(__dirname, '../server/middleware/adminActivityAudit.js'), 'utf8');
  const admin = fs.readFileSync(path.join(__dirname, '../src/pages/AdminHome.jsx'), 'utf8');
  assert.match(audit, /channel\.whatsapp_status/);
  assert.match(admin, /Changed WhatsApp Status publishing/);
});
