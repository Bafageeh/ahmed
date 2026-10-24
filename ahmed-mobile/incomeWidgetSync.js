import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { fetchFutureIncomeData, FUTURE_INCOME_SOURCES } from './futureMonthlyIncomeData';
import { buildIncomeWidgetData } from './incomeWidgetData';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
let activeSession = null;
let generation = 0;
let interval = null;
let subscription = null;
let pending = null;
let lastSnapshot = { values: {}, manual: [], failed: [], updatedAt: null };

function nativeWidget() {
  if (Platform.OS !== 'android') return null;
  try { return requireOptionalNativeModule('AhmedIncomeWidget'); } catch { return null; }
}

export function isIncomeWidgetAvailable() { return Boolean(nativeWidget()); }

export function publishIncomeWidgetSnapshot(snapshot, userId) {
  if (!activeSession || String(activeSession.user.id) !== String(userId)) return false;
  const widget = nativeWidget();
  if (!widget || !snapshot.updatedAt) return false;
  const payload = buildIncomeWidgetData(snapshot, FUTURE_INCOME_SOURCES, Boolean(activeSession.user.is_admin), userId);
  try { return widget.updateSnapshot(String(userId), JSON.stringify(payload)); } catch { return false; }
}

export function refreshIncomeWidget() {
  const widget = nativeWidget();
  if (!widget || !activeSession || !widget.hasWidgets()) return Promise.resolve();
  if (pending?.generation === generation) return pending.promise;
  const mine = generation;
  const session = activeSession;
  const promise = fetchFutureIncomeData({
    apiUrl: API_URL,
    includeFinance: Boolean(session.user.is_admin),
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.sessionKey}`, 'X-Ahmed-Token': session.sessionKey, 'X-Ahmed-User-Id': String(session.user.id) },
  }).then((result) => {
    if (mine !== generation || !activeSession) return;
    const received = Object.keys(result.values).length > 0 || result.manual !== null;
    if (!received) return;
    lastSnapshot = {
      values: { ...lastSnapshot.values, ...result.values },
      manual: result.manual === null ? lastSnapshot.manual : result.manual,
      failed: result.failed, updatedAt: new Date(),
    };
    publishIncomeWidgetSnapshot(lastSnapshot, session.user.id);
  }).catch(() => {}).finally(() => { if (pending?.generation === mine) pending = null; });
  pending = { generation: mine, promise };
  return promise;
}

export function synchronizeIncomeWidgetSession(session) {
  const next = session?.user?.id && session?.sessionKey ? session : null;
  if (next && next.user.id === activeSession?.user?.id && next.sessionKey === activeSession?.sessionKey && Boolean(next.user.is_admin) === Boolean(activeSession?.user?.is_admin)) return;
  generation += 1;
  activeSession = next;
  lastSnapshot = { values: {}, manual: [], failed: [], updatedAt: null };
  clearInterval(interval); interval = null;
  subscription?.remove(); subscription = null;
  const widget = nativeWidget();
  if (!widget) return;
  try { widget.bindSession(''); if (next) widget.bindSession(String(next.user.id)); } catch { return; }
  if (!next) return;
  refreshIncomeWidget();
  subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refreshIncomeWidget(); });
  interval = setInterval(() => {
    if (AppState.currentState === 'active') refreshIncomeWidget();
  }, 60000);
}

export async function requestIncomeWidgetPin() {
  const widget = nativeWidget();
  if (!widget) return 'unavailable';
  if (!activeSession) return 'signed-out';
  try { return await widget.requestPin() ? 'requested' : 'unsupported'; } catch { return 'unsupported'; }
}
