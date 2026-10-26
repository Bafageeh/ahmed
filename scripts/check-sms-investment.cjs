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
const calls = [];
const rawCalls = [];
const noop = () => null;
const Native = { ...RN, AppState: { currentState: 'background', addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} } };
const api = {
  fetchSmsInvestment: async (id, key) => { calls.push({ action: 'open', id, key }); return active.review; },
  completeSmsInvestment: async (id, body, key) => { calls.push({ action: 'complete', id, body, key }); return { data: { id: 77 }, analysis: { message_id: id, action_type: 'investment', status: 'investment_created' } }; },
  dismissSmsInvestment: async (id, version, key) => {
    calls.push({ action: 'dismiss', id, version, key });
    active.archive = { data: [], total: 0, has_more: false, dismissed_ids: [id] };
    return { dismissed: true, message_id: id };
  },
};
const modules = {};
function load(name) {
  if (modules[name]) return modules[name];
  const staged = path.join(casePath, 'staged/ahmed-mobile', name);
  const code = babel.transformSync(fs.readFileSync(fs.existsSync(staged) ? staged : path.join(mobile, name), 'utf8'), {
    filename: path.join(mobile, name), configFile: path.join(mobile, 'babel.config.js'), babelrc: false,
    caller: { name: 'metro', platform: 'web', supportsStaticESM: false },
    plugins: [liveRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const module = { exports: {} };
  const requireApp = (id) => {
    if (id === 'react') return hooks;
    if (id === 'react-native') return Native;
    if (id.startsWith('react-native-web/dist/exports/')) return { __esModule: true, default: Native[id.split('/').pop()] };
    if (id === './ta3meedAllocationForm') return load('ta3meedAllocationForm.js');
    if (id === './Ta3meedNoResetFilterScreen') return load('Ta3meedNoResetFilterScreen.js');
    if (id === './Ta3meedInvestorControls') return { InvestorAllocationEditor: noop, InvestorManagerModal: noop, InvestorOwnerChangeModal: noop };
    if (id === './smsReviewApi') return api;
    if (id === './ahmedCurrentUser') return { getCurrentAhmedSession: () => ({ sessionKey: 'synthetic-session' }) };
    if (id === './smsCapture') return { fetchSmsArchive: async () => active.archive, getSmsCaptureStatus: async () => ({ supported: false }), syncSmsCapture: async () => {}, enableSmsCapture: async () => {}, disableSmsCapture: async () => {} };
    if (id === 'expo-clipboard') return { setStringAsync: async () => {} };
    if (id.startsWith('./')) return { __esModule: true, default: noop };
    return liveRequire(id);
  };
  const globals = { console, process, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {}, fetch: async (url, options) => {
    rawCalls.push({ url, options }); const result = options?.method === 'POST' ? { data: { id: 78 } } : { data: [] };
    return { ok: true, text: async () => JSON.stringify(result) };
  } };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, globals)(requireApp, module, module.exports);
  modules[name] = module.exports;
  return module.exports;
}
const Add = load('Ta3meedNoResetFilterScreen.js').AddOpportunityModal;
check(typeof Add === 'function', 'the existing opportunity form remains an exportable component');
const Archive = load('SmsArchiveScreen.js').default;
function elements(element, found = []) {
  if (Array.isArray(element)) { element.forEach((child) => elements(child, found)); return found; }
  if (!React.isValidElement(element)) return found;
  if (typeof element.type === 'function' && element.type.name === 'FormField') return elements(element.type(element.props), found);
  found.push(element); elements(element.props.children, found); return found;
}
async function mount(Component, props, state = {}) {
  const h = { slots: [], cursor: 0, effects: [], ...state };
  h.render = () => { active = h; h.cursor = 0; h.tree = Component(props); for (const effect of h.effects.splice(0)) effect(); h.nodes = elements(h.tree); return h; };
  h.byId = (id) => h.nodes.find((node) => node.props.testID === id)?.props;
  h.text = () => h.nodes.filter((node) => typeof node.props.children === 'string').map((node) => node.props.children).join(' ');
  h.render(); await new Promise(setImmediate); h.render(); return h;
}
const suggestion = { code: 'ER-ACCEPT900', total_amount: '50001.00', start_date: '2026-10-26', date_source: 'received_at' };
const accepted = { id: 55, sender: 'Ta3meed', body: 'تم قبول استثمارك بمبلغ 50001.00 في الفرصة رقم ER-ACCEPT900', received_at_ms: 1793000000000, analysis: { status: 'needs_review', action_type: 'investment', reason: 'investment_requires_completion' } };
const review = { version: 'a'.repeat(64), suggestion };
(async () => {
  let created = 0, closed = 0;
  const submissions = [];
  const props = { visible: true, initialValues: { code: suggestion.code, total_amount: suggestion.total_amount, start_date: suggestion.start_date },
    intro: 'أكمل بيانات الرسالة', onClose: () => { closed += 1; }, onCreated: () => { created += 1; },
    onSubmit: async (payload) => { submissions.push(payload); return { data: { id: 77 }, analysis: { status: 'investment_created' } }; } };
  const form = await mount(Add, props);
  check(form.byId('add-opportunity-reference').value === suggestion.code, 'existing add form receives the reference');
  check(form.byId('add-opportunity-capital').value === '50001.00' && form.byId('add-opportunity-funding-date').value === '2026-10-26', 'capital and funding date are prefilled exactly');
  check(submissions.length === 0, 'opening the add form never submits an investment');
  const input = (label) => form.nodes.find((node) => node.props.label === label);
  const field = (placeholder) => form.nodes.find((node) => node.props.placeholder === placeholder)?.props;
  // Fill only the commercial terms that the SMS does not supply.
  const inputs = form.nodes.filter((node) => typeof node.props.onChangeText === 'function');
  check(inputs.find((node) => node.props.placeholder === '0' && !node.props.testID)?.props.value === '', 'expected profit remains blank for manual entry');
  inputs.find((node) => node.props.placeholder === '0' && !node.props.testID).props.onChangeText('510.01'); form.render();
  field('مثال: 6').onChangeText('6'); form.render();
  form.nodes.find((node) => node.props.children?.props?.children === 'B+').props.onPress(); form.render();
  form.nodes.find((node) => typeof node.props.onChangeText === 'function' && node.props.placeholder === 'YYYY-MM-DD' && !node.props.testID).props.onChangeText('2027-04-26'); form.render();
  const editor = form.nodes.find((node) => node.props.rows && typeof node.props.onChange === 'function').props;
  editor.onChange([{ investor_id: 1, investor_name: 'اختبار', amount: '50001.00' }]); form.render();
  const saveButton = () => form.nodes.find((node) => node.props.children?.props?.children === 'حفظ الفرصة').props;
  check(!saveButton().disabled, 'normal investor allocation rules enable saving only after exact participation');
  await saveButton().onPress(); form.render();
  check(submissions.length === 1 && submissions[0].code === suggestion.code && submissions[0].total_amount === 50001, 'explicit save passes the prefilled fields to the SMS completion endpoint');
  check(submissions[0].start_date === '2026-10-26' && submissions[0].withdrawal_date === '2026-10-26' && submissions[0].category === 'B+', 'funding date and manual classification use the existing payload');
  check(created === 1 && closed === 1, 'only a successful save closes and reports creation');
  check(rawCalls.length === 0, 'SMS submission never calls the independent ordinary creation endpoint');

  const archive = await mount(Archive, { onBack() {} }, { archive: { data: [accepted], total: 1, has_more: false, dismissed_ids: [] }, review });
  archive.byId('sms-message-55').onPress(); archive.render();
  check(archive.byId('complete-sms-investment') && archive.byId('dismiss-sms-investment'), 'acceptance offers completion and cancellation');
  check(!archive.byId('open-sms-message-review'), 'acceptance never offers payment approval');
  await archive.byId('complete-sms-investment').onPress(); archive.render();
  const addProps = archive.nodes.find((node) => node.type === Add).props;
  check(addProps.visible && addProps.initialValues.code === suggestion.code && addProps.initialValues.total_amount === '50001.00', 'complete opens the same add-opportunity form with extracted fields');
  check(addProps.initialValues.start_date === suggestion.start_date && !('profit' in addProps.initialValues), 'only known values enter the draft');
  check(!calls.some((entry) => entry.action === 'complete'), 'pressing complete opens the form without financial writes');
  addProps.onClose(); archive.render();
  check(archive.byId('complete-sms-investment'), 'closing an unfinished form leaves the message pending');
  await archive.byId('dismiss-sms-investment').onPress(); await new Promise(setImmediate); archive.render();
  const dismissal = calls.find((entry) => entry.action === 'dismiss');
  check(dismissal?.id === 55 && dismissal.version === review.version && dismissal.key === 'synthetic-session', 'cancel sends the current owner-bound review version');
  check(!archive.byId('sms-message-55') && !archive.byId('complete-sms-investment'), 'cancel removes the pending message and its actions');
  check(!calls.some((entry) => entry.action === 'complete'), 'cancel never submits an opportunity');
  fs.writeFileSync(path.join(casePath, 'investment-qa.json'), JSON.stringify({ passed: true, checks, source_commit: process.env.AHMED_SMS_SHA }), { mode: 0o600 });
  console.log(`SMS_INVESTMENT_EXISTING_FORM_AND_ACTIONS_PASSED checks=${checks}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
