module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      './babel-plugin-ahmed-appshell-fixes',
      './babel-plugin-investment-platform-cards',
      './babel-plugin-debt-detail-extra-stats',
      './babel-plugin-debt-header-safe-area',
      './babel-plugin-debt-last-payment-stat',
      './babel-plugin-debt-auto-payment-ui',
      './babel-plugin-credit-card-summary-card',
      './babel-plugin-mercedes-finance-analysis',
      './babel-plugin-secure-vault-optional-sadad',
      './babel-plugin-secure-vault-auto-credit-debt',
      './babel-plugin-secure-vault-remove-card-helper',
      './babel-plugin-secure-vault-sadad-cvv',
      './babel-plugin-secure-vault-iban-single-line',
      './babel-plugin-secure-vault-national-id-info',
      './babel-plugin-secure-vault-sadad-form-visible',
    ],
  };
};
