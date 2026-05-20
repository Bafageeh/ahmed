import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { money, n } from './ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const todayText = () => new Date().toISOString().slice(0, 10);
const investorBase = [
  { code: 'ahmed', name: 'أحمد' },
  { code: 'sara', name: 'سارة' },
  { code: 'amal', name: 'آمال' },
  { code: 'mother', name: 'أمي' },
  { code: 'father', name: 'الوالد' },
];
const aliases = { 'أحمد': 'ahmed', 'احمد': 'ahmed', 'سارة': 'sara', 'ساره': 'sara', 'آمال': 'amal', 'امال': 'amal', 'أمال': 'amal', 'أمي': 'mother', 'امي': 'mother', 'الوالد': 'father' };
const colors = {
  main: ['#ecfdf5', '#99f6e4', '#0f766e', '#115e59'],
  blue: ['#eff6ff', '#bfdbfe', '#1d4ed8', '#1e3a8a'],
  amber: ['#fffbeb', '#fde68a', '#b45309', '#78350f'],
  violet: ['#f5f3ff', '#ddd6fe', '#6d28d9', '#4c1d95'],
  slate: ['#f8fafc', '#e2e8f0', '#475569', '#0f172a'],
  red: ['#fff1f2', '#fecdd3', '#be123c', '#881337'],
};
const endedStatuses = ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'مستلم', 'مستلمة', 'تم الاستلام', 'منتهي', 'منتهية'];
const cancelledStatuses = ['cancelled', 'canceled', 'void', 'ملغي', 'ملغية', 'ملغاة'];

function keyOf(v) { return aliases[String(v || '').trim()] || String(v || '').trim(); }
function buildInvestors(investors) {
  const map = new Map(investorBase.map((x) => [x.code, x]));
  (investors || []).forEach((x) => {
    const code = keyOf(x.code || x.name);
    const name = x.name || x.code;
    if (code && name) map.set(code, { code, name });
  });
  return Array.from(map.values());
}
function statusValues(o) {
  return [o?.opportunity_status, o?.allocation_status, o?.status]
    .map((status) => String(status || '').trim().toLowerCase())
    .filter(Boolean);
}
function hasStatus(o, statuses) { return statusValues(o).some((status) => statuses.includes(status)); }
function isEnded(o) { return hasStatus(o, endedStatuses); }
function isCancelled(o) { return hasStatus(o, cancelledStatuses); }
function isInactive(o) { return isCancelled(o) || isEnded(o); }
function investorEndedProfitOf(o) { return Math.max(0, n(o?.received_total_amount ?? o?.received_amount) - n(o?.invested_amount)); }
function principalReceivedOf(o) {
  const invested = n(o?.invested_amount);
  const explicit = o?.principal_received_amount ?? null;
  if (explicit !== null && explicit !== undefined) return Math.min(invested, Math.max(0, n(explicit)));
  return Math.min(invested, Math.max(0, n(o?.received_total_amount ?? o?.received_amount)));
}
function remainingCapitalOf(o) {
  if (isInactive(o)) return 0;
  const explicit = o?.ta3meed_remaining_amount ?? null;
  if (explicit !== null && explicit !== undefined) return Math.max(0, n(explicit));
  return Math.max(0, n(o?.invested_amount) - principalReceivedOf(o));
}
function normalizeAccount(raw, investor) {
  const summary = raw?.summary || {};
  const opportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : [];
  const active = opportunities.filter((o) => !isInactive(o));
  const activeInvested = active.reduce((sum, o) => sum + n(o.invested_amount), 0);
  const ta3meed = active.reduce((sum, o) => sum + remainingCapitalOf(o), 0);
  const activeReceived = Math.max(0, activeInvested - ta3meed);
  const endedProfit = summary.ended_profit !== undefined ? n(summary.ended_profit) : opportunities.filter(isEnded).reduce((sum, o) => sum + investorEndedProfitOf(o), 0);
  const entries = Array.isArray(raw?.entries) && raw.entries.length ? raw.entries : (Array.isArray(raw?.manual_entries) ? raw.manual_entries : []);
  return {
    investor,
    balance: raw?.balance !== undefined ? n(raw.balance) : n(summary.manual_balance),
    activeInvested,
    activeReceived,
    ta3meed,
    endedProfit,
    expectedProfit: n(summary.expected_profit),
    netBalance: summary.net_balance !== undefined ? n(summary.net_balance) : null,
    opportunitiesCount: summary.opportunities_count !== undefined ? n(summary.opportunities_count) : opportunities.length,
    entries,
    timeline: Array.isArray(raw?.timeline) ? raw.timeline : [],
    opportunities,
  };
}

