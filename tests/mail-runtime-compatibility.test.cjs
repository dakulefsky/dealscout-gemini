const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodemailer = require('nodemailer');

test('patched Nodemailer builds every app email locally without external delivery or unsafe content access', async () => {
  const messages = [];
  const configurations = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../server/services/mailService'), 'utf8'), {
    module, exports: module.exports, URL,
    process: { env: { NODE_ENV: 'production', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'mail@example.com', SMTP_PASS: 'unused', PUBLIC_WEB_URL: 'https://deals.example.com', ADMIN_WEB_URL: 'https://admin.example.com' } },
    require(name) {
      if (name === 'nodemailer') return { createTransport(config) {
        configurations.push(config);
        const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
        return { async sendMail(options) { messages.push(await transport.sendMail(options)); } };
      } };
      return require('../server/config/publicSurface');
    },
  });
  const mail = module.exports;
  await mail.sendVerificationCode('test@example.com', '123456');
  await mail.sendPasswordReset('test@example.com', 'reset-token');
  await mail.sendPriceAlert('test@example.com', { dealId: 'B000000001', dealTitle: 'Example product', currentPrice: 20, targetPrice: 25 });
  assert.equal(messages.length, 3);
  assert.match(messages[0].message.toString(), /123456/);
  const decoded = (message) => message.message.toString().replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  assert.match(decoded(messages[1]), /admin.example.com\/admin\/reset-password/);
  assert.match(decoded(messages[2]), /deals.example.com\/deal\/B000000001/);
  for (const config of configurations) {
    assert.equal(config.disableFileAccess, true);
    assert.equal(config.disableUrlAccess, true);
    assert.equal(config.socketTimeout, 20000);
  }
});
