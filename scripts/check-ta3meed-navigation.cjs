const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const mobile = path.join(process.env.AHMED_SMS_ROOT, 'ahmed-mobile');
const liveRequire = createRequire(path.join(mobile, 'package.json'));
const babel = liveRequire('@babel/core');
const generate = liveRequire('@babel/generator').default;
const t = babel.types;
const mode = process.argv[2];

function compile(sourceFile) {
  const stage = path.join(process.env.AHMED_SMS_CASE, 'staged/ahmed-mobile');
  const config = liveRequire('./babel.config.js')({ cache() {} });
  const resolve = (entry, allowStage) => {
    const name = Array.isArray(entry) ? entry[0] : entry;
    const candidate = path.join(stage, name.endsWith('.js') ? name : name + '.js');
    const resolved = allowStage && name.startsWith('./') && fs.existsSync(candidate) ? candidate : liveRequire.resolve(name);
    return Array.isArray(entry) ? [resolved, ...entry.slice(1)] : resolved;
  };
  const portable = process.env.AHMED_NAVIGATION_PORTABLE_BABEL === '1';
  const result = babel.transformSync(fs.readFileSync(sourceFile, 'utf8'), {
    filename: path.join(mobile, path.basename(sourceFile)),
    configFile: false,
    babelrc: false,
    compact: false,
    parserOpts: { plugins: ['jsx'] },
    presets: portable ? [] : config.presets.map((entry) => resolve(entry, false)),
    plugins: config.plugins.map((entry) => resolve(entry, true)),
    caller: { name: 'metro', platform: 'android', supportsStaticESM: false },
  });
  return portable ? liveRequire('esbuild').transformSync(result.code, {
    loader: 'jsx', format: 'cjs', target: 'es2020', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  }).code : result.code;
}