export function Ta3meedInvestorAccounts({ investors, backRequestVersion = 0, onExit }) {
  const accounts = useMemo(() => buildInvestors(investors), [investors]);
  const [selected, setSelected] = useState(null);
  const [screen, setScreen] = useState('home');
  const [seenBack, setSeenBack] = useState(backRequestVersion);
  useEffect(() => {
    if (backRequestVersion === seenBack) return;
    setSeenBack(backRequestVersion);
    if (selected && screen !== 'home') return setScreen('home');
    if (selected) return setSelected(null);
    onExit?.();
  }, [backRequestVersion, onExit, screen, seenBack, selected]);
  if (selected) return <InvestorDetails investor={selected} screen={screen} setScreen={setScreen} onBack={() => setSelected(null)} />;
  return <View style={styles.investorScreen}><Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text><Text style={styles.investorScreenSubtitle}>اختر المستثمر لفتح شاشة خاصة به.</Text>{accounts.map((i) => <TouchableOpacity key={i.code} style={styles.investorAccountButton} onPress={() => { setSelected(i); setScreen('home'); }}><Text style={styles.investorAccountButtonText}>شاشة {i.name}</Text><Text style={styles.investorAccountButtonIcon}>›</Text></TouchableOpacity>)}</View>;
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
      setAccount(normalizeAccount(json.data, investor));
      setMessage('');
    } catch {
      setAccount(normalizeAccount({}, investor));
      setMessage('تعذر تحميل الحساب.');
    }
  };
  useEffect(() => { load(); }, [investor.code]);
  return <View style={styles.investorScreen}><TouchableOpacity style={styles.investorAccountBackButton} onPress={screen === 'home' ? onBack : () => setScreen('home')}><Text style={styles.investorAccountBackText}>{screen === 'home' ? 'رجوع لحسابات المستثمرين' : `رجوع لشاشة ${investor.name}`}</Text></TouchableOpacity>{screen === 'home' ? <Home investor={investor} account={account} message={message} setScreen={setScreen} /> : null}{screen === 'manage' ? <ManageEntries investor={investor} account={account} reload={load} /> : null}{screen === 'movements' ? <SimpleList title={`#S-113 الحركات المالية - ${investor.name}`} rows={account?.timeline || []} /> : null}{screen === 'opportunities' ? <OpportunityList investor={investor} rows={account?.opportunities || []} /> : null}</View>;
}

