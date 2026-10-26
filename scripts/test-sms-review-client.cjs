const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

(async () => {
  let session = { sessionKey: 'account-one', user: { id: 1 } };
  let handler, timeout;
  const calls = [];
  const context = vm.createContext({ process: { env: {} }, AbortController,
    setTimeout: (fn) => { timeout = fn; return 1; }, clearTimeout: () => { timeout = null; },
    fetch: async (url, options) => { calls.push([url, options]); return handler(url, options); },
  });
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../ahmed-mobile/smsReviewApi.js'), 'utf8'), { context });
  await module.link(async () => new vm.SyntheticModule(['getCurrentAhmedSession', 'ahmedUserHeaders'], function () {
    this.setExport('getCurrentAhmedSession', () => session);
    this.setExport('ahmedUserHeaders', (extra) => ({ ...extra, Authorization: `Bearer ${session.sessionKey}` }));
  }, { context }));
  await module.evaluate();
  const api = module.namespace;
  await assert.rejects(api.fetchSmsReview(1, 'other-session'), /تغير الحساب/);
  assert.equal(calls.length, 0, 'an account switch must prevent the request');
  handler = async () => ({ ok: true, json: async () => ({ version: 'v', suggestion: { amount: '1.00' } }) });
  assert.equal((await api.fetchSmsReview(4, 'account-one')).suggestion.amount, '1.00');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer account-one');
  assert.equal(calls[0][0], 'https://ahmed.pm.sa/api/sms/messages/4/review');
  let release;
  handler = () => new Promise((resolve) => { release = resolve; });
  const oldRequest = api.fetchSmsReview(4, 'account-one');
  session = { sessionKey: 'account-two', user: { id: 2 } };
  release({ ok: true, json: async () => ({ suggestion: { amount: '999' } }) });
  await assert.rejects(oldRequest, /تغير الحساب/, 'an old-account response cannot appear in the new session');
  session = { sessionKey: 'account-one', user: { id: 1 } };
  handler = async () => ({ ok: false, status: 409, json: async () => ({ message: 'duplicate', conflict: true, candidates: [{ id: 7 }], duplicate_token: 'challenge' }) });
  await assert.rejects(api.approveSmsReview(4, { amount: '1.00' }, 'account-one'), (error) => error.status === 409 && error.data.candidates[0].id === 7 && error.data.duplicate_token === 'challenge');
  handler = async () => ({ ok: false, status: 422, json: async () => ({ errors: { amount: ['أدخل المبلغ'] } }) });
  await assert.rejects(api.approveSmsReview(4, {}, 'account-one'), /أدخل المبلغ/);
  handler = async () => ({ ok: true, json: async () => ({ analysis: { status: 'applied' } }) });
  const body = { amount: '1.00', confirmed: true, confirm_duplicate: true, duplicate_token: 'challenge' };
  await api.approveSmsReview(4, body, 'account-one');
  const savedRequest = calls.at(-1)[1].body;
  await api.approveSmsReview(4, body, 'account-one');
  assert.equal(calls.at(-1)[1].body, savedRequest, 'retries preserve the exact confirmed decision');
  await api.fetchSmsInvestment(9, 'account-one');
  assert.equal(calls.at(-1)[0], 'https://ahmed.pm.sa/api/sms/messages/9/investment');
  await api.completeSmsInvestment(9, { version: 'review', code: 'ER-TEST9' }, 'account-one');
  assert.equal(calls.at(-1)[0], 'https://ahmed.pm.sa/api/sms/messages/9/investment/complete');
  assert.equal(JSON.parse(calls.at(-1)[1].body).code, 'ER-TEST9');
  await api.dismissSmsInvestment(9, 'review', 'account-one');
  assert.equal(calls.at(-1)[0], 'https://ahmed.pm.sa/api/sms/messages/9/investment/dismiss');
  assert.equal(JSON.parse(calls.at(-1)[1].body).version, 'review');
  handler = async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { const error = new Error(); error.name = 'AbortError'; reject(error); }));
  const uncertain = api.approveSmsReview(4, body, 'account-one');
  timeout();
  await assert.rejects(uncertain, /أعد المحاولة بالبيانات نفسها/);
  assert.equal(timeout, null);
  console.log('SMS_REVIEW_CLIENT_AUTH_ACCOUNT_SWITCH_CONFLICT_RETRY_TIMEOUT_PASSED');
})().catch((error) => { console.error(error); process.exitCode = 1; });
