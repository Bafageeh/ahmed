import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { amountText, hasProtectedAllocations, normalizeAmountInput, parseMoneyCents } from './ta3meedAllocationForm';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const money = (v) => `${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const json = await response.json();
  if (!response.ok) throw new Error(Object.values(json.errors || {}).flat().join('\n') || json.message || 'تعذر تنفيذ العملية.');
  return json;
}

function useRegistry(enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { const json = await requestJson('/ta3meed/investors'); setItems(json.data || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);
  return { items, loading, error, refresh };
}

function Action({ children, onPress, disabled, secondary, testID }) {
  return <TouchableOpacity testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && s.disabled]} activeOpacity={0.85}><Text style={[s.buttonText, secondary && s.secondaryText]}>{children}</Text></TouchableOpacity>;
}

function InvestorRegistryPanel({ onDone, onChanged }) {
  const registry = useRegistry(true);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reset = () => { setName(''); setEditingId(null); setError(''); };
  const save = async () => {
    setSaving(true); setError('');
    try {
      await requestJson(editingId ? `/ta3meed/investors/${editingId}` : '/ta3meed/investors', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ name: name.trim() }) });
      reset(); await registry.refresh(); onChanged?.();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const toggle = async (investor) => {
    setSaving(true); setError('');
    try {
      await requestJson(`/ta3meed/investors/${investor.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !Boolean(Number(investor.is_active)) }) });
      await registry.refresh(); onChanged?.();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  return <View style={s.panel}>
    <Text style={s.title}>إدارة المستثمرين</Text>
    <Text style={s.hint}>مستثمرو هذا الحساب فقط. إيقاف الاختيار الجديد يحفظ الحقوق والدفعات السابقة.</Text>
    <Text style={s.label}>{editingId ? 'تعديل اسم المستثمر' : 'مستثمر جديد'}</Text>
    <TextInput testID="investor-profile-name" value={name} onChangeText={setName} placeholder="اسم يميز المستثمر بوضوح" style={s.input} textAlign="right" editable={!saving} />
    <View style={s.actions}>
      <Action disabled={saving || !name.trim()} onPress={save}>{saving ? 'جاري الحفظ…' : editingId ? 'حفظ الاسم' : 'إضافة المستثمر'}</Action>
      {editingId ? <Action secondary disabled={saving} onPress={reset}>إلغاء التعديل</Action> : null}
    </View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <TextInput value={query} onChangeText={setQuery} placeholder="ابحث في المستثمرين" style={s.input} textAlign="right" />
    {registry.loading ? <ActivityIndicator color="#0f766e" /> : null}
    {!!registry.error && <><Text style={s.error}>{registry.error}</Text><Action secondary onPress={registry.refresh}>إعادة المحاولة</Action></>}
    <ScrollView nestedScrollEnabled style={s.registryList} keyboardShouldPersistTaps="handled">
      {registry.items.filter((i) => i.name.includes(query.trim())).map((i) => <View key={i.id} style={s.profileRow}>
        <View style={s.grow}><Text style={s.name}>{i.name}</Text><Text style={s.hint}>{i.opportunity_count || 0} حصة · {Number(i.is_active) ? 'متاح للاختيار' : 'موقوف عن المشاركات الجديدة'}</Text></View>
        <TouchableOpacity disabled={saving} onPress={() => { setEditingId(i.id); setName(i.name); setError(''); }} style={s.smallButton}><Text style={s.link}>تعديل الاسم</Text></TouchableOpacity>
        <TouchableOpacity disabled={saving} onPress={() => toggle(i)} style={s.smallButton}><Text style={s.link}>{Number(i.is_active) ? 'إيقاف' : 'تفعيل'}</Text></TouchableOpacity>
      </View>)}
      {!registry.loading && !registry.items.length ? <Text style={s.hint}>أضف أول مستثمر ليظهر في قائمة الاختيار.</Text> : null}
    </ScrollView>
    <Action secondary onPress={onDone} disabled={saving}>العودة</Action>
  </View>;
}

export function InvestorManagerModal({ visible, onClose }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><InvestorRegistryPanel onDone={onClose} /></View></View></Modal>;
}

