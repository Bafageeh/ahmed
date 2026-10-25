import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api').replace(/\/$/, '');
let activeSession = null;
let generation = 0;

function nativeCapture() {
  if (Platform.OS !== 'android') return null;
  try { return requireOptionalNativeModule('AhmedSmsCapture'); } catch { return null; }
}

export function synchronizeSmsCaptureSession(session) {
  const next = session?.user?.id && session?.sessionKey ? session : null;
  generation += 1;
  activeSession = next;
  const capture = nativeCapture();
  if (!capture) return;
  try {
    capture.bindUser(next ? String(next.user.id) : '');
    if (next) capture.syncNow().catch(() => {});
  } catch { /* Native SMS availability must not interrupt login or logout. */ }
}

export async function getSmsCaptureStatus() {
  const capture = nativeCapture();
  if (!capture) return { supported: false, enabled: false, pendingCount: 0 };
  return { supported: true, ...(await capture.getStatus()) };
}

export async function enableSmsCapture() {
  const capture = nativeCapture();
  if (!capture) throw new Error('استقبال الرسائل يحتاج نسخة APK المحدثة على أندرويد.');
  if (!activeSession) throw new Error('سجل الدخول أولًا لربط الرسائل بحسابك.');
  const mine = generation;
  const ownerId = String(activeSession.user.id);
  const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS, {
    title: 'استقبال رسائل SMS الجديدة',
    message: 'يسمح ذلك بحفظ الرسائل الجديدة مع المرسل ووقت الوصول في حسابك للتحليل، من وقت التفعيل.',
    buttonPositive: 'متابعة', buttonNegative: 'إلغاء',
  });
  if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('لم تُمنح صلاحية استقبال SMS. يمكنك منحها من إعدادات التطبيق.');
  if (mine !== generation || !activeSession || String(activeSession.user.id) !== ownerId) throw new Error('تغير الحساب. افتح صفحة الرسائل من جديد.');
  const status = await capture.getStatus();
  const response = await fetch(`${API_URL}/sms/devices`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ installation_id: status.installationId, label: 'تطبيق أحمد على أندرويد' }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || 'تعذر ربط الرسائل بالسيرفر. حاول مرة أخرى.');
  if (mine !== generation || !activeSession || String(activeSession.user.id) !== ownerId) throw new Error('تغير الحساب. لم يتم تفعيل استقبال الرسائل.');
  return { supported: true, ...(await capture.enableCapture(ownerId, json.upload_token, `${API_URL}/sms/ingest`, Number(json.server_time_ms), Number(json.data.capture_from_ms))) };
}

export async function disableSmsCapture() {
  const capture = nativeCapture();
  if (!capture) return getSmsCaptureStatus();
  const status = await capture.disableCapture();
  // Collection stops locally first, including when the network is unavailable.
  if (activeSession && status.installationId) {
    await fetch(`${API_URL}/sms/devices/${encodeURIComponent(status.installationId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } }).catch(() => {});
  }
  return { supported: true, ...status };
}

export async function syncSmsCapture() {
  const capture = nativeCapture();
  if (!capture) return getSmsCaptureStatus();
  return { supported: true, ...(await capture.syncNow()) };
}

export async function fetchSmsArchive(beforeId) {
  const response = await fetch(`${API_URL}/sms/messages${beforeId ? `?before_id=${encodeURIComponent(beforeId)}` : ''}`, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || 'تعذر تحميل الرسائل المحفوظة.');
  return { data: Array.isArray(json.data) ? json.data : [], total: Number(json.total || 0), hasMore: Boolean(json.has_more) };
}
