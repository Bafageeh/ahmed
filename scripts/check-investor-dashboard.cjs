const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const zlib = require('node:zlib');
const root = process.env.AHMED_SMS_ROOT;
const casePath = process.env.AHMED_SMS_CASE;
const mobile = path.join(root, 'ahmed-mobile');
const staged = path.join(casePath, 'staged/ahmed-mobile');
const liveRequire = Module.createRequire(path.join(mobile, 'package.json'));
const babel = liveRequire('@babel/core');
const React = liveRequire('react');
const ReactDOMServer = liveRequire('react-dom/server');
const RN = liveRequire('react-native-web');
let width = 390;
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks += 1; };
const native = { ...RN, useWindowDimensions: () => ({ width, height: 844, scale: 1, fontScale: 1 }) };
const svg = { __esModule: true };
for (const name of ['Svg', 'Path', 'Circle', 'Rect', 'Line', 'Polyline', 'Polygon', 'Ellipse', 'G', 'Defs', 'ClipPath', 'LinearGradient', 'Stop', 'Text', 'TSpan']) {
  const tag = { Svg: 'svg', ClipPath: 'clipPath', LinearGradient: 'linearGradient', TSpan: 'tspan' }[name] || name.toLowerCase();
  svg[name] = React.forwardRef((props, ref) => React.createElement(tag, { ...props, ref }));
}
svg.default = svg.Svg;
const originalLoad = Module._load;
let icons;
try {
  Module._load = function (name, parent, isMain) {
    if (name === 'react-native-svg') return svg;
    if (name === 'react-native') return native;
    return originalLoad.call(this, name, parent, isMain);
  };
  icons = liveRequire('lucide-react-native');
} finally { Module._load = originalLoad; }

function compile(name) {
  const file = fs.existsSync(path.join(staged, name)) ? path.join(staged, name) : path.join(mobile, name);
  return babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: path.join(mobile, name), configFile: path.join(mobile, 'babel.config.js'), babelrc: false,
    caller: { name: 'metro', platform: 'web', supportsStaticESM: false },
    plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
}
function evaluate(code, resolveExtra = () => undefined) {
  const module = { exports: {} };
  const requireApp = (name) => {
    const extra = resolveExtra(name);
    if (extra !== undefined) return extra;
    if (name === 'react-native') return native;
    if (name.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: native[name.split('/').pop()] };
    if (name === 'lucide-react-native') return icons;
    if (name === './ta3meedUtils') return { n: (value) => Number(value || 0) };
    return liveRequire(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console, process, setTimeout, clearTimeout,
    fetch() { throw new Error('Dashboard rendering must not make financial requests'); },
  })(requireApp, module, module.exports);
  return module.exports;
}
// Compile both edited modules through the existing production Babel adapters.
compile('ta3meed/Ta3meedTenantInvestorAccounts.js');
const Dashboard = evaluate(compile('ta3meed/Ta3meedInvestorDashboard.js')).InvestorAccountDashboard;
const account = { balance: 209000.5, ta3meed: 258400.75, endedProfit: 48000, activeInvested: 278500.75, activeReceived: 20100, expectedProfit: 37200.25, opportunitiesCount: 12 };
const props = { investor: { name: 'مريم', code: 'preview' }, account, message: '', setScreen: () => {} };
const render = (values = props) => ReactDOMServer.renderToStaticMarkup(React.createElement(Dashboard, values));
const markup = render();
for (const amount of ['258,400.75', '-1,400.25', '209,000.50', '257,000.50', '278,500.75', '20,100.00', '37,200.25', '48,000.00']) check(markup.includes(amount), 'all original financial values and cash formula are retained: ' + amount);
check(render({ ...props, account: { ...account, balance: 300000 } }).includes('89,599.25'), 'positive cash preserves the original formula');
check(render({ ...props, account: { ...account, balance: 210400.75 } }).includes('>0.00<'), 'zero cash is displayed');
check(!render({ ...props, account: null, message: 'جاري تحميل الحساب...' }).includes('258,400.75'), 'loading does not show an old account balance');
check(markup.indexOf('investor-manage-balance') < markup.indexOf('مستثمر تعميد'), 'balance management is above the financial cards');
check(markup.indexOf('investor-financial-movements') < markup.indexOf('مستثمر تعميد'), 'financial movements are above the financial cards');
check(markup.includes('aria-label="إدارة حركات الرصيد"') && markup.includes('aria-label="الحركات المالية"'), 'both icon-only buttons retain accessible names');

