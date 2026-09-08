import { Platform } from 'react-native';
import * as Notifications from './SafeNotifications';
import * as SecureStore from 'expo-secure-store';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const CHANNEL_ID = 'card-statements';
const ACTIVE_KEYS_STORE = 'ahmed_bank_statement_active_keys';
const bankNotificationKey = (key) => `ahmed_bank_statement_notification_${key}`;
const legacyCardNotificationKey = (id) => `ahmed_card_statement_notification_${id}`;

let handlerConfigured = false;

async function configureNotifications() {
  if (!Notifications.isAvailable || Platform.OS === 'web') return false;
  try {
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'مواعيد كشف البطاقات',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

async function cancelBankReminder(key) {
  try {
    const storageKey = bankNotificationKey(key);
    const scheduledId = await SecureStore.getItemAsync(storageKey);
    if (scheduledId) await Notifications.cancelScheduledNotificationAsync(scheduledId);
    await SecureStore.deleteItemAsync(storageKey);
  } catch {}
}

async function clearLegacyCardReminders() {
  try {
    const response = await fetch(`${API_URL}/secure-vault`, {
      headers: ahmedUserHeaders({ Accept: 'application/json' }),
    });
    const json = await response.json();
    if (!response.ok || !Array.isArray(json.data)) return;

    for (const item of json.data) {
      if (!item?.id || (item.record_type !== 'card' && item.category !== 'cards')) continue;
      try {
        const key = legacyCardNotificationKey(item.id);
        const scheduledId = await SecureStore.getItemAsync(key);
        if (scheduledId) await Notifications.cancelScheduledNotificationAsync(scheduledId);
        await SecureStore.deleteItemAsync(key);
      } catch {}
    }
  } catch {}
}

export async function syncBankStatementReminders() {
  if (!Notifications.isAvailable || Platform.OS === 'web') return false;
  const allowed = await configureNotifications();
  if (!allowed) return false;

  try {
    const response = await fetch(`${API_URL}/bank-statement-schedules/mine`, {
      headers: ahmedUserHeaders({ Accept: 'application/json' }),
    });
    const json = await response.json();
    if (!response.ok) return false;

    const rows = Array.isArray(json.data) ? json.data : [];
    const activeRows = rows.filter((row) => {
      const day = Number(row?.statement_day);
      return row?.bank_key && Number.isInteger(day) && day >= 1 && day <= 31;
    });

    let oldKeys = [];
    try {
      oldKeys = JSON.parse((await SecureStore.getItemAsync(ACTIVE_KEYS_STORE)) || '[]');
      if (!Array.isArray(oldKeys)) oldKeys = [];
    } catch { oldKeys = []; }

    const currentKeys = activeRows.map((row) => String(row.bank_key));
    const allKeys = Array.from(new Set([...oldKeys.map(String), ...currentKeys]));
    for (const key of allKeys) await cancelBankReminder(key);

    for (const row of activeRows) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'موعد كشف البطاقة',
          body: `${row.bank_name} — اليوم موعد كشف حساب البطاقات.`,
          sound: 'default',
          data: { bankStatementKey: String(row.bank_key), bankName: String(row.bank_name || '') },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: Number(row.statement_day),
          hour: 9,
          minute: 0,
          channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
        },
      });
      if (identifier) await SecureStore.setItemAsync(bankNotificationKey(row.bank_key), String(identifier));
    }

    await SecureStore.setItemAsync(ACTIVE_KEYS_STORE, JSON.stringify(currentKeys));
    await clearLegacyCardReminders();
    return true;
  } catch {
    return false;
  }
}
