from pathlib import Path
import re

path = Path('ahmed-mobile/App.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/App.js not found')

text = path.read_text(encoding='utf-8')

if 'const isStuck =' not in text:
    text = text.replace(
        "const isReceived = (item) => item.status === 'received' || item.status === 'completed';\nconst isOverdue = (item) => Boolean(item.maturity_date && item.maturity_date < today() && !isReceived(item));",
        "const isReceived = (item) => item.status === 'received' || item.status === 'completed';\nconst isStuck = (item) => {\n  const meta = safeJson(item?.metadata);\n  return item?.status === 'stuck' || meta?.display_state === 'stuck' || meta?.is_stuck === true;\n};\nconst isOverdue = (item) => Boolean(item?.maturity_date && item.maturity_date < today() && !isReceived(item));"
    )

start = text.index('function MoneyMoonScreen')
card_start = text.index('function MoneyMoonCard', start)
section = text[start:card_start]

if 'showInvestmentForm' not in section:
    section = section.replace(
        "  const [editingId, setEditingId] = useState(null);",
        "  const [showInvestmentForm, setShowInvestmentForm] = useState(false);\n  const [editingId, setEditingId] = useState(null);"
    )
    section = section.replace(
        "  const overdueCount = useMemo(() => items.filter((item) => isOverdue(item)).length, [items]);\n  const formExpectedProfit = calcProfit(amount, category);",
        "  const overdueCount = useMemo(() => items.filter((item) => isOverdue(item)).length, [items]);\n  const stuckCount = useMemo(() => items.filter((item) => isStuck(item)).length, [items]);\n  const formExpectedProfit = calcProfit(amount, category);"
    )

old_reset = """  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setCategory('A');
    setInvestmentDate(today());
    setMaturityDate('');
    setNotes('');
  };"""
new_reset = old_reset + """

  const openAddForm = () => {
    resetForm();
    setMessage('');
    setShowInvestmentForm(true);
  };

  const closeForm = () => {
    resetForm();
    setShowInvestmentForm(false);
  };"""
if 'const openAddForm' not in section:
    section = section.replace(old_reset, new_reset)

section = section.replace(
    "    setMessage('تم فتح البطاقة للتعديل');",
    "    setShowInvestmentForm(true);\n    setMessage('تم فتح البطاقة للتعديل');"
)
section = section.replace(
    "      resetForm();\n      setMessage(editingId ? 'تم تعديل بطاقة موني مون' : 'تم حفظ استثمار موني مون');",
    "      resetForm();\n      setShowInvestmentForm(false);\n      setMessage(editingId ? 'تم تعديل بطاقة موني مون' : 'تم حفظ استثمار موني مون');"
)
section = section.replace("if (editingId === item.id) resetForm();", "if (editingId === item.id) closeForm();")

old_return = """  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.header}>"""
new_return = """  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.fixedTopBar}>
        <TouchableOpacity style={styles.topBackButton} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.topBackText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topTitleBlock}>
          <Text style={styles.topTitle}>موني مون</Text>
          <Text style={styles.topSubtitle}>استثماراتك حسب الاستحقاق</Text>
        </View>
        <TouchableOpacity style={styles.topAddButton} onPress={openAddForm} activeOpacity={0.85}>
          <Text style={styles.topAddText}>＋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.moneyMoonContainer}>
        {showInvestmentForm ? (
          <InvestmentSlideForm
            editingId={editingId}
            amount={amount}
            setAmount={setAmount}
            category={category}
            setCategory={setCategory}
            investmentDate={investmentDate}
            setInvestmentDate={setInvestmentDate}
            maturityDate={maturityDate}
            setMaturityDate={setMaturityDate}
            notes={notes}
            setNotes={setNotes}
            formExpectedProfit={formExpectedProfit}
            message={message}
            saving={saving}
            onSave={saveInvestment}
            onCancel={closeForm}
          />
        ) : null}

        <View style={styles.header}>"""
section = section.replace(old_return, new_return)

section = re.sub(
    r"\n        <View style=\{styles\.formCard\}>\n          <Text style=\{styles\.formTitle\}>\{editingId \? 'تعديل بطاقة استثمار' : 'إضافة استثمار جديد'\}</Text>.*?\n        </View>\n\n        <Text style=\{styles\.sectionTitle\}>استثمارات موني مون</Text>",
    "\n        <Text style={styles.sectionTitle}>استثمارات موني مون</Text>",
    section,
    flags=re.S,
)
section = section.replace(
    "أضف أول استثمار من النموذج بالأعلى.",
    "اضغط زر + في الشريط العلوي لإضافة أول استثمار."
)
section = section.replace(
    "          <View style={[styles.summaryCard, overdueCount > 0 && styles.overdueSummary]}><Text style={[styles.summaryValue, overdueCount > 0 && styles.overdueText]}>{overdueCount}</Text><Text style={[styles.summaryLabel, overdueCount > 0 && styles.overdueText]}>متأخر غير مستلم</Text></View>",
    "          <View style={[styles.summaryCard, overdueCount > 0 && styles.overdueSummary]}><Text style={[styles.summaryValue, overdueCount > 0 && styles.overdueText]}>{overdueCount}</Text><Text style={[styles.summaryLabel, overdueCount > 0 && styles.overdueText]}>استحقاق ماضي</Text></View>\n          <View style={[styles.summaryCard, stuckCount > 0 && styles.stuckSummary]}><Text style={[styles.summaryValue, stuckCount > 0 && styles.stuckText]}>{stuckCount}</Text><Text style={[styles.summaryLabel, stuckCount > 0 && styles.stuckText]}>متعثر</Text></View>"
)

