#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TA3MEED = ROOT / 'ahmed-mobile' / 'Ta3meedCompactFiltersScreen.js'
APP_SHELL = ROOT / 'ahmed-mobile' / 'AppShell.js'
API_ROUTES = ROOT / 'ahmed-api' / 'routes' / 'api.php'


def patch_ta3meed():
    text = TA3MEED.read_text(encoding='utf-8')

    if "  Linking,\n" not in text:
        text = text.replace("  Alert,\n  Modal,", "  Alert,\n  Linking,\n  Modal,", 1)

    old_sig = "export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore, onEditOpportunity }) {"
    old_patched_sig = "export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore, onOpenInvestments, onOpenInvestorAccounts, onOpenImageImport, onEditOpportunity }) {"
    new_sig = "export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore, onOpenInvestments, onOpenInvestorAccounts, onOpenImageImport, onOpenBackup, onEditOpportunity }) {"
    if old_sig in text:
        text = text.replace(old_sig, new_sig, 1)
    elif old_patched_sig in text:
        text = text.replace(old_patched_sig, new_sig, 1)

    state_anchor = "  const [receiptOpen, setReceiptOpen] = useState(false);\n"
    if "const [quickMenuOpen, setQuickMenuOpen]" not in text:
        if state_anchor not in text:
            raise RuntimeError('Ta3meed receiptOpen state anchor not found')
        text = text.replace(state_anchor, state_anchor + "  const [quickMenuOpen, setQuickMenuOpen] = useState(false);\n  const [exportingExcel, setExportingExcel] = useState(false);\n", 1)
    elif "const [exportingExcel, setExportingExcel]" not in text:
        text = text.replace("  const [quickMenuOpen, setQuickMenuOpen] = useState(false);\n", "  const [quickMenuOpen, setQuickMenuOpen] = useState(false);\n  const [exportingExcel, setExportingExcel] = useState(false);\n", 1)

    export_anchor = "  const [exportingExcel, setExportingExcel] = useState(false);\n"
    if "const exportTa3meedExcel = async () =>" not in text:
        export_handler = '''
  const exportTa3meedExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      const json = await apiJson('/ta3meed/export-link', { method: 'POST' });
      const url = json?.data?.url;
      if (!url) throw new Error('لم يتم إنشاء رابط ملف Excel');
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('تعذر فتح رابط تنزيل ملف Excel');
      setQuickMenuOpen(false);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('تعذر تصدير Excel', error?.message || 'حدث خطأ أثناء تجهيز الملف.');
    } finally {
      setExportingExcel(false);
    }
  };
'''
        if export_anchor not in text:
            raise RuntimeError('Ta3meed Excel export state anchor not found')
        text = text.replace(export_anchor, export_anchor + export_handler, 1)

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

              <TouchableOpacity disabled={exportingExcel} activeOpacity={0.86} style={[styles.quickMenuItem, exportingExcel && { opacity: 0.65 }]} onPress={exportTa3meedExcel}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#ecfeff' }]}><UiIcon name="reports" size={26} color="#0e7490" /></View>
                <Text style={styles.quickMenuItemTitle}>{exportingExcel ? 'جاري تجهيز Excel...' : 'تصدير Excel'}</Text>
                <Text style={styles.quickMenuItemText}>كل الفرص والمستثمرين وجميع التفاصيل</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); (onOpenBackup || onOpenMore)?.(); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#f0fdf4' }]}><UiIcon name="save" size={26} color="#15803d" /></View>
                <Text style={styles.quickMenuItemTitle}>نسخة احتياطية</Text>
                <Text style={styles.quickMenuItemText}>إنشاء نسخة واسترجاع البيانات عند الحاجة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
'''
    if old_more in text:
        text = text.replace(old_more, new_more, 1)
    elif 'اختصارات تعميد' in text and 'تصدير Excel' not in text:
        # Upgrade an already-patched working tree without duplicating the modal.
        image_block = '''              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); (onOpenImageImport || onOpenMore)?.(); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#fff7ed' }]}><UiIcon name="ta3meed" size={26} color="#c2410c" /></View>
                <Text style={styles.quickMenuItemTitle}>استيراد صورة تعميد</Text>
                <Text style={styles.quickMenuItemText}>قراءة بيانات الفرصة من الصورة</Text>
              </TouchableOpacity>
