const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../ahmed-mobile/smsCapture.js'), 'utf8');

async function fixture(platform = 'android', available = true) {
  const calls = [];
  const state = { owner: '', enabled: false, permission: async () => 'granted', fetch: null };
  const native = {
    bindUser(owner) { calls.push(['owner', owner]); if (owner !== state.owner) state.enabled = false; state.owner = owner; },
    async getStatus() { return { installationId: 'ef1884e5-81b3-4806-985e-d3817819604b', enabled: state.enabled, pendingCount: 0 }; },
    async syncNow() { calls.push(['sync']); return this.getStatus(); },
    async enableCapture(...args) { calls.push(['enable', ...args]); state.enabled = true; return this.getStatus(); },
    async disableCapture() { calls.push(['disable']); state.enabled = false; return this.getStatus(); },
  };
  const context = vm.createContext({ process: { env: {} }, fetch: async (...args) => {
    calls.push(['fetch', ...args]);
    if (state.fetch) return state.fetch(...args);
    return { ok: true, json: async () => ({ upload_token: 'x'.repeat(80), server_time_ms: 10001, data: { capture_from_ms: 10000 } }) };
  } });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async (name) => {
    if (name === 'react-native') {
      return new vm.SyntheticModule(['PermissionsAndroid', 'Platform'], function () {
        this.setExport('Platform', { OS: platform });
        this.setExport('PermissionsAndroid', {
          PERMISSIONS: { RECEIVE_SMS: 'android.permission.RECEIVE_SMS' }, RESULTS: { GRANTED: 'granted' },
          request: async (permission) => { assert.equal(permission, 'android.permission.RECEIVE_SMS'); calls.push(['permission']); return state.permission(); },
        });
      }, { context });
    }
    if (name === 'expo') return new vm.SyntheticModule(['requireOptionalNativeModule'], function () { this.setExport('requireOptionalNativeModule', () => available ? native : null); }, { context });
    throw new Error('Unexpected dependency: ' + name);
  });
  await module.evaluate();
  return { api: module.namespace, state, calls };
}
const user = (id) => ({ user: { id }, sessionKey: 'signed-in-' + id });

(async () => {
  let f = await fixture('web');
  assert.equal((await f.api.getSmsCaptureStatus()).supported, false);
  await assert.rejects(f.api.enableSmsCapture());
  assert.equal(f.calls.length, 0);
  f = await fixture('android', false);
  assert.equal((await f.api.getSmsCaptureStatus()).supported, false);

  f = await fixture();
  await assert.rejects(f.api.enableSmsCapture());
  f.api.synchronizeSmsCaptureSession(user(1));
  f.state.permission = async () => 'denied';
  await assert.rejects(f.api.enableSmsCapture());
  assert.equal(f.calls.filter((x) => x[0] === 'fetch').length, 0);
  assert.equal(f.state.enabled, false);

  f.state.permission = async () => 'granted';
  await f.api.enableSmsCapture();
  assert.equal(f.state.enabled, true);
  const activation = f.calls.find((x) => x[0] === 'enable');
  assert.equal(activation[1], '1');
  assert.equal(activation[3], 'https://ahmed.pm.sa/api/sms/ingest');
  assert.equal(activation[5], 10000);
  f.state.fetch = async () => { assert.equal(f.state.enabled, false, 'local collection must stop before a network request'); throw new Error('offline'); };
  await f.api.disableSmsCapture();
  assert.equal(f.state.enabled, false);
  f.api.synchronizeSmsCaptureSession(null);
  assert.equal(f.state.owner, '');

  f = await fixture();
  f.api.synchronizeSmsCaptureSession(user(1));
  let releasePermission;
  f.state.permission = () => new Promise((resolve) => { releasePermission = resolve; });
  const pending = f.api.enableSmsCapture();
  f.api.synchronizeSmsCaptureSession(user(2));
  releasePermission('granted');
  await assert.rejects(pending);
  assert.equal(f.state.owner, '2');
  assert.equal(f.state.enabled, false);
  assert.equal(f.calls.filter((x) => x[0] === 'fetch').length, 0);

  f = await fixture();
  f.api.synchronizeSmsCaptureSession(user(1));
  let releaseNetwork, networkStarted;
  const started = new Promise((resolve) => { networkStarted = resolve; });
  f.state.fetch = () => new Promise((resolve) => { releaseNetwork = resolve; networkStarted(); });
  const registering = f.api.enableSmsCapture();
  await started;
  f.api.synchronizeSmsCaptureSession(user(2));
  releaseNetwork({ ok: true, json: async () => ({ upload_token: 'x'.repeat(80), server_time_ms: 10001, data: { capture_from_ms: 10000 } }) });
  await assert.rejects(registering);
  assert.equal(f.state.owner, '2');
  assert.equal(f.state.enabled, false);
  assert.equal(f.calls.filter((x) => x[0] === 'enable').length, 0);
  console.log('SMS_CLIENT_PERMISSION_OFFLINE_STOP_AND_ACCOUNT_SWITCH_CHECKS_PASSED');
})().catch((error) => { console.error(error); process.exitCode = 1; });
