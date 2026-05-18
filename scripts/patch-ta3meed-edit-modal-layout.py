#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')

old_block = """              <TextInput style={styles.searchInput} value={opportunityForm.code} onChangeText={(v) => setOpportunityField('code', v)} placeholder=\"رقم الفرصة\" placeholderTextColor=\"#94a3b8\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.total_amount} onChangeText={(v) => setOpportunityField('total_amount', v)} placeholder=\"مبلغ الاستثمار\" placeholderTextColor=\"#94a3b8\" keyboardType=\"decimal-pad\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.profit} onChangeText={(v) => setOpportunityField('profit', v)} placeholder=\"الربح\" placeholderTextColor=\"#94a3b8\" keyboardType=\"decimal-pad\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.profit_rate} onChangeText={(v) => setOpportunityField('profit_rate', v)} placeholder=\"النسبة\" placeholderTextColor=\"#94a3b8\" keyboardType=\"decimal-pad\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.category} onChangeText={(v) => setOpportunityField('category', v)} placeholder=\"التصنيف\" placeholderTextColor=\"#94a3b8\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.months} onChangeText={(v) => setOpportunityField('months', v)} placeholder=\"الشهور\" placeholderTextColor=\"#94a3b8\" keyboardType=\"number-pad\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.start_date} onChangeText={(v) => setOpportunityField('start_date', v)} placeholder=\"تاريخ الاستثمار YYYY-MM-DD\" placeholderTextColor=\"#94a3b8\" textAlign=\"right\" />
              <TextInput style={styles.searchInput} value={opportunityForm.maturity_date} onChangeText={(v) => setOpportunityField('maturity_date', v)} placeholder=\"تاريخ الاستحقاق YYYY-MM-DD\" placeholderTextColor=\"#94a3b8\" textAlign=\"right\" />
              <TextInput style={[styles.searchInput, { minHeight: 86, textAlignVertical: 'top' }]} value={opportunityForm.allocations} onChangeText={(v) => setOpportunityField('allocations', v)} placeholder={'المستثمرين، كل سطر: الاسم المبلغ'} placeholderTextColor=\"#94a3b8\" multiline textAlign=\"right\" />
              <TextInput style={[styles.searchInput, { minHeight: 70, textAlignVertical: 'top' }]} value={opportunityForm.notes} onChangeText={(v) => setOpportunityField('notes', v)} placeholder=\"ملاحظات\" placeholderTextColor=\"#94a3b8\" multiline textAlign=\"right\" />
"""

new_block = """              <View style={styles.editFormSection}>
                <Text style={styles.editFormSectionTitle}>بيانات الفرصة</Text>
                <EditField label=\"رقم الفرصة\" value={opportunityForm.code} onChangeText={(v) => setOpportunityField('code', v)} placeholder=\"مثال: 123456\" />
                <EditField label=\"مبلغ الاستثمار\" value={opportunityForm.total_amount} onChangeText={(v) => setOpportunityField('total_amount', v)} placeholder=\"مبلغ الاستثمار\" keyboardType=\"decimal-pad\" />
                <EditField label=\"الربح\" value={opportunityForm.profit} onChangeText={(v) => setOpportunityField('profit', v)} placeholder=\"قيمة الربح\" keyboardType=\"decimal-pad\" />
                <EditField label=\"النسبة\" value={opportunityForm.profit_rate} onChangeText={(v) => setOpportunityField('profit_rate', v)} placeholder=\"نسبة الربح\" keyboardType=\"decimal-pad\" />
                <EditField label=\"التصنيف\" value={opportunityForm.category} onChangeText={(v) => setOpportunityField('category', v)} placeholder=\"A+ / A / B ...\" />
                <EditField label=\"عدد الشهور\" value={opportunityForm.months} onChangeText={(v) => setOpportunityField('months', v)} placeholder=\"مدة الفرصة بالشهور\" keyboardType=\"number-pad\" />
                <EditField label=\"تاريخ الاستثمار\" value={opportunityForm.start_date} onChangeText={(v) => setOpportunityField('start_date', v)} placeholder=\"YYYY-MM-DD\" />
                <EditField label=\"تاريخ الاستحقاق\" value={opportunityForm.maturity_date} onChangeText={(v) => setOpportunityField('maturity_date', v)} placeholder=\"YYYY-MM-DD\" />
                <EditField label=\"المستثمرون\" value={opportunityForm.allocations} onChangeText={(v) => setOpportunityField('allocations', v)} placeholder={'كل سطر: الاسم المبلغ'} multiline inputStyle={{ minHeight: 96, textAlignVertical: 'top' }} />
                <EditField label=\"ملاحظات\" value={opportunityForm.notes} onChangeText={(v) => setOpportunityField('notes', v)} placeholder=\"أي ملاحظات إضافية\" multiline inputStyle={{ minHeight: 78, textAlignVertical: 'top' }} />
              </View>
"""

if old_block not in text and '<EditField label="تاريخ الاستحقاق"' not in text:
    raise RuntimeError('Ta3meed edit modal fields block not found')

text = text.replace(old_block, new_block)

if 'function EditField(' not in text:
    marker = 'function CompactFilter({ label, value, onPress }) {'
    helper = """
function EditField({ label, value, onChangeText, placeholder, keyboardType, multiline, inputStyle }) {
  return (
    <View style={styles.editFieldBox}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={[styles.editFieldInput, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlign="right"
      />
    </View>
  );
}

"""
    if marker not in text:
        raise RuntimeError('CompactFilter marker not found')
    text = text.replace(marker, helper + marker, 1)

style_marker = '  safe: { flex: 1, backgroundColor: \'#f4f7fb\' },'
style_block = """  editFormSection: { marginTop: 6, gap: 10, paddingBottom: 8 },
  editFormSectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right', marginBottom: 2 },
  editFieldBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 10 },
  editFieldLabel: { color: '#334155', fontSize: 12, fontWeight: '900', textAlign: 'right', marginBottom: 7 },
  editFieldInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, color: '#0f172a', fontWeight: '900', fontSize: 13, textAlign: 'right' },
"""

if 'editFieldBox:' not in text:
    if style_marker not in text:
        raise RuntimeError('style marker not found')
    text = text.replace(style_marker, style_block + style_marker, 1)

if '<EditField label="تاريخ الاستحقاق"' not in text:
    raise RuntimeError('maturity date field missing')

path.write_text(text, encoding='utf-8')
print('Ta3meed edit modal layout patched')
