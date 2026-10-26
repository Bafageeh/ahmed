import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UiIcon from './UiIcon';
import SmsArchiveScreen from './SmsArchiveScreen';
import { normalizeAmountInput, parseMoneyCents } from './ta3meedAllocationForm';
import { deleteTa3meedWalletEntry, fetchTa3meedWallet, saveTa3meedWalletEntry, walletRequestId } from './ta3meedWalletApi';

const ANDROID_STATUS_BAR_INSET = Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight || 0, 24) : 0;

const KINDS = { opening_balance: 'رصيد افتتاحي', deposit: 'إيداع', withdrawal: 'سحب', repayment: 'سداد وارد' };
const SOURCES = { manual: 'يدوي', sms: 'رسالة Ta3meed', receipt: 'سجل السداد' };
const money = (cents = 0) => (Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)?.value).join('-');
};

export default function Ta3meedWalletScreen({ onBack }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const mounted = useRef(true);
  const readVersion = useRef(0);
  const writing = useRef(false);
  const currentPage = useRef(1);

  const load = useCallback(async (nextPage = 1, silent = false) => {
    const mine = ++readVersion.current;
    if (!silent) setLoading(true);
    try {
      const result = await fetchTa3meedWallet(kind, nextPage);
      if (!mounted.current || mine !== readVersion.current) return;
      setRows((old) => nextPage === 1 ? result.data : [...old, ...result.data.filter((item) => !old.some((row) => row.id === item.id))]);
      setSummary(result.summary || {}); setPage(nextPage); currentPage.current = nextPage; setHasMore(Boolean(result.has_more));
    } catch (error) { if (mounted.current && mine === readVersion.current) setMessage(error.message); }
    finally { if (mounted.current && mine === readVersion.current) setLoading(false); }
  }, [kind]);

  useEffect(() => {
    mounted.current = true;
    load();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') load(1, true); });
    const timer = setInterval(() => { if (AppState.currentState === 'active' && currentPage.current === 1 && !writing.current) load(1, true); }, 30000);
    return () => { mounted.current = false; readVersion.current += 1; sub.remove(); clearInterval(timer); };
  }, [load]);

  const openForm = (entryKind, entry = null) => {
    setSelected(null); setConfirmDelete(false); setFormError(''); setDuplicateWarning(false);
    setForm({ id: entry?.id, revision: entry?.revision, kind: entryKind, amount: entry ? (Math.abs(entry.amount_cents) / 100).toFixed(2) : '',
      entry_date: entry?.entry_date || today(), notes: entry?.notes || '', transaction_reference: entry?.transaction_reference || '', request_id: walletRequestId() });
  };
  const save = async (allowDuplicate = false) => {
    if (!form || writing.current) return;
    const cents = parseMoneyCents(form.amount);
    if (cents === null || (cents <= 0 && form.kind !== 'opening_balance')) { setFormError('أدخل مبلغًا صحيحًا بمنزلتين عشريتين كحد أقصى.'); return; }
    writing.current = true; setBusy(true); setFormError('');
    try {
      await saveTa3meedWalletEntry({ kind: form.kind, amount: (cents / 100).toFixed(2), entry_date: form.entry_date,
        notes: form.notes, transaction_reference: form.transaction_reference, request_id: form.request_id,
        ...(form.id ? { expected_revision: form.revision } : {}), allow_duplicate: allowDuplicate }, form.id);
      if (!mounted.current) return;
      setForm(null); setMessage('تم حفظ الحركة وتحديث رصيد المحفظة.'); await load(1, true);
    } catch (error) {
      if (mounted.current) { setFormError(error.message); setDuplicateWarning(error.status === 409 && error.message.includes('حركة مستقلة')); }
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  };
  const remove = async () => {
    if (!selected || writing.current) return;
    writing.current = true; setBusy(true);
    try {
      await deleteTa3meedWalletEntry(selected);
      if (!mounted.current) return;
      setSelected(null); setConfirmDelete(false); setMessage('حُذفت الحركة من الرصيد مع حفظ سجل تعديلها.'); await load(1, true);
    } catch (error) { if (mounted.current) setMessage(error.message); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  };

  if (showSms) return <SmsArchiveScreen onBack={() => { setShowSms(false); load(1, true); }} />;
  return <SafeAreaView style={s.safe} testID="ta3meed-cash-wallet">
    <View style={s.header} testID="ta3meed-wallet-safe-header">
      <TouchableOpacity onPress={onBack} style={s.iconButton} accessibilityLabel="رجوع إلى تعميد"><UiIcon name="back" size={23} color="#142a36" /></TouchableOpacity>
      <View style={s.headerText}><Text style={s.title}>محفظة تعميد</Text><Text style={s.subtitle}>الإيداع والسحب والسداد الوارد</Text></View>
      <TouchableOpacity onPress={() => { setMessage(''); load(); }} style={s.iconButton} accessibilityLabel="تحديث المحفظة">{loading ? <ActivityIndicator color="#0f766e" /> : <UiIcon name="refresh" size={21} color="#0f766e" />}</TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} />}>
      <View style={s.hero}>
        <View style={s.heroTop}><View style={s.heroSymbol}><UiIcon name="wallet" size={23} color="#a7f3d0" /></View><Text style={s.heroLabel}>رصيد المحفظة المسجل</Text></View>
        <View style={s.amountRow}><Text style={s.currency}>ر.س</Text><Text style={[s.balance, Number(summary.balance_cents || 0) < 0 && { color: '#fecaca' }]} adjustsFontSizeToFit numberOfLines={1}>{money(summary.balance_cents)}</Text></View>
        <Text style={s.heroNote}>الرصيد الافتتاحي + الإيداعات + السدادات − السحوبات</Text>
        <View style={s.heroFooter}><Text style={s.heroCount}>{summary.count || 0} حركة مسجلة</Text><Text style={s.heroBadge}>Ta3meed</Text></View>
      </View>
      <View style={s.actions}>
        <Action title="إيداع" icon="add" color="#047857" onPress={() => openForm('deposit')} />
        <Action title="سحب" icon="payments" color="#c2410c" onPress={() => openForm('withdrawal')} />
        <Action title="رصيد افتتاحي" icon="wallet" color="#4f46e5" onPress={() => {
          const existing = rows.find((item) => item.kind === 'opening_balance');
          if (summary.has_opening_balance && !existing) { setKind('opening_balance'); setMessage('اختر الرصيد الافتتاحي من السجل لتعديله.'); }
          else openForm('opening_balance', existing);
        }} />
      </View>
      {!summary.has_opening_balance ? <TouchableOpacity style={s.openingNotice} onPress={() => openForm('opening_balance')}><Text style={s.openingTitle}>ابدأ بالرصيد الافتتاحي</Text><Text style={s.muted}>أدخل رصيد المحفظة قبل أول حركة مسجلة لضبط الرصيد.</Text></TouchableOpacity> : null}
      <View style={s.metrics}>
        <Metric title="الإيداعات" cents={summary.deposits_cents} color="#047857" />
        <Metric title="السحوبات" cents={summary.withdrawals_cents} color="#c2410c" />
        <Metric title="السداد الوارد" cents={summary.repayments_cents} color="#4f46e5" />
      </View>
      <TouchableOpacity style={s.smsLink} onPress={() => setShowSms(true)} accessibilityLabel="إدارة رسائل Ta3meed التلقائية"><View style={s.smsCopy}><Text style={s.smsTitle}>الحفظ التلقائي من رسائل Ta3meed</Text><Text style={s.muted}>إيداع وسحب مؤكدان، مع منع التكرار وتنبيهك بالإتمام.</Text></View><UiIcon name="sms" size={22} color="#0f766e" /></TouchableOpacity>
      {!!message && <Text accessibilityLiveRegion="polite" style={s.feedback}>{message}</Text>}
      <View style={s.listHeader}><Text style={s.listTitle}>الحركات المالية</Text><Text style={s.muted}>الأحدث أولًا</Text></View>
      <View style={s.filters}>{[['', 'الكل'], ...Object.entries(KINDS)].map(([key, label]) => <TouchableOpacity key={key || 'all'} onPress={() => setKind(key)} style={[s.chip, kind === key && s.chipActive]}><Text style={[s.chipText, kind === key && s.chipTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      {!rows.length && !loading ? <View style={s.empty}><UiIcon name="wallet" size={32} color="#94a3b8" /><Text style={s.emptyTitle}>لا توجد حركات في هذا القسم</Text><Text style={s.muted}>أضف حركة يدويًا أو فعّل استقبال رسائل Ta3meed.</Text></View> : rows.map((item) => <TouchableOpacity key={item.id} onPress={() => { setSelected(item); setConfirmDelete(false); }} style={s.entry}>
        <View style={[s.entryIcon, { backgroundColor: item.amount_cents < 0 ? '#fff1e8' : '#e8f7f1' }]}><UiIcon name={item.amount_cents < 0 ? 'payments' : 'wallet'} size={20} color={item.amount_cents < 0 ? '#c2410c' : '#047857'} /></View>
        <View style={s.entryCopy}><Text style={s.entryTitle}>{KINDS[item.kind]}</Text><Text style={s.entryMeta}>{item.entry_date} · {SOURCES[item.source]}</Text>{item.notes ? <Text numberOfLines={1} style={s.entryNotes}>{item.notes}</Text> : null}</View>
        <Text style={[s.entryAmount, { color: item.amount_cents < 0 ? '#c2410c' : '#047857' }]}>{item.amount_cents < 0 ? '−' : '+'}{money(Math.abs(item.amount_cents))}</Text>
      </TouchableOpacity>)}
      {hasMore ? <TouchableOpacity style={s.more} disabled={loading} onPress={() => load(page + 1)}><Text style={s.moreText}>عرض حركات أقدم</Text></TouchableOpacity> : null}
    </ScrollView>
    <Modal visible={Boolean(form)} transparent animationType="fade" onRequestClose={() => { if (!busy) setForm(null); }}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={s.dialog}>
        <View style={s.dialogBar}><Text style={s.dialogTitle}>{form?.id ? 'تعديل' : 'إضافة'} {KINDS[form?.kind]}</Text><TouchableOpacity disabled={busy} onPress={() => setForm(null)} style={s.iconButton} accessibilityLabel="إغلاق"><UiIcon name="close" size={22} color="#334155" /></TouchableOpacity></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.formBody}>
          {form?.kind === 'opening_balance' ? <Text style={s.muted}>الرصيد قبل أول حركة في السجل. هذا المبلغ لا يغيّر سجلات الاستثمار.</Text> : null}
          <Text style={s.fieldLabel}>المبلغ بالريال</Text><TextInput style={[s.input, s.amountInput]} autoFocus keyboardType="decimal-pad" value={form?.amount || ''} onChangeText={(amount) => { setForm((old) => ({ ...old, amount: normalizeAmountInput(amount) })); setDuplicateWarning(false); }} placeholder="0.00" editable={!busy} />
          <Text style={s.fieldLabel}>تاريخ الحركة</Text><TextInput style={s.input} value={form?.entry_date || ''} onChangeText={(entry_date) => setForm((old) => ({ ...old, entry_date: normalizeAmountInput(entry_date) }))} placeholder="YYYY-MM-DD" editable={!busy} />
          <Text style={s.fieldLabel}>مرجع العملية · اختياري</Text><TextInput style={s.input} value={form?.transaction_reference || ''} onChangeText={(transaction_reference) => setForm((old) => ({ ...old, transaction_reference }))} maxLength={100} editable={!busy} />
          <Text style={s.fieldLabel}>ملاحظة · اختياري</Text><TextInput style={[s.input, s.notesInput]} value={form?.notes || ''} onChangeText={(notes) => setForm((old) => ({ ...old, notes }))} multiline maxLength={2000} editable={!busy} />
          {!!formError && <Text accessibilityLiveRegion="polite" style={s.error}>{formError}</Text>}
          <TouchableOpacity disabled={busy} style={[s.save, busy && { opacity: 0.65 }]} onPress={() => save()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>حفظ وتحديث الرصيد</Text>}</TouchableOpacity>
          {duplicateWarning ? <TouchableOpacity disabled={busy} style={s.independent} onPress={() => save(true)}><Text style={s.independentText}>إضافة كحركة مستقلة</Text></TouchableOpacity> : null}
        </ScrollView>
      </View></KeyboardAvoidingView>
    </Modal>
    <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => { if (!busy) setSelected(null); }}><View style={s.overlay}><View style={s.dialog}>
      <View style={s.dialogBar}><Text style={s.dialogTitle}>{KINDS[selected?.kind]}</Text><TouchableOpacity disabled={busy} onPress={() => setSelected(null)} style={s.iconButton} accessibilityLabel="إغلاق التفاصيل"><UiIcon name="close" size={22} color="#334155" /></TouchableOpacity></View>
      <Text style={s.detailAmount}>{money(selected?.amount_cents)} ر.س</Text><Text style={s.detail}>{selected?.entry_date} · {SOURCES[selected?.source]}</Text>
      {selected?.transaction_reference ? <Text selectable style={s.detail}>المرجع: {selected.transaction_reference}</Text> : null}
      {selected?.notes ? <Text selectable style={s.detail}>{selected.notes}</Text> : null}
      {selected?.editable ? <View style={s.detailActions}><TouchableOpacity disabled={busy} style={s.edit} onPress={() => openForm(selected.kind, selected)}><Text style={s.editText}>تعديل الحركة</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={s.remove} onPress={() => setConfirmDelete(true)}><Text style={s.removeText}>حذف</Text></TouchableOpacity></View> : <Text style={s.autoNote}>{selected?.source === 'receipt' ? 'تُحدّث هذه الحركة مع سجل السداد المرتبط بها.' : 'حركة محفوظة تلقائيًا من رسالة Ta3meed.'}</Text>}
      {confirmDelete ? <View style={s.deleteConfirm}><Text style={s.error}>حذف الحركة وإعادة حساب رصيد المحفظة؟</Text><TouchableOpacity disabled={busy} onPress={remove} style={s.remove}>{busy ? <ActivityIndicator color="#b91c1c" /> : <Text style={s.removeText}>تأكيد الحذف</Text>}</TouchableOpacity></View> : null}
    </View></View></Modal>
  </SafeAreaView>;
}

function Action({ title, icon, color, onPress }) { return <TouchableOpacity onPress={onPress} style={s.action}><UiIcon name={icon} size={21} color={color} /><Text style={[s.actionText, { color }]}>{title}</Text></TouchableOpacity>; }
function Metric({ title, cents, color }) { return <View style={s.metric}><Text style={s.metricLabel}>{title}</Text><Text style={[s.metricAmount, { color }]} numberOfLines={1} adjustsFontSizeToFit>{money(cents)}</Text><Text style={s.metricCurrency}>ر.س</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7f8' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: ANDROID_STATUS_BAR_INSET + 9, paddingBottom: 9, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5ecef' }, headerText: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 9 }, title: { color: '#142a36', fontSize: 19, fontWeight: '900' }, subtitle: { color: '#70818d', fontSize: 11, marginTop: 3 }, iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, page: { padding: 14, paddingBottom: 35 },
  hero: { backgroundColor: '#123b3d', borderRadius: 21, padding: 18 }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroSymbol: { backgroundColor: '#215451', padding: 9, borderRadius: 13 }, heroLabel: { color: '#cae8df', fontSize: 13, fontWeight: '700' }, amountRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: 8, marginTop: 9 }, balance: { color: '#fff', fontSize: 34, fontWeight: '900', flexShrink: 1, fontVariant: ['tabular-nums'] }, currency: { color: '#a9d6c9', fontSize: 13, fontWeight: '700' }, heroNote: { color: '#abd1c8', fontSize: 10, marginTop: 6, textAlign: 'right', lineHeight: 17 }, heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#305654', marginTop: 13, paddingTop: 12 }, heroCount: { color: '#b6d7ce', fontSize: 11 }, heroBadge: { color: '#e0f8ef', fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 }, action: { flex: 1, backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#e3eceb', paddingVertical: 12, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }, actionText: { fontSize: 12, fontWeight: '800' }, openingNotice: { padding: 12, backgroundColor: '#eef2ff', borderRadius: 13, marginTop: 11, borderWidth: 1, borderColor: '#dce3ff' }, openingTitle: { color: '#4338ca', fontSize: 12, fontWeight: '800', textAlign: 'right' }, muted: { color: '#71818b', fontSize: 11, lineHeight: 18, textAlign: 'right', marginTop: 3 }, metrics: { flexDirection: 'row-reverse', gap: 7, marginTop: 11 }, metric: { flex: 1, padding: 11, backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#e6ecef', alignItems: 'flex-end' }, metricLabel: { color: '#71818b', fontSize: 10 }, metricAmount: { marginTop: 6, fontSize: 17, fontWeight: '900' }, metricCurrency: { color: '#8b99a1', fontSize: 10, marginTop: 2 },
  smsLink: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 11, backgroundColor: '#eaf5f1', borderRadius: 13 }, smsCopy: { flex: 1 }, smsTitle: { color: '#11645b', fontSize: 12, fontWeight: '800', textAlign: 'right' }, feedback: { backgroundColor: '#e7f1f8', borderRadius: 12, padding: 11, color: '#23536b', fontSize: 12, lineHeight: 20, textAlign: 'right', marginTop: 10 }, listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 21 }, listTitle: { color: '#142a36', fontSize: 16, fontWeight: '900' }, filters: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 10 }, chip: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#dfe8ec' }, chipActive: { backgroundColor: '#154d48', borderColor: '#154d48' }, chipText: { color: '#607684', fontSize: 11, fontWeight: '700' }, chipTextActive: { color: '#fff' },
  entry: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6ecef', borderRadius: 13, padding: 12, marginBottom: 7 }, entryIcon: { width: 37, height: 37, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, entryCopy: { flex: 1, alignItems: 'flex-end' }, entryTitle: { color: '#183341', fontSize: 13, fontWeight: '800' }, entryMeta: { color: '#8a99a2', fontSize: 10, marginTop: 4 }, entryNotes: { color: '#71818b', fontSize: 10, marginTop: 4, textAlign: 'right' }, entryAmount: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] }, empty: { padding: 25, alignItems: 'center', backgroundColor: '#fff', borderRadius: 15 }, emptyTitle: { color: '#526a78', fontWeight: '800', marginTop: 10, fontSize: 13 }, more: { padding: 13, alignItems: 'center' }, moreText: { color: '#0f766e', fontWeight: '800', fontSize: 12 },
  overlay: { flex: 1, backgroundColor: '#10293688', alignItems: 'center', justifyContent: 'center', padding: 18 }, dialog: { backgroundColor: '#fff', borderRadius: 21, padding: 16, width: '100%', maxWidth: 480, maxHeight: '90%' }, dialogBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }, dialogTitle: { fontSize: 18, fontWeight: '900', color: '#183341' }, formBody: { paddingBottom: 4 }, fieldLabel: { color: '#607684', fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 7, marginTop: 14 }, input: { backgroundColor: '#f5f8fa', borderWidth: 1, borderColor: '#dee8ed', borderRadius: 12, minHeight: 46, padding: 11, color: '#183341', textAlign: 'right', fontSize: 14 }, amountInput: { fontSize: 24, fontWeight: '800' }, notesInput: { minHeight: 75, textAlignVertical: 'top' }, save: { backgroundColor: '#0f766e', borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 17 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 14 }, error: { color: '#b91c1c', fontSize: 12, lineHeight: 21, textAlign: 'right', marginTop: 10 }, independent: { alignItems: 'center', padding: 12 }, independentText: { color: '#b45309', fontWeight: '800', fontSize: 12 }, detailAmount: { color: '#123b3d', fontWeight: '900', fontSize: 29, marginVertical: 12, textAlign: 'right' }, detail: { color: '#607684', fontSize: 13, lineHeight: 22, textAlign: 'right', marginTop: 4 }, detailActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 18 }, edit: { flex: 1, backgroundColor: '#e8f6f0', borderRadius: 12, padding: 13, alignItems: 'center' }, editText: { color: '#047857', fontWeight: '800' }, remove: { backgroundColor: '#fff1f0', borderRadius: 12, padding: 13, alignItems: 'center' }, removeText: { color: '#b91c1c', fontWeight: '800' }, autoNote: { color: '#71818b', fontSize: 11, lineHeight: 19, textAlign: 'right', padding: 11, backgroundColor: '#f4f7f8', borderRadius: 12, marginTop: 14 }, deleteConfirm: { marginTop: 10, gap: 10 },
});
