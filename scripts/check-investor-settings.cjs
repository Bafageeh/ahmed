const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const mobile = path.join(process.env.AHMED_SMS_ROOT, 'ahmed-mobile');
const staged = path.join(process.env.AHMED_SMS_CASE, 'staged/ahmed-mobile');
const liveRequire = createRequire(path.join(mobile, 'package.json'));
const React = liveRequire('react');
const native = liveRequire('react-native-web');
const babel = liveRequire('@babel/core');
let managerOpen = false;
const hooks = { ...React, useState: () => [managerOpen, (value) => { managerOpen = value; }] };
function Manager() { return null; }
function Empty() { return null; }
let Settings;
function evaluate(name, suffix = '') {
  const code = babel.transformSync(fs.readFileSync(path.join(staged, name), 'utf8'), {
    filename: path.join(mobile, name), configFile: path.join(mobile, 'babel.config.js'), babelrc: false,
    caller: { name: 'metro', platform: 'web', supportsStaticESM: false },
    plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const module = { exports: {} };
  const resolve = (key) => {
    if (key === 'react') return hooks;
    if (key === 'react-native') return native;
    if (key.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: native[key.split('/').pop()] };
    if (key === './Ta3meedInvestorControls') return { InvestorManagerModal: Manager };
    if (key === './SettingsScreen') return { __esModule: true, default: Settings };
    if (key.startsWith('./') || key.startsWith('expo-')) return { __esModule: true, default: Empty };
    return liveRequire(key);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n${suffix}\n})`, { process, console })(resolve, module, module.exports);
  return module.exports;
}
Settings = evaluate('SettingsScreen.js').default;
function elements(element, found = []) {
  if (Array.isArray(element)) { element.forEach((child) => elements(child, found)); return found; }
  if (!React.isValidElement(element)) return found;
  if (['Group', 'SettingsRow'].includes(element.type.name)) return elements(element.type(element.props), found);
  found.push(element);
  elements(element.props.children, found);
  return found;
}
for (const isAdmin of [false, true]) {
  managerOpen = false;
  const routes = [];
  const props = { isAdmin, currentUser: { name: 'تجريبي' }, goTo: (key) => routes.push(key), onLogout() {}, onOpenInvestorAccounts: () => routes.push('ta3meedAccounts') };
  let tree = elements(Settings(props));
  const buttons = tree.filter((node) => node.props.accessibilityRole === 'button');
  const find = (label) => buttons.filter((node) => node.props.accessibilityLabel === label);
  assert.equal(find('حسابات المستثمرين').length, 1);
  assert.equal(find('إدارة المستثمرين').length, 1);
  assert.equal(find('إدارة المستخدمين').length, isAdmin ? 1 : 0);
  find('حسابات المستثمرين')[0].props.onPress();
  assert.deepEqual(routes, ['ta3meedAccounts']);
  find('إدارة المستثمرين')[0].props.onPress();
  tree = elements(Settings(props));
  const modal = tree.find((node) => node.type === Manager);
  assert.equal(modal.props.visible, true);
  modal.props.onClose();
  assert.equal(elements(Settings(props)).find((node) => node.type === Manager).props.visible, false);
}
const More = evaluate('AppShell.js', 'exports.__more = MoreScreen;').__more;
const routes = [];
More({ openInvestment: (key) => routes.push(key) }).props.onOpenInvestorAccounts();
assert.deepEqual(routes, ['ta3meedAccounts']);
const quickMenu = fs.readFileSync(path.join(staged, 'Ta3meedCompactFiltersScreen.js'), 'utf8');
assert.ok(!quickMenu.includes('حسابات المستثمرين') && !quickMenu.includes('إدارة المستثمرين'));
console.log('INVESTOR_SETTINGS_ROUTES_AND_MODAL_VERIFIED for admin and regular accounts');
