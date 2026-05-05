from pathlib import Path
import re

path = Path('ahmed-mobile/App.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/App.js not found')

text = path.read_text(encoding='utf-8')

# Inline edit form should be compact inside the card.
text = re.sub(
    r"onCancel=\{onCancelEdit\}\n\s*/>",
    "onCancel={onCancelEdit}\n          compactInline\n        />",
    text,
    count=1,
)

new_form = r'''function InvestmentSlideForm({
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
  compactInline = false,
}) {
  const title = editingId ? (compactInline ? 'تعديل سريع' : 'تعديل استثمار') : 'استثمار جديد';
  const hint = compactInline ? 'عدّل بيانات هذه البطاقة فقط' : 'أدخل بيانات استثمار موني مون الجديد';

  return (
    <View style={[styles.slideFormCard, compactInline && styles.inlineEditCard]}>
      {compactInline ? <View style={styles.inlineEditAccent} /> : null}

      <View style={styles.slideFormHeader}>
        <TouchableOpacity onPress={onCancel} style={[styles.closeSheetButton, compactInline && styles.inlineCloseButton]} activeOpacity={0.85}>
          <Text style={styles.closeSheetText}>×</Text>
        </TouchableOpacity>
        <View style={styles.slideFormTitleBlock}>
          <Text style={[styles.slideFormTitle, compactInline && styles.inlineEditTitle]}>{title}</Text>
          <Text style={styles.slideFormHint}>{hint}</Text>
        </View>
      </View>

      <View style={styles.inlineFieldsRow}>
        <View style={styles.inlineField}>
          <Text style={[styles.inputLabel, compactInline && styles.inlineInputLabel]}>المبلغ</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="1000"
            style={[styles.input, compactInline && styles.inlineInput]}
          />
        </View>
        <View style={styles.inlineField}>
          <Text style={[styles.inputLabel, compactInline && styles.inlineInputLabel]}>الفئة</Text>
          <View style={styles.categoryRow}>
            {['A', 'B', 'C', 'D'].map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.categoryButton, compactInline && styles.inlineCategoryButton, category === item && styles.categoryActive]}
              >
                <Text style={[styles.categoryText, compactInline && styles.inlineCategoryText, category === item && styles.categoryTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.profitBox, compactInline && styles.inlineProfitBox]}>
        <Text style={styles.profitTitle}>الربح المتوقع</Text>
        <Text style={[styles.profitValue, compactInline && styles.inlineProfitValue]}>{formExpectedProfit.toFixed(2)} ر.س</Text>
      </View>

      <View style={styles.inlineFieldsRow}>
        <View style={styles.inlineField}>
          <Text style={[styles.inputLabel, compactInline && styles.inlineInputLabel]}>تاريخ الاستثمار</Text>
          <TextInput
            value={investmentDate}
            onChangeText={setInvestmentDate}
            placeholder="YYYY-MM-DD"
            style={[styles.input, compactInline && styles.inlineInput]}
          />
        </View>
        <View style={styles.inlineField}>
          <Text style={[styles.inputLabel, compactInline && styles.inlineInputLabel]}>الاستحقاق</Text>
          <TextInput
            value={maturityDate}
            onChangeText={setMaturityDate}
            placeholder="YYYY-MM-DD"
            style={[styles.input, compactInline && styles.inlineInput]}
          />
        </View>
      </View>

      <Text style={[styles.inputLabel, compactInline && styles.inlineInputLabel]}>ملاحظات</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="اختياري"
        style={[styles.input, styles.notesInput, compactInline && styles.inlineNotesInput]}
        multiline
      />

      {!!message && <Text style={[styles.message, compactInline && styles.inlineMessage]}>{message}</Text>}

      <View style={styles.inlineFormActions}>
        <TouchableOpacity style={styles.inlineCancelButton} onPress={onCancel} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.inlineCancelText}>إلغاء</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineSaveButton} onPress={onSave} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.inlineSaveText}>{saving ? '...' : 'حفظ ✓'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

'''

text = re.sub(
    r"function InvestmentSlideForm\([\s\S]*?\nfunction MoneyMoonCard",
    new_form + "function MoneyMoonCard",
    text,
    count=1,
)

if 'inlineEditCard:' not in text:
    style_injection = """
  inlineEditCard: { marginTop: 10, marginBottom: 10, padding: 12, borderRadius: 20, borderColor: '#bae6fd', backgroundColor: '#f8feff', overflow: 'hidden' },
  inlineEditAccent: { position: 'absolute', top: 0, right: 0, left: 0, height: 4, backgroundColor: '#06b6d4' },
  inlineCloseButton: { width: 34, height: 34, borderRadius: 13 },
  inlineEditTitle: { fontSize: 17 },
  inlineFieldsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 2 },
  inlineField: { flex: 1 },
  inlineInputLabel: { marginTop: 7, marginBottom: 4, fontSize: 11, color: '#64748b' },
  inlineInput: { borderRadius: 13, paddingVertical: 9, paddingHorizontal: 10, fontSize: 13, backgroundColor: '#fff' },
  inlineCategoryButton: { borderRadius: 12, paddingVertical: 9 },
  inlineCategoryText: { fontSize: 12 },
  inlineProfitBox: { marginTop: 10, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  inlineProfitValue: { marginTop: 0, fontSize: 16 },
  inlineNotesInput: { minHeight: 44, borderRadius: 13, paddingVertical: 9, fontSize: 13 },
  inlineMessage: { marginTop: 8, fontSize: 12 },
  inlineFormActions: { marginTop: 10, flexDirection: 'row-reverse', gap: 8 },
  inlineSaveButton: { flex: 1.3, backgroundColor: '#0f172a', borderRadius: 15, paddingVertical: 12, alignItems: 'center' },
  inlineSaveText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  inlineCancelButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 15, paddingVertical: 12, alignItems: 'center' },
  inlineCancelText: { color: '#475569', fontWeight: '900', fontSize: 13 },
"""
    text = text.replace('const styles = StyleSheet.create({\n', 'const styles = StyleSheet.create({\n' + style_injection)

path.write_text(text, encoding='utf-8')
print('MoneyMoon compact inline edit patch applied')
