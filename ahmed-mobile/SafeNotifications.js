const { NativeModules, Platform } = require('react-native');
const SecureStore = require('expo-secure-store');

const expoConstants = NativeModules.ExponentConstants || NativeModules.ExpoConstants || {};
const isExpoGo = Boolean(
  expoConstants.appOwnership === 'expo'
  || expoConstants.executionEnvironment === 'storeClient'
  || NativeModules.ExpoGo
);

const CARD_STATEMENT_TYPE = 'card-statement';
const CARD_STATEMENT_DAILY_PREFIX = 'ahmed_card_statement_daily_';
const CARD_STATEMENT_PAID_PREFIX = 'ahmed_card_statement_paid_';
const CARD_STATEMENT_ANCHOR_PREFIX = 'ahmed_card_statement_anchor_';
const CARD_STATEMENT_PENDING_PREFIX = 'ahmed_card_statement_pending_';

let nativeNotifications = null;
let notificationsUnavailable = Platform.OS === 'web' || isExpoGo;

function getNativeNotifications() {
  if (notificationsUnavailable) return null;
  if (nativeNotifications) return nativeNotifications;

  try {
    nativeNotifications = require('expo-notifications');
    return nativeNotifications;
  } catch (error) {
    // Expo Go (SDK 53+) can throw while merely loading expo-notifications.
    // Treat notifications as unavailable for this runtime instead of crashing
    // the whole Ahmed app. A native/development build can still use the real
    // module normally.
    notificationsUnavailable = true;
    nativeNotifications = null;
    return null;
  }
}

