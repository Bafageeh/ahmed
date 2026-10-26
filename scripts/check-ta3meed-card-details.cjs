const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const root = process.env.AHMED_SMS_ROOT;
const casePath = process.env.AHMED_SMS_CASE;
const mobile = path.join(root, 'ahmed-mobile');
const staged = path.join(casePath, 'staged/ahmed-mobile');
const liveRequire = Module.createRequire(path.join(mobile, 'package.json'));
const babel = liveRequire('@babel/core');
const React = liveRequire('react');
const ReactDOMServer = liveRequire('react-dom/server');
const RN = liveRequire('react-native-web');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const noop = () => null;

// Use the installed icon geometry and the actual RN Web layout primitives.
const svg = { __esModule: true };
for (const name of ['Svg', 'Path', 'Circle', 'Rect', 'Line', 'Polyline', 'Polygon', 'Ellipse', 'G', 'Defs', 'ClipPath', 'LinearGradient', 'Stop', 'Text', 'TSpan']) {
  svg[name] = React.forwardRef((props, ref) => React.createElement(name === 'Svg' ? 'svg' : name === 'ClipPath' ? 'clipPath' : name === 'LinearGradient' ? 'linearGradient' : name === 'TSpan' ? 'tspan' : name.toLowerCase(), { ...props, ref }));
}
svg.default = svg.Svg;
const originalLoad = Module._load;
let lucide;
try {
  Module._load = function (name, parent, isMain) {
    if (name === 'react-native-svg') return svg;
    if (name === 'react-native') return RN;
    return originalLoad.call(this, name, parent, isMain);
  };
  lucide = liveRequire('lucide-react-native');
} finally { Module._load = originalLoad; }

