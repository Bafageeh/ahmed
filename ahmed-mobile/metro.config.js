const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const safeNotificationsPath = path.resolve(__dirname, 'SafeNotifications.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-notifications' && path.resolve(context.originModulePath || '') !== safeNotificationsPath) {
    return {
      filePath: safeNotificationsPath,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
