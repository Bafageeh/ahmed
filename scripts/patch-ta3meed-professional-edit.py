from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPACT = ROOT / 'ahmed-mobile' / 'Ta3meedCompactFiltersScreen.js'
WRAPPER = ROOT / 'ahmed-mobile' / 'Ta3meedNoResetFilterScreen.js'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# Route the edit pencil from the legacy modal to the professional wrapper modal.
compact = COMPACT.read_text(encoding='utf-8')
original_compact = compact
compact = replace_once(
    compact,
    'export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore }) {',
    'export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore, onEditOpportunity }) {',
    'compact props',
)
compact = replace_once(
    compact,
    'onEdit={openOpportunityEdit}',
    'onEdit={onEditOpportunity || openOpportunityEdit}',
    'card edit callback',
)
if compact != original_compact:
    COMPACT.write_text(compact, encoding='utf-8')


wrapper = WRAPPER.read_text(encoding='utf-8')
original_wrapper = wrapper
wrapper = replace_once(
    wrapper,
    "import React, { useMemo, useState } from 'react';",
    "import React, { useEffect, useMemo, useState } from 'react';",
    'useEffect import',
)

edit_component = r'''
function editOpportunityForm(item) {
  const meta = metaOf(item || {});
  const category = categoryOf(item || {});
  return {
    code: String(item?.reference_number || item?.code || ''),
    total_amount: String(n(item?.principal_amount) || ''),
    profit: String(n(item?.expected_profit_amount) || ''),
    profit_rate: String(n(item?.expected_rate) || n(item?.registered_annual_profit_rate) || ''),
    category: category === '-' ? '' : category,
    months: String(n(meta.months || item?.months || item?.duration_months) || ''),
    start_date: String(meta.withdrawal_date || item?.withdrawal_date || item?.start_date || item?.investment_date || '').slice(0, 10),
    maturity_date: String(item?.maturity_date || '').slice(0, 10),
    company_name: String(meta.company_name || item?.company_name || ''),
    tasks: String(meta.tasks || item?.tasks || ''),
    executor: String(meta.executor || item?.executor || ''),
    allocations: (item?.allocations || [])
      .map((allocation) => `${allocation.investor_name || allocation.investor_code || ''} ${n(allocation.invested_amount)}`.trim())
      .filter(Boolean)
      .join('\n'),
    notes: String(item?.notes || ''),
  };
}

function EditOpportunityModal({ visible, item, onClose, onSaved }) {
  const [form, setForm] = useState(() => editOpportunityForm(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setForm(editOpportunityForm(item));
    setError('');
  }, [visible, item]);

  const allocationsInfo = useMemo(() => parseAllocations(form.allocations), [form.allocations]);
  const allocationsTotal = useMemo(
    () => allocationsInfo.rows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    [allocationsInfo]
  );
  const totalAmount = numberValue(form.total_amount);
  const profitAmount = numberValue(form.profit);
  const calculatedRate = totalAmount > 0 && profitAmount > 0 ? (profitAmount / totalAmount) * 100 : 0;

  const setField = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const close = () => {
    if (saving) return;
    setError('');
    onClose?.();
  };

  const validate = () => {
    if (!form.code.trim()) return 'أدخل رقم الفرصة.';
    if (totalAmount <= 0) return 'أدخل مبلغ الاستثمار بشكل صحيح.';
    if (form.months.trim() && (!Number.isInteger(numberValue(form.months)) || numberValue(form.months) <= 0)) {
      return 'عدد الشهور يجب أن يكون رقمًا صحيحًا أكبر من صفر.';
    }
    if (allocationsInfo.invalid.length) {
      return `راجع صيغة المستثمرين. كل سطر يجب أن يكون: الاسم ثم المبلغ.\n${allocationsInfo.invalid[0]}`;
    }
    if (allocationsTotal > totalAmount + 0.009) {
      return `مجموع المستثمرين (${money(allocationsTotal)}) أكبر من مبلغ الاستثمار (${money(totalAmount)}).`;
    }
    return '';
  };

  const save = async () => {
    if (!item?.id) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        code: form.code.trim(),
        total_amount: totalAmount,
        profit: profitAmount || 0,
        profit_rate: numberValue(form.profit_rate) || null,
        category: form.category || null,
        months: numberValue(form.months) || null,
        start_date: form.start_date.trim() || null,
        withdrawal_date: form.start_date.trim() || null,
        maturity_date: form.maturity_date.trim() || null,
        company_name: form.company_name.trim() || null,
        tasks: form.tasks.trim() || null,
        executor: form.executor.trim() || null,
        notes: form.notes.trim() || null,
        allocations: allocationsInfo.rows,
      };

      const result = await apiJson(`/ta3meed/investments/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      onSaved?.(result?.data || { ...item, ...payload });
    } catch (e) {
      setError(e.message || 'تعذر حفظ تعديل الفرصة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={addStyles.backdrop}>
        <View style={addStyles.modalCard}>
          <View style={addStyles.modalHeader}>
            <TouchableOpacity onPress={close} disabled={saving} style={addStyles.closeButton} activeOpacity={0.8}>
              <Text style={addStyles.closeText}>×</Text>
            </TouchableOpacity>
            <View style={addStyles.titleBlock}>
              <Text style={addStyles.title}>تعديل فرصة تعميد</Text>
              <Text style={addStyles.subtitle}>نفس نموذج الإضافة مع البيانات الحالية</Text>
            </View>
            <View style={addStyles.headerMark}><Text style={addStyles.headerMarkText}>✎</Text></View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={addStyles.formScroll}
          >
            <View style={addStyles.sectionHeader}>
              <Text style={addStyles.sectionHint}>الحقول الأساسية</Text>
              <Text style={addStyles.sectionTitle}>بيانات الفرصة</Text>
            </View>

            <FormField
              label="رقم الفرصة *"
              value={form.code}
              onChangeText={(value) => setField('code', value)}
              placeholder="مثال: ER-ABC123"
              autoCapitalize="characters"
            />

            <View style={addStyles.twoColumns}>
              <FormField
                compact
                label="مبلغ الاستثمار *"
                value={form.total_amount}
                onChangeText={(value) => setField('total_amount', value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              <FormField
                compact
                label="الربح المتوقع"
                value={form.profit}
                onChangeText={(value) => setField('profit', value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={addStyles.twoColumns}>
              <FormField
                compact
                label="نسبة الربح %"
                value={form.profit_rate}
                onChangeText={(value) => setField('profit_rate', value.replace(/[^0-9.]/g, ''))}
                placeholder={calculatedRate > 0 ? calculatedRate.toFixed(2) : 'تلقائي'}
                keyboardType="decimal-pad"
              />
              <FormField
                compact
                label="عدد الشهور"
                value={form.months}
                onChangeText={(value) => setField('months', value.replace(/[^0-9]/g, ''))}
                placeholder="مثال: 6"
                keyboardType="number-pad"
              />
            </View>

            <Text style={addStyles.fieldLabel}>التصنيف</Text>
            <View style={addStyles.categoryWrap}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setField('category', form.category === category ? '' : category)}
                  activeOpacity={0.82}
                  style={[addStyles.categoryChip, form.category === category && addStyles.categoryChipActive]}
                >
                  <Text style={[addStyles.categoryText, form.category === category && addStyles.categoryTextActive]}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={addStyles.twoColumns}>
              <FormField
                compact
                label="تاريخ السحب"
                value={form.start_date}
                onChangeText={(value) => setField('start_date', value)}
                placeholder="YYYY-MM-DD"
              />
              <FormField
                compact
                label="تاريخ الاستحقاق"
                value={form.maturity_date}
                onChangeText={(value) => setField('maturity_date', value)}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View style={addStyles.sectionHeaderSecondary}>
              <Text style={addStyles.sectionHint}>اختياري</Text>
              <Text style={addStyles.sectionTitle}>تفاصيل الفرصة</Text>
            </View>

            <FormField
              label="اسم الشركة"
              value={form.company_name}
              onChangeText={(value) => setField('company_name', value)}
              placeholder="اسم الشركة المرتبطة بالفرصة"
            />
            <FormField
              label="المهام"
              value={form.tasks}
              onChangeText={(value) => setField('tasks', value)}
              placeholder="المهام أو وصف العمل"
              multiline
              shortMultiline
            />
            <FormField
              label="المنفذ"
              value={form.executor}
              onChangeText={(value) => setField('executor', value)}
              placeholder="اسم المنفذ"
            />

            <View style={addStyles.sectionHeaderSecondary}>
              <Text style={addStyles.sectionHint}>التوزيع الحالي</Text>
              <Text style={addStyles.sectionTitle}>المستثمرون</Text>
            </View>

            <FormField
              label="المستثمرون"
              value={form.allocations}
              onChangeText={(value) => setField('allocations', value)}
              placeholder={'كل سطر: الاسم المبلغ\nمثال: أحمد 50000'}
              multiline
            />

            {allocationsInfo.rows.length > 0 ? (
              <View style={addStyles.allocationSummary}>
                <Text style={addStyles.allocationSummaryValue}>{money(allocationsTotal)}</Text>
                <Text style={addStyles.allocationSummaryLabel}>مجموع {allocationsInfo.rows.length} مستثمر</Text>
              </View>
            ) : null}

            <FormField
              label="ملاحظات"
              value={form.notes}
              onChangeText={(value) => setField('notes', value)}
              placeholder="معلومة إضافية عند الحاجة"
              multiline
              shortMultiline
            />

            {!!error && (
              <View style={addStyles.errorBox}>
                <Text style={addStyles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={addStyles.footer}>
            <TouchableOpacity onPress={close} disabled={saving} style={addStyles.cancelButton} activeOpacity={0.82}>
              <Text style={addStyles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[addStyles.saveButton, saving && addStyles.disabled]}
              activeOpacity={0.88}
            >
              {saving ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={addStyles.saveText}>حفظ التعديل</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

'''

