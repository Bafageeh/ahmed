from pathlib import Path
import re
import subprocess

BASE_COMMIT = "0714d6234595db37fb452a1ba38cea394c1b1e21"
TARGET = "ahmed-mobile/AppShell.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"لم يتم العثور على الجزء المطلوب: {label}")
    return text.replace(old, new, 1)


base = subprocess.check_output(
    ["git", "show", f"{BASE_COMMIT}:{TARGET}"],
    text=True,
)
text = base

text = replace_once(
    text,
    "import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';",
    "import { Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';",
    "استيراد RefreshControl",
)

text = replace_once(
    text,
    "function ScreenWrap({ children }) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>; }",
    "function ScreenWrap({ children, refreshControl }) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>{children}</ScrollView></SafeAreaView>; }",
    "دعم السحب للتحديث",
)

finance_screen = r'''function FinanceImportsScreen({ onBack }) {
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

function FutureMonthlyIncomeScreen'''

text, count = re.subn(
    r"function FinanceImportsScreen\(\{ onBack \}\) \{.*?\n\}\n\nfunction FutureMonthlyIncomeScreen",
    finance_screen,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("تعذر استبدال شاشة قيم Finance")

text = replace_once(
    text,
    "  const [comMonthlyPersonNet, setComMonthlyPersonNet] = useState(0);\n  const [menuId, setMenuId] = useState(null);",
    "  const [comMonthlyPersonNet, setComMonthlyPersonNet] = useState(0);\n  const [refreshing, setRefreshing] = useState(false);\n  const [menuId, setMenuId] = useState(null);",
    "حالة تحديث الدخل المستقبلي",
)

text = replace_once(
    text,
    "  useEffect(() => { loadIncomes(); loadMoneyMoonIncome(); loadTa3meedIncome(); loadDinarIncome(); loadFinanceNetProfitAfterStuckDeduction(); }, []);",
    """  const reloadAll = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      await Promise.all([
        loadIncomes(),
        loadMoneyMoonIncome(),
        loadTa3meedIncome(),
        loadDinarIncome(),
        loadFinanceNetProfitAfterStuckDeduction(),
      ]);
    } finally {
      if (showRefreshing) setRefreshing(false);
    }
  };
  useEffect(() => { reloadAll(); }, []);""",
    "تحديث الدخل المستقبلي بالسحب",
)

text = replace_once(
    text,
    "  return <View style={styles.fullScreenHost}><ScreenWrap><TopBar title=\"#S-121 دخل شهري مستقبلي\"",
    "  return <View style={styles.fullScreenHost}><ScreenWrap refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reloadAll(true)} tintColor=\"#0f766e\" colors={['#0f766e']} />}><TopBar title=\"#S-121 دخل شهري مستقبلي\"",
    "ربط السحب بالتحديث في الدخل المستقبلي",
)

translation_helpers = r'''function financeSectionLabel(key) {
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
  const key = String(path || '').split('.').pop().replace(/\[\d+\]/g, '');
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
function formatFinanceValue'''

text, count = re.subn(
    r"function financeSectionLabel\(key\).*?function formatFinanceValue",
    translation_helpers,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("تعذر تحديث ترجمات حقول Finance")

required_fragments = [
    "const [refreshing, setRefreshing] = useState(false);",
    "onRefresh={() => loadSummary(true)}",
    "source_account: 'حساب المصدر'",
    "<TopBar title=\"#S-123 قيم Finance\" onBack={onBack} />",
    "onRefresh={() => reloadAll(true)}",
]
for fragment in required_fragments:
    if fragment not in text:
        raise RuntimeError(f"فشل التحقق من التعديل: {fragment}")

if "right={<TouchableOpacity style={styles.refreshButton}" in text:
    raise RuntimeError("زر التحديث ما زال موجودًا")
if "colors={[\\" in text:
    raise RuntimeError("تم اكتشاف سطر RefreshControl تالف")

Path(TARGET).write_text(text, encoding="utf-8")
print("تم تحديث AppShell.js بنجاح")
