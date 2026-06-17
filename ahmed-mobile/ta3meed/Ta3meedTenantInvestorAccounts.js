import React, { useEffect, useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { money, n } from './ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const todayText = () => new Date().toISOString().slice(0, 10);
const endedStatuses = ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'مستلم', 'مستلمة', 'تم الاستلام', 'منتهي', 'منتهية'];
const cancelledStatuses = ['cancelled', 'canceled', 'void', 'ملغي', 'ملغية', 'ملغاة'];

function uniqueInvestors(investors) {
  const map = new Map();
  (investors || []).forEach((item) => {
    const code = String(item?.code || item?.name || '').trim();
    const name = String(item?.name || item?.code || '').trim();
    if (code && name) map.set(code, { code, name });
  });
  return Array.from(map.values());
}

function safeNumber(value) { return Number(value || 0); }
function statusValues(row) { return [row?.opportunity_status, row?.allocation_status, row?.status].map((status) => String(status || '').trim().toLowerCase()).filter(Boolean); }
function hasStatus(row, statuses) { return statusValues(row).some((status) => statuses.includes(status)); }
function isEnded(row) { return hasStatus(row, endedStatuses); }
function isCancelled(row) { return hasStatus(row, cancelledStatuses); }
function isInactive(row) { return isCancelled(row) || isEnded(row); }
function principalReceivedOf(row) {
  const invested = safeNumber(row?.invested_amount);
  if (row?.principal_received_amount !== undefined && row?.principal_received_amount !== null) return Math.min(invested, Math.max(0, safeNumber(row.principal_received_amount)));
  return Math.min(invested, Math.max(0, safeNumber(row?.received_total_amount ?? row?.received_amount)));
}
function remainingCapitalOf(row) {
  if (isInactive(row)) return 0;
  if (row?.ta3meed_remaining_amount !== undefined && row?.ta3meed_remaining_amount !== null) return Math.max(0, safeNumber(row.ta3meed_remaining_amount));
  return Math.max(0, safeNumber(row?.invested_amount) - principalReceivedOf(row));
}

function normalize(raw, investor) {
  const summary = raw?.summary || {};
  const opportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : [];
  const active = opportunities.filter((row) => !isInactive(row));
  const activeInvested = active.reduce((sum, row) => sum + safeNumber(row.invested_amount), 0);
  const ta3meed = active.reduce((sum, row) => sum + remainingCapitalOf(row), 0);
  const activeReceived = Math.max(0, activeInvested - ta3meed);
  const endedProfit = summary.ended_profit !== undefined ? safeNumber(summary.ended_profit) : opportunities.reduce((sum, row) => isEnded(row) ? sum + Math.max(0, safeNumber(row.received_total_amount ?? row.received_amount) - safeNumber(row.invested_amount)) : sum, 0);
  return {
    investor,
    balance: safeNumber(raw?.balance !== undefined ? raw.balance : summary.manual_balance),
    ta3meed,
    activeInvested,
    activeReceived,
    endedProfit,
    expectedProfit: safeNumber(summary.expected_profit),
    opportunitiesCount: safeNumber(summary.opportunities_count !== undefined ? summary.opportunities_count : opportunities.length),
    entries: Array.isArray(raw?.entries) && raw.entries.length ? raw.entries : (Array.isArray(raw?.manual_entries) ? raw.manual_entries : []),
    timeline: Array.isArray(raw?.timeline) ? raw.timeline : [],
  };
}

