#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TA3MEED = ROOT / 'ahmed-mobile' / 'Ta3meedCompactFiltersScreen.js'
APP_SHELL = ROOT / 'ahmed-mobile' / 'AppShell.js'


def patch_ta3meed():
    text = TA3MEED.read_text(encoding='utf-8')

    old_sig = "export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore, onEditOpportunity }) {"
    new_sig = "export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore, onOpenInvestments, onOpenInvestorAccounts, onOpenImageImport, onEditOpportunity }) {"
    if old_sig in text:
        text = text.replace(old_sig, new_sig, 1)

    state_anchor = "  const [receiptOpen, setReceiptOpen] = useState(false);\n"
    if "const [quickMenuOpen, setQuickMenuOpen]" not in text:
        if state_anchor not in text:
            raise RuntimeError('Ta3meed receiptOpen state anchor not found')
        text = text.replace(state_anchor, state_anchor + "  const [quickMenuOpen, setQuickMenuOpen] = useState(false);\n", 1)

    pay_block = '''      <TouchableOpacity style={styles.floatingPayButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.88}>
        <Text style={styles.payText}>سداد</Text>
      </TouchableOpacity>

'''
    text = text.replace(pay_block, '', 1)

    old_more = '''      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => onOpenMore ? onOpenMore() : onBack?.()}
        style={styles.moreFloatingButton}
      >
        <UiIcon name="more" size={27} color={ICON_COLOR_DARK} />
      </TouchableOpacity>
'''

    new_more = '''      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => setQuickMenuOpen(true)}
        style={styles.moreFloatingButton}
        accessibilityRole="button"
        accessibilityLabel="اختصارات تعميد"
      >
        <UiIcon name="more" size={27} color={ICON_COLOR_DARK} />
      </TouchableOpacity>

      <Modal visible={quickMenuOpen} transparent animationType="fade" onRequestClose={() => setQuickMenuOpen(false)}>
        <View style={styles.quickMenuOverlay}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFillObject} onPress={() => setQuickMenuOpen(false)} />
          <View style={styles.quickMenuCard}>
            <View style={styles.quickMenuHeader}>
              <TouchableOpacity style={styles.quickMenuClose} onPress={() => setQuickMenuOpen(false)} activeOpacity={0.82}>
                <Text style={styles.quickMenuCloseText}>×</Text>
              </TouchableOpacity>
              <View style={styles.quickMenuHeaderText}>
                <Text style={styles.quickMenuTitle}>اختصارات تعميد</Text>
                <Text style={styles.quickMenuSubtitle}>وصول سريع لأهم الأدوات والشاشات</Text>
              </View>
              <View style={styles.quickMenuHeaderIcon}><UiIcon name="more" size={22} color="#ffffff" /></View>
            </View>

            <View style={styles.quickMenuGrid}>
              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); setReceiptOpen(true); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#ecfdf5' }]}><UiIcon name="payments" size={26} color="#0f766e" /></View>
                <Text style={styles.quickMenuItemTitle}>السداد</Text>
                <Text style={styles.quickMenuItemText}>إضافة واعتماد دفعة تعميد</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); (onOpenInvestments || onBack)?.(); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#f5f3ff' }]}><UiIcon name="investments" size={26} color="#7c3aed" /></View>
                <Text style={styles.quickMenuItemTitle}>استثماراتي</Text>
                <Text style={styles.quickMenuItemText}>العودة إلى منصات الاستثمار</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); (onOpenInvestorAccounts || onOpenMore)?.(); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#eff6ff' }]}><UiIcon name="users" size={26} color="#2563eb" /></View>
                <Text style={styles.quickMenuItemTitle}>حسابات المستثمرين</Text>
                <Text style={styles.quickMenuItemText}>الحركات والأرصدة والتفاصيل</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); (onOpenImageImport || onOpenMore)?.(); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#fff7ed' }]}><UiIcon name="ta3meed" size={26} color="#c2410c" /></View>
                <Text style={styles.quickMenuItemTitle}>استيراد صورة تعميد</Text>
                <Text style={styles.quickMenuItemText}>قراءة بيانات الفرصة من الصورة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
'''
    if old_more in text:
        text = text.replace(old_more, new_more, 1)

    if 'quickMenuOverlay:' not in text:
        style_anchor = "const styles = StyleSheet.create({\n\n  moreFloatingButton: {"
        if style_anchor not in text:
            raise RuntimeError('Ta3meed styles anchor not found')
        quick_styles = '''const styles = StyleSheet.create({

  quickMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 92,
  },
  quickMenuCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    elevation: 22,
    shadowColor: '#0f172a',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  quickMenuHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  quickMenuClose: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  quickMenuCloseText: { color: '#475569', fontSize: 26, lineHeight: 28, fontWeight: '500' },
  quickMenuHeaderText: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 12 },
  quickMenuTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  quickMenuSubtitle: { marginTop: 3, color: '#64748b', fontSize: 11.5, fontWeight: '800', textAlign: 'right' },
  quickMenuHeaderIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' },
  quickMenuGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  quickMenuItem: { flexBasis: '47%', flexGrow: 1, minHeight: 142, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 12, alignItems: 'flex-end' },
  quickMenuItemIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickMenuItemTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  quickMenuItemText: { marginTop: 5, color: '#64748b', fontSize: 11.5, fontWeight: '700', lineHeight: 17, textAlign: 'right' },

  moreFloatingButton: {'''
        text = text.replace(style_anchor, quick_styles, 1)

    if 'اختصارات تعميد' not in text:
        raise RuntimeError('Ta3meed quick menu was not inserted')
    if 'floatingPayButton} onPress={() => setReceiptOpen(true)' in text:
        raise RuntimeError('Old top payment button still exists')

    TA3MEED.write_text(text, encoding='utf-8')


def patch_app_shell():
    text = APP_SHELL.read_text(encoding='utf-8')

    old_route = "      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenMore={() => openTab('more')} />;"
    new_route = "      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenInvestments={() => setInvestmentScreen('list')} onOpenInvestorAccounts={() => setInvestmentScreen('ta3meedAccounts')} onOpenImageImport={() => setInvestmentScreen('ta3meedImageImport')} />;"
    if old_route in text:
        text = text.replace(old_route, new_route, 1)

    moved_rows = '<MenuRow title="استيراد صورة تعميد" text="قراءة صورة الفرصة" icon="ta3meed" onPress={() => openInvestment(\'ta3meedImageImport\')} /><MenuRow title="حسابات المستثمرين" text="حركات وأرصدة المستثمرين" icon="users" onPress={() => openInvestment(\'ta3meedAccounts\')} />'
    text = text.replace(moved_rows, '', 1)

    if 'onOpenInvestorAccounts' not in text or 'onOpenImageImport' not in text:
        raise RuntimeError('Ta3meed navigation callbacks were not inserted')
    if '<MenuRow title="استيراد صورة تعميد"' in text or '<MenuRow title="حسابات المستثمرين"' in text:
        raise RuntimeError('Moved Ta3meed rows still exist in More screen')

    APP_SHELL.write_text(text, encoding='utf-8')


if __name__ == '__main__':
    patch_ta3meed()
    patch_app_shell()
    print('Ta3meed quick menu patch applied and verified')