text = text[:start] + section + text[card_start:]

if 'function InvestmentSlideForm' not in text:
    form_component = r'''
function InvestmentSlideForm({
  editingId,
  amount,
  setAmount,
  category,
  setCategory,
  investmentDate,
  setInvestmentDate,
  maturityDate,
  setMaturityDate,
  notes,
  setNotes,
  formExpectedProfit,
  message,
  saving,
  onSave,
  onCancel,
}) {
  return (
    <View style={styles.slideFormCard}>
      <View style={styles.slideFormHeader}>
        <TouchableOpacity onPress={onCancel} style={styles.closeSheetButton} activeOpacity={0.85}>
          <Text style={styles.closeSheetText}>×</Text>
        </TouchableOpacity>
        <View style={styles.slideFormTitleBlock}>
          <Text style={styles.slideFormTitle}>{editingId ? 'تعديل استثمار' : 'استثمار جديد'}</Text>
          <Text style={styles.slideFormHint}>النموذج المنسدل لإضافة أو تعديل موني مون</Text>
        </View>
      </View>

      <Text style={styles.inputLabel}>المبلغ المستثمر</Text>
      <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="مثال: 1000" style={styles.input} />

      <Text style={styles.inputLabel}>الفئة</Text>
      <View style={styles.categoryRow}>
        {['A', 'B', 'C', 'D'].map((item) => (
          <TouchableOpacity key={item} onPress={() => setCategory(item)} style={[styles.categoryButton, category === item && styles.categoryActive]}>
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
            <Text style={[styles.categoryRate, category === item && styles.categoryTextActive]}>{categoryProfit(item)}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.profitBox}>
        <Text style={styles.profitTitle}>الربح المتوقع</Text>
        <Text style={styles.profitValue}>{formExpectedProfit.toFixed(2)} ر.س</Text>
      </View>

      <Text style={styles.inputLabel}>تاريخ الاستثمار</Text>
      <TextInput value={investmentDate} onChangeText={setInvestmentDate} placeholder="YYYY-MM-DD" style={styles.input} />

      <Text style={styles.inputLabel}>تاريخ الاستحقاق</Text>
      <TextInput value={maturityDate} onChangeText={setMaturityDate} placeholder="اتركه فارغًا ليكون بعد شهر عند الإضافة" style={styles.input} />

      <Text style={styles.inputLabel}>ملاحظات</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="اختياري" style={[styles.input, styles.notesInput]} multiline />

      {!!message && <Text style={styles.message}>{message}</Text>}
      <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديل' : 'حفظ الاستثمار'}</Text>
      </TouchableOpacity>
    </View>
  );
}

'''
    text = text.replace('function MoneyMoonCard', form_component + 'function MoneyMoonCard')

text = text.replace(
    "  const overdue = isOverdue(item);\n  const statusText = received ? 'مستلم' : overdue ? 'متأخر' : 'نشط';",
    "  const overdue = isOverdue(item);\n  const stuck = isStuck(item);\n  const statusText = received ? 'مستلم' : stuck ? 'متعثر' : overdue ? 'متأخر' : 'نشط';"
)
text = text.replace(
    "<View style={[styles.moneyMoonCard, overdue && styles.moneyMoonOverdueCard, received && styles.moneyMoonReceivedCard]}",
    "<View style={[styles.moneyMoonCard, overdue && styles.moneyMoonOverdueCard, stuck && styles.moneyMoonStuckCard, received && styles.moneyMoonReceivedCard]}"
)
text = text.replace(
    "styles.statusMiniBadge, overdue && styles.statusOverdueBadge, received && styles.statusReceivedBadge",
    "styles.statusMiniBadge, overdue && styles.statusOverdueBadge, stuck && styles.statusStuckBadge, received && styles.statusReceivedBadge"
)
text = text.replace(
    "<Text style={styles.moneyMoonAmount}>{Number(item.principal_amount || 0).toLocaleString('en-US')}</Text>",
    "<Text style={[styles.moneyMoonAmount, (overdue || stuck) && styles.moneyMoonDangerAmount]}>{Number(item.principal_amount || 0).toLocaleString('en-US')}</Text>"
)

if 'fixedTopBar:' not in text:
    style_injection = """
  moneyMoonContainer: { padding: 14, paddingBottom: 36 },
  fixedTopBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  topBackButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  topBackText: { color: '#0f172a', fontSize: 31, fontWeight: '900', marginTop: -2 },
  topTitleBlock: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  topSubtitle: { marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: '700' },
  topAddButton: { width: 46, height: 42, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06b6d4' },
  topAddText: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: -2 },
  slideFormCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#bae6fd' },
  slideFormHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  slideFormTitleBlock: { alignItems: 'flex-end', flex: 1 },
  slideFormTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  slideFormHint: { marginTop: 3, color: '#64748b', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  closeSheetButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  closeSheetText: { color: '#0f172a', fontSize: 25, fontWeight: '900', marginTop: -2 },
  stuckSummary: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  stuckText: { color: '#991b1b' },
  moneyMoonStuckCard: { backgroundColor: '#fff1f2', borderColor: '#fb7185' },
  statusStuckBadge: { backgroundColor: '#fb7185', color: '#fff' },
  moneyMoonDangerAmount: { color: '#e11d48' },
"""
    text = text.replace('const styles = StyleSheet.create({\n', 'const styles = StyleSheet.create({\n' + style_injection)

path.write_text(text, encoding='utf-8')
print('MoneyMoon top bar patch applied')
