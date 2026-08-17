import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const n = (value) => Number(value || 0);
const money = (value, digits = 2) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;
const CATEGORIES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

function metaOf(item) {
  try {
    return typeof item?.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item?.metadata || {};
  } catch {
    return {};
  }
}

function categoryOf(item) {
  const raw = String(metaOf(item).category || item.category || '').trim().toUpperCase().replace(/\s+/g, '');
  return CATEGORIES.includes(raw) ? raw : '-';
}

function investorKey(allocation) {
  return String(allocation?.investor_code || allocation?.investor_name || '').trim();
}

function isEndedOpportunity(item) {
  const status = String(item?.status || '').trim().toLowerCase();
  return ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done'].includes(status);
}

function isPartialOpportunity(item) {
  return String(item?.status || '').trim().toLowerCase() === 'partial_received';
}

function compareOpportunityOrder(a, b) {
  const dateValue = (item) => {
    const dateText = String(item?.maturity_date || item?.due_date || '').slice(0, 10);
    if (!dateText) return null;
    const value = new Date(`${dateText}T00:00:00`).getTime();
    return Number.isFinite(value) ? value : null;
  };

  const aValue = dateValue(a);
  const bValue = dateValue(b);

  if (aValue === null && bValue !== null) return -1;
  if (aValue !== null && bValue === null) return 1;
  if (aValue !== null && bValue !== null && aValue !== bValue) return aValue - bValue;

  return String(a?.reference_number || a?.code || a?.id || '').localeCompare(
    String(b?.reference_number || b?.code || b?.id || ''),
    'ar'
  );
}

function itemHasInvestor(item, selectedInvestor) {
  if (!selectedInvestor || selectedInvestor === 'all') return true;
  return (item.allocations || []).some((allocation) => investorKey(allocation) === selectedInvestor);
}

function itemHasCategory(item, selectedCategory) {
  if (!selectedCategory || selectedCategory === 'all') return true;
  return categoryOf(item) === selectedCategory;
}