'''
        extra_items = image_block + '''
              <TouchableOpacity disabled={exportingExcel} activeOpacity={0.86} style={[styles.quickMenuItem, exportingExcel && { opacity: 0.65 }]} onPress={exportTa3meedExcel}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#ecfeff' }]}><UiIcon name="reports" size={26} color="#0e7490" /></View>
                <Text style={styles.quickMenuItemTitle}>{exportingExcel ? 'جاري تجهيز Excel...' : 'تصدير Excel'}</Text>
                <Text style={styles.quickMenuItemText}>كل الفرص والمستثمرين وجميع التفاصيل</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.86} style={styles.quickMenuItem} onPress={() => { setQuickMenuOpen(false); (onOpenBackup || onOpenMore)?.(); }}>
                <View style={[styles.quickMenuItemIcon, { backgroundColor: '#f0fdf4' }]}><UiIcon name="save" size={26} color="#15803d" /></View>
                <Text style={styles.quickMenuItemTitle}>نسخة احتياطية</Text>
                <Text style={styles.quickMenuItemText}>إنشاء نسخة واسترجاع البيانات عند الحاجة</Text>
              </TouchableOpacity>
'''
        if image_block not in text:
            raise RuntimeError('Ta3meed quick menu image-import anchor not found')
        text = text.replace(image_block, extra_items, 1)

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

    # Keep the header title centered while placing navigation icons at the screen edges.
    text = text.replace("  backHeaderButton: { right: 22 },", "  backHeaderButton: { left: 22 },", 1)
    text = text.replace("  searchHeaderButton: { left: 92 },", "  searchHeaderButton: { right: 22 },", 1)
    text = text.replace("  searchHeaderButton: { left: 22 },", "  searchHeaderButton: { right: 22 },", 1)

    for required in ['اختصارات تعميد', 'تصدير Excel', 'نسخة احتياطية', 'exportTa3meedExcel', 'onOpenBackup']:
        if required not in text:
            raise RuntimeError(f'Ta3meed quick menu missing: {required}')
    if 'floatingPayButton} onPress={() => setReceiptOpen(true)' in text:
        raise RuntimeError('Old top payment button still exists')
    if "backHeaderButton: { left: 22 }" not in text:
        raise RuntimeError('Ta3meed back button was not moved to the left edge')
    if "searchHeaderButton: { right: 22 }" not in text:
        raise RuntimeError('Ta3meed search button was not moved to the right edge')

    TA3MEED.write_text(text, encoding='utf-8')


def patch_app_shell():
    text = APP_SHELL.read_text(encoding='utf-8')

    import_anchor = "import Ta3meedImageImportScreen from './Ta3meedImageImportScreen';\n"
    backup_import = "import Ta3meedBackupScreen from './Ta3meedBackupScreen';\n"
    if backup_import not in text:
        if import_anchor not in text:
            raise RuntimeError('Ta3meed backup import anchor not found')
        text = text.replace(import_anchor, import_anchor + backup_import, 1)

    old_keys = "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa', 'tokenize'];"
    new_keys = "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'ta3meedBackup', 'moneymoon', 'dinar', 'sulfa', 'tokenize'];"
    if old_keys in text:
        text = text.replace(old_keys, new_keys, 1)

    old_route = "      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenMore={() => openTab('more')} />;"
    older_patched_route = "      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenInvestments={() => setInvestmentScreen('list')} onOpenInvestorAccounts={() => setInvestmentScreen('ta3meedAccounts')} onOpenImageImport={() => setInvestmentScreen('ta3meedImageImport')} />;"
    new_route = "      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenInvestments={() => setInvestmentScreen('list')} onOpenInvestorAccounts={() => setInvestmentScreen('ta3meedAccounts')} onOpenImageImport={() => setInvestmentScreen('ta3meedImageImport')} onOpenBackup={() => setInvestmentScreen('ta3meedBackup')} />;"
    if old_route in text:
        text = text.replace(old_route, new_route, 1)
    elif older_patched_route in text:
        text = text.replace(older_patched_route, new_route, 1)

    image_route = "      if (investmentScreen === 'ta3meedImageImport') return <Ta3meedImageImportScreen onBack={() => setInvestmentScreen('list')} />;"
    backup_route = "      if (investmentScreen === 'ta3meedBackup') return <Ta3meedBackupScreen onBack={() => setInvestmentScreen('ta3meed')} />;"
    if backup_route not in text:
        if image_route not in text:
            raise RuntimeError('Ta3meed image route anchor not found')
        text = text.replace(image_route, image_route + "\n" + backup_route, 1)

    moved_rows = '<MenuRow title="استيراد صورة تعميد" text="قراءة صورة الفرصة" icon="ta3meed" onPress={() => openInvestment(\'ta3meedImageImport\')} /><MenuRow title="حسابات المستثمرين" text="حركات وأرصدة المستثمرين" icon="users" onPress={() => openInvestment(\'ta3meedAccounts\')} />'
    text = text.replace(moved_rows, '', 1)

    if 'onOpenInvestorAccounts' not in text or 'onOpenImageImport' not in text or 'onOpenBackup' not in text:
        raise RuntimeError('Ta3meed navigation callbacks were not inserted')
    if backup_import not in text or backup_route not in text or "'ta3meedBackup'" not in text:
        raise RuntimeError('Ta3meed backup screen wiring was not inserted')
    if '<MenuRow title="استيراد صورة تعميد"' in text or '<MenuRow title="حسابات المستثمرين"' in text:
        raise RuntimeError('Moved Ta3meed rows still exist in More screen')

    APP_SHELL.write_text(text, encoding='utf-8')


def patch_api_routes():
    text = API_ROUTES.read_text(encoding='utf-8')

    import_anchor = "use App\\Http\\Controllers\\Api\\Ta3meedController;\n"
    tools_import = "use App\\Http\\Controllers\\Api\\Ta3meedDataToolsController;\n"
    if tools_import not in text:
        if import_anchor not in text:
            raise RuntimeError('Ta3meedDataToolsController import anchor not found')
        text = text.replace(import_anchor, import_anchor + tools_import, 1)

    webhook_anchor = "Route::post('/wa/webhook', [WhatsAppController::class, 'webhook']);\n"
    public_download = "Route::get('/ta3meed/export-download/{token}', [Ta3meedDataToolsController::class, 'downloadExport']);\n"
    if public_download not in text:
        if webhook_anchor not in text:
            raise RuntimeError('Ta3meed public export route anchor not found')
        text = text.replace(webhook_anchor, webhook_anchor + public_download, 1)

    summary_anchor = "    Route::get('/ta3meed/summary', [Ta3meedController::class, 'summary']);\n"
    protected_routes = (
        "    Route::post('/ta3meed/export-link', [Ta3meedDataToolsController::class, 'exportLink']);\n"
        "    Route::get('/ta3meed/backups', [Ta3meedDataToolsController::class, 'backups']);\n"
        "    Route::post('/ta3meed/backups', [Ta3meedDataToolsController::class, 'createBackup']);\n"
        "    Route::post('/ta3meed/backups/{id}/restore', [Ta3meedDataToolsController::class, 'restoreBackup']);\n"
    )
    if "Route::post('/ta3meed/export-link'" not in text:
        if summary_anchor not in text:
            raise RuntimeError('Ta3meed protected data-tools route anchor not found')
        text = text.replace(summary_anchor, summary_anchor + protected_routes, 1)

    for required in [
        'Ta3meedDataToolsController',
        "Route::get('/ta3meed/export-download/{token}'",
        "Route::post('/ta3meed/export-link'",
        "Route::get('/ta3meed/backups'",
        "Route::post('/ta3meed/backups/{id}/restore'",
    ]:
        if required not in text:
            raise RuntimeError(f'Ta3meed data-tools route missing: {required}')

    API_ROUTES.write_text(text, encoding='utf-8')


if __name__ == '__main__':
    patch_ta3meed()
    patch_app_shell()
    patch_api_routes()
    print('Ta3meed quick menu, Excel export, backup, and API routes applied and verified')
