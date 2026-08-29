const { NativeModules, Platform } = require('react-native');

const expoConstants = NativeModules.ExponentConstants || NativeModules.ExpoConstants || {};
const isExpoGo = Boolean(
  expoConstants.appOwnership === 'expo'
  || expoConstants.executionEnvironment === 'storeClient'
  || NativeModules.ExpoGo
);

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

const SafeNotifications = {
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { MONTHLY: 'monthly' },

  get isAvailable() {
    return !notificationsUnavailable;
  },

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

  async scheduleNotificationAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    try {
      return await notifications.scheduleNotificationAsync(...args);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return null;
    }
  },

  async cancelScheduledNotificationAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return undefined;
    try {
      return await notifications.cancelScheduledNotificationAsync(...args);
    } catch (error) {
      notificationsUnavailable = true;
      nativeNotifications = null;
      return undefined;
    }
  },
};

module.exports = SafeNotifications;
