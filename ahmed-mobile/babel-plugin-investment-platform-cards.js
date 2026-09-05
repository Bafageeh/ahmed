'use strict';

module.exports = function investmentPlatformCardsPlugin() {
  return {
    name: 'ahmed-investment-platform-cards',
    parserOverride(code, parserOptions, parse) {
      if (!code.includes('function InvestmentsScreen') || !code.includes('#S-140 منصات الاستثمار')) {
        return parse(code, parserOptions);
      }

      let source = code;

      // S-140: make each platform card a single tap target, remove the redundant
      // "فتح الشاشة" label, and keep the platform name directly beside its icon.
      const investmentsScreen = `function InvestmentsScreen({ openPlatform }) {
  return <ScreenWrap>
    <Header badge="استثماراتي" title="#S-140 منصات الاستثمار" subtitle="منصات الاستثمار فقط." icon="investments" />
    <View style={styles.grid}>
      {platforms.map((p) => {
        const isActive = activeInvestmentKeys.includes(p.key);
        return <TouchableOpacity
          key={p.key}
          disabled={!isActive}
          activeOpacity={0.84}
          onPress={() => openPlatform(p.key)}
          style={[styles.card, !isActive && styles.disabledCard]}
        >
          <View style={{ alignSelf: 'stretch', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 6 }}>
            <View style={[styles.iconBox, { marginBottom: 0 }]}>
              <UiIcon name={p.icon} size={29} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>{p.name}</Text>
          </View>
          <Text style={styles.cardText}>{p.text}</Text>
          {!isActive ? <Text style={[styles.openText, styles.soonText]}>قريبًا</Text> : null}
        </TouchableOpacity>;
      })}
    </View>
  </ScreenWrap>;
}`;

      source = source.replace(
        /function InvestmentsScreen\(\{ openPlatform \}\) \{[\s\S]*?\}\n\nfunction FinanceImportsScreen/,
        `${investmentsScreen}\n\nfunction FinanceImportsScreen`,
      );

      return parse(source, parserOptions);
    },
  };
};