function controls(element, found = []) {
  if (Array.isArray(element)) { element.forEach((child) => controls(child, found)); return found; }
  if (!React.isValidElement(element)) return found;
  if (typeof element.type === 'function' && ['InvestorAccountDashboard', 'ActionIcon', 'Metric', 'Amount'].includes(element.type.name)) return controls(element.type(element.props), found);
  if (element.props.testID?.startsWith('investor-') && element.props.onPress) found.push(element.props);
  controls(element.props.children, found);
  return found;
}
const actions = [];
for (const button of controls(React.createElement(Dashboard, { ...props, setScreen: (screen) => actions.push(screen) }))) button.onPress();
check(JSON.stringify(actions) === JSON.stringify(['manage', 'movements']), 'both top icons open the existing account screens');
const source = fs.readFileSync(path.join(staged, 'ta3meed/Ta3meedTenantInvestorAccounts.js'), 'utf8');
check(source.includes("if (selected && screen !== 'home') return setScreen('home');") && source.includes('if (selected) return setSelected(null);'), 'the fixed top back arrow retains nested navigation');
check(source.includes('row._accountCode || investor.code') && source.includes('ahmedUserHeaders'), 'grouped account edit routing and user isolation remain intact');

const Screen = evaluate(compile('Ta3meedInvestorAccountsScreen.js'), (name) => {
  if (name === './ta3meed/Ta3meedInvestorAccounts') return { Ta3meedInvestorAccounts: () => React.createElement(Dashboard, props) };
  if (name === './ahmedCurrentUser') return { getCurrentAhmedUserId: () => 1, ahmedUserHeaders: () => ({}) };
  if (name === 'expo-status-bar') return { StatusBar: () => null };
  if (name === './UiIcon') return { __esModule: true, default: () => React.createElement(icons.ChevronLeft, { size: 24, color: '#312e81' }), ICON_COLOR_DARK: '#312e81' };
  return undefined;
}).default;
for (const previewWidth of [390, 320]) {
  width = previewWidth;
  const name = 'InvestorDashboard' + width;
  RN.AppRegistry.registerComponent(name, () => () => React.createElement(RN.View, { style: { width, minHeight: 820 } }, React.createElement(Screen, { onBack: () => {} })));
  const application = RN.AppRegistry.getApplication(name, { initialProps: {} });
  const body = ReactDOMServer.renderToStaticMarkup(application.element);
  const css = ReactDOMServer.renderToStaticMarkup(application.getStyleElement());
  const html = '<!doctype html><html lang="ar" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + css + '<style>html,body{margin:0;background:#f4f8fc}#preview{width:' + width + 'px;margin:auto}*{box-sizing:border-box}</style></head><body><div id="preview">' + body + '</div></body></html>';
  fs.writeFileSync(path.join(casePath, 'investor-dashboard-' + width + '.html'), html, { mode: 0o600 });
  const encoded = zlib.gzipSync(html).toString('base64');
  for (let i = 0; i < encoded.length; i += 3500) console.log('INVESTOR_PREVIEW_' + width + '_' + (i / 3500) + '=' + encoded.slice(i, i + 3500));
}
fs.writeFileSync(path.join(casePath, 'investor-dashboard-qa.json'), JSON.stringify({ passed: true, checks, source_commit: process.env.AHMED_SMS_SHA }), { mode: 0o600 });
console.log('INVESTOR_DASHBOARD_SOURCE_BEHAVIOR_AND_PREVIEWS_PASSED checks=' + checks);
