import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const endedProfit = summary.ended_profit !== undefined ? safeNumber(summary.ended_profit) : opportunities.reduce((sum, row) => {
    return isEnded(row) ? sum + Math.max(0, safeNumber(row.received_total_amount ?? row.received_amount) - safeNumber(row.invested_amount)) : sum;
  }, 0);
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

export function Ta3meedInvestorAccounts({ investors, backRequestVersion = 0, onExit }) {
  const accounts = useMemo(() => uniqueInvestors(investors), [investors]);
  const [selected, setSelected] = useState(null);
  const [screen, setScreen] = useState('home');
  const [seenBack, setSeenBack] = useState(backRequestVersion);

  useEffect(() => {
    if (backRequestVersion === seenBack) return;
    setSeenBack(backRequestVersion);
    if (selected && screen !== 'home') return setScreen('home');
    if (selected) return setSelected(null);
    onExit?.();
  }, [backRequestVersion, seenBack, selected, screen, onExit]);

  if (selected) return <InvestorDetails investor={selected} screen={screen} setScreen={setScreen} onBack={() => setSelected(null)} />;

  return <View style={styles.investorScreen}><Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text><Text style={styles.investorScreenSubtitle}>{accounts.length ? 'اختر المستثمر لفتح شاشة خاصة به.' : 'لا يوجد مستثمرون لهذا الحساب بعد. أضف فرصة تعميد وبداخلها مستثمرو هذا الحساب فقط.'}</Text>{accounts.map((item) => <TouchableOpacity key={item.code} style={styles.investorAccountButton} onPress={() => { setSelected(item); setScreen('home'); }}><Text style={styles.investorAccountButtonText}>شاشة {item.name}</Text><Text style={styles.investorAccountButtonIcon}>›</Text></TouchableOpacity>)}</View>;
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

  return <View style={styles.investorScreen}><TouchableOpacity style={styles.investorAccountBackButton} onPress={screen === 'home' ? onBack : () => setScreen('home')}><Text style={styles.investorAccountBackText}>{screen === 'home' ? 'رجوع لحسابات المستثمرين' : `رجوع لشاشة ${investor.name}`}</Text></TouchableOpacity>{screen === 'home' ? <Home investor={investor} account={account} message={message} setScreen={setScreen} /> : null}{screen === 'manage' ? <ManageEntries investor={investor} account={account} reload={load} /> : null}{screen === 'movements' ? <SimpleList title={`#S-113 الحركات المالية - ${investor.name}`} rows={account?.timeline || []} /> : null}</View>;
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

function ManageEntries({ investor, account, reload }) {
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayText());
  const [notes, setNotes] = useState('');
  const [entryType, setEntryType] = useState('deposit');
  const [editingId, setEditingId] = useState(null);
  const [localMessage, setLocalMessage] = useState('');
  const rows = account?.entries || [];
  const reset = () => { setAmount(''); setEntryDate(todayText()); setNotes(''); setEntryType('deposit'); setEditingId(null); };
  const startEdit = (row) => { setEditingId(row.id); setAmount(String(Math.abs(n(row.amount)))); setEntryType(n(row.amount) < 0 ? 'withdrawal' : 'deposit'); setEntryDate(row.entry_date || todayText()); setNotes(row.notes || ''); setLocalMessage('تم فتح الحركة للتعديل'); };
  const save = async () => {
    const value = n(amount);
    if (!value) return setLocalMessage('أدخل المبلغ أولًا');
    try {
      const url = editingId ? `${API_URL}/ta3meed/investors/${investor.code}/account/entries/${editingId}` : `${API_URL}/ta3meed/investors/${investor.code}/account/entries`;
      const response = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ amount: value, type: entryType, entry_date: entryDate || todayText(), notes: notes || null }) });
      if (!response.ok) throw new Error('failed');
      reset();
      setLocalMessage(editingId ? 'تم تعديل الحركة' : 'تمت إضافة الحركة');
      await reload();
    } catch { setLocalMessage('تعذر حفظ الحركة'); }
  };
  const remove = async (row) => {
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account/entries/${row.id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('failed');
      if (editingId === row.id) reset();
      setLocalMessage('تم حذف الحركة');
      await reload();
    } catch { setLocalMessage('تعذر حذف الحركة'); }
  };
  return <><Text style={styles.investorScreenTitle}>#S-112 إدارة حركات أرصدة {investor.name}</Text>{!!localMessage && <Text style={styles.message}>{localMessage}</Text>}<View style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{editingId ? 'تعديل حركة' : 'إضافة حركة'}</Text><View style={styles.investorEntryTypeRow}><TypeButton label="إضافة" active={entryType === 'deposit'} onPress={() => setEntryType('deposit')} /><TypeButton label="سحب" active={entryType === 'withdrawal'} onPress={() => setEntryType('withdrawal')} danger /></View><TextInput value={amount} onChangeText={setAmount} placeholder="المبلغ" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.investorPaymentInput} /><TextInput value={entryDate} onChangeText={setEntryDate} placeholder="تاريخ الحركة YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} /><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات" placeholderTextColor="#94a3b8" style={[styles.investorPaymentInput, styles.investorNotesInput]} multiline textAlignVertical="top" /><TouchableOpacity style={[styles.investorPaymentButton, entryType === 'withdrawal' && styles.investorWithdrawButton]} onPress={save}><Text style={styles.investorPaymentButtonText}>{editingId ? 'حفظ التعديل' : 'حفظ الحركة'}</Text></TouchableOpacity>{editingId ? <TouchableOpacity style={styles.investorCancelEditButton} onPress={reset}><Text style={styles.investorCancelEditText}>إلغاء التعديل</Text></TouchableOpacity> : null}</View><Text style={styles.panelTitle}>الحركات</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((row, index) => <View key={row.id || index} style={styles.investorPaymentCard}><Text style={[styles.investorPaymentTitle, n(row.amount) < 0 && styles.investorWithdrawText]}>{money(row.amount || 0, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>{row.entry_date || '-'}</Text>{row.notes ? <Text style={styles.investorPaymentMeta}>{row.notes}</Text> : null}<View style={[styles.balanceEntryActions, { gap: 8, marginTop: 10 }]}><TouchableOpacity style={[styles.balanceEntryActionButton, { minWidth: 70, paddingHorizontal: 10 }]} onPress={() => startEdit(row)}><Text style={[styles.balanceEntryActionIcon, styles.balanceEntryEditIcon, { fontSize: 13 }]}>تعديل</Text></TouchableOpacity><TouchableOpacity style={[styles.balanceEntryActionButton, { minWidth: 62, paddingHorizontal: 10 }]} onPress={() => remove(row)}><Text style={[styles.balanceEntryActionIcon, styles.balanceEntryDeleteIcon, { fontSize: 13 }]}>حذف</Text></TouchableOpacity></View></View>)}</>;
}

function TypeButton({ label, active, onPress, danger }) {
  return <TouchableOpacity style={[styles.investorEntryTypeButton, active && styles.investorEntryTypeButtonActive, active && danger && styles.investorEntryTypeButtonDanger]} onPress={onPress}><Text style={[styles.investorEntryTypeText, active && styles.investorEntryTypeTextActive]}>{label}</Text></TouchableOpacity>;
}

function SimpleList({ title, rows }) {
  return <><Text style={styles.investorScreenTitle}>{title}</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((row, index) => <View key={row.id || index} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{money(row.amount || row.received_amount || 0, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>{row.date || row.entry_date || row.receipt_date || '-'}</Text>{row.description || row.notes ? <Text style={styles.investorPaymentMeta}>{row.description || row.notes}</Text> : null}</View>)}</>;
}