marker = 'function FormField({ label, compact, multiline, shortMultiline, ...inputProps }) {'
if 'function EditOpportunityModal(' not in wrapper:
    if marker not in wrapper:
        raise SystemExit('FormField marker not found')
    wrapper = wrapper.replace(marker, edit_component + marker, 1)

wrapper = replace_once(
    wrapper,
    "  const [addOpen, setAddOpen] = useState(false);\n  const [screenVersion, setScreenVersion] = useState(0);\n  const [toast, setToast] = useState('');",
    "  const [addOpen, setAddOpen] = useState(false);\n  const [editOpen, setEditOpen] = useState(false);\n  const [editingItem, setEditingItem] = useState(null);\n  const [screenVersion, setScreenVersion] = useState(0);\n  const [toast, setToast] = useState('');",
    'wrapper edit state',
)

handler_marker = r'''  const handleCreated = (created) => {
    const code = String(created?.reference_number || created?.code || '').trim();
    setScreenVersion((current) => current + 1);
    setToast(code ? `تمت إضافة الفرصة ${code}` : 'تمت إضافة الفرصة بنجاح');
    setTimeout(() => setToast(''), 2600);
  };
'''
handler_replacement = handler_marker + r'''
  const handleEdit = (item) => {
    setEditingItem(item);
    setEditOpen(true);
  };

  const handleEdited = (updated) => {
    const code = String(updated?.reference_number || updated?.code || editingItem?.reference_number || '').trim();
    setEditOpen(false);
    setEditingItem(null);
    setScreenVersion((current) => current + 1);
    setToast(code ? `تم تعديل الفرصة ${code}` : 'تم حفظ تعديل الفرصة');
    setTimeout(() => setToast(''), 2600);
  };
'''
wrapper = replace_once(wrapper, handler_marker, handler_replacement, 'edit handlers')

wrapper = replace_once(
    wrapper,
    '      <Ta3meedCompactFiltersScreen key={screenVersion} {...props} />',
    '      <Ta3meedCompactFiltersScreen key={screenVersion} {...props} onEditOpportunity={handleEdit} />',
    'pass edit callback',
)

add_modal_block = r'''      <AddOpportunityModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
'''
replacement_modal_block = add_modal_block + r'''

      <EditOpportunityModal
        visible={editOpen}
        item={editingItem}
        onClose={() => {
          setEditOpen(false);
          setEditingItem(null);
        }}
        onSaved={handleEdited}
      />
'''
wrapper = replace_once(wrapper, add_modal_block, replacement_modal_block, 'render edit modal')

required = [
    'function EditOpportunityModal(',
    'onEditOpportunity={handleEdit}',
    'حفظ التعديل',
    'نفس نموذج الإضافة مع البيانات الحالية',
    "company_name: form.company_name.trim() || null",
]
for needle in required:
    if needle not in wrapper:
        raise SystemExit(f'missing required edit UI marker: {needle}')

if wrapper != original_wrapper:
    WRAPPER.write_text(wrapper, encoding='utf-8')

print('Professional Ta3meed edit UI patched successfully')