let current;
const hooks = { ...React,
  useState(initial) {
    const index = current.cursor++;
    if (!(index in current.slots)) current.slots[index] = initial === 362 ? current.width : initial;
    return [current.slots[index], (value) => { current.slots[index] = typeof value === 'function' ? value(current.slots[index]) : value; }];
  },
  useRef(initial) { const index = current.cursor++; return current.slots[index] || (current.slots[index] = { current: initial }); },
  useEffect() {},
};
function compile(name) {
  return babel.transformSync(fs.readFileSync(path.join(staged, name), 'utf8'), {
    filename: path.join(mobile, name), configFile: path.join(mobile, 'babel.config.js'), babelrc: false,
    caller: { name: 'metro', platform: 'web', supportsStaticESM: false },
    plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
}
function evaluate(code) {
  const module = { exports: {} };
  const requireApp = (name) => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return RN;
    if (name.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: RN[name.split('/').pop()] };
    if (name === 'lucide-react-native') return lucide;
    if (name === 'expo-status-bar') return { StatusBar: noop };
    if (name.startsWith('./')) return { __esModule: true, default: noop };
    return liveRequire(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console, process, setTimeout, clearTimeout,
    fetch() { throw new Error('Displaying company and rates must not write or fetch financial data'); } })(requireApp, module, module.exports);
  return module.exports;
}
const Card = evaluate(compile('Ta3meedOpportunityCard.js')).default;
const calculations = evaluate(compile('Ta3meedCompactFiltersScreen.js') + '\nexports.rates = { registeredAnnualRate, actualAnnualRate };').rates;
const receipts = [{ amount: 500, receipt_date: '2026-04-01' }, { amount: 560, receipt_date: '2026-07-02' }];
const settled = { status: 'received', principal_amount: 1000, expected_profit_amount: 60, expected_rate: 14.25, actual_profit_amount: 60, start_date: '2026-01-01' };
const actual = (item, meta = {}, rows = receipts) => calculations.actualAnnualRate(item, meta, rows, []);
check(calculations.registeredAnnualRate(settled, {}) === 14.25, 'the recorded rate remains the saved value rather than the term-profit ratio');
check(Math.abs(actual(settled) - (60 / 1000 * 365 / 182 * 100)) < 1e-9, 'actual rate uses realized profit and days to the final receipt');
check(actual({ ...settled, status: 'partial_received' }) === null && actual({ ...settled, status: 'active' }) === null, 'unfinished opportunities never expose a final realized rate');
check(actual({ ...settled, actual_profit_amount: 0 }, {}, [{ amount: 1000, receipt_date: '2026-07-02' }]) === 0, 'a completed zero-profit investment has a real zero rate');
const negativeRate = actual({ ...settled, actual_profit_amount: -20 }, {}, [{ amount: 980, receipt_date: '2026-07-02' }]);
check(negativeRate < 0 && Math.abs(negativeRate - (-20 / 1000 * 365 / 182 * 100)) < 1e-9, 'a realized loss stays negative rather than becoming zero or disappearing');
check(actual(settled, {}, []) === null && actual({ ...settled, start_date: 'not-a-date' }) === null, 'missing duration never invents a rate');
check(actual({ ...settled, start_date: '2027-01-01' }) === null, 'an impossible negative duration is unavailable');
check(actual({ ...settled, actual_profit_amount: undefined }) === actual(settled), 'known receipt totals remain a compatible profit source');
check(Math.abs(actual(settled, { withdrawal_date: '2026-01-10' }) - (60 / 1000 * 365 / 173 * 100)) < 1e-9, 'the saved funding date takes precedence over an older start date');

function elements(element, result = []) {
  if (Array.isArray(element)) { element.forEach((child) => elements(child, result)); return result; }
  if (!React.isValidElement(element)) return result;
  if (typeof element.type === 'function' && ['Amount', 'Status', 'CardRate', 'DetailRow'].includes(element.type.name)) return elements(element.type(element.props), result);
  result.push(element); elements(element.props.children, result); return result;
}
function render(props, width = 362) {
  const state = { cursor: 0, slots: [], width };
  const draw = () => { current = state; state.cursor = 0; state.tree = Card(props); state.nodes = elements(state.tree); return state; };
  state.byId = (id) => state.nodes.find((node) => node.props.testID === id)?.props;
  state.draw = draw; return draw();
}
const base = { item: { id: 1, reference_number: 'INV-DEMO217', principal_amount: 19000, expected_profit_amount: 1800, receipts: [], allocations: [] },
  meta: { company_name: 'شركة تجريبية لخدمات الإمداد والتجارة' }, category: 'B-', tone: { color: '#2563eb' },
  status: { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' },
  summary: { actualProfit: null, received: 0, remaining: 20800, progress: 0, annualRate: 14.25, realRate: 99, months: 6, daysLabel: 'متأخر 12 يوم', isOverdue: true, sortedReceipts: [] },
  onEdit: noop, renderReceipt: noop, renderInvestor: noop };
const active = render(base);
check(active.byId('opportunity-company-1').children === base.meta.company_name, 'the company shown on the card comes from its saved metadata');
check(active.byId('opportunity-registered-rate-1').children === '14.25%', 'the recorded percentage is visible with its stored precision');
check(!active.byId('opportunity-actual-rate-1'), 'a stale actual-rate field cannot leak onto an unfinished card');
check(['details', 'receipts', 'investors'].every((kind) => active.byId(`opportunity-${kind}-1`)), 'the existing detail, receipt and investor actions remain available');
const completeProps = { ...base, item: { ...base.item, id: 2 }, status: { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' },
  summary: { ...base.summary, actualProfit: 1600, realRate: 11.25, received: 20600, remaining: 0, progress: 100, isOverdue: false } };
const complete = render(completeProps);
check(complete.byId('opportunity-registered-rate-2').children === '14.25%' && complete.byId('opportunity-actual-rate-2').children === '11.25%', 'completed cards show recorded and real rates together');
check(complete.byId('opportunity-company-2').numberOfLines === 2, 'long company names are bounded while full text remains available in details');
const zero = render({ ...completeProps, summary: { ...completeProps.summary, realRate: 0 } });
check(zero.byId('opportunity-actual-rate-2').children === '0.00%', 'a known zero rate renders as a percentage');
const loss = render({ ...completeProps, summary: { ...completeProps.summary, realRate: negativeRate } });
check(loss.byId('opportunity-actual-rate-2').children.startsWith('-4.01'), 'negative realized percentages are retained in the visible label');
const unknown = render({ ...completeProps, summary: { ...completeProps.summary, realRate: null } });
check(unknown.byId('opportunity-actual-rate-2').children === '—', 'unavailable duration is distinct from a zero return');
const fallback = render({ ...base, meta: { company_name: '   ' }, item: { ...base.item, company_name: 'شركة تجريبية' } });
check(fallback.byId('opportunity-company-1').children === 'شركة تجريبية', 'an empty metadata name falls back to the saved company field');
const small = render(completeProps, 296);
check(small.byId('opportunity-actual-rate-2') && small.byId('opportunity-company-2'), 'small-card presentation retains both rates and the company');

const previewProps = [base, completeProps, { ...completeProps, item: { ...base.item, id: 3, reference_number: 'INV-DEMO300' }, meta: { company_name: 'شركة تجريبية' }, summary: { ...completeProps.summary, actualProfit: -20, realRate: negativeRate } }];
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
for (const width of [390, 320]) {
  const cards = previewProps.map((props) => render(props, width - 28).tree);
  const Preview = () => React.createElement(RN.View, { style: { backgroundColor: '#f4f7fb', padding: 14, width } },
    React.createElement(RN.Text, { style: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 12, color: '#172033' } }, 'تعميد'), ...cards);
  const key = 'CardDetails' + width;
  RN.AppRegistry.registerComponent(key, () => Preview);
  const application = RN.AppRegistry.getApplication(key, { initialProps: {} });
  const markup = ReactDOMServer.renderToStaticMarkup(application.element);
  const css = ReactDOMServer.renderToStaticMarkup(application.getStyleElement());
  const html = '<!doctype html><html lang="ar" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ta3meed card layout review</title>' + css + '<style>html,body{margin:0;background:#e8edf4}main{width:' + width + 'px;margin:16px auto;border-radius:22px;overflow:hidden}#label{font:12px Arial;color:#64748b;text-align:center;padding:10px}</style></head><body><div id="label">بيانات تجريبية لمراجعة التنسيق · ' + escape(width) + 'px</div><main>' + markup + '</main></body></html>';
  fs.writeFileSync(path.join(casePath, `card-details-${width}.html`), html, { mode: 0o600 });
}
fs.writeFileSync(path.join(casePath, 'card-details-qa.json'), JSON.stringify({ passed: true, checks, source_commit: process.env.AHMED_SMS_SHA }), { mode: 0o600 });
console.log(`TA3MEED_CARD_COMPANY_AND_RATES_PASSED checks=${checks}`);
