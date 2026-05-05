from pathlib import Path
import re

path = Path('ahmed-mobile/App.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/App.js not found')

text = path.read_text(encoding='utf-8')

start = text.index('function BasicIncomeScreen')
end = text.index('function MoneyMoonScreen', start)

new_basic = r'''function BasicIncomeScreen({ onBack }) {
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeType, setIncomeType] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const totalIncome = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount || 0), 0), [items]);
  const manualItems = useMemo(() => items.filter((item) => !item.readonly), [items]);

  const loadItems = async () => {
    try {
      const response = await fetch(`${API_URL}/income/basic`);
      const json = await response.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage('تعذر تحميل بيانات الدخل');
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetIncomeForm = () => {
    setIncomeType('');
    setAmount('');
    setNotes('');
  };

  const openIncomeForm = () => {
    resetIncomeForm();
    setMessage('');
    setShowIncomeForm(true);
  };

  const closeIncomeForm = () => {
    resetIncomeForm();
    setShowIncomeForm(false);
  };

  const saveIncome = async () => {
    if (!incomeType.trim()) return setMessage('ادخل نوع الدخل');
    if (!amount || Number(amount) <= 0) return setMessage('ادخل المبلغ بشكل صحيح');

    setSaving(true);
    setMessage('جاري الحفظ...');

    try {
      const response = await fetch(`${API_URL}/income/basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ income_type: incomeType.trim(), amount: Number(amount), notes: notes || null }),
      });

      if (!response.ok) throw new Error('save failed');

      closeIncomeForm();
      setMessage('تم حفظ الدخل الأساسي');
      await loadItems();
    } catch (error) {
      setMessage('تعذر حفظ الدخل');
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = async (item) => {
    if (item.readonly) {
      setMessage('هذا دخل مرتبط ولا يمكن حذفه من هنا');
      return;
    }

    setDeletingId(item.id);
    setMessage('جاري حذف الدخل...');

    try {
      const response = await fetch(`${API_URL}/income/basic/${item.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error('delete failed');

      setItems((current) => current.filter((income) => income.id !== item.id));
      setMessage('تم حذف الدخل الأساسي');
      await loadItems();
    } catch (error) {
      setMessage('تعذر حذف الدخل');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteIncome = (item) => {
    Alert.alert(
      'حذف الدخل',
      'هل تريد حذف هذا الدخل الأساسي؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => deleteIncome(item) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.fixedTopBar}>
        <TouchableOpacity style={styles.topBackButton} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.topBackText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topTitleBlock}>
          <Text style={styles.topTitle}>الدخل الأساسي</Text>
          <Text style={styles.topSubtitle}>مصادر الدخل اليدوية والمرتبطة</Text>
        </View>
        <TouchableOpacity style={styles.topAddButton} onPress={openIncomeForm} activeOpacity={0.85}>
          <Text style={styles.topAddText}>＋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.moneyMoonContainer}>
        {showIncomeForm ? (
          <View style={styles.incomeAddSheet}>
            <View style={styles.slideFormHeader}>
              <TouchableOpacity onPress={closeIncomeForm} style={styles.closeSheetButton} activeOpacity={0.85}>
                <Text style={styles.closeSheetText}>×</Text>
              </TouchableOpacity>
              <View style={styles.slideFormTitleBlock}>
                <Text style={styles.slideFormTitle}>إضافة دخل جديد</Text>
                <Text style={styles.slideFormHint}>سجل مصدر دخل أساسي مختصر</Text>
              </View>
            </View>

            <View style={styles.inlineFieldsRow}>
              <View style={styles.inlineField}>
                <Text style={styles.inlineInputLabel}>نوع الدخل</Text>
                <TextInput value={incomeType} onChangeText={setIncomeType} placeholder="راتب، إيجار..." style={styles.inlineInput} />
              </View>
              <View style={styles.inlineField}>
                <Text style={styles.inlineInputLabel}>المبلغ</Text>
                <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5000" style={styles.inlineInput} />
              </View>
            </View>

            <Text style={styles.inlineInputLabel}>ملاحظات</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="اختياري" style={[styles.inlineInput, styles.inlineNotesInput]} multiline />

            {!!message && <Text style={styles.inlineMessage}>{message}</Text>}
            <View style={styles.inlineFormActions}>
              <TouchableOpacity style={styles.inlineCancelButton} onPress={closeIncomeForm} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.inlineCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inlineSaveButton} onPress={saveIncome} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.inlineSaveText}>{saving ? '...' : 'حفظ ✓'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.incomeHeroCard}>
          <View style={styles.incomeHeroTop}>
            <View style={styles.incomeHeroIcon}><Text style={styles.incomeHeroIconText}>↗</Text></View>
            <View style={styles.incomeHeroTextBlock}>
              <Text style={styles.incomeHeroTitle}>الدخل الأساسي</Text>
              <Text style={styles.incomeHeroSub}>تصميم مختصر لإظهار أكبر عدد من مصادر الدخل</Text>
            </View>
          </View>
          <View style={styles.incomeHeroStats}>
            <View style={styles.incomeHeroStat}><Text style={styles.incomeHeroValue}>{Number(totalIncome || 0).toLocaleString('en-US')}</Text><Text style={styles.incomeHeroLabel}>الإجمالي</Text></View>
            <View style={styles.incomeHeroStat}><Text style={styles.incomeHeroValue}>{items.length}</Text><Text style={styles.incomeHeroLabel}>كل السجلات</Text></View>
            <View style={styles.incomeHeroStat}><Text style={styles.incomeHeroValue}>{manualItems.length}</Text><Text style={styles.incomeHeroLabel}>يدوي</Text></View>
          </View>
        </View>

        {!!message && !showIncomeForm ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.sectionTitle}>سجلات الدخل</Text>
        {items.length === 0 ? (
          <View style={styles.platformCard}>
            <Text style={styles.platformName}>لا يوجد دخل مسجل</Text>
            <Text style={styles.platformText}>اضغط زر + في الشريط العلوي لإضافة أول دخل.</Text>
          </View>
        ) : items.map((item) => (
          <BasicIncomeCard
            key={String(item.id)}
            item={item}
            deleting={deletingId === item.id}
            onDelete={() => confirmDeleteIncome(item)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function BasicIncomeCard({ item, deleting, onDelete }) {
  const readonly = Boolean(item.readonly);
  const amount = Number(item.amount || 0);

  return (
    <View style={[styles.basicIncomeCard, readonly && styles.basicIncomeLinkedCard]}>
      <View style={styles.basicIncomeMainRow}>
        <View style={styles.basicIncomeAmountBlock}>
          <Text style={styles.basicIncomeAmount}>{amount.toLocaleString('en-US')}</Text>
          <Text style={styles.basicIncomeCurrency}>ر.س</Text>
        </View>
        <View style={styles.basicIncomeInfo}>
          <Text style={styles.basicIncomeName} numberOfLines={1}>{item.income_type || 'دخل'}</Text>
          <View style={styles.basicIncomeMetaRow}>
            <Text style={[styles.basicIncomeTag, readonly && styles.basicIncomeLinkedTag]}>{readonly ? 'مرتبط' : 'يدوي'}</Text>
            <Text style={styles.basicIncomeDate}>{item.transaction_date || '-'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.basicIncomeDeleteButton, readonly && styles.basicIncomeDeleteDisabled]}
          onPress={onDelete}
          disabled={readonly || deleting}
          activeOpacity={0.85}
        >
          <Text style={[styles.basicIncomeDeleteText, readonly && styles.basicIncomeDeleteTextDisabled]}>{deleting ? '…' : '⌫'}</Text>
        </TouchableOpacity>
      </View>
      {item.description ? <Text style={styles.basicIncomeNote} numberOfLines={1}>{item.description}</Text> : null}
    </View>
  );
}

'''

