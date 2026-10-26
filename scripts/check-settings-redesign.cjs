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
function check(condition, message) { assert.ok(condition, message); checks += 1; }

function compile(name, commonjs = false) {
  return babel.transformSync(fs.readFileSync(path.join(staged, name), 'utf8'), {
    filename: path.join(mobile, name), configFile: path.join(staged, 'babel.config.js'), babelrc: false,
    caller: { name: 'metro', platform: 'web', supportsStaticESM: !commonjs },
    ...(commonjs ? { plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')] } : {}),
  }).code;
}

// Exercise the real composition of all existing adapters, including generated debt labels.
for (const name of ['AppShell.js', 'SettingsScreen.js', 'DinarInvestmentsScreen.js', 'SulfaInvestmentScreen.js', 'TokenizeInvestmentsScreen.js', 'Ta3meedImageImportScreen.js', 'DebtsLoansScreen.js']) {
  const code = compile(name);
  check(!/#S-\d{2,4}\b/.test(code), `${name}: visible screen identifiers must be absent`);
  if (name === 'AppShell.js') {
    check(code.includes('bankStatementSchedules') && code.includes('syncBankStatementReminders'), 'card schedule route and reminders remain integrated');
    check(code.includes('SettingsScreen') && code.includes('usersManager') && code.includes('smsArchive'), 'settings, users and SMS routes remain integrated');
  }
}
const cleanup = require(path.join(staged, 'babel-plugin-hide-screen-codes.js'));
const fixture = babel.transformSync("const metadata = {screenId: '#S-777'}; const Example = () => <View><Text style={styles.screenId}>#S-141</Text><Text>#S-144 استثمار ترميز</Text><TopBar title=\"#S-151 إدارة المستخدمين\" /><Text>INV-XYZ123 · 100,000.50</Text></View>;", {
  filename: 'screen-label-fixture.jsx', configFile: false, babelrc: false, plugins: [cleanup], parserOpts: { plugins: ['jsx'] },
}).code;
check(!fixture.includes('#S-141') && !fixture.includes('styles.screenId'), 'standalone screen badges are removed without an empty badge');
check(!fixture.includes('#S-144') && !fixture.includes('#S-151'), 'text and title labels lose their screen prefix');
check(fixture.includes('#S-777') && fixture.includes('INV-XYZ123') && fixture.includes('100,000.50'), 'routing metadata, investment references and money remain unchanged');

// Render actual lucide geometry through DOM SVG primitives in the isolated preview.
const svgNames = ['Svg', 'Path', 'Circle', 'Rect', 'Line', 'Polyline', 'Polygon', 'Ellipse', 'G', 'Defs', 'ClipPath', 'LinearGradient', 'Stop', 'Text', 'TSpan'];
const svg = { __esModule: true };
for (const name of svgNames) svg[name] = React.forwardRef((props, ref) => React.createElement(name === 'Svg' ? 'svg' : name === 'ClipPath' ? 'clipPath' : name === 'LinearGradient' ? 'linearGradient' : name === 'TSpan' ? 'tspan' : name.toLowerCase(), { ...props, ref }));
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
check(Boolean(lucide.LogOut), 'logout icon exists in the installed icon package');

const iconModule = { exports: {} };
function evaluate(code, module, extraRequire) {
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console, process, setTimeout, clearTimeout })(extraRequire, module, module.exports);
  return module.exports;
}
const icon = evaluate(compile('UiIcon.js', true), iconModule, (name) => name === 'react-native' ? RN : name === 'lucide-react-native' ? lucide : liveRequire(name));
const emptyComponent = () => null;
const appRequire = (name) => {
  if (name === 'react-native') return RN;
  if (name.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: RN[name.split('/').pop()] };
  if (name === './UiIcon') return icon;
  if (name === 'expo-status-bar') return { StatusBar: emptyComponent };
  if (name === 'expo-local-authentication') return {};
  if (name.startsWith('./')) return { __esModule: true, default: emptyComponent };
  return liveRequire(name);
};
const settingsModule = { exports: {} };
const Settings = evaluate(compile('SettingsScreen.js', true), settingsModule, appRequire).default;
const shellModule = { exports: {} };
const BottomTabs = evaluate(compile('AppShell.js', true) + '\nexports.__previewTabs = BottomTabs;', shellModule, appRequire).__previewTabs;

function controls(element, found = []) {
  if (Array.isArray(element)) { element.forEach((child) => controls(child, found)); return found; }
  if (!React.isValidElement(element)) return found;
  if (typeof element.type === 'function' && (element.type === Settings || ['Group', 'SettingsRow'].includes(element.type.name))) return controls(element.type(element.props), found);
  if (typeof element.props.onPress === 'function' && element.props.accessibilityLabel) found.push(element.props);
  controls(element.props.children, found);
  return found;
}
for (const isAdmin of [true, false]) {
  const actions = [];
  const props = { currentUser: { name: 'حساب تجريبي', username: 'demo' }, isAdmin, goTo: (key) => actions.push(key), onLogout: () => actions.push('logout') };
  const buttons = controls(React.createElement(Settings, props));
  const labels = buttons.map((button) => button.accessibilityLabel);
  check(labels.includes('إدارة المستخدمين') === isAdmin, 'user administration remains manager-only');
  check(labels.includes('مواعيد كشف البطاقات') === isAdmin, 'card schedule management remains manager-only');
  for (const button of buttons) button.onPress();
  const expected = isAdmin ? ['reports', 'bankStatementSchedules', 'usersManager', 'smsArchive', 'financeImports', 'logout'] : ['reports', 'smsArchive', 'financeImports', 'logout'];
  check(JSON.stringify(actions) === JSON.stringify(expected), 'all visible actions navigate to the existing destination or log out');

  const Preview = () => React.createElement(RN.View, { style: { width: 390, height: 816, backgroundColor: '#f6f7fb' } },
    React.createElement(RN.View, { style: { flex: 1, paddingBottom: 98 } }, React.createElement(Settings, props)),
    React.createElement(BottomTabs, { activeTab: 'more', setActiveTab: () => {} }));
  const key = isAdmin ? 'SettingsAdminPreview' : 'SettingsUserPreview';
  RN.AppRegistry.registerComponent(key, () => Preview);
  const application = RN.AppRegistry.getApplication(key, { initialProps: {} });
  const markup = ReactDOMServer.renderToStaticMarkup(application.element);
  const css = ReactDOMServer.renderToStaticMarkup(application.getStyleElement());
  check(!/#S-\d+/.test(markup), 'rendered preview contains no screen codes');
  check(markup.includes('ahmed-settings-redesign'), 'preview renders the real settings screen');
  const html = '<!doctype html><html lang="ar" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Settings preview</title>' + css + '<style>html,body{margin:0;background:#e9eaf0}#phone{width:390px;height:844px;margin:20px auto;background:#f6f7fb;overflow:hidden;box-shadow:0 12px 50px #30334a19;border-radius:24px}#bar{height:28px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;font:12px Arial;color:#545969;background:#f6f7fb}#preview{height:816px}#preview>div{height:816px}</style></head><body><main id="phone"><div id="bar"><span>9:41</span><span>5G ◂ ▰</span></div><div id="preview">' + markup + '</div></main></body></html>';
  const file = `settings-${isAdmin ? 'admin' : 'user'}-preview.html`;
  fs.writeFileSync(path.join(casePath, file), html, { mode: 0o600 });
}
const manifest = JSON.parse(fs.readFileSync(path.join(casePath, 'settings-release.json'), 'utf8'));
fs.writeFileSync(path.join(casePath, 'settings-qa.json'), JSON.stringify({ passed: true, checks, files: manifest.files, source_commit: process.env.AHMED_SMS_SHA }), { mode: 0o600 });
console.log(`SETTINGS_REDESIGN_BEHAVIOR_AND_SCREEN_LABELS_PASSED checks=${checks}`);
