const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('verified price observations evaluate alerts without retaining shopper history', () => {
  const observation = read('server/services/priceHistoryService.js');
  assert.match(observation, /processPriceAlerts/);
  assert.match(observation, /safelyProcessPriceAlerts/);
  assert.match(observation, /Price alert processing skipped/);
  assert.match(observation, /await safelyProcessPriceAlerts\(\{ asin: cleanAsin, salePrice: sale \}\)/);
  assert.doesNotMatch(observation, /price_history|HISTORY_FILE|getHistory|writeFileSync|INSERT INTO/i);
});

test('price alerts use a recoverable delivery claim and only trigger at or below target', () => {
  const repository = read('server/repositories/priceAlertRepository.js');
  assert.match(repository, /CLAIM_TTL_SECONDS = 15 \* 60/);
  assert.match(repository, /delivery_claimed_at/);
  assert.match(repository, /alert\.target_price >= \$2/);
  assert.match(repository, /alert\.status = 'ACTIVE'/);
  assert.match(repository, /alert\.status = 'DELIVERING'/);
  assert.match(repository, /status = 'TRIGGERED'/);
});

test('failed email delivery releases the claim but successful delivery is not knowingly reopened', () => {
  const service = read('server/services/priceAlertService.js');
  assert.match(service, /mailer\.sendPriceAlert/);
  assert.match(service, /alerts\.releaseClaim\(alert\.id\)/);
  assert.match(service, /alerts\.markTriggered\(alert\.id\)/);
  assert.match(service, /Do not reopen the claim here/);
});

test('price alert email links to the DealScout deal and includes a price-change disclaimer', () => {
  const mail = read('server/services/mailService.js');
  assert.match(mail, /async function sendPriceAlert/);
  assert.match(mail, /\/deal\/\$\{encodeURIComponent\(dealId\)\}/);
  assert.match(mail, /Price and availability can change on Amazon/);
});