text = text[:start] + new_basic + text[end:]

if 'basicIncomeCard:' not in text:
    style_injection = """
  incomeAddSheet: { marginTop: 12, backgroundColor: '#fff', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#bae6fd' },
  incomeHeroCard: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 24, padding: 16, overflow: 'hidden' },
  incomeHeroTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  incomeHeroIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#06b6d4', alignItems: 'center', justifyContent: 'center' },
  incomeHeroIconText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  incomeHeroTextBlock: { flex: 1, alignItems: 'flex-end' },
  incomeHeroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  incomeHeroSub: { color: '#cbd5e1', fontSize: 12, marginTop: 3, textAlign: 'right' },
  incomeHeroStats: { marginTop: 14, flexDirection: 'row-reverse', gap: 8 },
  incomeHeroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 10, alignItems: 'flex-end' },
  incomeHeroValue: { color: '#67e8f9', fontSize: 17, fontWeight: '900' },
  incomeHeroLabel: { color: '#e2e8f0', fontSize: 10, fontWeight: '800', marginTop: 2 },
  basicIncomeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 10, marginBottom: 7, borderWidth: 1, borderColor: '#e2e8f0' },
  basicIncomeLinkedCard: { backgroundColor: '#f8fafc', borderColor: '#dbeafe' },
  basicIncomeMainRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  basicIncomeAmountBlock: { minWidth: 82, alignItems: 'flex-start' },
  basicIncomeAmount: { color: '#06b6d4', fontSize: 18, fontWeight: '900' },
  basicIncomeCurrency: { color: '#64748b', fontSize: 10, fontWeight: '800', marginTop: -1 },
  basicIncomeInfo: { flex: 1, alignItems: 'flex-end' },
  basicIncomeName: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  basicIncomeMetaRow: { marginTop: 5, flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  basicIncomeTag: { backgroundColor: '#ecfeff', color: '#0891b2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  basicIncomeLinkedTag: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  basicIncomeDate: { color: '#94a3b8', fontSize: 11, fontWeight: '800' },
  basicIncomeDeleteButton: { width: 36, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3' },
  basicIncomeDeleteDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  basicIncomeDeleteText: { color: '#be123c', fontSize: 18, fontWeight: '900' },
  basicIncomeDeleteTextDisabled: { color: '#cbd5e1' },
  basicIncomeNote: { marginTop: 6, color: '#64748b', fontSize: 11, textAlign: 'right' },
"""
    text = text.replace('const styles = StyleSheet.create({\n', 'const styles = StyleSheet.create({\n' + style_injection)

path.write_text(text, encoding='utf-8')
print('Basic income compact add/delete UI patch applied')
