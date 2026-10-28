import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import UiIcon from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';
import { normalizeAmountInput, parseMoneyCents } from './ta3meedAllocationForm';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const ACCENT = '#6d57b8';
const ANDROID_TOP = Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight || 0, 24) : 0;
const today = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)?.value).join('-');
};
const formatAmount = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const searchKey = (value) => String(value || '').normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').trim().toLowerCase();
const frequencyLabel = (value) => value === 'annual' ? 'سنوي' : 'شهري';
const monthlyEquivalent = (item) => item.frequency === 'annual' ? Number(item.amount || 0) / 12 : Number(item.amount || 0);
const annualEquivalent = (item) => item.frequency === 'annual' ? Number(item.amount || 0) : Number(item.amount || 0) * 12;
const emptyForm = () => ({ id: null, definition: '', amount: '', expense_date: today(), frequency: 'monthly', notes: '' });
const dateLabel = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).split('-').reverse().join('/') : (value || '—');

function normalizeExpenseDate(value) {
  const date = String(value || '').trim().replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function apiError(json, fallback) {
  return Object.values(json.errors || {}).flat().join('\n') || json.message || fallback;
}
function Money({ value, style, currencyStyle, loading = false }) {
  return <View style={s.moneyRow}>
    <Text style={[s.money, style]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{loading ? '—' : formatAmount(value)}</Text>
    <Text style={[s.currency, currencyStyle]}>ر.س</Text>
  </View>;
}
function IconAction({ icon, label, onPress, danger, disabled }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} activeOpacity={0.7} style={[s.iconAction, danger && s.dangerAction, disabled && s.disabled]}>
    <UiIcon name={icon} size={19} color={danger ? '#bd5265' : ACCENT} />
  </TouchableOpacity>;
}
function FilterChip({ label, value, active, onPress }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[s.filterChip, active && s.filterChipActive]} activeOpacity={0.75}>
    <Text style={[s.filterText, active && s.filterTextActive]}>{value}</Text>
  </TouchableOpacity>;
}