function buildSummary(account) {
  const ta3meed = n(account?.ta3meed);
  const manual = n(account?.balance);
  const endedProfit = n(account?.endedProfit);
  const cash = manual + endedProfit - ta3meed;
  return { ta3meed, manual, cash, total: ta3meed + cash };
}

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Ta3meedInvestorAccounts({ investors, backRequestVersion = 0, onExit }) {
  const accounts = useMemo(() => uniqueInvestors(investors), [investors]);
  const [selected, setSelected] = useState(null);
  const [screen, setScreen] = useState('home');
  const [seenBack, setSeenBack] = useState(backRequestVersion);
  const [accountSummaries, setAccountSummaries] = useState({});

  useEffect(() => {
    if (backRequestVersion === seenBack) return;
    setSeenBack(backRequestVersion);
    if (selected && screen !== 'home') return setScreen('home');
    if (selected) return setSelected(null);
    onExit?.();
  }, [backRequestVersion, seenBack, selected, screen, onExit]);

  useEffect(() => {
    let alive = true;
    const accountCodes = accounts.map((item) => item.code).join('|');
    if (!accountCodes) { setAccountSummaries({}); return () => { alive = false; }; }
    Promise.all(accounts.map(async (item) => {
      try {
        const response = await fetch(`${API_URL}/ta3meed/investors/${item.code}/account`, { headers: { Accept: 'application/json' } });
        const json = await response.json();
        if (!response.ok) throw new Error('failed');
        return [item.code, buildSummary(normalize(json.data, item))];
      } catch {
        return [item.code, { ta3meed: 0, manual: 0, cash: 0, total: 0 }];
      }
    })).then((rows) => { if (alive) setAccountSummaries(Object.fromEntries(rows)); });
    return () => { alive = false; };
  }, [accounts.map((item) => item.code).join('|')]);

  if (selected) return <InvestorDetails investor={selected} screen={screen} setScreen={setScreen} onBack={() => setSelected(null)} />;

  const sortedAccounts = [...accounts].map((item) => {
    const summary = accountSummaries[item.code] || { ta3meed: 0, manual: 0, cash: 0, total: 0 };
    const ta3meed = n(summary.ta3meed);
    const manual = n(summary.manual);
    const cash = n(summary.cash);
    const total = n(summary.total);
    return { ...item, ta3meed, manual, cash, total, inactive: ta3meed === 0 && manual === 0 };
  }).sort((a, b) => {
    if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
    if (b.total !== a.total) return b.total - a.total;
    if (b.ta3meed !== a.ta3meed) return b.ta3meed - a.ta3meed;
    return String(a.name).localeCompare(String(b.name), 'ar');
  });

  return <View style={styles.investorScreen}><Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text><Text style={styles.investorScreenSubtitle}>{accounts.length ? 'اختر المستثمر لفتح شاشة خاصة به.' : 'لا يوجد مستثمرون لهذا الحساب بعد. أضف فرصة تعميد وبداخلها مستثمرو هذا الحساب فقط.'}</Text>{sortedAccounts.map((item) => <TouchableOpacity key={item.code} style={[styles.investorAccountButton, item.inactive && { backgroundColor: '#f1f5f9', borderColor: '#d1d5db', opacity: 0.7 }]} onPress={() => { setSelected(item); setScreen('home'); }}><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[styles.investorAccountButtonText, item.inactive && { color: '#6b7280' }]}>شاشة {item.name}</Text><Text style={{ marginTop: 5, color: item.inactive ? '#6b7280' : '#0f766e', fontWeight: '900', textAlign: 'right' }}>تعميد: {fmt(item.ta3meed)}</Text><Text style={{ color: item.inactive ? '#6b7280' : '#1d4ed8', fontWeight: '900', textAlign: 'right' }}>الرصيد اليدوي: {fmt(item.manual)}</Text><Text style={{ color: item.inactive ? '#6b7280' : '#b45309', fontWeight: '900', textAlign: 'right' }}>الكاش: {fmt(item.cash)}</Text><Text style={{ marginTop: 5, color: item.inactive ? '#6b7280' : '#ffffff', backgroundColor: item.inactive ? '#e5e7eb' : '#2563eb', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden', fontWeight: '900', textAlign: 'right' }}>الرصيد الكلي: {fmt(item.total)}</Text>{item.inactive ? <Text style={{ marginTop: 5, color: '#6b7280', backgroundColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', fontWeight: '900' }}>غير مفعل · أرصدة صفرية</Text> : null}</View><Text style={[styles.investorAccountButtonIcon, item.inactive && { color: '#6b7280' }]}>›</Text></TouchableOpacity>)}</View>;
}

function InvestorDetails({ investor, screen, setScreen, onBack }) {
  const [account, setAccount] = useState(null);
  const [message, setMessage] = useState('');
  const load = async () => {
    setMessage('جاري تحميل الحساب...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error('failed');
      setAccount(normalize(json.data, investor));
      setMessage('');
    } catch {
      setAccount(normalize({}, investor));
      setMessage('تعذر تحميل الحساب.');
    }
  };
  useEffect(() => { load(); }, [investor.code]);
  return <View style={styles.investorScreen}><TouchableOpacity style={styles.investorAccountBackButton} onPress={screen === 'home' ? onBack : () => setScreen('home')}><Text style={styles.investorAccountBackText}>{screen === 'home' ? 'رجوع لحسابات المستثمرين' : `رجوع لشاشة ${investor.name}`}</Text></TouchableOpacity>{screen === 'home' ? <Home investor={investor} account={account} message={message} setScreen={setScreen} /> : null}{screen === 'manage' ? <ManageEntries investor={investor} account={account} reload={load} onBack={() => setScreen('home')} /> : null}{screen === 'movements' ? <SimpleList title={`#S-113 الحركات المالية - ${investor.name}`} rows={account?.timeline || []} /> : null}</View>;
}

function Home({ investor, account, message, setScreen }) {
  const balance = n(account?.balance);
  const ta3meed = n(account?.ta3meed);
  const endedProfit = n(account?.endedProfit);
  const cash = balance + endedProfit - ta3meed;
  const capital = balance + endedProfit;
  const cards = [
    ['مستثمر تعميد', ta3meed, '#ecfdf5', '#99f6e4', '#0f766e', '#115e59', 'مجموع رأس مال المستثمر المتبقي في فرص تعميد غير المنتهية', true],
    ['الرصيد اليدوي', balance, '#eff6ff', '#bfdbfe', '#1d4ed8', '#1e3a8a', 'مجموع الإضافات - مجموع السحوبات'],
    ['الكاش', cash, cash < 0 ? '#fff1f2' : '#fffbeb', cash < 0 ? '#fecdd3' : '#fde68a', cash < 0 ? '#be123c' : '#b45309', cash < 0 ? '#881337' : '#78350f', 'الرصيد اليدوي + ربح تعميد المنتهي - مستثمر تعميد'],
    ['إجمالي المستثمر', n(account?.activeInvested), '#f8fafc', '#e2e8f0', '#475569', '#0f172a', 'مجموع رأس مال المستثمر في الفرص غير المنتهية'],
    ['نصيبه المستلم', n(account?.activeReceived), '#f5f3ff', '#ddd6fe', '#6d28d9', '#4c1d95', 'المستلم من أصل رأس المال فقط'],
    ['رأس المال', capital, '#ecfdf5', '#99f6e4', '#0f766e', '#115e59', 'الرصيد اليدوي + ربح تعميد المنتهي'],
    ['ربح متوقع', n(account?.expectedProfit), '#fffbeb', '#fde68a', '#b45309', '#78350f', 'مجموع الربح المتوقع لحصة المستثمر'],
    ['ربح تعميد المنتهي', endedProfit, '#eff6ff', '#bfdbfe', '#1d4ed8', '#1e3a8a', 'المسترجع الكامل أو مجموع الدفعات - المبلغ المستثمر'],
    ['عدد الفرص', n(account?.opportunitiesCount), '#f8fafc', '#e2e8f0', '#475569', '#0f172a', 'عدد فرص المستثمر في تعميد', false, true],
  ];
  return <><Text style={styles.investorScreenTitle}>#S-111 شاشة {investor.name}</Text><View style={{ marginTop: 12, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>{cards.map((card) => <Card key={card[0]} data={card} />)}</View>{!!message && <Text style={styles.message}>{message}</Text>}<Text style={styles.panelTitle}>شاشات المستثمر</Text><Nav title="#S-112 إدارة حركات أرصدة المستثمر" text="إضافة رصيد، تسجيل سحب، تعديل وحذف." onPress={() => setScreen('manage')} /><Nav title="#S-113 الحركات المالية لكل مستثمر" text="كل الاستلامات والإيداعات والسحوبات في شاشة مستقلة." onPress={() => setScreen('movements')} /></>;
}

function Card({ data }) {
  const [title, value, bg, border, titleColor, valueColor, note, wide, count] = data;
  return <View style={{ flexBasis: wide ? '100%' : '47%', flexGrow: 1, minHeight: wide ? 128 : 108, borderRadius: 24, overflow: 'hidden', backgroundColor: bg, borderWidth: 1, borderColor: border }}><View style={{ width: '100%', paddingVertical: wide ? 12 : 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: titleColor, fontWeight: '900', fontSize: 13, textAlign: 'center' }}>{title}</Text></View><View style={{ flex: 1, width: '100%', paddingHorizontal: 14, paddingVertical: wide ? 16 : 13, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: valueColor, fontWeight: '900', fontSize: wide ? 27 : 20, textAlign: 'center', writingDirection: 'rtl' }}>{count ? value : `${money(value, 2)} ر.س`}</Text>{note ? <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 10, marginTop: 7, textAlign: 'center', lineHeight: 16, writingDirection: 'rtl' }}>{note}</Text> : null}</View></View>;
}

function Nav({ title, text, onPress }) {
  return <TouchableOpacity style={styles.investorAccountButton} onPress={onPress}><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.investorAccountButtonText}>{title}</Text><Text style={styles.investorScreenSubtitle}>{text}</Text></View><Text style={styles.investorAccountButtonIcon}>›</Text></TouchableOpacity>;
}

