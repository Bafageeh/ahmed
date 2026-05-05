from pathlib import Path
import re

app = Path('ahmed-mobile/App.js')
finance = Path('ahmed-mobile/FinanceSummaryScreen.js')
if not app.exists():
    raise SystemExit('ahmed-mobile/App.js not found')
if not finance.exists():
    raise SystemExit('ahmed-mobile/FinanceSummaryScreen.js not found')

text = app.read_text(encoding='utf-8')

# Sync MoneyMoon profits automatically when opening basic income.
if 'syncMoneyMoonProfits' not in text:
    marker = r"""  const loadItems = async () => {
    try {
      const response = await fetch(`${API_URL}/income/basic`);
      const json = await response.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage('تعذر تحميل بيانات الدخل');
    }
  };"""
    replacement = marker + r"""

  const syncMoneyMoonProfits = async () => {
    try {
      await fetch(`${API_URL}/income/linked/moneymoon/profits/sync`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      // لا نوقف شاشة الدخل إذا فشلت مزامنة أرباح موني مون.
    }
  };"""
    text = text.replace(marker, replacement, 1)

    text = text.replace(
        """  useEffect(() => {
    loadItems();
  }, []);""",
        """  useEffect(() => {
    const prepareIncome = async () => {
      await syncMoneyMoonProfits();
      await loadItems();
    };

    prepareIncome();
  }, []);""",
        1,
    )

# Allow delete button for linked income too (previous UI disabled linked items).
text = text.replace("if (item.readonly) {\n      setMessage('هذا دخل مرتبط ولا يمكن حذفه من هنا');\n      return;\n    }\n\n    setDeletingId(item.id);", "setDeletingId(item.id);")
text = text.replace("disabled={readonly || deleting}", "disabled={deleting}")
text = text.replace("readonly && styles.basicIncomeDeleteDisabled", "deleting && styles.basicIncomeDeleteDisabled")
text = text.replace("readonly && styles.basicIncomeDeleteTextDisabled", "deleting && styles.basicIncomeDeleteTextDisabled")

# Improve tag display for MoneyMoon income source if present.
if 'incomeSourceLabel' not in text:
    text = text.replace(
        "function BasicIncomeCard({ item, deleting, onDelete }) {\n  const readonly = Boolean(item.readonly);\n  const amount = Number(item.amount || 0);",
        "function BasicIncomeCard({ item, deleting, onDelete }) {\n  const readonly = Boolean(item.readonly);\n  const amount = Number(item.amount || 0);\n  const source = item.display_source || item.external_app_key || 'manual';\n  const incomeSourceLabel = source === 'moneymoon' ? 'موني مون' : source === 'finance' ? 'Finance' : readonly ? 'مرتبط' : 'يدوي';"
    )
    text = text.replace("{readonly ? 'مرتبط' : 'يدوي'}</Text>", "{incomeSourceLabel}</Text>")

app.write_text(text, encoding='utf-8')

f = finance.read_text(encoding='utf-8')

# Add helper to post individual finance cards to basic income.
if 'syncFinanceCardToIncome' not in f:
    f = f.replace(
        """  const syncSummary = async () => {
    setSyncing(true);
    setMessage('جاري مزامنة بيانات Finance...');""",
        """  const syncFinanceCardToIncome = async (item, group) => {
    setSyncing(true);
    setMessage('جاري إضافة البطاقة إلى الدخل الأساسي...');

    try {
      const response = await fetch(`${API_URL}/income/linked/finance/card/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          key: item.key,
          label: item.label,
          amount: Number(item.value || 0),
          group,
          currency,
          transaction_date: period.to || new Date().toISOString().slice(0, 10),
        }),
      });

      if (!response.ok) {
        throw new Error('sync card failed');
      }

      setMessage('تمت إضافة البطاقة إلى شاشة الدخل الأساسي');
    } catch (error) {
      setMessage('تعذر إضافة البطاقة إلى الدخل الأساسي');
    } finally {
      setSyncing(false);
    }
  };

  const syncSummary = async () => {
    setSyncing(true);
    setMessage('جاري مزامنة بيانات Finance...');"""
    )

# Pass handler into sections.
f = f.replace('<Section title="الدخل" data={summary.income} labelMap={labels.income} currency={currency} formatter={money} />', '<Section title="الدخل" data={summary.income} labelMap={labels.income} currency={currency} formatter={money} group="income" onAddIncome={syncFinanceCardToIncome} />')
f = f.replace('<Section title="المحفظة" data={summary.portfolio} labelMap={labels.portfolio} currency={currency} formatter={money} />', '<Section title="المحفظة" data={summary.portfolio} labelMap={labels.portfolio} currency={currency} formatter={money} group="portfolio" onAddIncome={syncFinanceCardToIncome} />')
f = f.replace('<Section title="التنبيهات" data={summary.alerts} labelMap={labels.alerts} currency={currency} formatter={money} danger />', '<Section title="التنبيهات" data={summary.alerts} labelMap={labels.alerts} currency={currency} formatter={money} group="alerts" onAddIncome={syncFinanceCardToIncome} danger />')

# Counts are not money income, so no add button.
f = f.replace('function Section({ title, data = {}, labelMap = {}, currency, formatter, danger }) {', 'function Section({ title, data = {}, labelMap = {}, currency, formatter, danger, group, onAddIncome }) {')

old_card = r"""          <View key={item.key} style={[styles.metricCard, danger && Number(item.value || 0) > 0 && styles.dangerCard]}>
            <Text style={[styles.metricValue, danger && Number(item.value || 0) > 0 && styles.dangerText]}>
              {formatter(item.value, currency)}
            </Text>
            <Text style={[styles.metricLabel, danger && Number(item.value || 0) > 0 && styles.dangerText]}>{item.label}</Text>
          </View>"""
new_card = r"""          <View key={item.key} style={[styles.metricCard, danger && Number(item.value || 0) > 0 && styles.dangerCard]}>
            <View style={styles.metricTopRow}>
              {onAddIncome && Number(item.value || 0) > 0 ? (
                <TouchableOpacity style={styles.metricAddButton} onPress={() => onAddIncome(item, group)} activeOpacity={0.85}>
                  <Text style={styles.metricAddText}>＋</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={[styles.metricValue, danger && Number(item.value || 0) > 0 && styles.dangerText]}>
                {formatter(item.value, currency)}
              </Text>
            </View>
            <Text style={[styles.metricLabel, danger && Number(item.value || 0) > 0 && styles.dangerText]}>{item.label}</Text>
          </View>"""
f = f.replace(old_card, new_card)

if 'metricAddButton' not in f:
    f = f.replace(
        "  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },",
        "  metricTopRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },\n  metricAddButton: { width: 31, height: 31, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#bae6fd' },\n  metricAddText: { color: '#0891b2', fontSize: 18, fontWeight: '900', marginTop: -1 },\n  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right', flex: 1 },"
    )

finance.write_text(f, encoding='utf-8')
print('Income linked sync UI patch applied')
