import React, { useEffect, useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { money, n } from './ta3meedUtils';
import { ahmedUserHeaders } from '../ahmedCurrentUser';
import { ChevronRight, Coins, ArrowLeftRight, Wallet, TrendingUp, UserRound } from 'lucide-react-native';
import UiIcon from '../UiIcon';
import { InvestorAccountDashboard } from './Ta3meedInvestorDashboard';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const todayText = () => new Date().toISOString().slice(0, 10);
const endedStatuses = ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'مستلم', 'مستلمة', 'تم الاستلام', 'منتهي', 'منتهية'];
const cancelledStatuses = ['cancelled', 'canceled', 'void', 'ملغي', 'ملغية', 'ملغاة'];

function uniqueInvestors(investors) {
  const map = new Map();
  (investors || []).forEach((item) => {
    const code = String(item?.code || item?.name || '').trim();
    const name = String(item?.name || item?.code || '').trim();
    if (code && name) map.set(code, { code, name, codes: item.codes?.length ? item.codes : [code] });
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

async function fetchInvestorAccount(code) {
  const response = await fetch(`${API_URL}/ta3meed/investors/${encodeURIComponent(code)}/account`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.message || 'تعذر تحميل حساب المستثمر');
  return json.data;
}

async function fetchGroupedAccount(investor) {
  const codes = investor.codes?.length ? investor.codes : [investor.code];
  const results = await Promise.all(codes.map(async (code) => ({ code, raw: await fetchInvestorAccount(code) })));
  const accounts = results.map(({ code, raw }) => {
    const account = normalize(raw, investor);
    return {
      ...account,
      entries: (account.entries || []).map((entry) => ({ ...entry, _accountCode: code })),
      timeline: (account.timeline || []).map((entry) => ({ ...entry, _accountCode: code })),
    };
  });
  return accounts.reduce((acc, row) => ({
    ...acc,
    balance: acc.balance + row.balance,
    ta3meed: acc.ta3meed + row.ta3meed,
    activeInvested: acc.activeInvested + row.activeInvested,
    activeReceived: acc.activeReceived + row.activeReceived,
    endedProfit: acc.endedProfit + row.endedProfit,
    expectedProfit: acc.expectedProfit + row.expectedProfit,
    opportunitiesCount: acc.opportunitiesCount + row.opportunitiesCount,
    entries: [...acc.entries, ...row.entries],
    timeline: [...acc.timeline, ...row.timeline],
  }), {
    investor, balance: 0, ta3meed: 0, activeInvested: 0, activeReceived: 0,
    endedProfit: 0, expectedProfit: 0, opportunitiesCount: 0, entries: [], timeline: [],
  });
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
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

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
        const account = await fetchGroupedAccount(item);
        return [item.code, buildSummary(account)];
      } catch {
        return [item.code, { ta3meed: 0, manual: 0, cash: 0, total: 0 }];
      }
    })).then((rows) => { if (alive) setAccountSummaries(Object.fromEntries(rows)); });
    return () => { alive = false; };
  }, [accounts.map((item) => (item.codes || [item.code]).join('|')).join('~')]);

  if (selected) return <InvestorDetails investor={selected} screen={screen} setScreen={setScreen} onBack={() => setSelected(null)} />;

  const sortedAccounts = [...accounts].map((item) => {
    const summary = accountSummaries[item.code] || { ta3meed: 0, manual: 0, cash: 0, total: 0 };
    const ta3meed = n(summary.ta3meed);
    const manual = n(summary.manual);
    const cash = n(summary.cash);
    const total = n(summary.total);
    const profit = Math.round((total - manual) * 100) / 100;
    return { ...item, ta3meed, manual, cash, total, profit, inactive: ta3meed === 0 && manual === 0 };
  }).sort((a, b) => {
    if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
    if (b.total !== a.total) return b.total - a.total;
    if (b.ta3meed !== a.ta3meed) return b.ta3meed - a.ta3meed;
    return String(a.name).localeCompare(String(b.name), 'ar');
  });

  const searchKey = String(searchText || '').trim().normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g, '').toLowerCase();
  const visibleAccounts = sortedAccounts.filter((item) => {
    if (searchKey && !String(item.name || '').normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g, '').toLowerCase().includes(searchKey)) return false;
    if (filterMode === 'active' && item.inactive) return false;
    if (filterMode === 'inactive' && !item.inactive) return false;
    return true;
  });

  return (
    <View style={compactStyles.listRoot}>
      <View style={compactStyles.searchRow}>
        <TouchableOpacity
          onPress={() => setFiltersOpen((value) => !value)}
          style={[compactStyles.filterButton, filtersOpen && compactStyles.filterButtonSelected]}
          accessibilityRole="button"
          accessibilityLabel="خيارات تصفية المستثمرين"
          accessibilityState={{ expanded: filtersOpen }}
        >
          <UiIcon name="filter" size={20} color={filtersOpen ? '#0a7d76' : '#24508e'} />
        </TouchableOpacity>
        <View style={compactStyles.searchBox}>
          <TextInput
            style={compactStyles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="البحث عن مستثمر..."
            placeholderTextColor="#97a7bb"
            textAlign="right"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="البحث عن اسم المستثمر"
          />
          <UiIcon name="search" size={21} color="#97a7bb" />
        </View>
      </View>
      {filtersOpen ? (
        <View style={compactStyles.filterRow}>
          {[
            { key: 'all', label: 'الكل' },
            { key: 'active', label: 'النشطة' },
            { key: 'inactive', label: 'غير النشطة' },
          ].map((mode) => (
            <TouchableOpacity
              key={mode.key}
              onPress={() => { setFilterMode(mode.key); setFiltersOpen(false); }}
              style={[compactStyles.filterChoice, filterMode === mode.key && compactStyles.filterChoiceActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: filterMode === mode.key }}
            >
              <Text style={[compactStyles.filterChoiceText, filterMode === mode.key && compactStyles.filterChoiceTextActive]}>{mode.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {!visibleAccounts.length ? (
        <View style={compactStyles.emptyCard}>
          <Text style={compactStyles.emptyTitle}>{accounts.length ? 'لا توجد حسابات مطابقة' : 'لا توجد حسابات للمستثمرين'}</Text>
          <Text style={compactStyles.emptyText}>{accounts.length ? 'غيّر البحث أو الفلتر لعرض المستثمرين.' : 'ستظهر هنا الحسابات المرتبطة بإدارة المستثمرين عند إضافة استثمارات أو حركات مالية.'}</Text>
        </View>
      ) : null}
      {visibleAccounts.map((item) => (
        <CompactInvestorCard
          key={item.code}
          item={item}
          onPress={() => { setSelected(item); setScreen('home'); }}
        />
      ))}
    </View>
  );
}



const avatarColors = {
  'س': { fill: '#fce7f0', icon: '#e91e70' },
  'أ': { fill: '#e2eeff', icon: '#2474ee' },
  'ا': { fill: '#e2eeff', icon: '#2474ee' },
  'ع': { fill: '#dff6ea', icon: '#00976e' },
  'م': { fill: '#fff0d8', icon: '#f19908' },
  'خ': { fill: '#eee7ff', icon: '#7456db' },
};
const formatAmount = (value) => fmt(value);

function CompactInvestorCard({ item, onPress }) {
  const name = String(item.name || '').trim();
  const inactive = item.inactive;
  const avatar = avatarColors[name.slice(0, 1)] || { fill: '#e2eeff', icon: '#2474ee' };
  return (
    <TouchableOpacity
      style={[compactStyles.accountCard, inactive && compactStyles.accountCardInactive]}
      onPress={onPress}
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel={'فتح حساب المستثمر ' + name}
    >
      <View style={compactStyles.cardHeader}>
        <ChevronRight size={20} color={inactive ? '#9aa9b8' : '#26477d'} strokeWidth={2.4} />
        <View style={[compactStyles.avatar, { backgroundColor: inactive ? '#e9edf2' : avatar.fill }]}>
          <UserRound size={20} fill={inactive ? '#89949d' : avatar.icon} color={inactive ? '#89949d' : avatar.icon} strokeWidth={1.7} />
        </View>
        <Text style={[compactStyles.investorName, inactive && compactStyles.inactiveText]} numberOfLines={1}>{name}</Text>
      </View>
      <View style={compactStyles.metricsRow}>
        <CompactMetric label="استثمار تعميد" value={item.ta3meed} icon="investment" color="#087e5a" inactive={inactive} />
        <CompactMetric label="الحوالات الشخصية" value={item.manual} icon="transfers" color="#1257ce" inactive={inactive} />
      </View>
      <View style={compactStyles.metricsRow}>
        <CompactMetric label="الكاش" value={item.cash} icon="cash" color="#d5630a" inactive={inactive} />
        <CompactMetric label="الربح" value={item.profit} icon="profit" color={item.profit < 0 ? '#c13b40' : '#048966'} inactive={inactive} />
      </View>
      <View style={[compactStyles.balanceStrip, inactive && compactStyles.balanceStripInactive]}>
        <View style={compactStyles.balanceTitleWrap}>
          <Wallet size={17} color={inactive ? '#98a5b3' : '#0d57cf'} strokeWidth={2.2} />
          <Text style={[compactStyles.balanceLabel, inactive && compactStyles.inactiveText]}>الرصيد الكلي</Text>
        </View>
        <Text style={[compactStyles.balanceAmount, inactive && compactStyles.inactiveText]} numberOfLines={1} adjustsFontSizeToFit>
          {formatAmount(item.total)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function CompactMetric({ label, value, icon, color, inactive }) {
  const tint = inactive ? '#8995a3' : color;
  return (
    <View style={[compactStyles.metricCell, inactive && compactStyles.metricCellInactive]}>
      <View style={compactStyles.metricIconWrap}>
        {icon === 'investment' ? <Coins size={17} color={tint} strokeWidth={2.15} /> : null}
        {icon === 'transfers' ? <ArrowLeftRight size={17} color={tint} strokeWidth={2.15} /> : null}
        {icon === 'cash' ? <Wallet size={17} color={tint} strokeWidth={2.15} /> : null}
        {icon === 'profit' ? <TrendingUp size={17} color={tint} strokeWidth={2.15} /> : null}
      </View>
      <View style={compactStyles.metricCopy}>
        <Text style={compactStyles.metricLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
        <Text style={[compactStyles.metricAmount, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatAmount(value)}
        </Text>
      </View>
    </View>
  );
}

const compactStyles = {
  listRoot: { width: '100%', paddingBottom: 10 },
  searchRow: { flexDirection: 'row-reverse', gap: 9, marginTop: 2, marginBottom: 10, alignItems: 'center' },
  filterButton: { height: 43, width: 43, borderRadius: 13, borderWidth: 1, borderColor: '#d8e3ef', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  filterButtonSelected: { backgroundColor: '#eaf6f3', borderColor: '#aadbd5' },
  searchBox: { flex: 1, flexDirection: 'row-reverse', height: 43, alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: '#d8e3ef', backgroundColor: '#fff', paddingHorizontal: 13 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: '#142b44', paddingVertical: 4, writingDirection: 'rtl' },
  filterRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginBottom: 10 },
  filterChoice: { borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe5ee', paddingHorizontal: 13, paddingVertical: 7 },
  filterChoiceActive: { backgroundColor: '#097c75', borderColor: '#097c75' },
  filterChoiceText: { color: '#64788c', fontSize: 12, fontWeight: '800' },
  filterChoiceTextActive: { color: '#fff' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 8, borderWidth: 1, borderColor: '#e0e8f0' },
  emptyTitle: { textAlign: 'right', color: '#2c3d51', fontWeight: '800', fontSize: 15 },
  emptyText: { textAlign: 'right', color: '#8291a1', marginTop: 7, fontSize: 12 },
  accountCard: { backgroundColor: '#fff', borderRadius: 17, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 8, marginBottom: 9, borderWidth: 1, borderColor: '#e0e7f0', shadowColor: '#213455', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  accountCardInactive: { backgroundColor: '#fafbfc' },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, height: 32, paddingHorizontal: 5, marginBottom: 5 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  investorName: { flex: 1, textAlign: 'right', writingDirection: 'rtl', color: '#102238', fontSize: 16, fontWeight: '900' },
  metricsRow: { flexDirection: 'row-reverse', gap: 5, marginBottom: 4 },
  metricCell: { flex: 1, minWidth: 0, height: 43, borderRadius: 9, backgroundColor: '#f7f9fc', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 6, gap: 6 },
  metricCellInactive: { backgroundColor: '#f0f3f6' },
  metricIconWrap: { width: 23, alignItems: 'center', justifyContent: 'center' },
  metricCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center' },
  metricLabel: { color: '#637a93', fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  metricAmount: { fontSize: 15, fontWeight: '900', marginTop: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  balanceStrip: { height: 29, backgroundColor: '#e5f1ff', borderRadius: 9, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 1 },
  balanceStripInactive: { backgroundColor: '#eef2f6' },
  balanceTitleWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  balanceLabel: { color: '#0d57cf', fontWeight: '900', fontSize: 12 },
  balanceAmount: { flexShrink: 1, color: '#0d57cf', fontWeight: '900', fontSize: 17, fontVariant: ['tabular-nums'] },
  inactiveText: { color: '#84929f' },
};

function InvestorDetails({ investor, screen, setScreen, onBack }) {
  const [account, setAccount] = useState(null);
  const [message, setMessage] = useState('');
  const load = async () => {
    setMessage('جاري تحميل الحساب...');
    try {
      setAccount(await fetchGroupedAccount(investor));
      setMessage('');
    } catch {
      setAccount(normalize({}, investor));
      setMessage('تعذر تحميل الحساب.');
    }
  };
  useEffect(() => { load(); }, [investor.code]);
  return (
    <View style={{ marginTop: 12 }}>
      {screen !== 'home' ? (
        <TouchableOpacity style={styles.investorAccountBackButton} onPress={() => setScreen('home')} accessibilityRole="button" accessibilityLabel={`رجوع لشاشة ${investor.name}`}>
          <Text style={styles.investorAccountBackText}>{`رجوع لشاشة ${investor.name}`}</Text>
        </TouchableOpacity>
      ) : null}
      {screen === 'home' ? <InvestorAccountDashboard investor={investor} account={account} message={message} setScreen={setScreen} /> : null}
      {screen === 'manage' ? <ManageEntries investor={investor} account={account} reload={load} onBack={() => setScreen('home')} /> : null}
      {screen === 'movements' ? <SimpleList title={`الحركات المالية - ${investor.name}`} rows={account?.timeline || []} /> : null}
    </View>
  );
}

function ManageEntries({ investor, account, reload, onBack }) {
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayText());
  const [notes, setNotes] = useState('');
  const [entryType, setEntryType] = useState('deposit');
  const [editingId, setEditingId] = useState(null);
  const [editingCode, setEditingCode] = useState(null);
  const [localMessage, setLocalMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const rows = account?.entries || [];
  const totals = useMemo(() => rows.reduce((sum, row) => {
    const value = n(row.amount);
    if (value >= 0) return { ...sum, deposits: sum.deposits + value };
    return { ...sum, withdrawals: sum.withdrawals + Math.abs(value) };
  }, { deposits: 0, withdrawals: 0 }), [rows]);
  const result = totals.deposits - totals.withdrawals;
  const reset = () => { setAmount(''); setEntryDate(todayText()); setNotes(''); setEntryType('deposit'); setEditingId(null); setEditingCode(null); };
  const closeModal = () => { reset(); setModalVisible(false); };
  const openAdd = () => { reset(); setModalVisible(true); };
  const startEdit = (row) => { setEditingId(row.id); setEditingCode(row._accountCode || investor.code); setAmount(String(Math.abs(n(row.amount)))); setEntryType(n(row.amount) < 0 ? 'withdrawal' : 'deposit'); setEntryDate(row.entry_date || todayText()); setNotes(row.notes || ''); setLocalMessage('تم فتح الحركة للتعديل'); setModalVisible(true); };
  const save = async () => {
    const value = n(amount);
    if (!value) return setLocalMessage('أدخل المبلغ أولًا');
    try {
      const targetCode = editingId ? (editingCode || investor.code) : investor.code;
      const url = editingId ? `${API_URL}/ta3meed/investors/${encodeURIComponent(targetCode)}/account/entries/${editingId}` : `${API_URL}/ta3meed/investors/${encodeURIComponent(targetCode)}/account/entries`;
      const response = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: ahmedUserHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }), body: JSON.stringify({ amount: value, type: entryType, entry_date: entryDate || todayText(), notes: notes || null }) });
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
      const response = await fetch(`${API_URL}/ta3meed/investors/${encodeURIComponent(row._accountCode || investor.code)}/account/entries/${row.id}`, { method: removeVerb, headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      if (!response.ok) throw new Error('failed');
      if (editingId === row.id) reset();
      setLocalMessage('تم حذف الحركة');
      await reload();
    } catch { setLocalMessage('تعذر حذف الحركة'); }
  };
  return <Modal visible animationType="slide" onRequestClose={onBack}><SafeAreaView style={{ flex: 1, backgroundColor: '#f4f7fb' }}><View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><TouchableOpacity onPress={onBack} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#312e81', fontSize: 27, fontWeight: '900' }}>‹</Text></TouchableOpacity><View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'center' }}>حركات أرصدة {investor.name}</Text></View><View style={{ width: 48 }} /></View><ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 96 }} showsVerticalScrollIndicator={false}><View style={{ marginTop: 8, marginBottom: 10, borderRadius: 24, backgroundColor: result < 0 ? '#fff1f2' : '#ecfdf5', borderWidth: 1, borderColor: result < 0 ? '#fecdd3' : '#99f6e4', paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}><Text style={{ color: result < 0 ? '#be123c' : '#0f766e', fontSize: 13, fontWeight: '900', textAlign: 'right' }}>الناتج</Text><Text style={{ marginTop: 3, color: result < 0 ? '#dc2626' : '#0f172a', fontSize: 30, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>{money(result, 2)} ر.س</Text><View style={{ marginTop: 10, flexDirection: 'row-reverse', gap: 8 }}><View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.78)', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'flex-end' }}><Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900' }}>إجمالي الإضافات</Text><Text style={{ marginTop: 2, color: '#0f766e', fontSize: 13, fontWeight: '900', writingDirection: 'rtl' }}>{money(totals.deposits, 2)} ر.س</Text></View><View style={{ flex: 1, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.78)', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'flex-end' }}><Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900' }}>إجمالي السحوبات</Text><Text style={{ marginTop: 2, color: '#dc2626', fontSize: 13, fontWeight: '900', writingDirection: 'rtl' }}>{money(totals.withdrawals, 2)} ر.س</Text></View></View></View>{!!localMessage && <Text style={[styles.message, { marginHorizontal: 4 }]}>{localMessage}</Text>}<Text style={[styles.panelTitle, { marginTop: 4, marginBottom: 8, fontSize: 17 }]}>الحركات ({rows.length})</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((row, index) => <View key={`${row._accountCode || investor.code}-${row.id || index}`} style={{ marginTop: index === 0 ? 0 : 8, minHeight: 78, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: n(row.amount) < 0 ? '#fecdd3' : '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}><View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}><Text style={{ color: n(row.amount) < 0 ? '#dc2626' : '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>{money(row.amount || 0, 2)} ر.س</Text><View style={{ marginTop: 5, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, maxWidth: '100%' }}><Text style={{ color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: '900' }}>{row.entry_date || '-'}</Text>{row.notes ? <Text numberOfLines={1} style={{ flexShrink: 1, color: '#475569', fontSize: 12, fontWeight: '800', textAlign: 'right' }}>{row.notes}</Text> : null}</View></View><View style={{ alignItems: 'stretch', gap: 6 }}><TouchableOpacity onPress={() => startEdit(row)} style={{ minWidth: 58, borderRadius: 999, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f0f9ff', paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' }}><Text style={{ color: '#0284c7', fontSize: 12, fontWeight: '900' }}>تعديل</Text></TouchableOpacity><TouchableOpacity onPress={() => remove(row)} style={{ minWidth: 58, borderRadius: 999, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' }}><Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '900' }}>حذف</Text></TouchableOpacity></View></View>)}</ScrollView><TouchableOpacity onPress={openAdd} activeOpacity={0.86} style={{ position: 'absolute', left: 20, bottom: 22, width: 58, height: 58, borderRadius: 29, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 14, zIndex: 9999 }}><Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', lineHeight: 34 }}>+</Text></TouchableOpacity><EntryModal visible={modalVisible} editingId={editingId} entryType={entryType} setEntryType={setEntryType} amount={amount} setAmount={setAmount} entryDate={entryDate} setEntryDate={setEntryDate} notes={notes} setNotes={setNotes} closeModal={closeModal} save={save} /></SafeAreaView></Modal>;
}

function EntryModal({ visible, editingId, entryType, setEntryType, amount, setAmount, entryDate, setEntryDate, notes, setNotes, closeModal, save }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}><View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'center', padding: 18 }}><View style={[styles.investorPaymentCard, { marginTop: 0, maxHeight: '88%' }]}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><TouchableOpacity onPress={closeModal} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#0f172a', fontSize: 24, fontWeight: '900', marginTop: -2 }}>×</Text></TouchableOpacity><Text style={styles.investorPaymentTitle}>{editingId ? 'تعديل حركة' : 'إضافة حركة'}</Text></View><View style={styles.investorEntryTypeRow}><TypeButton label="إضافة" active={entryType === 'deposit'} onPress={() => setEntryType('deposit')} /><TypeButton label="سحب" active={entryType === 'withdrawal'} onPress={() => setEntryType('withdrawal')} danger /></View><TextInput value={amount} onChangeText={setAmount} placeholder="المبلغ" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.investorPaymentInput} /><TextInput value={entryDate} onChangeText={setEntryDate} placeholder="تاريخ الحركة YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} /><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات" placeholderTextColor="#94a3b8" style={[styles.investorPaymentInput, styles.investorNotesInput]} multiline textAlignVertical="top" /><TouchableOpacity style={[styles.investorPaymentButton, entryType === 'withdrawal' && styles.investorWithdrawButton]} onPress={save}><Text style={styles.investorPaymentButtonText}>{editingId ? 'حفظ التعديل' : 'حفظ الحركة'}</Text></TouchableOpacity>{editingId ? <TouchableOpacity style={styles.investorCancelEditButton} onPress={closeModal}><Text style={styles.investorCancelEditText}>إلغاء التعديل</Text></TouchableOpacity> : null}</View></View></Modal>;
}

function TypeButton({ label, active, onPress, danger }) {
  return <TouchableOpacity style={[styles.investorEntryTypeButton, active && styles.investorEntryTypeButtonActive, active && danger && styles.investorEntryTypeButtonDanger]} onPress={onPress}><Text style={[styles.investorEntryTypeText, active && styles.investorEntryTypeTextActive]}>{label}</Text></TouchableOpacity>;
}

function SimpleList({ title, rows }) {
  return <><Text style={styles.investorScreenTitle}>{title}</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((row, index) => <View key={`${row._accountCode || ''}-${row.id || index}`} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{money(row.amount || row.received_amount || 0, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>{row.date || row.entry_date || row.receipt_date || '-'}</Text>{row.description || row.notes ? <Text style={styles.investorPaymentMeta}>{row.description || row.notes}</Text> : null}</View>)}</>;
}
