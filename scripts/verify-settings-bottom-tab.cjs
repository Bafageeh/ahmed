const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const mobile = path.join(process.env.AHMED_SMS_ROOT, 'ahmed-mobile');
const liveRequire = createRequire(path.join(mobile, 'package.json'));
const babel = liveRequire('@babel/core');
const t = babel.types;
const marker = 'ahmed-bottom-navigation-four-tabs';

function verify(source, label) {
  const ast = babel.parseSync(source, { configFile: false, babelrc: false, sourceType: 'unambiguous' });
  const modules = [];
  t.traverseFast(ast, (node) => {
    if (!t.isCallExpression(node) || !t.isIdentifier(node.callee, { name: '__d' }) || !t.isFunction(node.arguments[0])) return;
    let containsMarker = false;
    t.traverseFast(node.arguments[0], (child) => {
      if (t.isStringLiteral(child, { value: marker })) containsMarker = true;
    });
    if (containsMarker) modules.push(node.arguments[0]);
  });
  assert.ok(modules.length <= 1, 'The app shell must be unique');
  const root = modules[0] || ast;
  const arrays = [];
  const reports = [];
  t.traverseFast(root, (node) => {
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name: 'tabs' }) && t.isArrayExpression(node.init)) arrays.push(node.init);
    if (t.isFunctionDeclaration(node) && t.isIdentifier(node.id, { name: 'ReportsScreen' })) reports.push(node);
  });
  assert.equal(arrays.length, 1, 'The final bottom navigation must be present');
  const tabs = arrays[0].elements.map((node) => Object.fromEntries(node.properties.filter((property) => t.isObjectProperty(property)).map((property) => [property.key.name || property.key.value, property.value.value])));
  assert.deepEqual(tabs.map((tab) => tab.key), ['accounts', 'reports', 'investments', 'more']);
  assert.equal(tabs[3].label, 'الإعدادات');
  assert.equal(tabs[3].icon, 'settings');
  assert.equal(tabs[1].label, 'الرئيسية');
  assert.equal(tabs[1].icon, 'home');
  assert.ok(tabs.every((tab) => !tab.center), 'Four navigation items must use the same layout');
  assert.equal(reports.length, 1);
  const titles = [];
  let settingsLinks = 0;
  let vaultLinks = 0;
  t.traverseFast(reports[0], (node) => {
    if (t.isObjectProperty(node) && (t.isIdentifier(node.key, { name: 'title' }) || t.isStringLiteral(node.key, { value: 'title' })) && t.isStringLiteral(node.value)) titles.push(node.value.value);
    if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'goTo' }) && t.isStringLiteral(node.arguments[0])) {
      if (node.arguments[0].value === 'more') settingsLinks += 1;
      if (node.arguments[0].value === 'secureVault') vaultLinks += 1;
    }
  });
  assert.ok(!titles.some((title) => ['إعدادات', 'الإعدادات', 'مزيد'].includes(title)), 'Reports must not keep a settings card');
  assert.equal(titles.filter((title) => title === 'الخزنة الآمنة').length, 1, 'The secure vault card remains reachable');
  assert.equal(settingsLinks, 0);
  assert.ok(vaultLinks > 0);
  console.log('SETTINGS_BOTTOM_TAB_AND_REPORTS_VERIFIED ' + label);
}

if (process.argv[2] === '--staged') {
  const stage = path.join(process.env.AHMED_SMS_CASE, 'staged/ahmed-mobile');
  const config = liveRequire('./babel.config.js')({ cache() {} });
  const resolve = (entry, allowStage) => {
    const name = Array.isArray(entry) ? entry[0] : entry;
    let resolved;
    if (allowStage && name.startsWith('./')) {
      const candidate = path.join(stage, name.endsWith('.js') ? name : name + '.js');
      resolved = fs.existsSync(candidate) ? candidate : liveRequire.resolve(name);
    } else resolved = liveRequire.resolve(name);
    return Array.isArray(entry) ? [resolved, ...entry.slice(1)] : resolved;
  };
  const options = { configFile: false, babelrc: false, presets: config.presets.map((entry) => resolve(entry, false)), plugins: config.plugins.map((entry) => resolve(entry, true)), caller: { name: 'metro', platform: 'android', supportsStaticESM: false } };
  for (const name of ['AppShell.js', 'UiIcon.js']) {
    const result = babel.transformSync(fs.readFileSync(path.join(stage, name), 'utf8'), { ...options, filename: path.join(mobile, name) });
    if (name === 'AppShell.js') verify(result.code, 'staged full Babel composition');
  }
} else if (process.argv[2] === '--bundle') {
  verify(fs.readFileSync(process.argv[3], 'utf8'), 'actual served Android bundle');
} else throw new Error('Specify the staged source or served bundle');

