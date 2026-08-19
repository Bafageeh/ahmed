module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      './babel-plugin-ahmed-appshell-fixes',
      './babel-plugin-debt-detail-extra-stats',
    ],
  };
};
