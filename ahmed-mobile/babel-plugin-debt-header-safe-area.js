'use strict';

module.exports = function debtHeaderSafeAreaPlugin() {
  return {
    name: 'ahmed-debt-header-safe-area',

    parserOverride(code, parserOptions, parse) {
      if (!code.includes('function DebtsScreen') || !code.includes('#S-124 ديوني')) {
        return parse(code, parserOptions);
      }

      let source = code;

      // React Native SafeAreaView does not reliably protect Android edge-to-edge
      // status bars on newer devices, so reserve the real Android status-bar height.
      if (!source.includes('StatusBar as NativeStatusBar')) {
        source = source.replace(
          '  Modal,\n  RefreshControl,',
          '  Modal,\n  Platform,\n  RefreshControl,\n  StatusBar as NativeStatusBar,',
        );
      }

      // Use a real invisible spacer instead of rendering a second white back button.
      source = source.replace(
        /<View style=\{styles\.backButton\} \/>/g,
        '<View style={styles.topBarSpacer} />',
      );

      // Keep the production title clean and make the internal screen id unobtrusive.
      source = source.replace(
        '<Text style={styles.topTitle}>#S-124 ديوني</Text>',
        '<View style={styles.topTitleWrap}><Text style={[styles.topTitle, styles.mainTopTitle]}>ديوني</Text><Text style={styles.screenCode}>#S-124</Text></View>',
      );

      source = source.replace(
        "  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },",
        "  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 24) + 8 : 8, paddingBottom: 8, minHeight: Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 24) + 58 : 58 },",
      );

      source = source.replace(
        "  backButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },",
        "  backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },\n  topBarSpacer: { width: 44, height: 44 },\n  topTitleWrap: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },",
      );

      source = source.replace(
        "  topTitle: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'center' },",
        "  topTitle: { flex: 1, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },\n  mainTopTitle: { flex: 0 },\n  screenCode: { marginTop: 1, color: '#94a3b8', fontSize: 9, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center' },",
      );

      // Normalize the first content position below the corrected header.
      source = source.replace(
        "  content: { padding: 18, paddingTop: 2, paddingBottom: 36 },",
        "  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 36 },",
      );
      source = source.replace(
        "  detailContent: { padding: 18, paddingTop: 2, paddingBottom: 40 },",
        "  detailContent: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 40 },",
      );

      return parse(source, parserOptions);
    },
  };
};