export function InvestorAllocationEditor({ rows = [], onChange, totalAmount, visible, item, onChangeOwner }) {
  const registry = useRegistry(visible);
  const [choosing, setChoosing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState('');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const locked = hasProtectedAllocations(item);
  const total = parseMoneyCents(totalAmount);
  const allocated = rows.reduce((sum, r) => sum + (parseMoneyCents(r.amount) || 0), 0);
  const remaining = total === null ? null : total - allocated;
  const selected = new Set(rows.map((r) => Number(r.investor_id)));
  const available = registry.items.filter((i) => Number(i.is_active) && !selected.has(i.id) && i.name.includes(query.trim()));
  useEffect(() => { if (!visible) { setChoosing(false); setManaging(false); setHistory(null); setInputError(''); } }, [visible]);
  const setAmount = (index, value) => {
    const normalized = normalizeAmountInput(value);
    if (!/^\d{0,10}(?:\.\d{0,2})?$/.test(normalized)) { setInputError('يسمح المبلغ بمنزلتين عشريتين فقط.'); return; }
    setInputError(''); onChange(rows.map((r, i) => i === index ? { ...r, amount: normalized } : r));
  };
  const loadHistory = async () => {
    if (history !== null) { setHistory(null); return; }
    try { const json = await requestJson(`/ta3meed/investments/${item.id}/investor-history`); setHistory(json.data || []); setHistoryError(''); }
    catch (e) { setHistoryError(e.message); }
  };
  if (managing) return <InvestorRegistryPanel onDone={() => { setManaging(false); registry.refresh(); }} onChanged={registry.refresh} />;
  return <View testID="investor-allocation-editor" style={s.panel}>
    <View style={s.heading}><Text style={s.title}>مشاركات المستثمرين</Text><TouchableOpacity onPress={() => setManaging(true)} style={s.smallButton}><Text style={s.link}>إدارة المستثمرين</Text></TouchableOpacity></View>
    {locked ? <Text style={s.protected}>حقوق مرتبطة بسداد أو إقفال. المبالغ محفوظة؛ تصحيح المالك يتم بمراجعة مستقلة.</Text> : <Text style={s.hint}>اختر المستثمر ثم أدخل مبلغ مشاركته. النسبة تُحسب تلقائياً.</Text>}
    {rows.map((row, index) => {
      const investor = registry.items.find((i) => i.id === Number(row.investor_id));
      const name = investor?.name || row.investor_name || 'مستثمر';
      const amount = parseMoneyCents(row.amount);
      const percent = total > 0 && amount !== null ? ((amount / total) * 100).toFixed(2) : '0.00';
      return <View key={row.allocation_id || `investor-${row.investor_id}`} style={s.allocationRow}>
        <View style={s.heading}><Text style={s.name}>{name}</Text><Text style={s.percent}>{percent}%</Text></View>
        <Text style={s.label}>مبلغ المشاركة · ريال</Text>
        <TextInput testID={`investor-amount-${row.investor_id}`} accessibilityLabel={`مبلغ مشاركة ${name}`} value={row.amount} onChangeText={(v) => setAmount(index, v)} keyboardType="decimal-pad" editable={!locked} placeholder="0.00" style={[s.input, s.amount, locked && s.readOnly]} textAlign="right" />
        {!locked ? <View style={s.actions}>
          <TouchableOpacity onPress={() => onChange(rows.filter((_, i) => i !== index))} style={s.smallButton}><Text style={s.remove}>إزالة المشاركة</Text></TouchableOpacity>
          {remaining > 0 ? <TouchableOpacity onPress={() => setAmount(index, amountText(((amount || 0) + remaining) / 100))} style={s.smallButton}><Text style={s.link}>إسناد المتبقي</Text></TouchableOpacity> : null}
        </View> : null}
        {!!row.allocation_id && onChangeOwner ? <TouchableOpacity onPress={() => onChangeOwner({ ...row, investor_name: name })} style={s.smallButton}><Text style={s.link}>{locked ? 'تصحيح المستثمر' : 'تصحيح / نقل الحصة'}</Text></TouchableOpacity> : null}
      </View>;
    })}
    {!locked ? <Action testID="add-investor-participation" secondary onPress={() => { setChoosing(!choosing); setQuery(''); }}>＋ إضافة مستثمر</Action> : null}
    {choosing && !locked ? <View style={s.picker}>
      <TextInput testID="investor-picker-search" value={query} onChangeText={setQuery} placeholder="ابحث واختر المستثمر" style={s.input} textAlign="right" />
      {registry.loading ? <ActivityIndicator color="#0f766e" /> : null}
      <ScrollView nestedScrollEnabled style={s.options} keyboardShouldPersistTaps="handled">
        {available.map((i) => <TouchableOpacity testID={`choose-investor-${i.id}`} key={i.id} style={s.option} onPress={() => { onChange([...rows, { investor_id: i.id, investor_name: i.name, amount: '' }]); setChoosing(false); setQuery(''); }}><Text style={s.name}>{i.name}</Text><Text style={s.link}>اختيار</Text></TouchableOpacity>)}
      </ScrollView>
      {!registry.loading && !available.length ? <Text style={s.hint}>لا توجد أسماء أخرى مطابقة. يمكنك إضافة مستثمر من الإدارة.</Text> : null}
    </View> : null}
    {!!registry.error && <><Text style={s.error}>{registry.error}</Text><Action secondary onPress={registry.refresh}>إعادة تحميل المستثمرين</Action></>}
    {!!inputError && <Text accessibilityRole="alert" style={s.error}>{inputError}</Text>}
    <View testID="allocation-balance" style={[s.balance, remaining !== 0 && s.balanceWarning]}>
      <View style={s.heading}><Text style={s.label}>مجموع المشاركات</Text><Text style={s.name}>{money(allocated / 100)}</Text></View>
      <View style={s.heading}><Text style={s.label}>{remaining < 0 ? 'زيادة عن أصل الاستثمار' : 'غير موزع'}</Text><Text style={[s.name, remaining !== 0 && s.remove]}>{remaining === null ? '—' : money(Math.abs(remaining) / 100)}</Text></View>
      {remaining !== 0 && item ? <Text style={s.hint}>يبقى التوزيع السابق محفوظاً عند تعديل الملاحظات أو التواريخ فقط.</Text> : null}
    </View>
    {item?.id ? <>
      <TouchableOpacity onPress={loadHistory} style={s.smallButton}><Text style={s.link}>{history === null ? 'سجل تغييرات الحقوق' : 'إخفاء سجل التغييرات'}</Text></TouchableOpacity>
      {!!historyError && <Text style={s.error}>{historyError}</Text>}
      {history !== null ? <View style={s.history}>
        {!history.length ? <Text style={s.hint}>لا تغييرات مسجلة منذ تفعيل سجل الحقوق.</Text> : history.map((h) => <View key={h.id} style={s.auditRow}>
          <Text style={s.name}>{h.action === 'allocation_owner_corrected' ? 'تصحيح المستثمر' : h.action === 'unpaid_allocation_transferred' ? 'نقل حصة قبل السداد' : 'حفظ توزيع المشاركات'}</Text>
          <Text style={s.hint}>{h.created_at}</Text>
          {h.before?.owner && h.after?.owner ? <Text style={s.hint}>{h.before.owner.name} ← {h.after.owner.name}</Text> : null}
          {!!h.reason && <Text style={s.hint}>{h.reason}</Text>}
        </View>)}
      </View> : null}
    </> : null}
  </View>;
}

export function InvestorOwnerChangeModal({ visible, row, item, onClose, onDone }) {
  const registry = useRegistry(visible);
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState('correction');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locked = hasProtectedAllocations(item);
  useEffect(() => { if (visible) { setTarget(null); setMode('correction'); setReason(''); setPreview(null); setConfirmed(false); setError(''); } }, [visible, row?.allocation_id]);
  const data = () => ({ investor_id: target, mode, reason: reason.trim(), allocation_version: item?.allocation_version });
  const inspect = async () => {
    setSaving(true); setError('');
    try { const json = await requestJson(`/ta3meed/allocations/${row.allocation_id}/owner-preview`, { method: 'POST', body: JSON.stringify(data()) }); setPreview(json.data); setConfirmed(false); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const commit = async () => {
    setSaving(true); setError('');
    try {
      await requestJson(`/ta3meed/allocations/${row.allocation_id}/owner-change`, { method: 'POST', body: JSON.stringify({ ...data(), preview_token: preview.preview_token, confirmed: true }) });
      onDone?.();
    } catch (e) { setError(e.message); setPreview(null); setConfirmed(false); } finally { setSaving(false); }
  };
  const currentIds = new Set((item?.allocations || []).map((a) => a.investor_id));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !saving && onClose()}><View style={s.backdrop}><View style={s.modal}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalContent}>
      <Text style={s.title}>مراجعة تغيير صاحب الحصة</Text>
      <Text style={s.hint}>{item?.reference_number} · {row?.investor_name} · {money(row?.amount)}</Text>
      {!preview ? <>
        <View style={s.actions}><Action secondary={mode !== 'correction'} onPress={() => setMode('correction')}>تصحيح تسجيل خاطئ</Action>{!locked ? <Action secondary={mode !== 'transfer'} onPress={() => setMode('transfer')}>نقل حصة قبل السداد</Action> : null}</View>
        <Text style={s.protected}>{mode === 'correction' ? 'لتصحيح اختيار المستثمر الخطأ فقط. ستُربط الحصة وتوزيعات دفعاتها بالمستثمر الصحيح، دون إنشاء حركة أموال جديدة.' : 'تنتقل هذه الحصة غير المسددة إلى المستثمر المختار، مع حفظ التغيير في سجل الحقوق.'}</Text>
        {locked ? <Text style={s.hint}>نقل الملكية بعد بدء السداد محمي من هذا النموذج للمحافظة على الحقوق المسجلة.</Text> : null}
        <Text style={s.label}>المستثمر الصحيح</Text>
        {registry.items.filter((i) => Number(i.is_active) && !currentIds.has(i.id)).map((i) => <TouchableOpacity key={i.id} onPress={() => setTarget(i.id)} style={[s.option, target === i.id && s.selected]}><Text style={s.name}>{i.name}</Text><Text style={s.link}>{target === i.id ? '✓' : 'اختيار'}</Text></TouchableOpacity>)}
        <Text style={s.label}>سبب التصحيح أو النقل</Text>
        <TextInput testID="investor-owner-reason" multiline value={reason} onChangeText={setReason} placeholder="اكتب سبباً واضحاً ليُحفظ في سجل الحقوق" style={[s.input, { minHeight: 80 }]} textAlign="right" />
        <Action testID="preview-investor-owner-change" disabled={saving || !target || reason.trim().length < 5} onPress={inspect}>{saving ? 'جاري المراجعة…' : 'مراجعة الأثر قبل الحفظ'}</Action>
      </> : <>
        <View style={s.balance}>
          <Text style={s.name}>من: {preview.from_investor.name}</Text><Text style={s.name}>إلى: {preview.to_investor.name}</Text>
          <Text style={s.hint}>أصل الحصة: {money(preview.principal_amount)}</Text><Text style={s.hint}>الربح المتوقع: {money(preview.expected_profit_amount)}</Text>
          <Text style={s.name}>المستلم المرتبط بالحصة: {money(preview.received_amount)}</Text><Text style={s.hint}>توزيعات دفعات متأثرة: {preview.receipt_count}</Text>
          {preview.receipt_shares.map((r) => <Text style={s.hint} key={r.id}>توزيع دفعة: {money(r.received_amount)}</Text>)}
          <Text style={s.hint}>السبب: {preview.reason}</Text>
        </View>
        <TouchableOpacity testID="confirm-investor-owner-change" accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed(!confirmed)} style={s.option}><Text style={s.name}>{mode === 'correction' ? 'أؤكد أن هذا تصحيح لخطأ في تسجيل المالك' : 'أوافق على نقل هذه الحصة غير المسددة'}</Text><Text style={s.link}>{confirmed ? '☑' : '☐'}</Text></TouchableOpacity>
        <Action disabled={!confirmed || saving} onPress={commit}>{saving ? 'جاري الحفظ…' : 'اعتماد وحفظ التغيير الموثق'}</Action>
        <Action secondary disabled={saving} onPress={() => { setPreview(null); setConfirmed(false); }}>تعديل الاختيار</Action>
      </>}
      {!!registry.error && <Text style={s.error}>{registry.error}</Text>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Action secondary disabled={saving} onPress={onClose}>رجوع دون تغيير</Action>
    </ScrollView>
  </View></View></Modal>;
}

const s = StyleSheet.create({
  panel: { gap: 12, paddingVertical: 12, width: '100%' },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  hint: { color: '#64748b', fontSize: 12, lineHeight: 21, textAlign: 'right' },
  label: { color: '#475569', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { color: '#0f172a', fontSize: 14, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  percent: { color: '#0f766e', fontSize: 13, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, color: '#0f172a', fontSize: 15, minHeight: 48 },
  amount: { fontSize: 20, fontWeight: '800' },
  readOnly: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  protected: { color: '#0f766e', backgroundColor: '#ecfdf5', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 22, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  button: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', minHeight: 48 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 13, textAlign: 'center' },
  secondary: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4' },
  secondaryText: { color: '#0f766e' },
  disabled: { opacity: 0.45 },
  smallButton: { paddingHorizontal: 6, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  link: { color: '#0f766e', fontWeight: '800', fontSize: 12, textAlign: 'right' },
  remove: { color: '#b91c1c', fontWeight: '800', fontSize: 12 },
  error: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  allocationRow: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 17, padding: 13, gap: 8 },
  picker: { borderWidth: 1, borderColor: '#99f6e4', borderRadius: 15, padding: 10, gap: 8, backgroundColor: '#f8fafc' },
  options: { maxHeight: 220 },
  option: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, minHeight: 50, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  selected: { backgroundColor: '#ccfbf1', borderRadius: 12 },
  balance: { backgroundColor: '#ecfdf5', borderRadius: 15, padding: 13, gap: 9, borderWidth: 1, borderColor: '#99f6e4' },
  balanceWarning: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  profileRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 11, gap: 7, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  grow: { flex: 1, gap: 4 },
  registryList: { maxHeight: 330 },
  history: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 10 },
  auditRow: { gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.5)', padding: 16 },
  modal: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 24, padding: 16 },
  modalContent: { gap: 13, paddingBottom: 10 },
});
