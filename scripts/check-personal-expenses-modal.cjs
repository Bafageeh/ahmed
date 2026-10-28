const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const mobile = path.join(process.env.AHMED_SMS_ROOT, 'ahmed-mobile');
const stage = path.join(process.env.AHMED_SMS_CASE, 'staged/ahmed-mobile');
const liveRequire = createRequire(path.join(mobile, 'package.json'));
const babel = liveRequire('@babel/core');
const React = liveRequire('react');
const RN = liveRequire('react-native-web');
const server = liveRequire('react-dom/server');
let cursor = 0;
let width = 390;
const slots = [];
const hooks = {
  ...React,
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  },
  useRef(initial) { const index = cursor++; return slots[index] || (slots[index] = { current: initial }); },
  useEffect() {},
  useMemo(fn) { return fn(); },
};
const native = { ...RN, Platform: { OS: 'android' }, StatusBar: { currentHeight: 32 }, Keyboard: { dismiss() {} }, useWindowDimensions: () => ({ width, height: 844 }) };
const fixture = [
  { id: 1, definition: 'إيجار تجريبي', amount: 1200, expense_date: '2026-10-01', frequency: 'monthly', notes: '' },
  { id: 2, definition: 'اشتراك تجريبي', amount: 2400, expense_date: '2026-09-10', frequency: 'annual', notes: 'ملاحظة محفوظة' },
];
let records = fixture.map((item) => ({ ...item }));
const requests = [];
let failMutation = false;
async function mockFetch(url, options = {}) {
  requests.push({ url, ...options });
  if ((options.method || 'GET') === 'GET') return { ok: true, json: async () => ({ data: records }) };
  if (failMutation) return { ok: false, json: async () => ({ message: 'تعذر الحفظ للاختبار' }) };
  if (options.method === 'DELETE') {
    records = records.filter((record) => !url.endsWith('/' + record.id));
    return { ok: true, json: async () => ({ data: { deleted: true } }) };
  }
  const payload = JSON.parse(options.body);
  const id = options.method === 'PUT' ? Number(url.split('/').pop()) : 3;
  records = [{ id, ...payload }, ...records.filter((record) => record.id !== id)];
  return { ok: true, json: async () => ({ data: { id, ...payload } }) };
}
function compile(name, suffix = '') {
  const file = fs.existsSync(path.join(stage, name)) ? path.join(stage, name) : path.join(mobile, name);
  const result = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: path.join(mobile, name), configFile: path.join(mobile, 'babel.config.js'), babelrc: false,
    caller: { name: 'metro', platform: 'web', supportsStaticESM: false },
    plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  const resolve = (key) => {
    if (key === 'react') return hooks;
    if (key === 'react-native') return native;
    if (key.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: native[key.split('/').pop()] };
    if (key === './UiIcon') return { __esModule: true, default: () => null };
    if (key === './ta3meedAllocationForm') return money;
    if (key === './ahmedCurrentUser') return { ahmedUserHeaders: (extra) => ({ ...extra, Authorization: 'Bearer fixture-session', 'X-Ahmed-User-Id': '7' }) };
    return liveRequire(key);
  };
  vm.runInNewContext('(function(require,module,exports){' + result.code + '\n' + suffix + '\n})', { console, process, Date, Intl, fetch: mockFetch })(resolve, module, module.exports);
  return module.exports;
}
let money;
money = compile('ta3meedAllocationForm.js');
const expenseModule = compile('PersonalExpensesScreen.js', 'exports.__helpers={monthlyEquivalent,annualEquivalent,normalizeExpenseDate};');
const Screen = expenseModule.default;
const helpers = expenseModule.__helpers;
function render() { cursor = 0; return Screen({ onBack() {} }); }
function elements(element, found = []) {
  if (Array.isArray(element)) { element.forEach((child) => elements(child, found)); return found; }
  if (!React.isValidElement(element)) return found;
  if (typeof element.type === 'function' && ['Money', 'IconAction', 'FilterChip', 'ExpenseCard', 'ExpenseEditor', 'DeleteDialog'].includes(element.type.name)) return elements(element.type(element.props), found);
  found.push(element);
  elements(element.props.children, found);
  return found;
}
function find(label) {
  const candidates = elements(render()).filter((element) => element.props.accessibilityLabel === label);
  assert.equal(candidates.length, 1, label);
  return candidates[0].props;
}
function editor() { return elements(render()).find((element) => element.type === RN.Modal && element.props.children?.props?.children)?.props; }
function editorVisible() { return elements(render()).filter((element) => element.type === RN.Modal)[0].props.visible; }
const mutations = () => requests.filter((request) => request.method && request.method !== 'GET');

