import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const RESET_FILTER_TEXT = 'إعادة الفلتر إلى نشط';
const CATEGORIES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

const today = () => new Date().toISOString().slice(0, 10);
const n = (value) => Number(value || 0);
const money = (value, digits = 2) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;

function containsResetFilterText(node) {
  if (typeof node === 'string') return node.includes(RESET_FILTER_TEXT);
  if (Array.isArray(node)) return node.some(containsResetFilterText);
  if (node && typeof node === 'object') return containsResetFilterText(node.props?.children);
  return false;
}

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

function statusKeyOf(item) {
  if (item?.status === 'received' || item?.status === 'completed') return 'received';
  if (item?.status === 'partial_received') return 'partial_received';
  if (item?.maturity_date && item.maturity_date < today()) return 'overdue';
  return 'active';
}

function investorKey(allocation) {
  return String(allocation?.investor_code || allocation?.investor_name || '').trim();
}

function itemHasInvestor(item, selectedInvestor) {
  if (!selectedInvestor || selectedInvestor === 'all') return true;
  return (item.allocations || []).some((allocation) => investorKey(allocation) === selectedInvestor);
}

function itemMatchesKeyword(item, keyword) {
  if (!keyword) return true;
  const meta = metaOf(item);
  const category = categoryOf(item);
  const text = [
    item.reference_number,
    item.status,
    item.maturity_date,
    meta.category,
    category,
    meta.withdrawal_date,
    ...(item.allocations || []).map((allocation) => allocation.investor_name),
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes(keyword);
}

function activeStatusFilteredItems(items, categoryFilter, investorFilter, query) {
  const keyword = String(query || '').trim().toLowerCase();
  return (items || []).filter((item) => {
    if (statusKeyOf(item) === 'received') return false;
    if (categoryFilter !== 'all' && categoryOf(item) !== categoryFilter) return false;
    if (!itemHasInvestor(item, investorFilter)) return false;
    return itemMatchesKeyword(item, keyword);
  });
}

function receivedAmountOf(item, meta, receipts, allocations) {
  const metaReceived = n(meta.ta3meed_received_total);
  const itemReceived = n(item.received_amount);
  const receiptsReceived = (receipts || []).reduce((sum, receipt) => sum + n(receipt.amount), 0);
  const allocationsReceived = (allocations || []).reduce((sum, allocation) => sum + n(allocation.received_amount), 0);
  return Math.max(metaReceived, itemReceived, receiptsReceived, allocationsReceived);
}

function netActiveInvestedAmount(items, selectedInvestor) {
  return (items || []).reduce((total, item) => {
    if (statusKeyOf(item) === 'received') return total;
    const allocations = item.allocations || [];
    const selectedAllocations = selectedInvestor && selectedInvestor !== 'all'
      ? allocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
      : allocations;
    if (selectedInvestor && selectedInvestor !== 'all' && selectedAllocations.length === 0) return total;
    if (selectedAllocations.length > 0) {
      const meta = metaOf(item);
      const totalAllocated = allocations.reduce((sum, allocation) => sum + n(allocation.invested_amount), 0);
      const itemReceivedTotal = receivedAmountOf(item, meta, item.receipts || [], allocations);
      const hasAllocationReceipts = allocations.some((allocation) => n(allocation.received_amount) > 0);
      return total + selectedAllocations.reduce((sum, allocation) => {
        const invested = n(allocation.invested_amount);
        const proportionalReceived = totalAllocated > 0 ? itemReceivedTotal * (invested / totalAllocated) : 0;
        const received = hasAllocationReceipts ? n(allocation.received_amount) : proportionalReceived;
        return sum + Math.max(0, invested - Math.min(invested, received));
      }, 0);
    }
    const meta = metaOf(item);
    const invested = n(item.principal_amount);
    const received = receivedAmountOf(item, meta, item.receipts || [], allocations);
    return total + Math.max(0, invested - Math.min(invested, received));
  }, 0);
}

function expectedProfitForActiveItems(items) {
  return (items || []).reduce((sum, item) => {
    if (statusKeyOf(item) === 'received') return sum;
    return sum + n(item.expected_profit_amount);
  }, 0);
}

function countActiveItems(items) {
  return (items || []).filter((item) => statusKeyOf(item) !== 'received').length;
}

function parseAllocations(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const amountText = parts.pop();
      return { investor: parts.join(' '), amount: n(String(amountText || '').replace(/,/g, '')) };
    })
    .filter((row) => row.investor && row.amount > 0);
}

