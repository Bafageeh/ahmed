import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowDownWideNarrow, Check, ChevronLeft, Eye, EyeOff, Plus, X } from 'lucide-react-native';
import UiIcon from './UiIcon';
import { ahmedUserHeaders, getCurrentAhmedUser } from './ahmedCurrentUser';
import { fetchFutureIncomeData, FUTURE_INCOME_SOURCES, incomeNumber, parseIncomeAmount } from './futureMonthlyIncomeData';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const money = (value) => incomeNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FILTERS = [{ id: 'all', label: 'الكل' }, { id: 'automatic', label: 'تلقائي' }, { id: 'manual', label: 'يدوي' }];
const pressStyle = (base) => ({ pressed }) => [base, pressed && { opacity: 0.72 }];

function IconButton({ label, onPress, children, accent = false, disabled = false, testID }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} testID={testID} style={pressStyle([s.iconButton, accent && s.iconButtonAccent, disabled && s.disabled])}>{children}</Pressable>;
}

function Sheet({ visible, onClose, title, children, busy = false }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? () => {} : onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={s.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={s.scrim} accessibilityRole="button" accessibilityLabel="إغلاق النافذة" onPress={busy ? undefined : onClose} />
      <SafeAreaView style={s.sheet} accessibilityViewIsModal>
        <View style={s.sheetHandle} />
        <View style={s.sheetHeader}><IconButton label="إغلاق" onPress={onClose} disabled={busy}><X size={21} color="#627080" /></IconButton><Text style={s.sheetTitle}>{title}</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>{children}</ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

export default function FutureMonthlyIncomeScreen({ onBack }) {
  const compact = useWindowDimensions().width < 360;
  const includeFinance = Boolean(getCurrentAhmedUser()?.is_admin);
  const [snapshot, setSnapshot] = useState({ values: {}, manual: [], failed: [], updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('monthly');
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sortByAmount, setSortByAmount] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef(null);
  const mutation = useRef(false);
  const mounted = useRef(true);
  const lastRefresh = useRef(0);

  const reloadAll = useCallback((showSpinner = true) => {
    if (pending.current) return pending.current;
    if (showSpinner) setRefreshing(true);
    pending.current = fetchFutureIncomeData({ apiUrl: API_URL, headers: ahmedUserHeaders({ Accept: 'application/json' }), includeFinance })
      .then((result) => {
        if (!mounted.current) return;
        setSnapshot((previous) => ({
          values: { ...previous.values, ...result.values },
          manual: result.manual === null ? previous.manual : result.manual,
          failed: result.failed,
          updatedAt: Object.keys(result.values).length || result.manual !== null ? new Date() : previous.updatedAt,
        }));
        lastRefresh.current = Date.now();
      })
      .finally(() => {
        pending.current = null;
        if (mounted.current) { setLoading(false); setRefreshing(false); }
      });
    return pending.current;
  }, [includeFinance]);

  useEffect(() => {
    mounted.current = true;
    reloadAll(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastRefresh.current > 60000 && !mutation.current) reloadAll(false);
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, [reloadAll]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const sources = useMemo(() => [
    ...FUTURE_INCOME_SOURCES.filter((source) => includeFinance || !['finance', 'com'].includes(source.id)).map((source) => ({
      ...source, ...snapshot.values[source.id], kind: 'automatic',
      stale: snapshot.failed.includes(source.id) || (source.id === 'com' && snapshot.failed.includes('manual')),
    })),
    ...snapshot.manual.map((row) => ({ id: `manual-${row.id}`, recordId: row.id, name: row.name, amount: incomeNumber(row.amount), kind: 'manual', readonly: Boolean(row.readonly), icon: 'wallet', color: '#58736F', tint: '#EDF5F3', caption: 'دخل مضاف يدويًا', formula: 'المبلغ الشهري الذي أدخلته لهذا المصدر', stale: snapshot.failed.includes('manual') })),
  ], [snapshot, includeFinance]);
  const total = sources.reduce((sum, source) => sum + incomeNumber(source.amount), 0);
  const positiveTotal = sources.reduce((sum, source) => sum + Math.max(0, incomeNumber(source.amount)), 0);
  const activeCount = sources.filter((source) => incomeNumber(source.amount) > 0).length;
  const visibleSources = useMemo(() => {
    const rows = sources.filter((source) => filter === 'all' || source.kind === filter);
    return sortByAmount ? [...rows].sort((a, b) => incomeNumber(b.amount) - incomeNumber(a.amount)) : rows;
  }, [sources, filter, sortByAmount]);
  const selected = sources.find((source) => source.id === selectedId);
  const multiplier = period === 'annual' ? 12 : 1;
  const displayAmount = (value) => hidden ? '••••••' : value == null ? '—' : money(value);
  const closeDetails = () => { if (mutation.current) return; setSelectedId(null); setConfirmDelete(false); setDetailError(''); };
  const openForm = (source) => {
    setSelectedId(null); setConfirmDelete(false); setDetailError('');
    setForm(source || { recordId: null }); setName(source?.name || ''); setAmount(source ? String(source.amount) : ''); setFormError('');
  };
  const closeForm = () => { if (!mutation.current) { setForm(null); setFormError(''); } };
  const writeIncome = async (method, id, body) => {
    const response = await fetch(`${API_URL}/monthly-incomes${id != null ? `/${encodeURIComponent(id)}` : ''}`, {
      method, headers: ahmedUserHeaders({ Accept: 'application/json', 'Content-Type': 'application/json' }),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json();
    if (!response.ok || json.readonly || json.data?.readonly || (method === 'DELETE' && (json.deleted === false || json.data?.deleted === false))) throw new Error('SAVE_FAILED');
    return json;
  };
  const saveIncome = async () => {
    if (mutation.current) return;
    const cleanName = name.trim();
    const value = parseIncomeAmount(amount);
    if (!cleanName || !String(amount).trim() || !Number.isFinite(value) || value < 0) {
      setFormError('أدخل اسم المصدر ومبلغًا صحيحًا يساوي صفرًا أو أكثر.'); return;
    }
    mutation.current = true; setSaving(true); setFormError('');
    try {
      if (pending.current) await pending.current;
      const saved = await writeIncome(form.recordId != null ? 'PUT' : 'POST', form.recordId, { screen: 'future', name: cleanName, amount: value });
      if (mounted.current && saved.data?.id != null) setSnapshot((previous) => ({ ...previous, manual: [saved.data, ...previous.manual.filter((row) => String(row.id) !== String(saved.data.id))] }));
      await reloadAll(false);
      if (mounted.current) { setForm(null); setNotice('تم حفظ مصدر الدخل'); }
    } catch { if (mounted.current) setFormError('تعذر الحفظ. تحقق من الاتصال وحاول مجددًا.'); }
    finally { mutation.current = false; if (mounted.current) setSaving(false); }
  };
  const deleteIncome = async () => {
    if (mutation.current || !selected || selected.kind !== 'manual' || selected.readonly) return;
    mutation.current = true; setSaving(true); setDetailError('');
    try {
      if (pending.current) await pending.current;
      await writeIncome('DELETE', selected.recordId);
      if (mounted.current) setSnapshot((previous) => ({ ...previous, manual: previous.manual.filter((row) => String(row.id) !== String(selected.recordId)) }));
      await reloadAll(false);
      if (mounted.current) { setSelectedId(null); setConfirmDelete(false); setNotice('تم حذف مصدر الدخل'); }
    } catch { if (mounted.current) setDetailError('تعذر الحذف. حاول مجددًا.'); }
    finally { mutation.current = false; if (mounted.current) setSaving(false); }
  };

  const header = <>
    <View style={s.hero} testID="future-income-summary">
      <View style={s.heroGlow} />
      <View style={s.heroTop}>
        <View style={s.periodTabs}>{[{ id: 'monthly', label: 'شهري' }, { id: 'annual', label: 'سنوي' }].map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: period === option.id }} accessibilityLabel={`عرض ${option.label}`} onPress={() => setPeriod(option.id)} style={pressStyle([s.periodTab, period === option.id && s.periodTabActive])}><Text style={[s.periodText, period === option.id && s.periodTextActive]}>{option.label}</Text></Pressable>)}</View>
        <View style={s.estimateBadge}><View style={s.liveDot} /><Text style={s.estimateText}>دخل متوقع</Text></View>
      </View>
      <View style={s.heroLabelRow}><Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'إظهار المبالغ' : 'إخفاء المبالغ'} onPress={() => setHidden(!hidden)} style={s.eyeButton}>{hidden ? <EyeOff size={19} color="#B8CCC9" /> : <Eye size={19} color="#B8CCC9" />}</Pressable><Text style={s.heroLabel}>{period === 'annual' ? 'التقدير السنوي' : 'إجمالي الدخل الشهري'}</Text></View>
      <View style={s.totalRow}><Text style={s.heroCurrency}>ر.س</Text><Text style={[s.total, compact && { fontSize: 32 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} testID="future-income-total">{loading ? '—' : displayAmount(total * multiplier)}</Text></View>
      <Text style={s.heroHint}>{period === 'annual' ? 'تقدير سنوي على أساس الدخل الشهري الحالي × 12' : 'نظرة موحّدة على مصادر دخلك المستقبلية'}</Text>
      <View style={s.composition} accessibilityLabel="توزيع الدخل بين المصادر">{sources.filter((source) => source.amount > 0).map((source) => <View key={source.id} style={{ flex: source.amount / (positiveTotal || 1), backgroundColor: source.color, minWidth: 2 }} />)}</View>
      <View style={s.heroFoot}><Text style={s.updated}>{refreshing ? 'جارٍ التحديث…' : snapshot.updatedAt ? `آخر تحديث ${snapshot.updatedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : 'بانتظار البيانات'}</Text><View style={s.sourceCount}><Text style={s.sourceCountText}>{loading ? '—' : activeCount} مصادر نشطة</Text><UiIcon name="stats" size={15} color="#A9C8BE" /></View></View>
    </View>
    {snapshot.failed.length > 0 && !loading ? <View style={s.warning}><View style={s.warningText}><Text style={s.warningTitle}>بعض المصادر لم تُحدّث</Text><Text style={s.warningCopy}>احتفظنا بآخر قيم متاحة. قد يكون الإجمالي غير مكتمل.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="إعادة تحديث المصادر" onPress={() => reloadAll(true)} style={s.retry}><UiIcon name="refresh" color="#94652D" size={20} /></Pressable></View> : null}
    <View style={s.sectionHeading}><Text style={s.sourceSubtitle}>{visibleSources.length} مصادر</Text><Text style={s.sectionTitle}>مصادر الدخل</Text></View>
    <View style={s.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={sortByAmount ? 'الترتيب الافتراضي' : 'ترتيب حسب الأعلى دخلًا'} accessibilityState={{ selected: sortByAmount }} onPress={() => setSortByAmount(!sortByAmount)} style={pressStyle([s.sort, sortByAmount && s.sortActive])}><ArrowDownWideNarrow size={17} color={sortByAmount ? '#157B6E' : '#76828F'} /><Text style={[s.sortText, sortByAmount && { color: '#157B6E' }]}>{sortByAmount ? 'الأعلى' : 'ترتيب'}</Text></Pressable>
      <View style={s.filters}>{FILTERS.map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: filter === option.id }} accessibilityLabel={`مصادر الدخل: ${option.label}`} onPress={() => setFilter(option.id)} style={pressStyle([s.filter, filter === option.id && s.filterActive])}><Text style={[s.filterText, filter === option.id && s.filterTextActive]}>{option.label}</Text></Pressable>)}</View>
    </View>
    {loading ? <View style={s.loading} accessibilityLabel="جارٍ تحميل مصادر الدخل"><ActivityIndicator color="#157B6E" /><Text style={s.loadingText}>نجمع مصادر دخلك…</Text></View> : null}
  </>;

  return <SafeAreaView style={s.safe} testID="future-income-redesign-v1">
    <View style={s.pageHeader}>
      <IconButton label="العودة إلى حساباتي" onPress={onBack}><ChevronLeft size={23} color="#253B3A" /></IconButton>
      <View style={s.titleBlock}><Text style={[s.pageTitle, compact && { fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>الدخل المستقبلي</Text><Text style={s.pageSubtitle}>حساباتي</Text></View>
      <IconButton label="إضافة مصدر دخل" onPress={() => openForm(null)} accent testID="add-income"><Plus size={23} color="#FFF" /></IconButton>
    </View>
    <FlatList data={loading ? [] : visibleSources} keyExtractor={(item) => item.id} ListHeaderComponent={header} initialNumToRender={10} showsVerticalScrollIndicator={false} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reloadAll(true)} tintColor="#157B6E" colors={['#157B6E']} />} renderItem={({ item }) => {
      const share = positiveTotal > 0 ? Math.max(0, incomeNumber(item.amount)) / positiveTotal * 100 : 0;
      return <Pressable testID={`income-source-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.name}، ${hidden ? 'المبلغ مخفي' : item.amount == null ? 'البيانات غير متاحة' : `${money(item.amount * multiplier)} ريال ${period === 'annual' ? 'سنويًا' : 'شهريًا'}`}، عرض التفاصيل`} onPress={() => { setSelectedId(item.id); setConfirmDelete(false); setDetailError(''); }} style={pressStyle(s.sourceCard)}>
        <View style={s.sourceMain}><View style={s.sourceAmountBlock}><Text style={[s.sourceAmount, compact && { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{displayAmount(item.amount == null ? null : item.amount * multiplier)}</Text><Text style={s.currency}>ر.س / {period === 'annual' ? 'سنة' : 'شهر'}</Text></View><View style={s.sourceText}><Text style={s.sourceName}>{item.name}</Text><View style={s.sourceMeta}><Text style={[s.kindBadge, item.kind === 'manual' && s.manualBadge]}>{item.kind === 'automatic' ? 'تلقائي' : 'يدوي'}</Text><Text style={[s.caption, item.stale && s.stale]} numberOfLines={1}>{item.stale ? 'تعذر التحديث' : item.caption}</Text></View></View><View style={[s.sourceIcon, { backgroundColor: item.tint }]}><UiIcon name={item.icon} color={item.color} size={23} /></View></View>
        <View style={s.cardFoot}><ChevronLeft size={14} color="#93A19F" /><Text style={s.share}>{hidden ? '••' : share < 1 && share > 0 ? 'أقل من 1%' : `${share.toFixed(1)}%`} من الدخل</Text><View style={s.shareTrack}><View style={[s.shareFill, { backgroundColor: item.color, width: `${Math.min(100, share)}%` }]} /></View></View>
      </Pressable>;
    }} ListEmptyComponent={!loading ? <View style={s.empty}><View style={s.emptyIcon}><UiIcon name="wallet" size={28} color="#5E8C82" /></View><Text style={s.emptyTitle}>أضف مصدر دخلك الأول</Text><Text style={s.emptyCopy}>سجّل راتبًا أو إيجارًا أو أي دخل شهري آخر.</Text><Pressable style={pressStyle(s.emptyAdd)} accessibilityRole="button" onPress={() => openForm(null)}><Text style={s.emptyAddText}>إضافة مصدر دخل</Text><Plus size={18} color="#157B6E" /></Pressable></View> : null} ListFooterComponent={<View style={s.footer}><UiIcon name="alert" size={15} color="#95A4A1" /><Text style={s.footerText}>تقديرات مبنية على القيم الحالية، وتتغير مع تغيّر المصادر.</Text></View>} />
    {!!notice && <View style={s.toast} accessibilityLiveRegion="polite"><Check size={18} color="#FFF" /><Text style={s.toastText}>{notice}</Text></View>}

    <Sheet visible={!!selected || !!form} title={form ? form.recordId != null ? 'تعديل مصدر الدخل' : 'مصدر دخل جديد' : 'تفاصيل المصدر'} onClose={form ? closeForm : closeDetails} busy={saving}>
      {selected ? <>
        <View style={s.detailIdentity}><View style={[s.detailIcon, { backgroundColor: selected.tint }]}><UiIcon name={selected.icon} color={selected.color} size={28} /></View><Text style={s.detailName}>{selected.name}</Text><Text style={s.detailType}>{selected.kind === 'automatic' ? 'مصدر تلقائي · يُحدّث من الحساب المرتبط' : 'مصدر دخل يدوي'}</Text></View>
        <View style={s.detailAmounts}><View style={s.detailAmountCell}><Text style={s.detailAmountLabel}>التقدير السنوي</Text><Text style={s.detailAmountValue}>{displayAmount(selected.amount == null ? null : selected.amount * 12)}</Text><Text style={s.currency}>ر.س</Text></View><View style={s.detailDivider} /><View style={s.detailAmountCell}><Text style={s.detailAmountLabel}>الدخل الشهري</Text><Text style={[s.detailAmountValue, { color: '#157B6E' }]}>{displayAmount(selected.amount)}</Text><Text style={s.currency}>ر.س</Text></View></View>
        <View style={s.formulaBox}><Text style={s.formulaTitle}>طريقة الحساب</Text><Text style={s.formulaText}>{selected.formula}</Text>{selected.capital != null ? <View style={s.capitalRow}><Text style={s.capitalValue}>{displayAmount(selected.capital)} ر.س</Text><Text style={s.capitalLabel}>المبلغ المعتمد</Text></View> : null}</View>
        {selected.stale ? <Text style={s.errorText}>تعذر تحديث هذا المصدر. القيمة المعروضة هي آخر قيمة متاحة.</Text> : null}
        {!!detailError && <Text accessibilityLiveRegion="polite" style={s.errorText}>{detailError}</Text>}
        {selected.kind === 'manual' && !selected.readonly ? confirmDelete ? <View style={s.deleteBox}><Text style={s.deleteQuestion}>حذف «{selected.name}» من مصادر الدخل؟</Text><Pressable accessibilityRole="button" disabled={saving} onPress={deleteIncome} style={pressStyle([s.primaryButton, s.deleteButton])}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryText}>تأكيد الحذف</Text>}</Pressable><Pressable disabled={saving} accessibilityRole="button" onPress={() => setConfirmDelete(false)} style={s.cancelButton}><Text style={s.cancelText}>إلغاء</Text></Pressable></View> : <View style={s.manualActions}><Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={pressStyle(s.deleteOutline)}><UiIcon name="delete" size={19} color="#AD4551" /><Text style={s.deleteText}>حذف</Text></Pressable><Pressable accessibilityRole="button" onPress={() => openForm(selected)} style={pressStyle([s.primaryButton, s.editButton])}><Text style={s.primaryText}>تعديل المصدر</Text><UiIcon name="edit" size={18} color="#FFF" /></Pressable></View> : <Text style={s.detailHint}>تتحدث هذه القيمة عند تحديث بيانات المصدر.</Text>}
      </> : null}
      {form ? <>
      <Text style={s.formIntro}>أضف المبلغ الشهري ليدخل ضمن إجمالي دخلك المتوقع.</Text>
      <Text style={s.inputLabel}>اسم المصدر</Text><TextInput accessibilityLabel="اسم مصدر الدخل" value={name} onChangeText={setName} editable={!saving} maxLength={255} placeholder="راتب، إيجار، أرباح…" placeholderTextColor="#9AA6AD" textAlign="right" style={s.input} returnKeyType="next" />
      <Text style={s.inputLabel}>المبلغ الشهري</Text><View style={s.amountInput}><Text style={s.inputCurrency}>ر.س</Text><TextInput accessibilityLabel="المبلغ الشهري" value={amount} onChangeText={setAmount} editable={!saving} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9AA6AD" style={s.amountField} textAlign="right" /></View>
      {!!formError && <Text accessibilityLiveRegion="polite" style={s.errorText}>{formError}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="حفظ مصدر الدخل" disabled={saving} onPress={saveIncome} style={pressStyle([s.primaryButton, saving && s.disabled])}>{saving ? <ActivityIndicator color="#FFF" /> : <><Text style={s.primaryText}>حفظ المصدر</Text><Check size={20} color="#FFF" /></>}</Pressable>
      </> : null}
    </Sheet>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  pageHeader: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, maxWidth: 760, width: '100%', alignSelf: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFF', borderColor: '#E2E9E6', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconButtonAccent: { backgroundColor: '#157B6E', borderColor: '#157B6E' }, disabled: { opacity: 0.55 },
  titleBlock: { flex: 1, alignItems: 'center' }, pageTitle: { color: '#1B3031', fontSize: 21, fontWeight: '800', textAlign: 'center' }, pageSubtitle: { color: '#899894', fontSize: 11, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 26, maxWidth: 760, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: '#142D30', borderRadius: 27, padding: 22, overflow: 'hidden', marginBottom: 24 },
  heroGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#1F4746', top: -150, right: -90 },
  heroTop: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  periodTabs: { flexDirection: 'row-reverse', direction: 'ltr', backgroundColor: '#243E40', borderRadius: 11, padding: 3 },
  periodTab: { minHeight: 44, paddingHorizontal: 13, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, periodTabActive: { backgroundColor: '#EEF7F2' },
  periodText: { color: '#B4C7C2', fontSize: 12, fontWeight: '600' }, periodTextActive: { color: '#1D4C45' },
  estimateBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7AC8A7' }, estimateText: { fontSize: 12, color: '#A9CBBB', fontWeight: '600' },
  heroLabelRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }, eyeButton: { width: 44, height: 38, justifyContent: 'center' }, heroLabel: { color: '#B4CAC6', fontSize: 14, fontWeight: '500', textAlign: 'right' },
  totalRow: { flexDirection: 'row', direction: 'ltr', justifyContent: 'flex-end', alignItems: 'baseline', gap: 9, marginTop: 0 }, total: { color: '#FFF', fontSize: 39, fontWeight: '800', letterSpacing: -1.3, flexShrink: 1, fontVariant: ['tabular-nums'] }, heroCurrency: { fontSize: 16, fontWeight: '600', color: '#B4CAC6' },
  heroHint: { color: '#9CB8B3', fontSize: 11, textAlign: 'right', marginTop: 7, lineHeight: 19 },
  composition: { height: 6, flexDirection: 'row-reverse', gap: 3, backgroundColor: '#2C4747', borderRadius: 4, overflow: 'hidden', marginTop: 23 },
  heroFoot: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 13 }, updated: { color: '#88A6A0', fontSize: 10 }, sourceCount: { flexDirection: 'row', alignItems: 'center', gap: 6 }, sourceCountText: { color: '#C0D5CD', fontSize: 11 },
  warning: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FFF5E5', borderRadius: 14, marginBottom: 18 }, warningText: { flex: 1 }, warningTitle: { fontWeight: '700', color: '#94652D', textAlign: 'right', fontSize: 12 }, warningCopy: { color: '#98754E', textAlign: 'right', fontSize: 11, lineHeight: 18, marginTop: 3 }, retry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', direction: 'ltr', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, sectionTitle: { color: '#243A38', fontSize: 18, fontWeight: '800' }, sourceSubtitle: { color: '#6C8074', fontSize: 11 },
  toolbar: { flexDirection: 'row', direction: 'ltr', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 },
  filters: { flexDirection: 'row-reverse', backgroundColor: '#E9EEEB', padding: 3, borderRadius: 12 }, filter: { paddingHorizontal: 15, minHeight: 44, justifyContent: 'center', borderRadius: 9 }, filterActive: { backgroundColor: '#FFF' }, filterText: { color: '#8B9893', fontSize: 12, fontWeight: '600' }, filterTextActive: { color: '#216858' },
  sort: { flexDirection: 'row', gap: 5, minHeight: 44, alignItems: 'center', paddingHorizontal: 4 }, sortActive: { borderBottomWidth: 1, borderColor: '#9BC9BB' }, sortText: { color: '#76828F', fontSize: 11 },
  sourceCard: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E8EFEB', paddingHorizontal: 15, paddingTop: 17, paddingBottom: 12, marginBottom: 10 }, sourceMain: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 11 }, sourceIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sourceText: { flex: 1, minWidth: 0 }, sourceName: { color: '#253B38', fontSize: 14, fontWeight: '700', textAlign: 'right', lineHeight: 22 }, sourceMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }, kindBadge: { fontSize: 9, fontWeight: '600', color: '#6A8F80', backgroundColor: '#EFF5F1', borderRadius: 4, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2 }, manualBadge: { backgroundColor: '#F3F1E9', color: '#9B8757' }, caption: { fontSize: 9, color: '#6F8175', flexShrink: 1 }, stale: { color: '#B27D34' },
  sourceAmountBlock: { alignItems: 'flex-start', maxWidth: '42%' }, sourceAmount: { color: '#29423D', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.3 }, currency: { color: '#6E8076', fontSize: 10, marginTop: 4 },
  cardFoot: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 8, marginTop: 13 }, share: { fontSize: 9, color: '#76877B' }, shareTrack: { height: 3, borderRadius: 3, backgroundColor: '#F1F5F2', flex: 1, overflow: 'hidden', alignItems: 'flex-end' }, shareFill: { height: 3, borderRadius: 3 },
  loading: { paddingVertical: 38, alignItems: 'center', gap: 12 }, loadingText: { fontSize: 12, color: '#7D9189' },
  empty: { padding: 30, backgroundColor: '#FFF', borderRadius: 20, alignItems: 'center' }, emptyIcon: { padding: 16, borderRadius: 22, backgroundColor: '#EFF5F1', marginBottom: 14 }, emptyTitle: { color: '#344F47', fontWeight: '700', fontSize: 15 }, emptyCopy: { fontSize: 12, color: '#8E9E96', textAlign: 'center', marginTop: 8, lineHeight: 20 }, emptyAdd: { marginTop: 16, minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' }, emptyAddText: { color: '#157B6E', fontSize: 12, fontWeight: '700' },
  footer: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, paddingHorizontal: 8 }, footerText: { fontSize: 10, color: '#95A4A1', lineHeight: 18, textAlign: 'right', flexShrink: 1 },
  toast: { position: 'absolute', bottom: 28, alignSelf: 'center', backgroundColor: '#1F6456', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', gap: 9, alignItems: 'center' }, toastText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0C252B80' }, sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', width: '100%', maxWidth: 760, alignSelf: 'center' }, sheetHandle: { width: 36, height: 4, backgroundColor: '#D8E3DE', borderRadius: 2, alignSelf: 'center', marginTop: 10 }, sheetHeader: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 16, paddingHorizontal: 22, paddingVertical: 12 }, sheetTitle: { flex: 1, textAlign: 'right', color: '#253B38', fontSize: 18, fontWeight: '800' }, sheetBody: { paddingHorizontal: 24, paddingBottom: 28 },
  detailIdentity: { alignItems: 'center', paddingTop: 4, paddingBottom: 23 }, detailIcon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, detailName: { color: '#253B38', fontWeight: '800', fontSize: 19, textAlign: 'center' }, detailType: { fontSize: 11, color: '#92A198', marginTop: 7, textAlign: 'center' },
  detailAmounts: { flexDirection: 'row', backgroundColor: '#F4F8F5', borderRadius: 18, paddingVertical: 19 }, detailAmountCell: { flex: 1, alignItems: 'center', paddingHorizontal: 5 }, detailAmountLabel: { fontSize: 11, color: '#899B91', marginBottom: 10 }, detailAmountValue: { fontSize: 20, fontWeight: '800', color: '#3D554A', fontVariant: ['tabular-nums'] }, detailDivider: { width: 1, backgroundColor: '#DFE9E2' },
  formulaBox: { backgroundColor: '#F9FAF8', borderRadius: 17, borderWidth: 1, borderColor: '#EBF0EA', padding: 17, marginTop: 16 }, formulaTitle: { fontWeight: '700', color: '#51695C', fontSize: 12, textAlign: 'right' }, formulaText: { fontSize: 13, lineHeight: 23, color: '#84968A', textAlign: 'right', marginTop: 8 }, capitalRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderColor: '#E8EEE6' }, capitalValue: { fontWeight: '700', color: '#56705F', fontSize: 13 }, capitalLabel: { fontSize: 11, color: '#92A18F' }, detailHint: { color: '#9EADA2', fontSize: 11, lineHeight: 19, textAlign: 'center', marginTop: 21 },
  manualActions: { flexDirection: 'row', direction: 'ltr', gap: 12, marginTop: 22 }, primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: '#157B6E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 22 }, primaryText: { color: '#FFF', fontSize: 14, fontWeight: '700' }, editButton: { marginTop: 0, flex: 1 }, deleteOutline: { minHeight: 52, paddingHorizontal: 19, borderRadius: 15, backgroundColor: '#FCF0F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, deleteText: { color: '#AD4551', fontSize: 13, fontWeight: '600' }, deleteBox: { marginTop: 22 }, deleteQuestion: { color: '#8C4C52', fontSize: 14, textAlign: 'right', lineHeight: 24 }, deleteButton: { backgroundColor: '#AD4551', marginTop: 14 }, cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, cancelText: { color: '#85988D', fontSize: 13 },
  formIntro: { color: '#8B9D91', fontSize: 12, lineHeight: 22, textAlign: 'right', marginBottom: 22 }, inputLabel: { color: '#58715F', fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 8 }, input: { color: '#2C4437', backgroundColor: '#F5F8F5', borderWidth: 1, borderColor: '#E2EBE2', minHeight: 54, borderRadius: 13, paddingHorizontal: 16, fontSize: 15, marginBottom: 20 }, amountInput: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', backgroundColor: '#F5F8F5', borderWidth: 1, borderColor: '#E2EBE2', borderRadius: 13, paddingHorizontal: 16 }, amountField: { flex: 1, minHeight: 54, color: '#2C4437', fontSize: 20, fontWeight: '700', paddingLeft: 10 }, inputCurrency: { color: '#9AAC9B', fontSize: 13 }, errorText: { color: '#B15157', fontSize: 12, lineHeight: 21, marginTop: 14, textAlign: 'right' },
});