(async () => {
  await find('تحديث المصروفات').onPress();
  assert.equal(editorVisible(), false);
  assert.equal(helpers.monthlyEquivalent(fixture[1]), 200);
  assert.equal(helpers.annualEquivalent(fixture[0]), 14400);
  assert.equal(helpers.normalizeExpenseDate('٢٠٢٦-١٠-٢٨'), '2026-10-28');
  assert.equal(helpers.normalizeExpenseDate('2026-02-30'), null);
  for (width of [390, 320]) {
    const markup = server.renderToStaticMarkup(render());
    assert.ok(markup.includes('1,400.00') && markup.includes('16,800.00'), 'mixed monthly and annual totals stay unchanged');
    assert.ok(!markup.includes('تعريف المصروف'), 'the form is absent from the main page');
  }
  find('المصروفات السنوية').onPress();
  assert.equal(elements(render()).filter((element) => element.props.accessibilityLabel === 'تعديل مصروف إيجار تجريبي').length, 0);
  assert.ok(server.renderToStaticMarkup(render()).includes('1,400.00'), 'filtering does not change the overall totals');
  find('كل المصروفات').onPress();
  find('البحث في المصروفات').onChangeText('ايجار');
  assert.equal(elements(render()).filter((element) => element.props.accessibilityLabel === 'تعديل مصروف اشتراك تجريبي').length, 0);
  assert.equal(elements(render()).filter((element) => element.props.accessibilityLabel === 'تعديل مصروف إيجار تجريبي').length, 1);
  find('مسح البحث').onPress();

  find('إضافة مصروف').onPress();
  assert.equal(editorVisible(), true);
  assert.equal(find('تعريف المصروف').value, '');
  const beforeInvalid = mutations().length;
  await find('حفظ المصروف').onPress();
  assert.equal(mutations().length, beforeInvalid);
  assert.equal(editorVisible(), true);
  find('تعريف المصروف').onChangeText('مصروف جديد');
  find('مبلغ المصروف').onChangeText('١٬٢٣٤٫٥٠');
  find('تاريخ المصروف').onChangeText('2026-10-28');
  find('مصروف سنوي').onPress();
  find('ملاحظات المصروف').onChangeText('ملاحظة جديدة');
  const save = find('حفظ المصروف').onPress;
  const request = save();
  await save();
  await request;
  assert.equal(mutations().length, beforeInvalid + 1, 'two rapid presses must create only once');
  const created = mutations().at(-1);
  assert.equal(created.method, 'POST');
  const payload = JSON.parse(created.body);
  assert.deepEqual(payload, { definition: 'مصروف جديد', amount: 1234.5, expense_date: '2026-10-28', frequency: 'annual', notes: 'ملاحظة جديدة' });
  assert.equal(created.headers['X-Ahmed-User-Id'], '7');
  assert.equal(editorVisible(), false);

  find('تعديل مصروف اشتراك تجريبي').onPress();
  assert.equal(editorVisible(), true);
  assert.equal(find('مبلغ المصروف').value, '2400');
  assert.equal(find('ملاحظات المصروف').value, 'ملاحظة محفوظة');
  find('مبلغ المصروف').onChangeText('2500.00');
  await find('حفظ تعديل المصروف').onPress();
  const edited = mutations().at(-1);
  assert.equal(edited.method, 'PUT');
  assert.ok(edited.url.endsWith('/personal-expenses/2'));
  assert.equal(JSON.parse(edited.body).frequency, 'annual');
  assert.equal(JSON.parse(edited.body).notes, 'ملاحظة محفوظة');

  find('إضافة مصروف').onPress();
  assert.equal(find('تعريف المصروف').value, '', 'new entries do not reuse edited data');
  find('تعريف المصروف').onChangeText('خطأ تجريبي');
  find('مبلغ المصروف').onChangeText('10.00');
  failMutation = true;
  await find('حفظ المصروف').onPress();
  assert.equal(editorVisible(), true, 'failed writes leave the editor open');
  assert.equal(find('تعريف المصروف').value, 'خطأ تجريبي');
  failMutation = false;
  find('إلغاء نموذج المصروف').onPress();
  const beforeDelete = mutations().length;
  find('حذف مصروف إيجار تجريبي').onPress();
  assert.equal(mutations().length, beforeDelete, 'opening deletion must not write');
  find('إلغاء حذف المصروف').onPress();
  assert.equal(mutations().length, beforeDelete);
  find('حذف مصروف إيجار تجريبي').onPress();
  await find('تأكيد حذف المصروف').onPress();
  assert.equal(mutations().at(-1).method, 'DELETE');
  assert.ok(mutations().at(-1).url.endsWith('/personal-expenses/1'));
  console.log('PERSONAL_EXPENSES_MODAL_SAVE_EDIT_VALIDATION_TOTALS_AND_ACCOUNT_HEADERS_VERIFIED');
})().catch((error) => { console.error(error); process.exitCode = 1; });
