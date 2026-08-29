const { NativeModules, Platform } = require('react-native');

const expoConstants = NativeModules.ExponentConstants || NativeModules.ExpoConstants || {};
const isExpoGo = Boolean(
  expoConstants.appOwnership === 'expo'
  || expoConstants.executionEnvironment === 'storeClient'
  || NativeModules.ExpoGo
);

let nativeNotifications = null;

function getNativeNotifications() {
  if (Platform.OS === 'web' || isExpoGo) return null;
  if (!nativeNotifications) {
    nativeNotifications = require('expo-notifications');
  }
  return nativeNotifications;
}

const SafeNotifications = {
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { MONTHLY: 'monthly' },
  isAvailable: !isExpoGo && Platform.OS !== 'web',

  setNotificationHandler(handler) {
    const notifications = getNativeNotifications();
    if (!notifications) return undefined;
    return notifications.setNotificationHandler(handler);
  },

  async setNotificationChannelAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    return notifications.setNotificationChannelAsync(...args);
  },

  async getPermissionsAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return { granted: false, status: 'undetermined' };
    return notifications.getPermissionsAsync(...args);
  },

  async requestPermissionsAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return { granted: false, status: 'undetermined' };
    return notifications.requestPermissionsAsync(...args);
  },

  async scheduleNotificationAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return null;
    return notifications.scheduleNotificationAsync(...args);
  },

  async cancelScheduledNotificationAsync(...args) {
    const notifications = getNativeNotifications();
    if (!notifications) return undefined;
    return notifications.cancelScheduledNotificationAsync(...args);
  },
};

module.exports = SafeNotifications;
