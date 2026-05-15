import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const RESET_FILTER_TEXT = 'إعادة الفلتر إلى نشط';
const CATEGORIES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

const today = () => new Date().toISOString().slice(0, 10);
const n = (value) => Number(value || 0);

function containsResetFilterText(node) {
  if (typeof node === 'string') return node.includes(RESET_FILTER_TEXT);
  if (Array.isArray(node)) return node.some(containsResetFilterText);
  if (node && typeof node === 'object') return containsResetFilterText(node.props?.children);
  return false;
}

function isMoreFloatingButtonStyle(style) {
  const styles = Array.isArray(style) ? style : [style];
  return styles.some((item) => item && typeof item === 'object' && item.position === 'absolute' && item.left === 24 && item.bottom === 24);
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

function blankForm() {
  return { code: '', total_amount: '', profit: '', profit_rate: '', category: '', months: '', start_date: today(), maturity_date: '', allocations: '', notes: '' };
}

const originalUseState = React.useState;
let renderingTa3meed = false;
let stateHookIndex = 0;
let currentSetPicker = null;

React.useState = function patchedTa3meedUseState(initialState) {
  const hookIndex = stateHookIndex;
  stateHookIndex += 1;
  const stateTuple = originalUseState.call(this, initialState);
  if (renderingTa3meed && hookIndex === 10) currentSetPicker = stateTuple[1];
  return stateTuple;
};

const Ta3meedCompactFiltersScreen = require('./Ta3meedCompactFiltersScreen.js').default;

export default function Ta3meedNoResetFilterScreen(props) {
  const [screenKey, setScreenKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [message, setMessage] = useState('');

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const openAdd = () => {
    setMessage('');
    setForm(blankForm());
    setModalOpen(true);
  };

  const openInvestorPicker = () => {
    if (typeof currentSetPicker === 'function') currentSetPicker('investor');
  };

  const openMore = () => {
    if (typeof props.onOpenMore === 'function') props.onOpenMore();
    else if (typeof props.onBack === 'function') props.onBack();
  };

  const saveOpportunity = async () => {
    if (!form.code.trim()) return setMessage('أدخل رقم الفرصة');
    if (!n(form.total_amount)) return setMessage('أدخل مبلغ الاستثمار');
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          total_amount: n(String(form.total_amount).replace(/,/g, '')),
          profit: n(String(form.profit).replace(/,/g, '')),
          profit_rate: n(form.profit_rate) || null,
          category: CATEGORIES.includes(String(form.category || '').trim().toUpperCase()) ? String(form.category || '').trim().toUpperCase() : (form.category.trim() || null),
          months: n(form.months) || null,
          start_date: form.start_date || null,
          maturity_date: form.maturity_date || null,
          withdrawal_date: form.start_date || null,
          notes: form.notes || null,
          allocations: parseAllocations(form.allocations),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر إضافة الفرصة');
      setMessage('تمت إضافة الفرصة');
      setForm(blankForm());
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
    if (renderingTa3meed && typeof type === 'function' && elementProps?.label === 'المستثمر') {
      return createOriginal(type, { ...elementProps, onPress: openInvestorPicker }, ...extraArgs);
    }
    if (renderingTa3meed && type === TouchableOpacity && isMoreFloatingButtonStyle(elementProps?.style)) {
      return createOriginal(type, { ...elementProps, onPress: openMore }, ...extraArgs);
    }
    if (type === TouchableOpacity && containsResetFilterText(elementProps?.children || extraArgs)) return null;
    return createOriginal(type, elementProps, ...extraArgs);
  };

  React.createElement = function createElementWithStableButtons(type, elementProps, ...children) {
    return wrapElement(type, elementProps, originalCreateElement.bind(this), children);
  };

  if (runtime && typeof originalJsx === 'function') {
    runtime.jsx = function jsxWithStableButtons(type, elementProps, ...rest) {
      return wrapElement(type, elementProps, originalJsx.bind(this), rest);
    };
  }
  if (runtime && typeof originalJsxs === 'function') {
    runtime.jsxs = function jsxsWithStableButtons(type, elementProps, ...rest) {
      return wrapElement(type, elementProps, originalJsxs.bind(this), rest);
    };
  }
  if (runtime && typeof originalJsxDEV === 'function') {
    runtime.jsxDEV = function jsxDEVWithStableButtons(type, elementProps, ...rest) {
      return wrapElement(type, elementProps, originalJsxDEV.bind(this), rest);
    };
  }

  renderingTa3meed = true;
  stateHookIndex = 0;
  currentSetPicker = null;
  let screen;
  try {
    screen = <Ta3meedCompactFiltersScreen key={screenKey} {...props} onOpenMore={openMore} />;
  } finally {
    renderingTa3meed = false;
    React.createElement = originalCreateElement;
    if (runtime && originalJsx) runtime.jsx = originalJsx;
    if (runtime && originalJsxs) runtime.jsxs = originalJsxs;
    if (runtime && originalJsxDEV) runtime.jsxDEV = originalJsxDEV;
  }

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
              <Text style={{ color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right' }}>إضافة فرصة تعميد</Text>
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
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{saving ? 'جاري الحفظ...' : 'حفظ الفرصة'}</Text>
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