function safeToken(value) {
  return String(value || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

function dailyStateKey(cardId) {
  return `${CARD_STATEMENT_DAILY_PREFIX}${safeToken(cardId)}`;
}

function paidCycleKey(cardId) {
  return `${CARD_STATEMENT_PAID_PREFIX}${safeToken(cardId)}`;
}

function anchorMapKey(identifier) {
  return `${CARD_STATEMENT_ANCHOR_PREFIX}${safeToken(identifier)}`;
}

function pendingDailyKey(cardId) {
  return `${CARD_STATEMENT_PENDING_PREFIX}${safeToken(cardId)}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function normalizeStatementDay(statementDay, year, monthIndex) {
  const numeric = Number(statementDay);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 31) return 0;
  return Math.min(numeric, daysInMonth(year, monthIndex));
}

function resolveStatementCycle(statementDay, now = new Date()) {
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = normalizeStatementDay(statementDay, year, month);
  if (!day) return '';

  if (now.getDate() < day) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    day = normalizeStatementDay(statementDay, year, month);
  }

  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function hasCurrentMonthStatementPassed(statementDay, now = new Date()) {
  const day = normalizeStatementDay(statementDay, now.getFullYear(), now.getMonth());
  return Boolean(day && now.getDate() > day);
}

async function readJson(key) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

async function writeJson(key, value) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch (error) {}
}

async function deleteSecureValue(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {}
}

async function cancelNativeScheduled(identifier) {
  if (!identifier) return;
  const notifications = getNativeNotifications();
  if (!notifications) return;
  try {
    await notifications.cancelScheduledNotificationAsync(String(identifier));
  } catch (error) {}
}

async function readDailyState(cardId) {
  return readJson(dailyStateKey(cardId));
}

async function cancelCardStatementDailyReminder(cardId) {
  if (!cardId) return;
  const state = await readDailyState(cardId);
  if (state?.identifier) await cancelNativeScheduled(state.identifier);
  await deleteSecureValue(dailyStateKey(cardId));
}

async function isCyclePaid(cardId, cycle) {
  if (!cardId || !cycle) return false;
  try {
    const paidCycle = await SecureStore.getItemAsync(paidCycleKey(cardId));
    return paidCycle === cycle;
  } catch (error) {
    return false;
  }
}

function statementBaseBody(content) {
  return String(content?.data?.cardStatementBaseBody || content?.body || 'بطاقة ائتمانية')
    .replace(/\s*اضغط لتحديد هل تم السداد\.?\s*$/u, '')
    .replace(/\s*—\s*لم يتم تأكيد السداد بعد\.?\s*$/u, '')
    .trim();
}

function statementData(content, statementDay, reminderKind) {
  return {
    ...(content?.data || {}),
    notificationType: CARD_STATEMENT_TYPE,
    statementDay: Number(statementDay),
    reminderKind,
    cardStatementBaseBody: statementBaseBody(content),
  };
}

async function startCardStatementDailyReminder({ cardId, statementDay, content = {}, channelId, cycle }) {
  const notifications = getNativeNotifications();
  if (!notifications || !cardId || !statementDay) return null;

  const resolvedCycle = cycle || resolveStatementCycle(statementDay);
  if (!resolvedCycle || await isCyclePaid(cardId, resolvedCycle)) {
    await cancelCardStatementDailyReminder(cardId);
    return null;
  }

  const existing = await readDailyState(cardId);
  if (existing?.identifier && existing?.cycle === resolvedCycle) return existing.identifier;
  if (existing?.identifier) await cancelNativeScheduled(existing.identifier);

  const baseBody = statementBaseBody(content);
  const identifier = await notifications.scheduleNotificationAsync({
    content: {
      ...content,
      title: 'تذكير سداد البطاقة',
      body: `${baseBody} — لم يتم تأكيد السداد بعد. اضغط لتحديد هل تم السداد.`,
      sound: 'default',
      data: statementData(content, statementDay, 'daily'),
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes?.DAILY || 'daily',
      hour: 9,
      minute: 0,
      channelId: Platform.OS === 'android' ? channelId : undefined,
    },
  });

  if (identifier) {
    await writeJson(dailyStateKey(cardId), { identifier: String(identifier), cycle: resolvedCycle });
  }
  return identifier || null;
}

async function markCardStatementPaid(cardId, statementDay) {
  if (!cardId || !statementDay) return false;
  const cycle = resolveStatementCycle(statementDay);
  if (!cycle) return false;
  try {
    await SecureStore.setItemAsync(paidCycleKey(cardId), cycle);
  } catch (error) {
    return false;
  }
  await cancelCardStatementDailyReminder(cardId);
  await deleteSecureValue(pendingDailyKey(cardId));
  return true;
}

async function continueCardStatementReminder(payload = {}) {
  const cardId = String(payload.cardId || payload.vaultCardId || '');
  const statementDay = Number(payload.statementDay || 0);
  if (!cardId || !statementDay) return false;

  const cycle = resolveStatementCycle(statementDay);
  try {
    const paidCycle = await SecureStore.getItemAsync(paidCycleKey(cardId));
    if (paidCycle === cycle) await SecureStore.deleteItemAsync(paidCycleKey(cardId));
  } catch (error) {}

  const identifier = await startCardStatementDailyReminder({
    cardId,
    statementDay,
    content: {
      title: payload.title || 'موعد كشف البطاقة',
      body: payload.body || payload.cardStatementBaseBody || 'بطاقة ائتمانية',
      sound: 'default',
      data: {
        vaultCardId: cardId,
        cardStatementBaseBody: payload.cardStatementBaseBody || payload.body || 'بطاقة ائتمانية',
      },
    },
    channelId: payload.channelId || 'card-statements',
    cycle,
  });
  return Boolean(identifier);
}

async function enrichAndScheduleCardStatement(request, notifications) {
  const cardId = String(request?.content?.data?.vaultCardId || '');
  const statementDay = Number(request?.trigger?.day || 0);
  const channelId = request?.trigger?.channelId;
  const baseContent = request?.content || {};
  const baseBody = statementBaseBody(baseContent);

  const anchorIdentifier = await notifications.scheduleNotificationAsync({
    ...request,
    content: {
      ...baseContent,
      body: `${baseBody} اضغط لتحديد هل تم السداد.`,
      data: statementData(baseContent, statementDay, 'statement'),
    },
  });

  if (!anchorIdentifier || !cardId || !statementDay) return anchorIdentifier;
  await SecureStore.setItemAsync(anchorMapKey(anchorIdentifier), cardId).catch(() => {});

  const pending = await readJson(pendingDailyKey(cardId));
  const currentCycle = resolveStatementCycle(statementDay);
  const currentPaid = await isCyclePaid(cardId, currentCycle);

  if (hasCurrentMonthStatementPassed(statementDay) && !currentPaid) {
    await startCardStatementDailyReminder({
      cardId,
      statementDay,
      content: baseContent,
      channelId,
      cycle: currentCycle,
    });
  } else if (pending?.cycle && !await isCyclePaid(cardId, pending.cycle)) {
    await startCardStatementDailyReminder({
      cardId,
      statementDay,
      content: baseContent,
      channelId,
      cycle: pending.cycle,
    });
  }

  await deleteSecureValue(pendingDailyKey(cardId));
  return anchorIdentifier;
}

const SafeNotifications = {
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { MONTHLY: 'monthly', DAILY: 'daily' },

  get isAvailable() {
    return !notificationsUnavailable;
  },

  resolveStatementCycle,
  markCardStatementPaid,
  continueCardStatementReminder,
  cancelCardStatementDailyReminder,

  setNotificationHandler(handler) {
    const notifications = getNativeNotifications();
    if (!notifications) return undefined;
    try {
      return notifications.setNotificationHandler(handler);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return undefined;
    }
  },

  addNotificationResponseReceivedListener(listener) {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    try {
      return notifications.addNotificationResponseReceivedListener(listener);
    } catch (error) {
      return null;
    }
  },

  getLastNotificationResponse() {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    try {
      return notifications.getLastNotificationResponse?.() || null;
    } catch (error) {
      return null;
    }
  },

  clearLastNotificationResponse() {
    const notifications = getNativeNotifications();
    if (!notifications) return undefined;
    try {
      return notifications.clearLastNotificationResponse?.();
    } catch (error) {
      return undefined;
    }
  },

  async setNotificationChannelAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    try {
      return await notifications.setNotificationChannelAsync(...args);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return null;
    }
  },

  async getPermissionsAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return { granted: false, status: 'undetermined' };
    try {
      return await notifications.getPermissionsAsync(...args);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return { granted: false, status: 'undetermined' };
    }
  },

  async requestPermissionsAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return { granted: false, status: 'undetermined' };
    try {
      return await notifications.requestPermissionsAsync(...args);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return { granted: false, status: 'undetermined' };
    }
  },

  async scheduleNotificationAsync(request) {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    try {
      const isCardStatement = Boolean(
        request?.content?.data?.vaultCardId
        && request?.trigger?.type === (notifications.SchedulableTriggerInputTypes?.MONTHLY || 'monthly')
      );
      if (isCardStatement) return await enrichAndScheduleCardStatement(request, notifications);
      return await notifications.scheduleNotificationAsync(request);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return null;
    }
  },

  async cancelScheduledNotificationAsync(identifier) {
    const notifications = getNativeNotifications();
    if (!notifications) return undefined;
    try {
      const mapKey = anchorMapKey(identifier);
      const cardId = await SecureStore.getItemAsync(mapKey).catch(() => null);
      if (cardId) {
        const dailyState = await readDailyState(cardId);
        if (dailyState?.cycle) await writeJson(pendingDailyKey(cardId), { cycle: dailyState.cycle });
        await cancelCardStatementDailyReminder(cardId);
        await deleteSecureValue(mapKey);
      }
      return await notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return undefined;
    }
  },
};

module.exports = SafeNotifications;