function Home({ investor, account, message, setScreen }) {
  const balance = n(account?.balance);
  const ta3meed = n(account?.ta3meed);
  const cash = balance - ta3meed;
  const capital = balance + n(account?.endedProfit);
  const cards = [
    ['مستثمر تعميد', ta3meed, 'main', 'مجموع رأس مال المستثمر المتبقي في فرص تعميد غير المنتهية', true],
    ['الرصيد اليدوي', balance, 'blue', 'مجموع الإضافات - مجموع السحوبات'],
    ['الكاش', cash, cash < 0 ? 'red' : 'amber', 'الرصيد اليدوي - مستثمر تعميد'],
    ['إجمالي المستثمر', n(account?.activeInvested), 'slate', 'مجموع رأس مال المستثمر في الفرص غير المنتهية'],
    ['نصيبه المستلم', n(account?.activeReceived), 'violet', 'المستلم من أصل رأس المال فقط'],
    ['رأس المال', capital, 'main', 'الرصيد اليدوي + ربح تعميد المنتهي'],
    ['ربح متوقع', n(account?.expectedProfit), 'amber', 'مجموع الربح المتوقع لحصة المستثمر'],
    ['ربح تعميد المنتهي', n(account?.endedProfit), 'blue', 'المسترجع الكامل أو مجموع الدفعات - المبلغ المستثمر'],
    ['عدد الفرص', n(account?.opportunitiesCount), 'slate', 'عدد فرص المستثمر في تعميد', false, true],
  ];
  return <><Text style={styles.investorScreenTitle}>#S-111 شاشة {investor.name}</Text><View style={{ marginTop: 12, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>{cards.map(([title, value, color, note, wide, count]) => <Card key={title} title={title} value={value} color={color} note={note} wide={wide} count={count} />)}</View>{account?.netBalance !== null && account?.netBalance !== undefined ? <Text style={[styles.investorPaymentMeta, { textAlign: 'center', marginTop: 12 }]}>صافي الحساب مع الاستلامات: {money(account.netBalance, 2)} ر.س</Text> : null}{!!message && <Text style={styles.message}>{message}</Text>}<Text style={styles.panelTitle}>شاشات المستثمر</Text><Nav title="#S-112 إدارة حركات أرصدة المستثمر" text="إضافة رصيد، تسجيل سحب، تعديل وحذف." onPress={() => setScreen('manage')} /><Nav title="#S-113 الحركات المالية لكل مستثمر" text="كل الاستلامات والإيداعات والسحوبات في شاشة مستقلة." onPress={() => setScreen('movements')} /><Nav title="#S-114 تفصيل فرص المستثمر" text="مبلغ كل فرصة، المستلم، المتبقي، والربح المتوقع." onPress={() => setScreen('opportunities')} /></>;
}
function Card({ title, value, color = 'slate', note, wide, count }) {
  const c = colors[color] || colors.slate;
  return (
    <View style={{ flexBasis: wide ? '100%' : '47%', flexGrow: 1, minHeight: wide ? 128 : 108, borderRadius: 24, overflow: 'hidden', backgroundColor: c[0], borderWidth: 1, borderColor: c[1] }}>
      <View style={{ width: '100%', paddingVertical: wide ? 12 : 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: c[1], alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c[2], fontWeight: '900', fontSize: 13, textAlign: 'center' }}>{title}</Text>
      </View>
      <View style={{ flex: 1, width: '100%', paddingHorizontal: 14, paddingVertical: wide ? 16 : 13, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c[3], fontWeight: '900', fontSize: wide ? 27 : 20, textAlign: 'center', writingDirection: 'rtl' }}>{count ? value : `${money(value, 2)} ر.س`}</Text>
        {note ? <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 10, marginTop: 7, textAlign: 'center', lineHeight: 16, writingDirection: 'rtl' }}>{note}</Text> : null}
      </View>
    </View>
  );
}
function Nav({ title, text, onPress }) { return <TouchableOpacity style={styles.investorAccountButton} onPress={onPress}><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.investorAccountButtonText}>{title}</Text><Text style={styles.investorScreenSubtitle}>{text}</Text></View><Text style={styles.investorAccountButtonIcon}>›</Text></TouchableOpacity>; }