function normalizeSearchValue(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0625\u0623\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addSearchPart(parts, value) {
  if (value === null || value === undefined || value === '') return;
  const raw = String(value);
  parts.push(raw);
  const numeric = raw.replace(/,/g, '');
  if (numeric !== raw) parts.push(numeric);
}

function searchTextOf(item) {
  const meta = metaOf(item);
  const parts = [];

  [
    item.reference_number,
    item.code,
    meta.reference_number,
    meta.code,
    meta.company_name,
    item.company_name,
    meta.activity,
    item.activity,
    meta.description,
    item.description,
    meta.tasks,
    item.tasks,
    meta.executor,
    item.executor,
    item.principal_amount,
    item.total_amount,
    item.amount,
    meta.total_amount,
    meta.amount,
  ].forEach((value) => addSearchPart(parts, value));

  (item.allocations || []).forEach((allocation) => {
    [
      allocation.investor_name,
      allocation.investor_code,
      allocation.invested_amount,
    ].forEach((value) => addSearchPart(parts, value));
  });

  const normalized = normalizeSearchValue(parts.join(' '));
  const collapsed = normalized.replace(/\s+/g, '');
  return { normalized, collapsed };
}

function itemMatchesSearch(item, query) {
  const tokens = normalizeSearchValue(query).split(' ').filter(Boolean);
  if (!tokens.length) return true;

  const { normalized, collapsed } = searchTextOf(item);

  return tokens.every((token) => {
    const cleanToken = normalizeSearchValue(token);
    if (!cleanToken) return true;
    const collapsedToken = cleanToken.replace(/\s+/g, '');
    return normalized.includes(cleanToken) || collapsed.includes(collapsedToken);
  });
}

function partialReceivedAmount(items, selectedInvestor = 'all') {
  return (items || []).reduce((total, item) => {
    if (isEndedOpportunity(item)) return total;

    const allocations = item.allocations || [];
    const selectedAllocations = selectedInvestor && selectedInvestor !== 'all'
      ? allocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
      : allocations;

    if (selectedInvestor && selectedInvestor !== 'all' && selectedAllocations.length === 0) return total;

    const receiptAllocationsTotal = (item.receipts || []).reduce((receiptTotal, receipt) => {
      const receiptAllocations = receipt.allocations || [];
      const selectedReceiptAllocations = selectedInvestor && selectedInvestor !== 'all'
        ? receiptAllocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
        : receiptAllocations;

      return receiptTotal + selectedReceiptAllocations.reduce((sum, allocation) => sum + n(allocation.received_amount), 0);
    }, 0);

    const allocationReceivedTotal = selectedAllocations.reduce((sum, allocation) => sum + n(allocation.received_amount), 0);

    if (receiptAllocationsTotal > 0 || allocationReceivedTotal > 0) {
      return total + Math.max(receiptAllocationsTotal, allocationReceivedTotal);
    }

    if (selectedInvestor && selectedInvestor !== 'all') return total;

    const rawReceiptTotal = (item.receipts || []).reduce((sum, receipt) => sum + n(receipt.amount), 0);
    return total + Math.max(n(item.received_amount), rawReceiptTotal);
  }, 0);
}

if (!React.__ta3meedPartialReceivedMemoPatched) {
  const originalUseMemo = React.useMemo;

  React.useMemo = function patchedUseMemo(factory, deps) {
    return originalUseMemo.call(this, () => {
      const value = factory();

      if (Array.isArray(value) && Array.isArray(deps?.[0]) && deps?.[1] === 'active') {
        const currentIds = new Set(value.map((item) => String(item?.id)));
        const selectedCategory = typeof deps?.[2] === 'string' ? deps[2] : 'all';
        const selectedInvestor = typeof deps?.[3] === 'string' ? deps[3] : 'all';
        const query = typeof deps?.[4] === 'string' ? deps[4] : '';
        const extraItems = deps[0].filter((item) => (
          isPartialOpportunity(item)
          && !currentIds.has(String(item?.id))
          && itemHasCategory(item, selectedCategory)
          && itemHasInvestor(item, selectedInvestor)
          && itemMatchesSearch(item, query)
        ));
        if (extraItems.length) return [...value, ...extraItems].sort(compareOpportunityOrder);
      }

      const looksLikeTa3meedTotals = value && typeof value === 'object' && !Array.isArray(value)
        && Object.prototype.hasOwnProperty.call(value, 'invested')
        && Object.prototype.hasOwnProperty.call(value, 'profit')
        && Object.prototype.hasOwnProperty.call(value, 'active')
        && Object.prototype.hasOwnProperty.call(value, 'partial')
        && Object.prototype.hasOwnProperty.call(value, 'received');

      if (!looksLikeTa3meedTotals) return value;

      const filteredItems = Array.isArray(deps?.[0]) ? deps[0] : [];
      const allItems = Array.isArray(deps?.[1]) ? deps[1] : [];
      const selectedInvestor = typeof deps?.[2] === 'string' ? deps[2] : 'all';

      return {
        ...value,
        active: filteredItems.filter((item) => !isEndedOpportunity(item)).length,
        partial: money(partialReceivedAmount(allItems, selectedInvestor), 2),
      };
    }, deps);
  };

  React.__ta3meedPartialReceivedMemoPatched = true;
}

const Ta3meedCompactFiltersScreen = require('./Ta3meedCompactFiltersScreen.js').default;

const emptyOpportunityForm = () => ({
  code: '',
  total_amount: '',
  profit: '',
  profit_rate: '',
  category: '',
  months: '',
  start_date: '',
  maturity_date: '',
  allocations: '',
  notes: '',
});

function numberValue(value) {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAllocations(text) {
  const rows = [];
  const invalid = [];

  String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/\s+/);
      const amountText = String(parts.pop() || '').replace(/,/g, '');
      const investor = parts.join(' ').trim();
      const amount = Number(amountText);

      if (!investor || !Number.isFinite(amount) || amount <= 0) {
        invalid.push(line);
        return;
      }

      rows.push({ investor, amount });
    });

  return { rows, invalid };
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });

  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }

  if (!response.ok) {
    const validationMessage = json?.errors
      ? Object.values(json.errors).flat().filter(Boolean).join('\n')
      : '';
    const error = new Error(validationMessage || json.message || `تعذر تنفيذ العملية (${response.status})`);
    error.status = response.status;
    error.data = json;
    throw error;
  }

  return json;
}

