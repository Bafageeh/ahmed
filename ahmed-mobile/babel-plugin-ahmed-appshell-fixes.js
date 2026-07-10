'use strict';

module.exports = function ahmedAppShellFixes() {
  return {
    name: 'ahmed-appshell-fixes',
    parserOverride(code, parserOptions, parse) {
      if (!code.includes('function FinanceImportsScreen') || !code.includes('#S-123')) {
        return parse(code, parserOptions);
      }

      let source = code;

      source = source.replace(
        "import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';",
        "import { Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';",
      );

      source = source.replace(
        "function ScreenWrap({ children }) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>; }",
        "function ScreenWrap({ children, refreshControl }) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>{children}</ScrollView></SafeAreaView>; }",
      );

      // Repair the previously malformed pull-to-refresh line in S-121 before parsing AppShell.
      source = source.replace(
        "colors={[\\ onBack={() => goTo('accounts')}",
        "colors={['#0f766e']} />}><TopBar title=\"#S-121 دخل شهري مستقبلي\" onBack={() => goTo('accounts')}",
      );

      const financeScreen = `function FinanceImportsScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await fetch(FINANCE_SUMMARY_URL, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'finance fetch failed');
      setSummary(json.data || json);
    } catch {
      setError('تعذر جلب بيانات Finance.');
      if (!showRefreshing) setSummary(null);
    } finally {
      if (showRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);

  const data = summary || {};
  const sections = buildFinanceSections(data);
  const syncedAt = data.synced_at || data.syncedAt || data.updated_at || data.generated_at || '';
  const sourceName = data.source || 'Finance';
  const sourceAccount = data.source_account || 'admin@pm.sa';

  return <ScreenWrap refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSummary(true)} tintColor="#0f766e" colors={['#0f766e']} />}>
    <TopBar title="#S-123 قيم Finance" onBack={onBack} />
    <Header badge="Finance" title="#S-123 القيم المستوردة" subtitle="جميع القيم المقروءة مباشرة من مشروع Finance بدون إدخال يدوي." icon="stats" />
    <View style={styles.financeSourceCard}>
      <Text style={styles.financeSourceTitle}>المصدر</Text>
      <Text style={styles.financeSourceText}>{sourceName} • {sourceAccount}</Text>
      {syncedAt ? <Text style={styles.financeSourceMuted}>آخر مزامنة: {formatFinanceValue('synced_at', syncedAt)}</Text> : null}
    </View>
    {loading ? <Text style={styles.emptyIncomeText}>جاري تحميل قيم Finance...</Text> : null}
    {!!error ? <Text style={styles.financeErrorText}>{error}</Text> : null}
    {!loading && !error && sections.length === 0 ? <Text style={styles.emptyIncomeText}>لا توجد قيم مستوردة من Finance حاليًا.</Text> : null}
    {!loading && !error ? sections.map((section) => <View key={section.key} style={styles.financeSectionCard}>
      <Text style={styles.financeSectionTitle}>{financeSectionLabel(section.key)}</Text>
      {section.items.map((item) => <View key={item.path} style={styles.financeValueRow}>
        <View style={styles.financeValueTextBlock}>
          <Text style={styles.financeValueLabel}>{financeLabel(item.path)}</Text>
        </View>
        <Text style={styles.financeValueAmount}>{formatFinanceValue(item.path, item.value)}</Text>
      </View>)}
    </View>) : null}
  </ScreenWrap>;
}

function FutureMonthlyIncomeScreen`;

      source = source.replace(
        /function FinanceImportsScreen\(\{ onBack \}\) \{[\s\S]*?\n\}\n\nfunction FutureMonthlyIncomeScreen/,
        financeScreen,
      );

      const financeTranslations = `function financeSectionLabel(key) {
  const labels = {
    source: 'المصدر',
    source_account: 'حساب المصدر',
    income: 'الدخل',
    portfolio: 'المحفظة',
    counts: 'الأعداد',
    alerts: 'التنبيهات',
    account: 'الحساب',
    meta: 'معلومات المزامنة',
  };
  return labels[key] || arabizeFinanceKey(key);
}
function financeLabel(path) {
  const labels = {
    source: 'المصدر',
    source_account: 'حساب المصدر',
    'income.monthly_installments_total': 'إجمالي الأقساط الشهرية',
    'income.ahmed_monthly_profit': 'ربح أحمد الشهري',
    'income.ahmed_monthly_net_profit_after_stuck_deduction': 'ربح أحمد الشهري الصافي بعد خصم المتعثرين',
    'portfolio.ahmed_monthly_net_profit_after_stuck_deduction': 'ربح أحمد الشهري الصافي بعد خصم المتعثرين',
    ahmed_monthly_net_profit_after_stuck_deduction: 'ربح أحمد الشهري الصافي بعد خصم المتعثرين',
    'income.remaining_installments_total': 'إجمالي الأقساط المتبقية',
    'portfolio.remaining_installments_total': 'إجمالي الأقساط المتبقية',
    'portfolio.remaining_principal_total': 'رأس المال المتبقي',
    'portfolio.ahmed_total_profit': 'إجمالي ربح أحمد',
    'portfolio.ahmed_net_profit_after_stuck_deduction': 'صافي ربح أحمد بعد خصم المتعثرين',
    'portfolio.active_monthly_installments': 'القسط الشهري النشط',
    'counts.active_clients': 'العملاء النشطون',
    'counts.overdue_clients': 'العملاء المتأخرون',
    'counts.stuck_clients': 'العملاء المتعثرون',
    'counts.legal_clients': 'عملاء القضايا',
    synced_at: 'وقت آخر مزامنة',
    updated_at: 'وقت آخر تحديث',
    generated_at: 'وقت إنشاء البيانات',
  };
  return labels[path] || arabizeFinanceKey(path);
}
function arabizeFinanceKey(path) {
  const key = String(path || '').split('.').pop().replace(/\\[\\d+\\]/g, '');
  const direct = {
    source: 'المصدر',
    source_account: 'حساب المصدر',
    account_id: 'رقم الحساب',
    account_name: 'اسم الحساب',
    account_email: 'البريد الإلكتروني للحساب',
    user_id: 'رقم المستخدم',
    user_name: 'اسم المستخدم',
    username: 'اسم الدخول',
    status: 'الحالة',
    synced_at: 'وقت آخر مزامنة',
    updated_at: 'وقت آخر تحديث',
    generated_at: 'وقت إنشاء البيانات',
  };
  if (direct[key]) return direct[key];

  const words = {
    source: 'المصدر', account: 'الحساب', user: 'المستخدم', id: 'الرقم', name: 'الاسم', email: 'البريد الإلكتروني', username: 'اسم الدخول',
    income: 'الدخل', portfolio: 'المحفظة', count: 'العدد', counts: 'الأعداد', alert: 'التنبيه', alerts: 'التنبيهات', meta: 'المعلومات',
    monthly: 'الشهري', installment: 'القسط', installments: 'الأقساط', total: 'الإجمالي', remaining: 'المتبقي', principal: 'رأس المال',
    profit: 'الربح', net: 'الصافي', after: 'بعد', stuck: 'المتعثرين', deduction: 'الخصم', active: 'النشط', overdue: 'المتأخر',
    legal: 'القضايا', clients: 'العملاء', client: 'العميل', amount: 'المبلغ', balance: 'الرصيد', payment: 'الدفعة', payments: 'الدفعات',
    capital: 'رأس المال', ahmed: 'أحمد', status: 'الحالة', synced: 'المزامنة', updated: 'التحديث', generated: 'الإنشاء', at: 'الوقت',
  };

  return key.split('_').map((word) => words[word] || word).join(' ');
}
function formatFinanceValue`;

      source = source.replace(
        /function financeSectionLabel\(key\)[\s\S]*?function formatFinanceValue/,
        financeTranslations,
      );

      return parse(source, parserOptions);
    },
  };
};
