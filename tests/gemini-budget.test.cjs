const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const budget = require('../server/services/providerBudgetService');
const aiRoutes = require('../server/routes/ai');

const root = path.join(__dirname, '..');
const geminiSource = fs.readFileSync(path.join(root, 'server', 'gemini.js'), 'utf8');

function withGeminiLimits(daily, monthly, fn) {
  const oldDaily = process.env.GEMINI_DAILY_REQUEST_LIMIT;
  const oldMonthly = process.env.GEMINI_MONTHLY_REQUEST_LIMIT;
  process.env.GEMINI_DAILY_REQUEST_LIMIT = String(daily);
  process.env.GEMINI_MONTHLY_REQUEST_LIMIT = String(monthly);
  budget.resetLocalUsage();
  return Promise.resolve(fn()).finally(() => {
    budget.resetLocalUsage();
    if (oldDaily === undefined) delete process.env.GEMINI_DAILY_REQUEST_LIMIT; else process.env.GEMINI_DAILY_REQUEST_LIMIT = oldDaily;
    if (oldMonthly === undefined) delete process.env.GEMINI_MONTHLY_REQUEST_LIMIT; else process.env.GEMINI_MONTHLY_REQUEST_LIMIT = oldMonthly;
  });
}

test('Gemini has bounded launch-safe request defaults', () => {
  const oldDaily = process.env.GEMINI_DAILY_REQUEST_LIMIT;
  const oldMonthly = process.env.GEMINI_MONTHLY_REQUEST_LIMIT;
  delete process.env.GEMINI_DAILY_REQUEST_LIMIT;
  delete process.env.GEMINI_MONTHLY_REQUEST_LIMIT;
  try { assert.deepEqual(budget.limitsFor('gemini'), { daily: 200, monthly: 5000 }); }
  finally {
    if (oldDaily !== undefined) process.env.GEMINI_DAILY_REQUEST_LIMIT = oldDaily;
    if (oldMonthly !== undefined) process.env.GEMINI_MONTHLY_REQUEST_LIMIT = oldMonthly;
  }
});

test('Gemini budget blocks before an extra outbound request is reserved', async () => withGeminiLimits(2, 10, async () => {
  const now = new Date('2026-09-03T12:00:00Z');
  await budget.reserveRequest('gemini', now);
  await budget.reserveRequest('gemini', now);
  await assert.rejects(
    () => budget.reserveRequest('gemini', now),
    (error) => error?.code === 'PROVIDER_BUDGET_EXCEEDED' && error?.provider === 'gemini' && error?.scope === 'day',
  );
}));

test('every Gemini generation passes through one durable budget reservation boundary', () => {
  const helper = geminiSource.match(/async function generateGeminiContent[\s\S]*?\n\}/)?.[0] || '';
  assert.match(helper, /await reserveRequest\('gemini'\)/);
  assert.match(helper, /ai\.models\.generateContent\(request\)/);
  assert.equal((geminiSource.match(/ai\.models\.generateContent\(/g) || []).length, 1);
  assert.equal((geminiSource.match(/generateGeminiContent\(ai,/g) || []).length, 2);
});

test('AI routes expose budget exhaustion as a bounded 429 response', () => {
  const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  aiRoutes.aiErrorResponse(response, { code: 'PROVIDER_BUDGET_EXCEEDED', provider: 'gemini' }, 'fallback');
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.code, 'AI_BUDGET_EXCEEDED');
});
