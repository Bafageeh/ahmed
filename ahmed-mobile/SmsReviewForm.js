import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentAhmedSession } from './ahmedCurrentUser';
import { approveSmsReview, fetchSmsReview } from './smsReviewApi';

const KINDS = { deposit: 'إيداع للمحفظة', withdrawal: 'سحب من المحفظة', repayment: 'سداد فرصة' };
const TYPES = { partial: 'جزئي', full: 'كامل', early_settlement: 'تسوية مبكرة' };
const SOURCES = { manual: 'يدوي', sms: 'رسالة', receipt: 'سجل السداد' };
const digits = (value) => String(value).replace(/[٠-٩۰-۹]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.includes(c) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(c) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/٫/g, '.').replace(/[٬,]/g, '');
const money = (cents) => (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requiredFields = (data) => ['kind', 'amount', 'entry_date', ...(data.kind === 'repayment' ? ['reference', 'receipt_type'] : [])];

export default function SmsReviewForm({ item, onApproved, onCancel }) {
  const [form, setForm] = useState(null);
  const [sources, setSources] = useState({});
  const [missing, setMissing] = useState([]);
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [independent, setIndependent] = useState(false);
  const mounted = useRef(true);
  const writing = useRef(false);
  const sessionKey = useRef(getCurrentAhmedSession()?.sessionKey);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await fetchSmsReview(item.id, sessionKey.current);
      if (mounted.current) {
        const suggestion = { kind: '', amount: '', entry_date: '', reference: '', receipt_type: '', ...result.suggestion };
        setForm(suggestion); setSources(result.sources || {});
        setMissing(requiredFields(suggestion).filter((key) => !suggestion[key])); setEditing(false);
        setVersion(result.version); setConflict(null); setConfirmed(false); setIndependent(false);
      }
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, [item.id]);

  const change = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    setMissing((current) => [...new Set([...current, ...requiredFields(next).filter((field) => !next[field])])]);
    setSources((current) => ({ ...current, [key]: 'manual' }));
    setConflict(null); setIndependent(false); setConfirmed(false); setError('');
  };
  const submit = async (mode = 'new', entryId = null) => {
    if (writing.current || !form) return;
    if (requiredFields(form).some((key) => !form[key]?.trim())) { setError('أكمل البيانات الناقصة فقط قبل الاعتماد.'); return; }
    if (!confirmed) { setError('أكد أنك راجعت الرسالة وتحققت من اكتمال العملية.'); return; }
    const amount = digits(form.amount).trim();
    const entryDate = digits(form.entry_date).trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { setError('أدخل مبلغًا صحيحًا أكبر من صفر، بحد أقصى رقمين عشريين.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) { setError('أدخل التاريخ بصيغة سنة-شهر-يوم، مثل 2026-10-26.'); return; }
    if (form.kind === 'repayment' && !form.reference.trim()) { setError('أدخل رقم الفرصة قبل اعتماد السداد.'); return; }
    writing.current = true; setBusy(true); setError('');
    try {
      const result = await approveSmsReview(item.id, {
        ...form, amount, entry_date: entryDate, reference: form.reference.trim(), version, confirmed: true,
        mode, ...(mode === 'link' ? { link_entry_id: entryId } : {}),
        confirm_duplicate: mode === 'new' && Boolean(conflict && independent),
        ...(conflict?.duplicate_token ? { duplicate_token: conflict.duplicate_token } : {}),
      }, sessionKey.current);
      if (mounted.current) onApproved(result);
    } catch (e) {
      if (mounted.current) {
        setError(e.message);
        if (e.data?.conflict) { setConflict(e.data); setIndependent(false); }
      }
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  };

  const needs = (key) => editing || missing.includes(key);
  const incomplete = Boolean(form && requiredFields(form).some((key) => !form[key]?.trim()));
  const hasMissing = Boolean(form && requiredFields(form).some((key) => missing.includes(key)));
  const rows = form ? [
    ['kind', 'نوع الحركة', KINDS[form.kind]],
    ['amount', 'المبلغ', form.amount ? `${money(Number(form.amount) * 100)} ر.س` : ''],
    ['entry_date', 'التاريخ', form.entry_date],
    ['reference', form.kind === 'repayment' ? 'رقم الفرصة' : 'مرجع العملية', form.reference],
    ...(form.kind === 'repayment' ? [['receipt_type', 'نوع السداد', TYPES[form.receipt_type]]] : []),
  ].filter(([key, , value]) => value && !missing.includes(key)) : [];

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrapper} testID="sms-message-review-form">
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.heading}><Text style={s.title}>اعتماد الرسالة</Text><Text style={s.subtitle}>تُقرأ البيانات تلقائيًا؛ أكمل الناقص ثم اعتمد العملية.</Text></View>
      <Text selectable style={s.body}>{item.body}</Text>
      {loading ? <ActivityIndicator style={s.loader} color="#6d28d9" /> : form ? <>
        {!editing && rows.length ? <View style={s.summary} testID="sms-review-auto-data">
          <Text style={s.summaryTitle}>بيانات العملية</Text>
          {rows.map(([key, label, value]) => <View style={s.summaryRow} key={key}><Text style={s.summaryLabel}>{label}</Text><View style={s.summaryValueWrap}><Text selectable style={s.summaryValue}>{value}</Text>{key === 'entry_date' && ['sent_at', 'received_at'].includes(sources[key]) ? <Text style={s.sourceNote}>{sources[key] === 'sent_at' ? 'من تاريخ الرسالة' : 'من وقت وصول الرسالة'}</Text> : null}</View></View>)}
        </View> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={editing ? 'عرض ملخص البيانات' : 'تعديل البيانات المقروءة'} disabled={busy} onPress={() => setEditing((value) => !value)} style={s.editButton}><Text style={s.linkText}>{editing ? 'عرض الملخص' : 'تعديل البيانات'}</Text></TouchableOpacity>
        {hasMissing && !editing ? <Text style={s.missingTitle}>أكمل البيانات غير المتوفرة أو غير الواضحة</Text> : null}
        {needs('kind') ? <><Text style={s.label}>نوع الحركة</Text><View style={s.choices}>{Object.entries(KINDS).map(([key, label]) => <Choice key={key} title={label} selected={form.kind === key} disabled={busy} onPress={() => change('kind', key)} />)}</View></> : null}
        {needs('amount') ? <><Text style={s.label}>المبلغ بالريال</Text><TextInput accessibilityLabel="مبلغ اعتماد الرسالة" value={form.amount} onChangeText={(value) => change('amount', value)} editable={!busy} keyboardType="decimal-pad" style={s.input} maxLength={20} /></> : null}
        {needs('entry_date') ? <><Text style={s.label}>تاريخ العملية (سنة-شهر-يوم)</Text><TextInput accessibilityLabel="تاريخ اعتماد الرسالة" value={form.entry_date} onChangeText={(value) => change('entry_date', value)} editable={!busy} style={s.input} placeholder="YYYY-MM-DD" maxLength={10} /></> : null}
        {(form.kind === 'repayment' && needs('reference')) || (editing && form.kind !== 'repayment') ? <><Text style={s.label}>{form.kind === 'repayment' ? 'رقم فرصة تعميد' : 'مرجع العملية (اختياري)'}</Text><TextInput accessibilityLabel={form.kind === 'repayment' ? 'رقم فرصة تعميد' : 'مرجع العملية'} value={form.reference} onChangeText={(value) => change('reference', value)} editable={!busy} style={s.input} autoCapitalize="characters" autoCorrect={false} maxLength={100} /></> : null}
        {form.kind === 'repayment' && needs('receipt_type') ? <><Text style={s.label}>نوع السداد</Text><View style={s.choices}>{Object.entries(TYPES).map(([key, label]) => <Choice key={key} title={label} selected={form.receipt_type === key} disabled={busy} onPress={() => change('receipt_type', key)} />)}</View></> : null}
        {form.kind === 'repayment' ? <Text style={s.note}>يُحدّث السداد الفرصة وحصص المستثمرين ويُضاف للمحفظة مرة واحدة.</Text> : null}
        <Check text="راجعت الرسالة وتحققت من اكتمال العملية وصحة البيانات." checked={confirmed} disabled={busy} onPress={() => setConfirmed((value) => !value)} />
        {conflict ? <View style={s.warning}>
          <Text style={s.warningTitle}>توجد حركة مشابهة</Text><Text style={s.note}>إذا كانت العملية مسجلة، اربط الرسالة بها ليبقى الرصيد كما هو. اعتمدها مستقلة فقط إذا كانت عملية أخرى.</Text>
          {conflict.candidates.map((entry) => <View key={entry.id} style={s.candidate}>
            <Text style={s.candidateTitle}>{KINDS[entry.kind] || 'سداد وارد'} · {money(entry.amount_cents)} ر.س</Text><Text style={s.note}>{entry.entry_date} · {SOURCES[entry.source] || entry.source}{entry.reference ? ` · ${entry.reference}` : ''}</Text>
            {entry.linkable ? <TouchableOpacity accessibilityLabel={`ربط الرسالة بالحركة ${entry.id}`} disabled={busy || !confirmed} onPress={() => submit('link', entry.id)} style={[s.linkButton, !confirmed && s.disabled]}><Text style={s.linkText}>اعتماد وربط بهذه الحركة</Text></TouchableOpacity> : <Text style={s.note}>لا تطابق هذه الحركة جميع بيانات الربط.</Text>}
          </View>)}
          <Check text="تحققت أنها عملية مستقلة عن الحركات المعروضة." checked={independent} disabled={busy} onPress={() => setIndependent((value) => !value)} />
        </View> : null}
      </> : null}
      {!!error && <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
      {!loading && !form ? <TouchableOpacity onPress={load} style={s.linkButton}><Text style={s.linkText}>إعادة تحميل بيانات المراجعة</Text></TouchableOpacity> : null}
      {form && !loading ? <TouchableOpacity testID="approve-sms-message" accessibilityLabel={conflict ? 'اعتماد الرسالة كعملية مستقلة' : 'تأكيد اعتماد الرسالة'} disabled={busy || incomplete || !confirmed || Boolean(conflict && !independent)} onPress={() => submit()} style={[s.approve, (busy || incomplete || !confirmed || Boolean(conflict && !independent)) && s.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.approveText}>{conflict ? 'اعتماد كعملية مستقلة' : 'تأكيد الاعتماد وتحديث السجلات'}</Text>}
      </TouchableOpacity> : null}
      <TouchableOpacity disabled={busy} onPress={onCancel} style={s.cancel}><Text style={s.cancelText}>العودة إلى تفاصيل الرسالة</Text></TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Choice({ title, selected, disabled, onPress }) {
  return <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[s.choice, selected && s.choiceSelected]}><Text style={[s.choiceText, selected && s.choiceTextSelected]}>{title}</Text></TouchableOpacity>;
}
function Check({ text, checked, disabled, onPress }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={s.checkRow}><View style={[s.checkBox, checked && s.checkSelected]}><Text style={s.checkMark}>{checked ? '✓' : ''}</Text></View><Text style={s.checkText}>{text}</Text></TouchableOpacity>;
}
const s = StyleSheet.create({
  summary: { marginTop: 14, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#e7e1f6' }, summaryTitle: { textAlign: 'right', fontSize: 13, color: '#5b4694', fontWeight: '800', marginBottom: 5 }, summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 7 }, summaryLabel: { textAlign: 'right', color: '#64748b', fontSize: 12 }, summaryValueWrap: { flexShrink: 1 }, summaryValue: { textAlign: 'left', color: '#172033', fontSize: 14, fontWeight: '700' }, sourceNote: { color: '#64748b', fontSize: 10, textAlign: 'left', marginTop: 2 }, editButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 3, minHeight: 44, justifyContent: 'center' }, missingTitle: { textAlign: 'right', color: '#5b4694', fontSize: 12, fontWeight: '700', marginTop: 3 },
  wrapper: { flexShrink: 1 }, content: { paddingBottom: 8 }, heading: { marginBottom: 12 }, title: { color: '#172033', fontSize: 20, fontWeight: '800', textAlign: 'right' }, subtitle: { fontSize: 12, lineHeight: 20, color: '#64748b', textAlign: 'right', marginTop: 4 }, body: { color: '#475569', fontSize: 12, lineHeight: 21, textAlign: 'right', backgroundColor: '#f5f6fa', padding: 12, borderRadius: 12 }, loader: { padding: 24 },
  label: { color: '#334155', fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 14, marginBottom: 7 }, input: { borderWidth: 1, borderColor: '#dce1eb', borderRadius: 12, backgroundColor: '#fff', color: '#172033', fontSize: 15, textAlign: 'right', padding: 12, minHeight: 46 }, choices: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }, choice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#dce1eb' }, choiceSelected: { backgroundColor: '#ede9fe', borderColor: '#a78bfa' }, choiceText: { color: '#64748b', fontSize: 12, fontWeight: '600' }, choiceTextSelected: { color: '#5b21b6' },
  note: { color: '#64748b', textAlign: 'right', fontSize: 11, lineHeight: 19, marginTop: 5 }, checkRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 13 }, checkBox: { width: 24, height: 24, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, checkSelected: { borderColor: '#6d28d9', backgroundColor: '#6d28d9' }, checkMark: { color: '#fff', fontSize: 16, fontWeight: '800' }, checkText: { flex: 1, color: '#334155', fontSize: 12, lineHeight: 20, textAlign: 'right' }, warning: { padding: 12, borderRadius: 13, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }, warningTitle: { color: '#92400e', fontSize: 14, fontWeight: '800', textAlign: 'right' }, candidate: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginTop: 10 }, candidateTitle: { color: '#334155', fontWeight: '700', fontSize: 13, textAlign: 'right' }, linkButton: { borderRadius: 10, backgroundColor: '#ede9fe', padding: 11, alignItems: 'center', marginTop: 9 }, linkText: { color: '#5b21b6', fontSize: 12, fontWeight: '700' }, approve: { padding: 14, minHeight: 48, borderRadius: 13, backgroundColor: '#6d28d9', alignItems: 'center', marginTop: 12 }, approveText: { color: '#fff', fontSize: 13, fontWeight: '800' }, disabled: { opacity: 0.45 }, error: { color: '#b45309', fontSize: 12, lineHeight: 21, textAlign: 'right', marginTop: 12 }, cancel: { paddingVertical: 14, alignItems: 'center' }, cancelText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
});