function ManageEntries({ investor, account, reload, onBack }) {
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayText());
  const [notes, setNotes] = useState('');
  const [entryType, setEntryType] = useState('deposit');
  const [editingId, setEditingId] = useState(null);
  const [localMessage, setLocalMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const rows = account?.entries || [];
  const totals = useMemo(() => rows.reduce((sum, row) => {
    const value = n(row.amount);
    if (value >= 0) return { ...sum, deposits: sum.deposits + value };
    return { ...sum, withdrawals: sum.withdrawals + Math.abs(value) };
  }, { deposits: 0, withdrawals: 0 }), [rows]);
  const result = totals.deposits - totals.withdrawals;
  const reset = () => { setAmount(''); setEntryDate(todayText()); setNotes(''); setEntryType('deposit'); setEditingId(null); };
  const closeModal = () => { reset(); setModalVisible(false); };
  const openAdd = () => { reset(); setModalVisible(true); };
  const startEdit = (row) => { setEditingId(row.id); setAmount(String(Math.abs(n(row.amount)))); setEntryType(n(row.amount) < 0 ? 'withdrawal' : 'deposit'); setEntryDate(row.entry_date || todayText()); setNotes(row.notes || ''); setLocalMessage('تم فتح الحركة للتعديل'); setModalVisible(true); };
  const save = async () => {
    const value = n(amount);
    if (!value) return setLocalMessage('أدخل المبلغ أولًا');
    try {
      const url = editingId ? `${API_URL}/ta3meed/investors/${investor.code}/account/entries/${editingId}` : `${API_URL}/ta3meed/investors/${investor.code}/account/entries`;
      const response = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ amount: value, type: entryType, entry_date: entryDate || todayText(), notes: notes || null }) });
      if (!response.ok) throw new Error('failed');
      setLocalMessage(editingId ? 'تم تعديل الحركة' : 'تمت إضافة الحركة');
      setModalVisible(false);
      reset();
      await reload();
    } catch { setLocalMessage('تعذر حفظ الحركة'); }
  };
  const remove = async (row) => {
    try {
      const removeVerb = ['D', 'E', 'L', 'E', 'T', 'E'].join('');
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account/entries/${row.id}`, { method: removeVerb, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('failed');
      if (editingId === row.id) reset();
      setLocalMessage('تم حذف الحركة');
      await reload();
    } catch { setLocalMessage('تعذر حذف الحركة'); }
  };
  return <Modal visible animationType="slide" onRequestClose={onBack}><SafeAreaView style={{ flex: 1, backgroundColor: '#f4f7fb' }}><View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><TouchableOpacity onPress={onBack} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#312e81', fontSize: 27, fontWeight: '900' }}>‹</Text></TouchableOpacity><View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '900' }}>#S-112</Text><Text style={{ color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'center' }}>حركات أرصدة {investor.name}</Text></View><View style={{ width: 48 }} /></View><ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 96 }} showsVerticalScrollIndicator={false}><View style={{ marginTop: 8, marginBottom: 10, borderRadius: 24, backgroundColor: result < 0 ? '#fff1f2' : '#ecfdf5', borderWidth: 1, borderColor: result < 0 ? '#fecdd3' : '#99f6e4', paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}><Text style={{ color: result < 0 ? '#be123c' : '#0f766e', fontSize: 13, fontWeight: '900', textAlign: 'right' }}>الناتج</Text><Text style={{ marginTop: 3, color: result < 0 ? '#dc2626' : '#0f172a', fontSize: 30, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>{money(result, 2)} ر.س</Text><View style={{ marginTop: 10, flexDirection: 'row-reverse', gap: 8 }}><View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.78)', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'flex-end' }}><Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900' }}>إجمالي الإضافات</Text><Text style={{ marginTop: 2, color: '#0f766e', fontSize: 13, fontWeight: '900', writingDirection: 'rtl' }}>{money(totals.deposits, 2)} ر.س</Text></View><View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.78)', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'flex-end' }}><Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900' }}>إجمالي السحوبات</Text><Text style={{ marginTop: 2, color: '#dc2626', fontSize: 13, fontWeight: '900', writingDirection: 'rtl' }}>{money(totals.withdrawals, 2)} ر.س</Text></View></View></View>{!!localMessage && <Text style={[styles.message, { marginHorizontal: 4 }]}>{localMessage}</Text>}<Text style={[styles.panelTitle, { marginTop: 4, marginBottom: 8, fontSize: 17 }]}>الحركات ({rows.length})</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((row, index) => <View key={row.id || index} style={{ marginTop: index === 0 ? 0 : 8, minHeight: 78, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: n(row.amount) < 0 ? '#fecdd3' : '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}><View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}><Text style={{ color: n(row.amount) < 0 ? '#dc2626' : '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>{money(row.amount || 0, 2)} ر.س</Text><View style={{ marginTop: 5, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, maxWidth: '100%' }}><Text style={{ color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: '900' }}>{row.entry_date || '-'}</Text>{row.notes ? <Text numberOfLines={1} style={{ flexShrink: 1, color: '#475569', fontSize: 12, fontWeight: '800', textAlign: 'right' }}>{row.notes}</Text> : null}</View></View><View style={{ alignItems: 'stretch', gap: 6 }}><TouchableOpacity onPress={() => startEdit(row)} style={{ minWidth: 58, borderRadius: 999, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f0f9ff', paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' }}><Text style={{ color: '#0284c7', fontSize: 12, fontWeight: '900' }}>تعديل</Text></TouchableOpacity><TouchableOpacity onPress={() => remove(row)} style={{ minWidth: 58, borderRadius: 999, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' }}><Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '900' }}>حذف</Text></TouchableOpacity></View></View>)}</ScrollView><TouchableOpacity onPress={openAdd} activeOpacity={0.86} style={{ position: 'absolute', left: 20, bottom: 22, width: 58, height: 58, borderRadius: 29, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 14, zIndex: 9999 }}><Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', lineHeight: 34 }}>+</Text></TouchableOpacity><EntryModal visible={modalVisible} editingId={editingId} entryType={entryType} setEntryType={setEntryType} amount={amount} setAmount={setAmount} entryDate={entryDate} setEntryDate={setEntryDate} notes={notes} setNotes={setNotes} closeModal={closeModal} save={save} /></SafeAreaView></Modal>;
}

function EntryModal({ visible, editingId, entryType, setEntryType, amount, setAmount, entryDate, setEntryDate, notes, setNotes, closeModal, save }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}><View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'center', padding: 18 }}><View style={[styles.investorPaymentCard, { marginTop: 0, maxHeight: '88%' }]}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><TouchableOpacity onPress={closeModal} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#0f172a', fontSize: 24, fontWeight: '900', marginTop: -2 }}>×</Text></TouchableOpacity><Text style={styles.investorPaymentTitle}>{editingId ? 'تعديل حركة' : 'إضافة حركة'}</Text></View><View style={styles.investorEntryTypeRow}><TypeButton label="إضافة" active={entryType === 'deposit'} onPress={() => setEntryType('deposit')} /><TypeButton label="سحب" active={entryType === 'withdrawal'} onPress={() => setEntryType('withdrawal')} danger /></View><TextInput value={amount} onChangeText={setAmount} placeholder="المبلغ" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.investorPaymentInput} /><TextInput value={entryDate} onChangeText={setEntryDate} placeholder="تاريخ الحركة YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} /><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات" placeholderTextColor="#94a3b8" style={[styles.investorPaymentInput, styles.investorNotesInput]} multiline textAlignVertical="top" /><TouchableOpacity style={[styles.investorPaymentButton, entryType === 'withdrawal' && styles.investorWithdrawButton]} onPress={save}><Text style={styles.investorPaymentButtonText}>{editingId ? 'حفظ التعديل' : 'حفظ الحركة'}</Text></TouchableOpacity>{editingId ? <TouchableOpacity style={styles.investorCancelEditButton} onPress={closeModal}><Text style={styles.investorCancelEditText}>إلغاء التعديل</Text></TouchableOpacity> : null}</View></View></Modal>;
}

function TypeButton({ label, active, onPress, danger }) {
  return <TouchableOpacity style={[styles.investorEntryTypeButton, active && styles.investorEntryTypeButtonActive, active && danger && styles.investorEntryTypeButtonDanger]} onPress={onPress}><Text style={[styles.investorEntryTypeText, active && styles.investorEntryTypeTextActive]}>{label}</Text></TouchableOpacity>;
}

function SimpleList({ title, rows }) {
  return <><Text style={styles.investorScreenTitle}>{title}</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((row, index) => <View key={row.id || index} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{money(row.amount || row.received_amount || 0, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>{row.date || row.entry_date || row.receipt_date || '-'}</Text>{row.description || row.notes ? <Text style={styles.investorPaymentMeta}>{row.description || row.notes}</Text> : null}</View>)}</>;
}