export default function PersonalExpensesScreen({ onBack }) {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const mounted = useRef(true);
  const readVersion = useRef(0);
  const writing = useRef(false);
  const scrollRef = useRef(null);

  const totals = useMemo(() => ({
    monthly: items.reduce((sum, item) => sum + monthlyEquivalent(item), 0),
    annual: items.reduce((sum, item) => sum + annualEquivalent(item), 0),
  }), [items]);
  const visibleItems = useMemo(() => {
    const key = searchKey(query);
    return items.filter((item) => (filter === 'all' || item.frequency === filter)
      && (!key || searchKey([item.definition, item.notes].filter(Boolean).join(' ')).includes(key)));
  }, [items, query, filter]);

  const loadItems = async (refresh = false) => {
    const version = ++readVersion.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch(API_URL + '/personal-expenses', { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(json, 'تعذر تحميل المصروفات.'));
      if (!mounted.current || version !== readVersion.current) return false;
      setItems(Array.isArray(json.data) ? json.data : []);
      setLoaded(true);
      return true;
    } catch (error) {
      if (mounted.current && version === readVersion.current) setNotice({ kind: 'error', text: error.message || 'تعذر تحميل المصروفات.' });
      return false;
    } finally {
      if (mounted.current && version === readVersion.current) { setLoading(false); setRefreshing(false); }
    }
  };
  useEffect(() => {
    mounted.current = true;
    loadItems();
    return () => { mounted.current = false; readVersion.current += 1; };
  }, []);
  const refreshExpenses = () => { setNotice(null); return loadItems(true); };
  const updateForm = (key, value) => { setForm((current) => ({ ...current, [key]: value })); if (formError) setFormError(''); };
  const openAdd = () => {
    if (writing.current) return;
    Keyboard.dismiss(); setForm(emptyForm()); setFormError(''); setFormOpen(true);
  };
  const startEdit = (item) => {
    if (writing.current) return;
    Keyboard.dismiss();
    setForm({ id: item.id, definition: item.definition || '', amount: String(item.amount ?? ''), expense_date: item.expense_date || today(), frequency: item.frequency === 'annual' ? 'annual' : 'monthly', notes: item.notes || '' });
    setFormError(''); setFormOpen(true);
  };
  const closeForm = () => { if (!writing.current) { Keyboard.dismiss(); setFormOpen(false); setFormError(''); } };
  const saveExpense = async () => {
    if (writing.current) return;
    const definition = form.definition.trim();
    const cents = parseMoneyCents(form.amount);
    const expenseDate = normalizeExpenseDate(form.expense_date);
    if (!definition) return setFormError('أدخل تعريف المصروف.');
    if (cents === null || cents <= 0) return setFormError('أدخل مبلغًا أكبر من صفر بمنزلتين عشريتين كحد أقصى.');
    if (!expenseDate) return setFormError('أدخل تاريخًا صحيحًا بصيغة YYYY-MM-DD.');
    const editing = form.id !== null;
    writing.current = true; setSaving(true); setFormError(''); setNotice(null);
    try {
      const response = await fetch(API_URL + '/personal-expenses' + (editing ? '/' + encodeURIComponent(form.id) : ''), {
        method: editing ? 'PUT' : 'POST',
        headers: ahmedUserHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify({ definition, amount: cents / 100, expense_date: expenseDate, frequency: form.frequency, notes: form.notes.trim() || null }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(json, 'تعذر حفظ المصروف.'));
      if (!mounted.current) return;
      Keyboard.dismiss(); setFormOpen(false); setQuery(''); setFilter('all');
      const refreshed = await loadItems(true);
      if (mounted.current) {
        setNotice({ kind: refreshed ? 'success' : 'error', text: refreshed ? (editing ? 'تم تعديل المصروف.' : 'تمت إضافة المصروف.') : 'تم حفظ المصروف، وتعذر تحديث القائمة. اضغط تحديث.' });
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    } catch (error) {
      if (mounted.current) setFormError(error.message || 'تعذر حفظ المصروف.');
    } finally { writing.current = false; if (mounted.current) setSaving(false); }
  };
  const askDelete = (item) => { if (!writing.current) { setDeleteTarget(item); setDeleteError(''); } };
  const closeDelete = () => { if (!writing.current) { setDeleteTarget(null); setDeleteError(''); } };
  const deleteExpense = async () => {
    if (!deleteTarget || writing.current) return;
    writing.current = true; setDeleting(true); setDeleteError(''); setNotice(null);
    try {
      const response = await fetch(API_URL + '/personal-expenses/' + encodeURIComponent(deleteTarget.id), { method: 'DELETE', headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(json, 'تعذر حذف المصروف.'));
      if (!mounted.current) return;
      setDeleteTarget(null);
      const refreshed = await loadItems(true);
      if (mounted.current) setNotice({ kind: refreshed ? 'success' : 'error', text: refreshed ? 'تم حذف المصروف.' : 'تم حذف المصروف، وتعذر تحديث القائمة. اضغط تحديث.' });
    } catch (error) { if (mounted.current) setDeleteError(error.message || 'تعذر حذف المصروف.'); }
    finally { writing.current = false; if (mounted.current) setDeleting(false); }
  };

  return <SafeAreaView style={s.safe} testID="personal-expenses-modal-redesign">
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="رجوع إلى حساباتي" onPress={onBack} style={s.headerIcon}><UiIcon name="back" size={23} color={ACCENT} /></TouchableOpacity>
      <View style={s.headerCopy}><Text accessibilityRole="header" style={s.title}>مصروفاتي</Text><Text style={s.subtitle}>متابعة مصروفاتك الشهرية والسنوية</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="تحديث المصروفات" onPress={refreshExpenses} disabled={refreshing || saving || deleting} style={s.headerIcon}>{refreshing ? <ActivityIndicator color={ACCENT} /> : <UiIcon name="refresh" size={21} color={ACCENT} />}</TouchableOpacity>
    </View>

    <ScrollView ref={scrollRef} contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshExpenses} tintColor={ACCENT} />}>
      <View style={s.summary}>
        <View style={s.summaryHeading}><Text style={s.summaryLabel}>الإجمالي الشهري</Text><View style={s.summaryIcon}><UiIcon name="money" color="#ded7f4" size={22} /></View></View>
        <Money value={totals.monthly} loading={!loaded} style={s.mainAmount} currencyStyle={s.mainCurrency} />
        <Text style={s.summaryNote}>بعد تحويل المصروفات السنوية إلى شهرية</Text>
        <View style={s.annualRow}><Text style={s.annualLabel}>الإجمالي السنوي</Text><Money value={totals.annual} loading={!loaded} style={s.annualAmount} currencyStyle={s.annualCurrency} /></View>
      </View>

      {!!notice && <Text accessibilityRole="alert" style={[s.notice, notice.kind === 'error' && s.errorNotice]}>{notice.text}</Text>}

      <View style={s.search}>
        <UiIcon name="search" size={19} color="#9a94ab" />
        <TextInput accessibilityLabel="البحث في المصروفات" value={query} onChangeText={setQuery} placeholder="ابحث عن مصروف..." placeholderTextColor="#737b90" style={s.searchInput} textAlign="right" />
        {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => setQuery('')} style={s.clearSearch}><UiIcon name="close" size={17} color="#9690a8" /></TouchableOpacity>}
      </View>
      <View style={s.listTools}>
        <View style={s.filters}>
          <FilterChip label="كل المصروفات" value="الكل" active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="المصروفات الشهرية" value="شهري" active={filter === 'monthly'} onPress={() => setFilter('monthly')} />
          <FilterChip label="المصروفات السنوية" value="سنوي" active={filter === 'annual'} onPress={() => setFilter('annual')} />
        </View>
        <Text style={s.count}>{query || filter !== 'all' ? visibleItems.length + ' من ' + items.length : items.length + ' مصروف'}</Text>
      </View>

      {loading ? <ActivityIndicator color={ACCENT} style={s.loader} /> : null}
      {!loading && !visibleItems.length ? <View style={s.empty}>
        <View style={s.emptyIcon}><UiIcon name="wallet" color="#9d91bb" size={28} /></View>
        <Text style={s.emptyTitle}>{items.length ? 'لا توجد نتائج مطابقة' : loaded ? 'لا توجد مصروفات بعد' : 'تعذر تحميل المصروفات'}</Text>
        <Text style={s.emptyNote}>{items.length ? 'جرّب كلمة أخرى أو اعرض كل المصروفات.' : loaded ? 'أضف مصروفك الأول من الزر أسفل الشاشة.' : 'اضغط زر التحديث للمحاولة مجددًا.'}</Text>
        {items.length ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="مسح البحث والفلاتر" onPress={() => { setQuery(''); setFilter('all'); }} style={s.resetFilters}><Text style={s.resetFiltersText}>عرض الكل</Text></TouchableOpacity> : null}
      </View> : null}

      {visibleItems.map((item) => <ExpenseCard key={String(item.id)} item={item} compact={width < 360} disabled={saving || deleting} onEdit={() => startEdit(item)} onDelete={() => askDelete(item)} />)}
    </ScrollView>

    <TouchableOpacity accessibilityRole="button" accessibilityLabel="إضافة مصروف" onPress={openAdd} disabled={saving || deleting} activeOpacity={0.85} style={[s.addButton, (saving || deleting) && s.disabled]}><UiIcon name="add" size={24} color="#fff" /><Text style={s.addText}>إضافة مصروف</Text></TouchableOpacity>
    <ExpenseEditor visible={formOpen} form={form} error={formError} saving={saving} onChange={updateForm} onClose={closeForm} onSave={saveExpense} />
    <DeleteDialog item={deleteTarget} error={deleteError} busy={deleting} onClose={closeDelete} onDelete={deleteExpense} />
  </SafeAreaView>;
}

function ExpenseCard({ item, compact, disabled, onEdit, onDelete }) {
  const annual = item.frequency === 'annual';
  const equivalent = annual ? (item.monthly_equivalent ?? monthlyEquivalent(item)) : (item.annual_equivalent ?? annualEquivalent(item));
  return <View style={s.expenseCard}>
    <View style={s.expenseTop}>
      <View style={s.expenseIdentity}><View style={[s.expenseIcon, annual && s.annualIcon]}><UiIcon name="money" size={19} color={annual ? '#0f766e' : ACCENT} /></View><Text numberOfLines={2} style={s.expenseName}>{item.definition}</Text></View>
      <View style={s.cardAmount}><Money value={item.amount} style={{ fontSize: compact ? 18 : 21 }} /></View>
    </View>
    {item.notes ? <Text numberOfLines={2} style={s.expenseNotes}>{item.notes}</Text> : null}
    <View style={s.expenseMeta}>
      <View style={s.metaCopy}><View style={[s.frequencyBadge, annual && s.annualBadge]}><Text style={[s.frequencyText, annual && s.annualText]}>{frequencyLabel(item.frequency)}</Text></View><Text style={s.date}>{dateLabel(item.expense_date)}</Text></View>
      <View style={s.rowActions}><IconAction icon="edit" label={'تعديل مصروف ' + item.definition} onPress={onEdit} disabled={disabled} /><IconAction icon="delete" label={'حذف مصروف ' + item.definition} onPress={onDelete} danger disabled={disabled} /></View>
    </View>
    <Text style={s.equivalent}>{'يعادل ' + formatAmount(equivalent) + ' ر.س ' + (annual ? 'شهريًا' : 'سنويًا')}</Text>
  </View>;
}

function ExpenseEditor({ visible, form, error, saving, onChange, onClose, onSave }) {
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={s.overlay}>
      <TouchableOpacity activeOpacity={1} accessibilityLabel="إغلاق نافذة المصروف" onPress={onClose} disabled={saving} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalPosition} pointerEvents="box-none">
        <View style={s.modalCard} accessibilityViewIsModal testID="personal-expense-editor-modal">
          <View style={s.modalHeader}><View style={s.modalHeading}><Text accessibilityRole="header" style={s.modalTitle}>{form.id !== null ? 'تعديل المصروف' : 'إضافة مصروف'}</Text><Text style={s.modalSubtitle}>حدد المبلغ ودورية المصروف</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="إغلاق نموذج المصروف" onPress={onClose} disabled={saving} style={s.closeButton}><UiIcon name="close" size={22} color="#88829a" /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={s.formBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.inputLabel}>التعريف</Text>
            <TextInput accessibilityLabel="تعريف المصروف" value={form.definition} onChangeText={(value) => onChange('definition', value)} maxLength={255} placeholder="مثال: إيجار، اشتراك، وقود" placeholderTextColor="#737b90" style={s.input} textAlign="right" editable={!saving} autoFocus={visible} returnKeyType="next" />
            <Text style={s.inputLabel}>المبلغ</Text>
            <View style={s.amountInput}><TextInput accessibilityLabel="مبلغ المصروف" value={form.amount} onChangeText={(value) => onChange('amount', normalizeAmountInput(value))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#737b90" style={s.numericInput} textAlign="left" editable={!saving} /><Text style={s.inputCurrency}>ر.س</Text></View>
            <Text style={s.inputLabel}>دورية المصروف</Text>
            <View style={s.frequencyOptions}>{['monthly', 'annual'].map((value) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={value === 'monthly' ? 'مصروف شهري' : 'مصروف سنوي'} accessibilityState={{ checked: form.frequency === value }} disabled={saving} onPress={() => onChange('frequency', value)} style={[s.frequencyOption, form.frequency === value && s.frequencyOptionSelected]}><Text style={[s.frequencyOptionText, form.frequency === value && s.frequencyOptionTextSelected]}>{frequencyLabel(value)}</Text></TouchableOpacity>)}</View>
            <Text style={s.inputLabel}>التاريخ</Text>
            <TextInput accessibilityLabel="تاريخ المصروف" value={form.expense_date} onChangeText={(value) => onChange('expense_date', value)} placeholder="YYYY-MM-DD" placeholderTextColor="#737b90" style={[s.input, s.dateInput]} textAlign="left" editable={!saving} autoCorrect={false} />
            <Text style={s.dateHint}>السنة-الشهر-اليوم</Text>
            <Text style={s.inputLabel}>ملاحظات <Text style={s.optional}>(اختياري)</Text></Text>
            <TextInput accessibilityLabel="ملاحظات المصروف" value={form.notes} onChangeText={(value) => onChange('notes', value)} maxLength={2000} placeholder="أضف ملاحظة..." placeholderTextColor="#737b90" style={[s.input, s.notesInput]} textAlign="right" multiline textAlignVertical="top" editable={!saving} />
            {!!error && <Text accessibilityRole="alert" style={s.formError}>{error}</Text>}
          </ScrollView>
          <View style={s.modalFooter}><TouchableOpacity accessibilityRole="button" accessibilityLabel="إلغاء نموذج المصروف" onPress={onClose} disabled={saving} style={s.cancelButton}><Text style={s.cancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={form.id !== null ? 'حفظ تعديل المصروف' : 'حفظ المصروف'} onPress={onSave} disabled={saving} style={[s.saveButton, saving && s.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{form.id !== null ? 'حفظ التعديل' : 'حفظ المصروف'}</Text>}</TouchableOpacity></View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

function DeleteDialog({ item, error, busy, onClose, onDelete }) {
  return <Modal visible={Boolean(item)} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}><View style={s.overlay}>
    <TouchableOpacity activeOpacity={1} onPress={onClose} disabled={busy} style={StyleSheet.absoluteFillObject} />
    <View style={s.deletePosition}><View style={s.deleteCard} accessibilityViewIsModal>
      <View style={s.deleteIcon}><UiIcon name="delete" size={24} color="#bd5265" /></View>
      <Text style={s.deleteTitle}>حذف المصروف؟</Text><Text style={s.deleteName}>{item?.definition}</Text><Text style={s.deleteNote}>سيتم حذف هذا المصروف من القائمة.</Text>
      {!!error && <Text accessibilityRole="alert" style={s.formError}>{error}</Text>}
      <View style={s.modalFooter}><TouchableOpacity accessibilityRole="button" accessibilityLabel="إلغاء حذف المصروف" onPress={onClose} disabled={busy} style={s.cancelButton}><Text style={s.cancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="تأكيد حذف المصروف" onPress={onDelete} disabled={busy} style={[s.saveButton, s.confirmDelete, busy && s.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>حذف المصروف</Text>}</TouchableOpacity></View>
    </View></View>
  </View></Modal>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { paddingTop: ANDROID_TOP + 10, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e6ef', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { color: '#252b41', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#6f7388', fontSize: 10, marginTop: 4, textAlign: 'center' },
  page: { paddingHorizontal: 16, paddingBottom: 112 },
  summary: { borderRadius: 23, backgroundColor: '#443578', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, marginBottom: 17 },
  summaryHeading: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  summaryLabel: { color: '#e0d9ef', fontSize: 13, fontWeight: '700' },
  summaryIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#554585', alignItems: 'center', justifyContent: 'center' },
  moneyRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: 5, minWidth: 0, flexShrink: 1 },
  money: { color: '#31354d', fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: 'right', flexShrink: 1 },
  currency: { color: '#6f7388', fontSize: 10, fontWeight: '600', flexShrink: 0 },
  mainAmount: { color: '#fff', fontSize: 35, letterSpacing: -0.5 },
  mainCurrency: { color: '#d6cdea', fontSize: 13 },
  summaryNote: { color: '#c9bddf', fontSize: 10, lineHeight: 17, textAlign: 'right', marginTop: 3 },
  annualRow: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#6c5b94', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  annualLabel: { color: '#dcd4ed', fontSize: 12, fontWeight: '600', flexShrink: 0 },
  annualAmount: { color: '#c6f0e2', fontSize: 22 },
  annualCurrency: { color: '#d6cdea' },
  notice: { marginBottom: 13, padding: 11, borderRadius: 12, backgroundColor: '#e9f5ef', color: '#167356', textAlign: 'right', fontSize: 12, lineHeight: 19 },
  errorNotice: { color: '#ad4359', backgroundColor: '#fff0f2' },
  search: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 13, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#e7e7ef', backgroundColor: '#fff' },
  searchInput: { flex: 1, minWidth: 0, color: '#34384d', fontSize: 13, paddingVertical: 11 },
  clearSearch: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  listTools: { marginTop: 12, marginBottom: 13, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  filters: { flexDirection: 'row-reverse', gap: 6 },
  filterChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#eeeef5' },
  filterChipActive: { backgroundColor: '#6d57b8' },
  filterText: { color: '#8b879e', fontWeight: '600', fontSize: 11 },
  filterTextActive: { color: '#fff' },
  count: { color: '#6f7388', fontSize: 11, flexShrink: 1, textAlign: 'left' },
  loader: { marginTop: 26, marginBottom: 22 },
  empty: { borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e7ef', paddingHorizontal: 20, paddingVertical: 30, alignItems: 'center', marginTop: 4 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#f3f0f9', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  emptyTitle: { color: '#51546c', fontWeight: '700', fontSize: 15 },
  emptyNote: { color: '#6f7388', fontSize: 12, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  resetFilters: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#f0ebfa', marginTop: 12 },
  resetFiltersText: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  expenseCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e7f0', borderRadius: 18, padding: 13, marginBottom: 10 },
  expenseTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  expenseIdentity: { flex: 1.2, minWidth: 0, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  expenseIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#f2edf9', alignItems: 'center', justifyContent: 'center' },
  annualIcon: { backgroundColor: '#eaf6f2' },
  expenseName: { flex: 1, color: '#3d4157', fontSize: 14, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  cardAmount: { flex: 1, minWidth: 0 },
  expenseNotes: { color: '#6f7388', fontSize: 12, lineHeight: 19, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  expenseMeta: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  metaCopy: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 7, flex: 1, minWidth: 0 },
  frequencyBadge: { backgroundColor: '#f2edf9', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 7 },
  frequencyText: { color: '#755b9e', fontSize: 10, fontWeight: '700' },
  annualBadge: { backgroundColor: '#eaf6f2' },
  annualText: { color: '#337361' },
  date: { color: '#6f7388', fontSize: 11, writingDirection: 'ltr' },
  rowActions: { flexDirection: 'row-reverse', gap: 5 },
  iconAction: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f1fb', alignItems: 'center', justifyContent: 'center' },
  dangerAction: { backgroundColor: '#fff2f4' },
  equivalent: { marginTop: 7, color: '#72768c', fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  addButton: { position: 'absolute', left: 20, bottom: 24, height: 54, paddingHorizontal: 19, borderRadius: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, backgroundColor: ACCENT, shadowColor: '#4b397c', shadowOpacity: 0.23, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  addText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  overlay: { flex: 1, backgroundColor: 'rgba(23,27,49,0.38)' },
  modalPosition: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingTop: ANDROID_TOP + 16, paddingBottom: 22 },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 23, overflow: 'hidden', shadowColor: '#10162c', shadowOpacity: 0.16, shadowRadius: 25, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
  modalHeader: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: '#f0eff5', flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  modalHeading: { flex: 1, alignItems: 'flex-end' },
  modalTitle: { color: '#33374d', fontSize: 19, fontWeight: '800', textAlign: 'right' },
  modalSubtitle: { color: '#75758b', fontSize: 11, marginTop: 4 },
  closeButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#f5f3f8', alignItems: 'center', justifyContent: 'center' },
  formBody: { paddingHorizontal: 18, paddingTop: 5, paddingBottom: 17 },
  inputLabel: { color: '#64677d', fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 13, marginBottom: 7 },
  input: { minHeight: 46, backgroundColor: '#f9f9fc', borderColor: '#e3e4ec', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#3b3f54', fontWeight: '500' },
  amountInput: { minHeight: 48, backgroundColor: '#f9f9fc', borderColor: '#e3e4ec', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  numericInput: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '700', color: '#45415e', writingDirection: 'ltr', paddingVertical: 10 },
  inputCurrency: { color: '#a3a1b1', fontSize: 12 },
  frequencyOptions: { flexDirection: 'row-reverse', gap: 9 },
  frequencyOption: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#e5e4ed', backgroundColor: '#f9f9fc', alignItems: 'center', justifyContent: 'center' },
  frequencyOptionSelected: { backgroundColor: '#f1ecfa', borderColor: '#ab9bcc' },
  frequencyOptionText: { color: '#9290a3', fontSize: 13, fontWeight: '600' },
  frequencyOptionTextSelected: { color: ACCENT },
  dateInput: { writingDirection: 'ltr' },
  dateHint: { color: '#75758b', fontSize: 11, marginTop: 5, textAlign: 'right' },
  optional: { color: '#7f7d90', fontSize: 10, fontWeight: '400' },
  notesInput: { minHeight: 76, lineHeight: 21 },
  formError: { backgroundColor: '#fff1f3', color: '#b54f63', borderRadius: 11, padding: 10, marginTop: 13, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  modalFooter: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 16, borderTopWidth: 1, borderTopColor: '#f0eff5' },
  cancelButton: { flex: 0.45, minHeight: 46, borderRadius: 12, backgroundColor: '#f3f2f7', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#6f657e', fontSize: 13, fontWeight: '600' },
  saveButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  deletePosition: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: ANDROID_TOP + 16, paddingBottom: 24 },
  deleteCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', paddingTop: 24 },
  deleteIcon: { width: 54, height: 54, borderRadius: 19, backgroundColor: '#fff1f3', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  deleteTitle: { color: '#3a3b50', fontWeight: '800', fontSize: 19, textAlign: 'center' },
  deleteName: { color: '#7d7b90', fontSize: 14, textAlign: 'center', marginTop: 9, paddingHorizontal: 20 },
  deleteNote: { color: '#aaa6b6', fontSize: 12, textAlign: 'center', marginTop: 7, marginBottom: 21, paddingHorizontal: 20 },
  confirmDelete: { backgroundColor: '#bd5265' },
});