function allocationsToText(item) {
  return (item?.allocations || [])
    .map((allocation) => `${allocation.investor_name || allocation.investor_code || ''} ${n(allocation.invested_amount)}`.trim())
    .filter(Boolean)
    .join('\n');
}

function blankForm() {
  return { code: '', total_amount: '', profit: '', profit_rate: '', category: '', months: '', start_date: today(), maturity_date: '', allocations: '', notes: '' };
}

function formFromItem(item) {
  const meta = metaOf(item);
  return {
    code: String(item.reference_number || item.code || ''),
    total_amount: String(n(item.principal_amount) || ''),
    profit: String(n(item.expected_profit_amount) || ''),
    profit_rate: String(n(item.expected_rate) || n(item.registered_annual_profit_rate) || ''),
    category: categoryOf(item) === '-' ? '' : categoryOf(item),
    months: String(n(meta.months || item.months || item.duration_months) || ''),
    start_date: String(meta.withdrawal_date || item.withdrawal_date || item.start_date || item.investment_date || today()).slice(0, 10),
    maturity_date: String(item.maturity_date || '').slice(0, 10),
    allocations: allocationsToText(item),
    notes: item.notes || '',
  };
}

function InlineEditableTa3meedCard({ OriginalCard, cardProps, onEdit }) {
  const rendered = OriginalCard(cardProps);
  if (!rendered || !rendered.props) return rendered;
  const existingChildren = rendered.props.children;
  const childArray = Array.isArray(existingChildren) ? existingChildren : [existingChildren];
  const editButton = (
    <TouchableOpacity
      key="inline-edit-opportunity"
      activeOpacity={0.84}
      onPress={() => onEdit(cardProps.item)}
      style={{ alignSelf: 'flex-start', marginTop: 10, width: 42, height: 42, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' }}
    >
      <UiIcon name="edit" size={22} color={ICON_COLOR_DARK} />
    </TouchableOpacity>
  );
  return React.cloneElement(rendered, rendered.props, ...childArray, editButton);
}

function isTa3meedCardElement(type, props) {
  return renderingTa3meed
    && typeof type === 'function'
    && props?.item
    && typeof props?.onToggle === 'function'
    && Object.prototype.hasOwnProperty.call(props, 'open')
    && Object.prototype.hasOwnProperty.call(props, 'onDeleteReceipt');
}

const originalUseState = React.useState;
const originalUseMemo = React.useMemo;
let renderingTa3meed = false;
let stateHookIndex = 0;
let currentInvestorFilter = 'all';
let currentSetPicker = null;

React.useState = function patchedTa3meedUseState(initialState) {
  const hookIndex = stateHookIndex;
  stateHookIndex += 1;
  const stateTuple = originalUseState.call(this, initialState);
  if (renderingTa3meed && hookIndex === 6) currentInvestorFilter = stateTuple[0] || 'all';
  if (renderingTa3meed && hookIndex === 10) currentSetPicker = stateTuple[1];
  return stateTuple;
};

React.useMemo = function patchedTa3meedUseMemo(factory, deps) {
  const value = originalUseMemo.call(this, factory, deps);
  const looksLikeFilteredItems = Array.isArray(value)
    && Array.isArray(deps)
    && deps.length === 5
    && Array.isArray(deps[0])
    && typeof deps[1] === 'string'
    && typeof deps[2] === 'string'
    && typeof deps[3] === 'string';
  if (renderingTa3meed && looksLikeFilteredItems && deps[1] === 'active') {
    const [items, , categoryFilter, investorFilter, query] = deps;
    return activeStatusFilteredItems(items, categoryFilter, investorFilter, query);
  }
  const looksLikeTotals = value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'invested')
    && Object.prototype.hasOwnProperty.call(value, 'profit')
    && Object.prototype.hasOwnProperty.call(value, 'active')
    && Object.prototype.hasOwnProperty.call(value, 'partial')
    && Object.prototype.hasOwnProperty.call(value, 'received')
    && Array.isArray(deps)
    && deps.length === 1
    && Array.isArray(deps[0]);
  if (!renderingTa3meed || !looksLikeTotals) return value;
  return { ...value, invested: netActiveInvestedAmount(deps[0], currentInvestorFilter), profit: expectedProfitForActiveItems(deps[0]), active: countActiveItems(deps[0]) };
};

const Ta3meedCompactFiltersScreen = require('./Ta3meedCompactFiltersScreen.js').default;

export default function Ta3meedNoResetFilterScreen(props) {
  const [screenKey, setScreenKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [message, setMessage] = useState('');

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const resetForm = () => setForm(blankForm());

  const openAdd = () => {
    setMessage('');
    setEditingId(null);
    resetForm();
    setModalMode('add');
    setModalOpen(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setMessage('');
    setModalMode('edit');
    setModalOpen(true);
  };

  const openInvestorPickerFromLegacyButton = () => {
    if (typeof currentSetPicker === 'function') {
      currentSetPicker('investor');
    }
  };

  const saveOpportunity = async () => {
    if (!form.code.trim()) return setMessage('أدخل رقم الفرصة');
    if (!n(form.total_amount)) return setMessage('أدخل مبلغ الاستثمار');
    setSaving(true);
    setMessage('');
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const response = await fetch(`${API_URL}/ta3meed/investments${isEdit ? `/${editingId}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          total_amount: n(String(form.total_amount).replace(/,/g, '')),
          profit: n(String(form.profit).replace(/,/g, '')),
          profit_rate: n(form.profit_rate) || null,
          category: form.category.trim() || null,
          months: n(form.months) || null,
          start_date: form.start_date || null,
          maturity_date: form.maturity_date || null,
          withdrawal_date: form.start_date || null,
          notes: form.notes || null,
          allocations: parseAllocations(form.allocations),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || (isEdit ? 'تعذر تعديل الفرصة' : 'تعذر إضافة الفرصة'));
      setMessage(isEdit ? 'تم تعديل الفرصة' : 'تمت إضافة الفرصة');
      resetForm();
      setEditingId(null);
      setModalOpen(false);
      setScreenKey((value) => value + 1);
    } catch (error) {
      setMessage(error.message || 'تعذر حفظ الفرصة');
    } finally {
      setSaving(false);
    }
  };

  const originalCreateElement = React.createElement;
  let runtime;
  let originalJsx;
  let originalJsxs;
  let originalJsxDEV;

  try {
    runtime = require('react/jsx-runtime');
    originalJsx = runtime.jsx;
    originalJsxs = runtime.jsxs;
    originalJsxDEV = runtime.jsxDEV;
  } catch {}

  const wrapElement = (type, elementProps, createOriginal, extraArgs = []) => {
    if (type === TouchableOpacity && containsResetFilterText(elementProps?.children || extraArgs)) return null;
    if (isTa3meedCardElement(type, elementProps)) {
      return createOriginal(InlineEditableTa3meedCard, { OriginalCard: type, cardProps: elementProps, onEdit: openEditForm }, ...extraArgs);
    }
    return createOriginal(type, elementProps, ...extraArgs);
  };

  React.createElement = function createElementWithInlineEdit(type, elementProps, ...children) {
    return wrapElement(type, elementProps, originalCreateElement.bind(this), children);
  };

  if (runtime && typeof originalJsx === 'function') {
    runtime.jsx = function jsxWithInlineEdit(type, elementProps, ...rest) {
      return wrapElement(type, elementProps, originalJsx.bind(this), rest);
    };
  }
  if (runtime && typeof originalJsxs === 'function') {
    runtime.jsxs = function jsxsWithInlineEdit(type, elementProps, ...rest) {
      return wrapElement(type, elementProps, originalJsxs.bind(this), rest);
    };
  }
  if (runtime && typeof originalJsxDEV === 'function') {
    runtime.jsxDEV = function jsxDEVWithInlineEdit(type, elementProps, ...rest) {
      return wrapElement(type, elementProps, originalJsxDEV.bind(this), rest);
    };
  }

  renderingTa3meed = true;
  stateHookIndex = 0;
  currentSetPicker = null;
  let screen;
  try {
    screen = <Ta3meedCompactFiltersScreen key={screenKey} {...props} onOpenMore={openInvestorPickerFromLegacyButton} />;
  } finally {
    renderingTa3meed = false;
    React.createElement = originalCreateElement;
    if (runtime && originalJsx) runtime.jsx = originalJsx;
    if (runtime && originalJsxs) runtime.jsxs = originalJsxs;
    if (runtime && originalJsxDEV) runtime.jsxDEV = originalJsxDEV;
  }

  const isEditForm = modalMode === 'edit';
  return (
    <View style={{ flex: 1 }}>
      {screen}
      <TouchableOpacity activeOpacity={0.86} onPress={openAdd} style={floatingButtonStyle}>
        <UiIcon name="add" size={28} color={ICON_COLOR_DARK} />
      </TouchableOpacity>
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'center', padding: 16 }}>
          <View style={{ maxHeight: '92%', backgroundColor: '#fff', borderRadius: 28, padding: 18 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right' }}>{isEditForm ? 'تعديل فرصة تعميد' : 'إضافة فرصة تعميد'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, fontWeight: '900', color: '#64748b' }}>×</Text></TouchableOpacity>
            </View>
            {!!message && <Text style={{ backgroundColor: '#eff6ff', color: '#075985', borderRadius: 14, padding: 10, marginBottom: 10, fontWeight: '900', textAlign: 'right' }}>{message}</Text>}
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput value={form.code} onChangeText={(v) => setField('code', v)} placeholder="رقم الفرصة" placeholderTextColor="#94a3b8" textAlign="right" style={inputStyle} />
              <TextInput value={form.total_amount} onChangeText={(v) => setField('total_amount', v)} placeholder="مبلغ الاستثمار" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" textAlign="right" style={inputStyle} />
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <TextInput value={form.profit} onChangeText={(v) => setField('profit', v)} placeholder="الربح" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" textAlign="right" style={[inputStyle, { flex: 1 }]} />
                <TextInput value={form.profit_rate} onChangeText={(v) => setField('profit_rate', v)} placeholder="النسبة" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" textAlign="right" style={[inputStyle, { flex: 1 }]} />
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <TextInput value={form.category} onChangeText={(v) => setField('category', v)} placeholder="التصنيف A+" placeholderTextColor="#94a3b8" textAlign="right" style={[inputStyle, { flex: 1 }]} />
                <TextInput value={form.months} onChangeText={(v) => setField('months', v)} placeholder="الشهور" placeholderTextColor="#94a3b8" keyboardType="number-pad" textAlign="right" style={[inputStyle, { flex: 1 }]} />
              </View>
              <TextInput value={form.start_date} onChangeText={(v) => setField('start_date', v)} placeholder="تاريخ الاستثمار YYYY-MM-DD" placeholderTextColor="#94a3b8" textAlign="right" style={inputStyle} />
              <TextInput value={form.maturity_date} onChangeText={(v) => setField('maturity_date', v)} placeholder="تاريخ الاستحقاق YYYY-MM-DD" placeholderTextColor="#94a3b8" textAlign="right" style={inputStyle} />
              <TextInput value={form.allocations} onChangeText={(v) => setField('allocations', v)} placeholder={'المستثمرين، كل سطر: الاسم المبلغ\nمثال: أحمد 10000'} placeholderTextColor="#94a3b8" textAlign="right" multiline style={[inputStyle, { minHeight: 86, textAlignVertical: 'top' }]} />
              <TextInput value={form.notes} onChangeText={(v) => setField('notes', v)} placeholder="ملاحظات" placeholderTextColor="#94a3b8" textAlign="right" multiline style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} />
              <TouchableOpacity disabled={saving} onPress={saveOpportunity} style={{ marginTop: 8, borderRadius: 18, backgroundColor: '#0f766e', paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{saving ? 'جاري الحفظ...' : isEditForm ? 'حفظ التعديل' : 'حفظ الفرصة'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const floatingButtonStyle = { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, zIndex: 50 };
const inputStyle = { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8, color: '#0f172a', fontWeight: '800' };