function loadShell(source) {
  const ast = babel.parseSync(source, { configFile: false, babelrc: false, sourceType: 'unambiguous' });
  const factories = [];
  t.traverseFast(ast, (node) => {
    if (!t.isCallExpression(node) || !t.isIdentifier(node.callee, { name: '__d' }) || !t.isFunction(node.arguments[0])) return;
    let matches = false;
    t.traverseFast(node.arguments[0], (child) => {
      if (t.isStringLiteral(child, { value: 'ahmed-bottom-navigation-four-tabs' })) matches = true;
    });
    if (matches) factories.push(node.arguments[0]);
  });
  assert.ok(factories.length <= 1, 'The served bundle must contain one application shell');
  const dependencyNames = new Map();
  if (factories.length) t.traverseFast(factories[0], (node) => {
    if (!t.isCallExpression(node) || !t.isStringLiteral(node.arguments[1])) return;
    const dependency = node.arguments[0];
    if (t.isMemberExpression(dependency) && t.isNumericLiteral(dependency.property)) dependencyNames.set(dependency.property.value, node.arguments[1].value);
  });

  const state = [];
  let cursor = 0;
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...(props || {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) },
  });
  const react = {
    createElement,
    Fragment: 'Fragment',
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect() {},
    useMemo: (fn) => fn(),
    useRef: (current) => ({ current }),
  };
  const native = { StyleSheet: { create: (styles) => styles, absoluteFillObject: {} }, Linking: {}, Platform: { OS: 'android' } };
  for (const name of ['View', 'Text', 'TouchableOpacity', 'SafeAreaView', 'ScrollView', 'Modal', 'RefreshControl', 'TextInput']) native[name] = name;
  const stubs = new Map();
  const stub = (name) => {
    if (!stubs.has(name)) {
      const component = () => null;
      component.moduleName = name;
      stubs.set(name, { __esModule: true, default: component });
    }
    return stubs.get(name);
  };
  const requireMock = (id, label) => {
    const name = typeof label === 'string' ? label : String(id);
    if (name === 'react') return { __esModule: true, ...react, default: react };
    if (/react\/jsx-(?:dev-)?runtime/.test(name)) return {
      jsx: (type, props) => createElement(type, props), jsxs: (type, props) => createElement(type, props),
      jsxDEV: (type, props) => createElement(type, props), Fragment: 'Fragment',
    };
    if (name === 'react-native') return native;
    if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
    if (name === 'expo/virtual/env') return { env: { EXPO_PUBLIC_API_URL: 'https://example.invalid/api' } };
    if (name === 'expo-local-authentication') return { hasHardwareAsync: async () => false, isEnrolledAsync: async () => false };
    if (name.includes('UiIcon')) return { ...stub(name), ICON_COLOR: '#7c3aed', ICON_COLOR_DARK: '#312e81', ICON_COLOR_SOFT: '#64748b' };
    if (name.includes('ahmedCurrentUser')) return { ahmedUserHeaders: (headers) => headers || {} };
    if (name.includes('dinarInvestmentMath')) return { dinarRemainingInvestment: () => 0 };
    if (name.startsWith('@babel/runtime/')) return liveRequire(name);
    return stub(name);
  };
  const module = { exports: {} };
  const sandbox = {
    module, exports: module.exports, require: requireMock, console,
    __DEV__: true, $RefreshReg$() {}, $RefreshSig$: () => (component) => component,
    process: { env: { EXPO_PUBLIC_API_URL: 'https://ahmed.pm.sa/api' } },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: () => { throw new Error('Navigation checks must never access application data'); },
  };
  const context = vm.createContext(sandbox);
  if (factories.length) {
    const factory = vm.runInContext('(' + generate(factories[0]).code + ')', context, { timeout: 5000 });
    const dependencyMap = new Proxy([], { get: (_, key) => dependencyNames.get(Number(key)) || key });
    const importDefault = (id) => { const result = requireMock(id); return result.default || result; };
    factory(sandbox, requireMock, importDefault, requireMock, module, module.exports, dependencyMap);
  } else vm.runInContext(source, context, { timeout: 5000 });
  const AppShell = module.exports.default;
  assert.equal(typeof AppShell, 'function', 'The actual application shell must load');

  const expand = (node) => {
    if (Array.isArray(node)) return node.map(expand);
    if (node === null || node === undefined || typeof node !== 'object') return node;
    if (typeof node.type === 'function' && !node.type.moduleName) return expand(node.type(node.props || {}));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  return () => { cursor = 0; return expand(AppShell({ currentUser: { id: 1, is_admin: true }, onLogout() {} })); };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function textValues(tree) {
  if (Array.isArray(tree)) return tree.flatMap(textValues);
  if (typeof tree === 'string') return [tree];
  return tree && typeof tree === 'object' ? textValues(tree.props?.children) : [];
}
const tabs = (tree) => nodes(tree).filter((node) => node.props?.accessibilityRole === 'tab');
const findTab = (tree, label) => tabs(tree).find((node) => node.props.accessibilityLabel === label);
const findCard = (tree, label) => nodes(tree).find((node) => node.type === 'TouchableOpacity' && textValues(node).includes(label));
const findScreen = (tree, name) => nodes(tree).find((node) => node.type?.moduleName?.replace(/\.js$/, '').endsWith(name));

async function verify(source, label) {
  const render = loadShell(source);
  let tree = render();
  assert.equal(tabs(tree).length, 4, 'The home screen must retain four bottom tabs');
  await findTab(tree, 'استثماراتي').props.onPress();
  tree = render();
  for (const [title, screenName] of [
    ['تعميد', 'Ta3meedNoResetFilterScreen'], ['موني مون', 'MoneyMoonActiveOnlyScreen'],
    ['دينار', 'DinarInvestmentsScreen'], ['سلفة', 'SulfaInvestmentScreen'], ['ترميز', 'TokenizeInvestmentsScreen'],
  ]) {
    const card = findCard(tree, title);
    assert.ok(card, 'Platform card is missing: ' + title);
    assert.equal(Boolean(card.props.disabled), false, 'Platform is disabled: ' + title);
    assert.equal(typeof card.props.onPress, 'function', 'Platform must be pressable: ' + title);
    await card.props.onPress();
    tree = render();
    const screen = findScreen(tree, screenName);
    assert.ok(screen, 'Pressing the platform must open its actual screen: ' + title);
    assert.equal(tabs(tree).length, title === 'تعميد' ? 4 : 0, 'Incorrect bottom navigation visibility: ' + title);
    if (title === 'تعميد') assert.equal(findTab(tree, 'استثماراتي').props.accessibilityState.selected, true);
    screen.props.onBack();
    tree = render();
    assert.ok(findCard(tree, 'تعميد'), 'Back must return to the platform list');
  }
  await findCard(tree, 'تعميد').props.onPress();
  tree = render();
  await findTab(tree, 'الإعدادات').props.onPress();
  tree = render();
  const settings = findScreen(tree, 'SettingsScreen');
  assert.ok(settings, 'Settings must remain reachable from Ta3meed');
  settings.props.onOpenTa3meedReceipt();
  tree = render();
  const receipt = findScreen(tree, 'Ta3meedNoResetFilterScreen');
  assert.equal(receipt?.props.openReceiptOnMount, true, 'The receipt shortcut must open the receipt flow');
  assert.equal(tabs(tree).length, 0, 'Receipt entry must retain its full-screen behavior');
  receipt.props.onReceiptClose();
  tree = render();
  assert.ok(findScreen(tree, 'SettingsScreen'), 'Closing receipt entry must return to Settings');
  for (const title of ['حساباتي', 'الرئيسية', 'استثماراتي']) {
    await findTab(tree, title).props.onPress();
    tree = render();
    assert.equal(findTab(tree, title).props.accessibilityState.selected, true, 'Bottom tab selection must update: ' + title);
  }
  assert.equal(Boolean(findCard(tree, 'تعميد').props.disabled), false, 'Ta3meed must stay available after tab navigation');
  console.log('TA3MEED_PLATFORM_PRESS_BACK_BOTTOM_TABS_AND_RECEIPT_VERIFIED ' + label);
}

async function main() {
  if (mode === '--bundle') await verify(fs.readFileSync(process.argv[3], 'utf8'), 'actual served Android bundle');
  else if (mode === '--compiled') await verify(fs.readFileSync(process.argv[3], 'utf8'), 'compiled module reproduction');
  else if (mode === '--staged') {
    for (const name of ['Ta3meedCompactFiltersScreen.js', 'Ta3meedNoResetFilterScreen.js']) {
      const candidate = path.join(process.env.AHMED_SMS_CASE, 'staged/ahmed-mobile', name);
      if (fs.existsSync(candidate)) compile(candidate);
    }
    await verify(compile(path.join(process.env.AHMED_SMS_CASE, 'staged/ahmed-mobile/AppShell.js')), 'staged production Babel composition');
  }
  else if (mode === '--source') await verify(compile(path.resolve(process.argv[3])), 'source navigation smoke check');
  else throw new Error('Specify --staged, --bundle, --compiled, or --source');
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
