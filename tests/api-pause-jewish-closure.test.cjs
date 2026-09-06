const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('provider API pause is durable and enforced before budget reservation', () => {
  const settings = read('server/services/channelSettingsService.js');
  const throttle = read('server/services/providerThrottle.js');
  assert.match(settings, /provider_api: Object\.freeze\(\{ enabled: true \}\)/);
  assert.match(throttle, /channelSettings\.get\('provider_api'\)/);
  assert.match(throttle, /PROVIDER_PAUSED/);
  assert.ok(throttle.indexOf("channelSettings.get('provider_api')") < throttle.indexOf('reserveRequest(key)'), 'pause check must happen before provider budget reservation');
});

test('admin exposes API pause and Jerusalem closure calendar controls', () => {
  const endpoint = read('server/middleware/channelSettingsEndpoint.js');
  const client = read('src/lib/apiCore.js');
  const ui = read('src/components/AdminOperationsControls.jsx');
  assert.match(endpoint, /providerApiEnabled/);
  assert.match(client, /setProviderApiEnabled/);
  assert.match(client, /jewishCalendar/);
  assert.match(ui, /Pause provider API/);
  assert.match(ui, /Asia\/Jerusalem/);
});

test('production shopper HTML fails closed during Jerusalem melacha-prohibited time', () => {
  const server = read('server.js');
  assert.match(server, /jewishClosure\.currentStatus\(\)/);
  assert.match(server, /closure\.closed/);
  assert.match(server, /status\(503\)/);
  assert.match(server, /Retry-After/);
  assert.match(server, /req\.path\.startsWith\('\/admin'\)/);
});

test('closure calendar pairs candle lighting through havdalah, including multi-day Yom Tov', () => {
  const { pairClosures } = require('../server/services/jewishClosureService');
  const periods = pairClosures([
    { category: 'candles', date: '2026-09-11T18:10:00+03:00', memo: 'Erev Rosh Hashana' },
    { category: 'candles', date: '2026-09-12T19:06:00+03:00', memo: 'Rosh Hashana I' },
    { category: 'havdalah', date: '2026-09-13T19:05:00+03:00', memo: 'Rosh Hashana II' },
  ]);
  assert.equal(periods.length, 1);
  assert.equal(periods[0].start, '2026-09-11T15:10:00.000Z');
  assert.equal(periods[0].end, '2026-09-13T16:05:00.000Z');
  assert.match(periods[0].label, /Rosh Hashana/);
});
