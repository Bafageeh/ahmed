import { ahmedUserHeaders, getCurrentAhmedSession } from './ahmedCurrentUser';

const API = (process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api').replace(/\/$/, '');

async function request(id, action, body, sessionKey) {
  if (!sessionKey || getCurrentAhmedSession()?.sessionKey !== sessionKey) throw new Error('تغير الحساب. افتح الرسائل من جديد.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API}/sms/messages/${encodeURIComponent(id)}/${action}`, {
      method: body ? 'POST' : 'GET', signal: controller.signal,
      headers: ahmedUserHeaders({ Accept: 'application/json', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    if (getCurrentAhmedSession()?.sessionKey !== sessionKey) throw new Error('تغير الحساب. افتح الرسائل من جديد.');
    if (!response.ok) {
      const error = new Error(Object.values(json.errors || {}).flat()[0] || json.message || 'تعذر اعتماد الرسالة.');
      error.status = response.status; error.data = json;
      throw error;
    }
    return json;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('تعذر تأكيد النتيجة. أعد المحاولة بالبيانات نفسها؛ لن تتكرر الحركة المعتمدة.');
    throw error;
  } finally { clearTimeout(timer); }
}

export const fetchSmsReview = (id, sessionKey) => request(id, 'review', null, sessionKey);
export const approveSmsReview = (id, body, sessionKey) => request(id, 'approve', body, sessionKey);
export const fetchSmsInvestment = (id, sessionKey) => request(id, 'investment', null, sessionKey);
export const completeSmsInvestment = (id, body, sessionKey) => request(id, 'investment/complete', body, sessionKey);
export const dismissSmsInvestment = (id, version, sessionKey) => request(id, 'investment/dismiss', { version }, sessionKey);
