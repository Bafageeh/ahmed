const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const mobile = path.resolve(__dirname, '../ahmed-mobile');
const { buildIncomeWidgetData } = require(path.join(mobile, 'incomeWidgetData'));
const definitions = [{ id: 'investment', color: '#123456' }, { id: 'finance', color: '#ABCDEF' }, { id: 'com', color: '#345678' }];

const data = buildIncomeWidgetData({ values: { investment: { amount: 120.125 }, finance: { amount: 800 }, com: { amount: 900 } }, manual: [{ amount: 5 }], updatedAt: new Date(1000), failed: [] }, definitions, false, 2);
assert.equal(data.monthlyAmount, 125.13);
assert.equal(data.annualAmount, 1501.5, 'Annual total uses the unrounded monthly total');
assert.equal(data.activeCount, 2);
const negative = buildIncomeWidgetData({ values: { investment: { amount: -10.005 } }, manual: [], updatedAt: 1000 }, definitions, false, 2);
assert.equal(negative.monthlyText, '-10.01', 'Widget rounding must match the income screen for negative totals');
assert.equal(data.ownerId, '2');
assert.equal(data.updatedAt, 1000);
assert(Math.abs(data.segments.reduce((sum, segment) => sum + segment.fraction, 0) - 1) < 1e-9);
const empty = buildIncomeWidgetData({ values: { investment: { amount: -10 } }, manual: [], updatedAt: 1000, failed: ['investment'] }, definitions, false, 3);
assert.equal(empty.monthlyAmount, -10);
assert.equal(empty.stale, true);
assert.equal(empty.activeCount, 0);
assert.deepEqual(empty.segments, []);

const babel = require(path.join(mobile, 'node_modules/@babel/core'));
const compiled = babel.transformSync(fs.readFileSync(path.join(mobile, 'incomeWidgetSync.js'), 'utf8'), { configFile: false, babelrc: false, plugins: [require.resolve(path.join(mobile, 'node_modules/@babel/plugin-transform-modules-commonjs'))] }).code;
const pending = [];
const native = {
  owner: '', data: null,
  bindSession(owner) { this.owner = owner; this.data = null; },
  hasWidgets() { return true; },
  updateSnapshot(owner, payload) { if (this.owner !== owner) return false; this.data = JSON.parse(payload); return true; },
  async requestPin() { return true; },
};
let available = true;
const timers = new Set();
const moduleObject = { exports: {} };
const appState = { currentState: 'active', addEventListener() { return { remove() {} }; } };
const sandbox = {
  module: moduleObject, exports: moduleObject.exports, process: { env: {} },
  setInterval(callback) { timers.add(callback); return callback; }, clearInterval(callback) { timers.delete(callback); },
  require(name) {
    if (name === 'react-native') return { Platform: { OS: 'android' }, AppState: appState };
    if (name === 'expo') return { requireOptionalNativeModule: () => available ? native : null };
    if (name === './incomeWidgetData') return { buildIncomeWidgetData };
    if (name === './futureMonthlyIncomeData') return {
      FUTURE_INCOME_SOURCES: definitions,
      fetchFutureIncomeData: (options) => new Promise((resolve) => pending.push({ options, resolve })),
    };
    throw new Error('Unexpected dependency: ' + name);
  },
};
vm.runInNewContext(compiled, sandbox, { filename: 'incomeWidgetSync.js' });
const sync = moduleObject.exports;
const result = (amount) => ({ values: { investment: { amount } }, manual: [], failed: [] });
const tick = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  native.owner = 'previous-account'; native.data = { monthlyAmount: 999 };
  sync.synchronizeIncomeWidgetSession(null);
  assert.equal(native.data, null, 'Starting without a session clears any persisted widget snapshot');
  sync.synchronizeIncomeWidgetSession({ user: { id: 1, is_admin: true }, sessionKey: 'test-token-A' });
  assert.equal(pending[0].options.includeFinance, true);
  sync.synchronizeIncomeWidgetSession({ user: { id: 2, is_admin: false }, sessionKey: 'test-token-B' });
  assert.equal(pending[1].options.includeFinance, false);
  assert.equal(native.data, null, 'Switching accounts clears the previous widget immediately');
  pending[0].resolve(result(999)); await tick();
  assert.equal(native.data, null, 'Late data from the previous account must be ignored');
  pending[1].resolve(result(25)); await tick();
  assert.equal(native.data.ownerId, '2'); assert.equal(native.data.monthlyAmount, 25);
  assert(!JSON.stringify(native.data).includes('test-token'), 'Credentials must never be stored in widget data');
  assert.equal(await sync.requestIncomeWidgetPin(), 'requested');
  sync.refreshIncomeWidget();
  sync.synchronizeIncomeWidgetSession(null);
  assert.equal(native.data, null, 'Signing out clears the widget');
  pending[2].resolve(result(888)); await tick();
  assert.equal(native.data, null, 'A request completing after logout cannot restore data');
  assert.equal(timers.size, 0);
  available = false;
  sync.synchronizeIncomeWidgetSession({ user: { id: 3 }, sessionKey: 'test-token-C' });
  assert.equal(await sync.requestIncomeWidgetPin(), 'unavailable', 'Expo Go remains usable without the native module');
  assert.equal(pending.length, 3, 'Expo Go must not start widget data polling');
  console.log('Income widget totals, tenant boundaries, logout races, and Expo Go fallback passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