function AddOpportunityModal({ visible, onClose, onCreated }) {
  const [form, setForm] = useState(emptyOpportunityForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setForm(emptyOpportunityForm());
    setError('');
    onClose();
  };

  const validate = () => {
    const code = form.code.trim();
    if (!code) return 'أدخل رقم الفرصة.';
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

  const createOpportunity = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const code = form.code.trim();
      const current = await apiJson('/ta3meed/investments');
      const existing = (Array.isArray(current?.data) ? current.data : []).find((item) => (
        String(item?.reference_number || item?.code || '').trim().toLowerCase() === code.toLowerCase()
      ));

      if (existing) {
        setError('رقم الفرصة موجود مسبقًا. افتح الفرصة الحالية واستخدم زر التعديل بدل إنشاء نسخة مكررة.');
        Alert.alert('الفرصة موجودة', `الفرصة ${code} مسجلة بالفعل.`);
        return;
      }

      const payload = {
        code,
        total_amount: totalAmount,
        profit: profitAmount || 0,
        profit_rate: numberValue(form.profit_rate) || null,
        category: form.category || null,
        months: numberValue(form.months) || null,
        start_date: form.start_date.trim() || null,
        withdrawal_date: form.start_date.trim() || null,
        maturity_date: form.maturity_date.trim() || null,
        notes: form.notes.trim() || null,
        allocations: allocationsInfo.rows,
      };

      const created = await apiJson('/ta3meed/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setForm(emptyOpportunityForm());
      onClose();
      onCreated?.(created?.data || payload);
    } catch (e) {
      setError(e.message || 'تعذر إضافة الفرصة.');
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
              <Text style={addStyles.title}>إضافة فرصة تعميد</Text>
              <Text style={addStyles.subtitle}>إدخال سريع ودقيق بدون ازدحام</Text>
            </View>
            <View style={addStyles.headerMark}><Text style={addStyles.headerMarkText}>+</Text></View>
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
              <Text style={addStyles.sectionTitle}>توزيع المستثمرين</Text>
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
              onPress={createOpportunity}
              disabled={saving}
              style={[addStyles.saveButton, saving && addStyles.disabled]}
              activeOpacity={0.88}
            >
              {saving ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={addStyles.saveText}>حفظ الفرصة</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


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

function FormField({ label, compact, multiline, shortMultiline, ...inputProps }) {
  return (
    <View style={[addStyles.field, compact && addStyles.fieldCompact]}>
      <Text style={addStyles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[
          addStyles.input,
          multiline && addStyles.inputMultiline,
          shortMultiline && addStyles.inputShortMultiline,
        ]}
        multiline={multiline}
        textAlign="right"
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

export default function Ta3meedNoResetFilterScreen(props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [screenVersion, setScreenVersion] = useState(0);
  const [toast, setToast] = useState('');

  const handleCreated = (created) => {
    const code = String(created?.reference_number || created?.code || '').trim();
    setScreenVersion((current) => current + 1);
    setToast(code ? `تمت إضافة الفرصة ${code}` : 'تمت إضافة الفرصة بنجاح');
    setTimeout(() => setToast(''), 2600);
  };

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

  return (
    <View style={addStyles.host}>
      <Ta3meedCompactFiltersScreen key={screenVersion} {...props} onEditOpportunity={handleEdit} />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="إضافة فرصة تعميد"
        activeOpacity={0.88}
        onPress={() => setAddOpen(true)}
        style={addStyles.floatingAddButton}
      >
        <Text style={addStyles.floatingAddPlus}>+</Text>
      </TouchableOpacity>

      {!!toast && (
        <View pointerEvents="none" style={addStyles.toast}>
          <Text style={addStyles.toastText}>{toast}</Text>
        </View>
      )}

      <AddOpportunityModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />


      <EditOpportunityModal
        visible={editOpen}
        item={editingItem}
        onClose={() => {
          setEditOpen(false);
          setEditingItem(null);
        }}
        onSaved={handleEdited}
      />
    </View>
  );
}

const addStyles = StyleSheet.create({
  host: {
    flex: 1,
  },
  floatingAddButton: {
    position: 'absolute',
    left: 24,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#0f766e',
    borderWidth: 1,
    borderColor: '#0b675f',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    zIndex: 70,
  },
  floatingAddPlus: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 37,
    fontWeight: '500',
    marginTop: -2,
  },
  toast: {
    position: 'absolute',
    left: 92,
    right: 18,
    bottom: 99,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    zIndex: 90,
    elevation: 12,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    elevation: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  modalHeader: {
    minHeight: 70,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#475569',
    fontSize: 25,
    lineHeight: 27,
    fontWeight: '500',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  subtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'right',
  },
  headerMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMarkText: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '500',
  },
  formScroll: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    marginBottom: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  sectionHint: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '800',
  },
  twoColumns: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  field: {
    width: '100%',
    marginBottom: 8,
  },
  fieldCompact: {
    flex: 1,
    width: 'auto',
  },
  fieldLabel: {
    marginBottom: 5,
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '900',
    textAlign: 'right',
  },
  input: {
    minHeight: 43,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13.5,
    fontWeight: '800',
  },
  inputMultiline: {
    minHeight: 76,
    paddingTop: 10,
  },
  inputShortMultiline: {
    minHeight: 62,
  },
  categoryWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  categoryChip: {
    minWidth: 48,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  categoryText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '900',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  allocationSummary: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 11,
    marginTop: -1,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allocationSummaryLabel: {
    color: '#0f766e',
    fontSize: 11.5,
    fontWeight: '900',
    textAlign: 'right',
  },
  allocationSummaryValue: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '900',
  },
  errorBox: {
    marginTop: 1,
    marginBottom: 4,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 11.5,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'right',
  },
  footer: {
    minHeight: 67,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    gap: 9,
  },
  cancelButton: {
    width: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.62,
  },
});
