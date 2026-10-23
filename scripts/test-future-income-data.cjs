// Run from the repository with the mobile dependencies installed:
// node scripts/test-future-income-data.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const mobile = process.env.AHMED_TEST_MOBILE || path.resolve(__dirname, '../ahmed-mobile');
const mobileRequire = createRequire(path.join(process.env.AHMED_TEST_DEPENDENCIES || mobile, 'package.json'));
const babel = mobileRequire('@babel/core');
const code = babel.transformSync(fs.readFileSync(path.join(mobile, 'futureMonthlyIncomeData.js'), 'utf8'), {
  configFile: false, babelrc: false,
  plugins: [mobileRequire.resolve('@babel/plugin-transform-modules-commonjs')],
}).code;
const loaded = { exports: {} };
new vm.Script('(function(require,module,exports){' + code + '\n})').runInThisContext()(mobileRequire, loaded, loaded.exports);
const { fetchFutureIncomeData, sulfaIncomeValue, ta3meedIncomeCapital, parseIncomeAmount } = loaded.exports;

(async () => {
  assert.equal(sulfaIncomeValue({ platform_snapshot: { total_investments: 20000, outstanding_investments: 12000 }, monthly_profit: 99 }).amount, 105);
  assert.equal(sulfaIncomeValue({ platform_snapshot: { outstanding_investments: 0 }, monthly_profit: 99 }).amount, 0);
  assert.equal(sulfaIncomeValue({ monthly_profit: 99 }).amount, 99);
  assert.equal(sulfaIncomeValue({ monthly_profit: 'invalid', invested_amount: 12000 }).amount, 105);
  assert.equal(ta3meedIncomeCapital({ opportunities: [
    { invested_amount: 1000, principal_received_amount: 300 },
    { invested_amount: 900, status: 'completed' },
    { invested_amount: 800, allocation_status: 'cancelled' },
    { invested_amount: 500, received_total_amount: 100 },
    { invested_amount: 1000, ta3meed_remaining_amount: 200 },
  ] }), 1300);
  assert.equal(ta3meedIncomeCapital({ summary: { ta3meed: 0 }, opportunities: [{ invested_amount: 1000 }] }), 0);
  assert.equal(parseIncomeAmount('١٬٢٣٤٫٥٠'), 1234.5);
  assert.equal(parseIncomeAmount('۱,۲۳۴.۵۰'), 1234.5);
  assert(Number.isNaN(parseIncomeAmount('1.2.3')));
  const requests = [];
  let failDinar = false;
  let comAmount = 20;
  let comStatus = 'fresh';
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/dinar/') && failDinar) throw new Error('offline');
    let json = { data: [] };
    if (url.includes('monthly-incomes?')) json = { data: [{ id: 1, name: 'Test rent', amount: 250 }, { id: 'fixed-com-monthly-person-net', source_key: 'com_monthly_person_net', amount: comAmount, sync_status: comStatus, synced_at: '2026-10-23T00:00:00Z' }] };
    if (url.includes('/moneymoon/')) json = { data: [{ status: 'active', principal_amount: 2000 }, { status: 'received', principal_amount: 1000 }, { status: 'completed', principal_amount: 1000 }] };
    if (url.includes('/ta3meed/')) json = { data: { summary: { ta3meed: 3000 } } };
    if (url.includes('/dinar/')) json = { data: [{ investment_amount: 5000, payments: [{ is_paid: 1, total_principal: 1000 }, { is_paid: 0, total_principal: 1000 }] }] };
    if (url.includes('/sulfa/')) json = { data: { platform_snapshot: { outstanding_investments: 12000 } } };
    if (url.includes('/tokenize/')) json = { summary: { monthly_profit_average: 15 } };
    if (url.startsWith('https://finance.')) json = { data: { income: { ahmed_monthly_net_profit_after_stuck_deduction: 50 } } };
    return { ok: true, json: async () => json };
  };
  const options = { apiUrl: 'https://ahmed.pm.sa/api', headers: { Authorization: 'Bearer fixture-session' }, fetcher };
  let result = await fetchFutureIncomeData(options);
  assert.deepEqual(result.failed, []);
  assert.equal(result.manual.length, 1, 'COM must not be counted as a manual source');
  assert.equal(result.values.dinar.amount, 40, 'Dinar must deduct paid principal only');
  assert.equal(result.values.sulfa.amount, 105);
  assert.equal(result.values.moneymoon.amount, 20);
  assert.equal(result.values.ta3meed.amount, 30);
  assert.equal(result.values.com.amount, 20);
  assert.equal(Object.values(result.values).reduce((sum, row) => sum + row.amount, 0) + result.manual[0].amount, 530);
  for (const { url, options: request } of requests) assert.equal(request.headers.Authorization, url.startsWith('https://finance.') ? undefined : 'Bearer fixture-session');
  assert.equal(result.values.com.syncedAt, '2026-10-23T00:00:00Z');
  comAmount = 0;
  result = await fetchFutureIncomeData(options);
  assert.equal(result.values.com.amount, 0, 'A real zero must remain a valid current value');
  comAmount = 99;
  result = await fetchFutureIncomeData(options);
  assert.equal(result.values.com.amount, 99, 'A changed source must update without a fixed fallback');
  comStatus = 'unavailable'; comAmount = null;
  result = await fetchFutureIncomeData(options);
  assert(result.failed.includes('com'));
  assert.equal(result.values.com, undefined, 'A missing source must not masquerade as a current zero');
  assert.equal(result.manual.length, 1, 'COM failure must not prevent manual income loading');
  failDinar = true;
  result = await fetchFutureIncomeData({ ...options, includeFinance: false });
  assert(result.failed.includes('dinar'));
  assert.equal(result.values.dinar, undefined, 'Unavailable values must not be presented as zero');
  assert.equal(result.values.finance, undefined);
  assert.equal(result.values.com, undefined);
  console.log('PASS: current-capital formulas, principal returns, zero and fallback values, statuses, Arabic input, COM deduplication, tenant headers, admin-only integration and partial failures.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
