import { ahmedUserHeaders } from './ahmedCurrentUser';

const API = (process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api').replace(/\/$/, '');

export function walletRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

async function request(path, method = 'GET', body) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 25000);
  try {
    const response = await fetch(`${API}${path}`, {
      method, signal: abort.signal, headers: ahmedUserHeaders({ Accept: 'application/json', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(Object.values(json.errors || {}).flat()[0] || json.message || 'تعذر إكمال الطلب.');
      error.status = response.status;
      throw error;
    }
    return json;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('تعذر تأكيد النتيجة. أعد المحاولة؛ لن تتكرر الحركة المحفوظة.');
    throw error;
  } finally { clearTimeout(timer); }
}

export const fetchTa3meedWallet = (kind = '', page = 1) => request(`/ta3meed/wallet?page=${page}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`);
export const saveTa3meedWalletEntry = (body, id) => request(`/ta3meed/wallet/entries${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body);
export const deleteTa3meedWalletEntry = (entry) => request(`/ta3meed/wallet/entries/${entry.id}`, 'DELETE', { expected_revision: entry.revision });