function ManageEntries({ investor, account, reload }) {
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayText());
  const [notes, setNotes] = useState('');
  const [entryType, setEntryType] = useState('deposit');
  const [editingId, setEditingId] = useState(null);
  const [localMessage, setLocalMessage] = useState('');
  const rows = account?.entries || [];
  const total = rows.reduce((sum, row) => sum + n(row.amount || 0), 0);
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
  return <><Text style={styles.investorScreenTitle}>#S-112 إدارة حركات أرصدة {investor.name}</Text>{!!localMessage && <Text style={styles.message}>{localMessage}</Text>}<View style={[styles.investorPaymentCard, { backgroundColor: '#ecfdf5', borderColor: '#99f6e4' }]}><Text style={[styles.investorPaymentTitle, { color: '#0f766e' }]}>مجموع الحركات</Text><Text style={[styles.investorBalanceText, { marginTop: 6 }]}>{money(total, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>إجمالي الإيداعات والسحوبات الظاهرة في هذه الشاشة</Text></View><View style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{editingId ? 'تعديل حركة' : 'إضافة حركة'}</Text><View style={styles.investorEntryTypeRow}><TypeButton label="إضافة" active={entryType === 'deposit'} onPress={() => setEntryType('deposit')} /><TypeButton label="سحب" active={entryType === 'withdrawal'} onPress={() => setEntryType('withdrawal')} danger /></View><TextInput value={amount} onChangeText={setAmount} placeholder="المبلغ" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.investorPaymentInput} /><TextInput value={entryDate} onChangeText={setEntryDate} placeholder="تاريخ الحركة YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} /><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات" placeholderTextColor="#94a3b8" style={[styles.investorPaymentInput, styles.investorNotesInput]} multiline textAlignVertical="top" /><TouchableOpacity style={[styles.investorPaymentButton, entryType === 'withdrawal' && styles.investorWithdrawButton]} onPress={save}><Text style={styles.investorPaymentButtonText}>{editingId ? 'حفظ التعديل' : 'حفظ الحركة'}</Text></TouchableOpacity>{editingId ? <TouchableOpacity style={styles.investorCancelEditButton} onPress={reset}><Text style={styles.investorCancelEditText}>إلغاء التعديل</Text></TouchableOpacity> : null}</View><Text style={styles.panelTitle}>الحركات</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((r, i) => <View key={r.id || i} style={styles.investorPaymentCard}><View style={styles.balanceEntryHeader}><View style={[styles.balanceEntryActions, { gap: 8 }]}><TouchableOpacity style={[styles.balanceEntryActionButton, { minWidth: 70, paddingHorizontal: 10 }]} onPress={() => startEdit(r)}><Text style={[styles.balanceEntryActionIcon, styles.balanceEntryEditIcon, { fontSize: 13 }]}>تعديل</Text></TouchableOpacity><TouchableOpacity style={[styles.balanceEntryActionButton, { minWidth: 62, paddingHorizontal: 10 }]} onPress={() => remove(r)}><Text style={[styles.balanceEntryActionIcon, styles.balanceEntryDeleteIcon, { fontSize: 13 }]}>حذف</Text></TouchableOpacity></View><Text style={[styles.investorPaymentTitle, n(r.amount) < 0 && styles.investorWithdrawText]}>{money(r.amount || 0, 2)} ر.س</Text></View><Text style={styles.investorPaymentMeta}>{r.entry_date || '-'}</Text>{r.notes ? <Text style={styles.investorPaymentMeta}>{r.notes}</Text> : null}</View>)}</>;
}
function TypeButton({ label, active, onPress, danger }) { return <TouchableOpacity style={[styles.investorEntryTypeButton, active && styles.investorEntryTypeButtonActive, active && danger && styles.investorEntryTypeButtonDanger]} onPress={onPress}><Text style={[styles.investorEntryTypeText, active && styles.investorEntryTypeTextActive]}>{label}</Text></TouchableOpacity>; }
function SimpleList({ title, rows }) { return <><Text style={styles.investorScreenTitle}>{title}</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((r, i) => <View key={r.id || i} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{money(r.amount || r.received_amount || 0, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>{r.date || r.entry_date || r.receipt_date || '-'}</Text>{r.description || r.notes ? <Text style={styles.investorPaymentMeta}>{r.description || r.notes}</Text> : null}</View>)}</>; }
function OpportunityList({ investor, rows }) { return <><Text style={styles.investorScreenTitle}>#S-114 فرص تعميد - {investor.name}</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد فرص تعميد مرتبطة بهذا المستثمر.</Text> : rows.map((o, i) => <View key={`${o.opportunity_id || i}-${o.allocation_id || i}`} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{o.reference_number || 'فرصة تعميد'}</Text><Text style={styles.investorPaymentMeta}>مبلغ المستثمر: {money(o.invested_amount, 2)}</Text><Text style={styles.investorPaymentMeta}>المستلم من أصل رأس المال: {money(principalReceivedOf(o), 2)}</Text><Text style={styles.investorPaymentMeta}>رأس المال المتبقي: {money(remainingCapitalOf(o), 2)}</Text><Text style={styles.investorPaymentMeta}>ربحه الفعلي: {money(o.ended_profit_amount ?? Math.max(0, n(o.received_total_amount ?? o.received_amount) - n(o.invested_amount)), 2)}</Text></View>)}</>; }
