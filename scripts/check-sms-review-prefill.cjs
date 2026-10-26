const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = process.env.AHMED_SMS_ROOT;
const casePath = process.env.AHMED_SMS_CASE;
const mobile = path.join(root, 'ahmed-mobile');
const liveRequire = createRequire(path.join(mobile, 'package.json'));
const babel = liveRequire('@babel/core');
const React = liveRequire('react');
const RN = liveRequire('react-native-web');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
let active;
const hooks = {
  ...React,
  useState(initial) {
    const h = active, index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], (value) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef(value) { const h = active, index = h.cursor++; return h.slots[index] || (h.slots[index] = { current: value }); },
  useEffect(callback, deps) {
    const h = active, index = h.cursor++;
    if (!h.slots[index] || JSON.stringify(h.slots[index]) !== JSON.stringify(deps)) { h.slots[index] = deps; h.effects.push(callback); }
  },
};
const code = babel.transformSync(fs.readFileSync(path.join(casePath, 'staged/ahmed-mobile/SmsReviewForm.js'), 'utf8'), {
  filename: path.join(mobile, 'SmsReviewForm.js'), configFile: path.join(mobile, 'babel.config.js'), babelrc: false,
  caller: { name: 'metro', platform: 'web', supportsStaticESM: false },
  plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')],
}).code;
const moduleObject = { exports: {} };
const api = {
  fetchSmsReview: async () => active.review,
  approveSmsReview: async (id, body) => { active.calls.push({ id, body }); return { analysis: { status: 'applied' } }; },
};
const requireApp = (name) => {
  if (name === 'react') return hooks;
  if (name === 'react-native') return RN;
  if (name.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: RN[name.split('/').pop()] };
  if (name === './smsReviewApi') return api;
  if (name === './ahmedCurrentUser') return { getCurrentAhmedSession: () => ({ sessionKey: 'synthetic-session' }) };
  return liveRequire(name);
};
vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console, process, setTimeout, clearTimeout })(requireApp, moduleObject, moduleObject.exports);
const Form = moduleObject.exports.default;
function elements(element, found = []) {
  if (Array.isArray(element)) { element.forEach((child) => elements(child, found)); return found; }
  if (!React.isValidElement(element)) return found;
  if (typeof element.type === 'function' && ['Choice', 'Check'].includes(element.type.name)) return elements(element.type(element.props), found);
  found.push(element);
  elements(element.props.children, found);
  return found;
}
const complete = { kind: 'repayment', amount: '2724.09', entry_date: '2026-10-26', reference: 'ER-TEST237', receipt_type: 'partial' };
async function mount(suggestion, sources = {}) {
  const h = { slots: [], cursor: 0, effects: [], calls: [], approved: [], review: { suggestion, sources, version: 'v'.repeat(64) } };
  h.render = () => {
    active = h; h.cursor = 0;
    h.tree = Form({ item: { id: 91, body: 'رسالة تجريبية' }, onApproved: (value) => h.approved.push(value), onCancel() {} });
    for (const effect of h.effects.splice(0)) effect();
    h.nodes = elements(h.tree);
    return h;
  };
  h.byLabel = (label) => h.nodes.find((node) => node.props.accessibilityLabel === label)?.props;
  h.byId = (id) => h.nodes.find((node) => node.props.testID === id)?.props;
  h.inputs = () => h.nodes.filter((node) => typeof node.props.onChangeText === 'function');
  h.text = () => h.nodes.filter((node) => typeof node.props.children === 'string').map((node) => node.props.children).join(' ');
  h.render(); await Promise.resolve(); await Promise.resolve(); h.render();
  return h;
}
(async () => {
  const ready = await mount(complete, { entry_date: 'received_at' });
  check(ready.inputs().length === 0, 'complete SMS must show no manual inputs');
  check(ready.byId('sms-review-auto-data'), 'complete SMS shows the actual compact summary');
  check(ready.text().includes('2,724.09') && ready.text().includes('ER-TEST237') && ready.text().includes('جزئي'), 'summary displays the extracted amount, reference and type');
  check(ready.text().includes('من وقت وصول الرسالة'), 'fallback date is explicitly attributed to message arrival');
  check(ready.byId('approve-sms-message').disabled, 'approval still requires a deliberate confirmation');
  const confirmation = ready.nodes.find((node) => node.props.accessibilityRole === 'checkbox').props;
  confirmation.onPress(); ready.render();
  check(!ready.byId('approve-sms-message').disabled, 'a complete extracted decision can be approved without retyping');
  await ready.byId('approve-sms-message').onPress();
  check(ready.calls.length === 1 && ready.calls[0].body.amount === complete.amount && ready.calls[0].body.reference === complete.reference && ready.calls[0].body.receipt_type === complete.receipt_type, 'approval submits unchanged extracted facts');
  check(ready.approved.length === 1, 'success feedback follows the committed API response');
  ready.render(); ready.byLabel('تعديل البيانات المقروءة').onPress(); ready.render();
  check(ready.inputs().length === 3 && ready.byLabel('مبلغ اعتماد الرسالة').value === '2724.09', 'optional correction reveals the prefilled fields');
  ready.byLabel('مبلغ اعتماد الرسالة').onChangeText('2725.10'); ready.render();
  check(ready.byId('approve-sms-message').disabled, 'a correction resets confirmation');

  const missingRef = await mount({ ...complete, reference: '' });
  check(missingRef.inputs().length === 1 && missingRef.byLabel('رقم فرصة تعميد'), 'missing reference is the only requested text input');
  check(!missingRef.byLabel('مبلغ اعتماد الرسالة') && !missingRef.byLabel('تاريخ اعتماد الرسالة'), 'known amount and date are not requested again');
  missingRef.byLabel('رقم فرصة تعميد').onChangeText('ER-TEST237'); missingRef.render();
  check(missingRef.byLabel('رقم فرصة تعميد').value === 'ER-TEST237', 'missing-field input remains stable while typing');
  const missingAmount = await mount({ ...complete, amount: '' });
  check(missingAmount.inputs().length === 1 && missingAmount.byLabel('مبلغ اعتماد الرسالة').value === '', 'only absent amount is requested');
  const missingType = await mount({ ...complete, receipt_type: '' });
  const typeChoices = missingType.nodes.filter((node) => node.props.accessibilityRole === 'radio');
  check(missingType.inputs().length === 0 && typeChoices.length === 3 && typeChoices.every((node) => !node.props.accessibilityState.checked), 'unspecified type offers a choice without guessing');
  check(missingType.byId('approve-sms-message').disabled, 'unknown payment type blocks approval');
  const deposit = await mount({ kind: 'deposit', amount: '1.07', entry_date: '2026-10-26', reference: '', receipt_type: '' });
  check(deposit.inputs().length === 0 && !deposit.byLabel('مرجع العملية'), 'optional wallet reference is not requested');
  const badDate = await mount({ ...complete, entry_date: '' });
  check(badDate.inputs().length === 1 && badDate.byLabel('تاريخ اعتماد الرسالة'), 'an invalid explicit date leaves only date for correction');
  fs.writeFileSync(path.join(casePath, 'prefill-qa.json'), JSON.stringify({ passed: true, checks, source_commit: process.env.AHMED_SMS_SHA }), { mode: 0o600 });
  console.log(`SMS_REVIEW_PREFILL_FORM_BEHAVIOR_PASSED checks=${checks}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
