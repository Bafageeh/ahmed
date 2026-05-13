import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { money, n } from './ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const investorBase = [
  { code: 'ahmed', name: 'أحمد' },
  { code: 'sara', name: 'سارة' },
  { code: 'amal', name: 'آمال' },
  { code: 'mother', name: 'أمي' },
  { code: 'father', name: 'الوالد' },
];
const aliases = { 'أحمد': 'ahmed', 'احمد': 'ahmed', 'سارة': 'sara', 'ساره': 'sara', 'آمال': 'amal', 'امال': 'amal', 'أمي': 'mother', 'امي': 'mother', 'الوالد': 'father' };
const colors = {
  main: ['#ecfdf5', '#99f6e4', '#0f766e', '#115e59'],
  blue: ['#eff6ff', '#bfdbfe', '#1d4ed8', '#1e3a8a'],
  amber: ['#fffbeb', '#fde68a', '#b45309', '#78350f'],
  violet: ['#f5f3ff', '#ddd6fe', '#6d28d9', '#4c1d95'],
  slate: ['#f8fafc', '#e2e8f0', '#475569', '#0f172a'],
  red: ['#fff1f2', '#fecdd3', '#be123c', '#881337'],
};
function keyOf(v) { return aliases[String(v || '').trim()] || String(v || '').trim(); }
function buildInvestors(investors) {
  const map = new Map(investorBase.map((x) => [x.code, x]));
  (investors || []).forEach((x) => { const code = keyOf(x.code || x.name); const name = x.name || x.code; if (code && name) map.set(code, { code, name }); });
  return Array.from(map.values());
}
function isClosed(o) { const status = String(o?.opportunity_status || o?.allocation_status || '').toLowerCase(); return ['received', 'completed', 'closed', 'cancelled', 'canceled', 'finished', 'ended'].includes(status) || n(o?.remaining_amount) <= 0; }
function normalizeAccount(raw, investor) {
  const summary = raw?.summary || {};
  const opportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : [];
  const active = opportunities.filter((o) => !isClosed(o));
  const activeInvested = active.reduce((sum, o) => sum + n(o.invested_amount), 0);
  const activeReceived = active.reduce((sum, o) => sum + n(o.received_amount), 0);
  const endedProfit = opportunities.filter(isClosed).reduce((sum, o) => sum + (n(o.actual_profit_amount) || n(o.contribution_profit_amount) || n(o.expected_profit_amount) || Math.max(0, n(o.received_amount) - n(o.invested_amount))), 0);
  const entries = Array.isArray(raw?.entries) && raw.entries.length ? raw.entries : (Array.isArray(raw?.manual_entries) ? raw.manual_entries : []);
  return {
    investor,
    balance: raw?.balance !== undefined ? n(raw.balance) : n(summary.manual_balance),
    activeInvested,
    activeReceived,
    ta3meed: Math.max(0, activeInvested - activeReceived),
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
  return <View style={styles.investorScreen}><TouchableOpacity style={styles.investorAccountBackButton} onPress={screen === 'home' ? onBack : () => setScreen('home')}><Text style={styles.investorAccountBackText}>{screen === 'home' ? 'رجوع لحسابات المستثمرين' : `رجوع لشاشة ${investor.name}`}</Text></TouchableOpacity>{screen === 'home' ? <Home investor={investor} account={account} message={message} setScreen={setScreen} /> : null}{screen === 'movements' ? <SimpleList title={`#S-113 الحركات المالية - ${investor.name}`} rows={account?.timeline || []} /> : null}{screen === 'opportunities' ? <OpportunityList investor={investor} rows={account?.opportunities || []} /> : null}{screen === 'manage' ? <SimpleList title={`#S-112 إدارة حركات أرصدة ${investor.name}`} rows={account?.entries || []} /> : null}</View>;
}
function Home({ investor, account, message, setScreen }) {
  const balance = n(account?.balance);
  const ta3meed = n(account?.ta3meed);
  const cash = balance - ta3meed;
  const capital = balance + n(account?.endedProfit);
  const cards = [
    ['مستثمر تعميد', ta3meed, 'main', 'إجمالي المستثمر النشط - نصيبه المستلم', true],
    ['الرصيد اليدوي', balance, 'blue'],
    ['الكاش', cash, cash < 0 ? 'red' : 'amber', 'الرصيد اليدوي - مستثمر تعميد'],
    ['إجمالي المستثمر', n(account?.activeInvested), 'slate'],
    ['نصيبه المستلم', n(account?.activeReceived), 'violet'],
    ['رأس المال', capital, 'main'],
    ['ربح متوقع', n(account?.expectedProfit), 'amber'],
    ['ربح تعميد المنتهي', n(account?.endedProfit), 'blue'],
    ['عدد الفرص', n(account?.opportunitiesCount), 'slate', '', false, true],
  ];
  return <><Text style={styles.investorScreenTitle}>#S-111 شاشة {investor.name}</Text><View style={{ marginTop: 12, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>{cards.map(([title, value, color, note, wide, count]) => <Card key={title} title={title} value={value} color={color} note={note} wide={wide} count={count} />)}</View>{account?.netBalance !== null && account?.netBalance !== undefined ? <Text style={[styles.investorPaymentMeta, { textAlign: 'center', marginTop: 12 }]}>صافي الحساب مع الاستلامات: {money(account.netBalance, 2)} ر.س</Text> : null}{!!message && <Text style={styles.message}>{message}</Text>}<Text style={styles.panelTitle}>شاشات المستثمر</Text><Nav title="#S-112 إدارة حركات أرصدة المستثمر" text="إضافة رصيد، تسجيل سحب، تعديل وحذف." onPress={() => setScreen('manage')} /><Nav title="#S-113 الحركات المالية لكل مستثمر" text="كل الاستلامات والإيداعات والسحوبات في شاشة مستقلة." onPress={() => setScreen('movements')} /><Nav title="#S-114 تفصيل فرص المستثمر" text="مبلغ كل فرصة، المستلم، المتبقي، والربح المتوقع." onPress={() => setScreen('opportunities')} /></>;
}
function Card({ title, value, color = 'slate', note, wide, count }) { const c = colors[color] || colors.slate; return <View style={{ flexBasis: wide ? '100%' : '47%', flexGrow: 1, minHeight: wide ? 128 : 108, borderRadius: 24, padding: 15, backgroundColor: c[0], borderWidth: 1, borderColor: c[1], alignItems: 'flex-end', justifyContent: 'center' }}><Text style={{ color: c[2], fontWeight: '900', fontSize: 13, textAlign: 'right' }}>{title}</Text><Text style={{ color: c[3], fontWeight: '900', fontSize: wide ? 27 : 20, marginTop: 7, textAlign: 'right' }}>{count ? value : `${money(value, 2)} ر.س`}</Text>{note ? <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, marginTop: 5, textAlign: 'right' }}>{note}</Text> : null}</View>; }
function Nav({ title, text, onPress }) { return <TouchableOpacity style={styles.investorAccountButton} onPress={onPress}><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.investorAccountButtonText}>{title}</Text><Text style={styles.investorScreenSubtitle}>{text}</Text></View><Text style={styles.investorAccountButtonIcon}>›</Text></TouchableOpacity>; }
function SimpleList({ title, rows }) {
  const total = rows.reduce((sum, row) => sum + n(row.amount || row.received_amount || 0), 0);
  const isBalanceEntriesScreen = title.includes('#S-112');
  return <><Text style={styles.investorScreenTitle}>{title}</Text>{isBalanceEntriesScreen ? <View style={[styles.investorPaymentCard, { backgroundColor: '#ecfdf5', borderColor: '#99f6e4' }]}><Text style={[styles.investorPaymentTitle, { color: '#0f766e' }]}>مجموع الحركات</Text><Text style={[styles.investorBalanceText, { marginTop: 6 }]}>{money(total, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>إجمالي الإيداعات والسحوبات الظاهرة في هذه الشاشة</Text></View> : null}{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد بيانات.</Text> : rows.map((r, i) => <View key={r.id || i} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{money(r.amount || r.received_amount || 0, 2)} ر.س</Text><Text style={styles.investorPaymentMeta}>{r.date || r.entry_date || r.receipt_date || '-'}</Text>{r.description || r.notes ? <Text style={styles.investorPaymentMeta}>{r.description || r.notes}</Text> : null}</View>)}</>;
}
function OpportunityList({ investor, rows }) { return <><Text style={styles.investorScreenTitle}>#S-114 فرص تعميد - {investor.name}</Text>{rows.length === 0 ? <Text style={styles.investorScreenSubtitle}>لا توجد فرص تعميد مرتبطة بهذا المستثمر.</Text> : rows.map((o, i) => <View key={`${o.opportunity_id || i}-${o.allocation_id || i}`} style={styles.investorPaymentCard}><Text style={styles.investorPaymentTitle}>{o.reference_number || 'فرصة تعميد'}</Text><Text style={styles.investorPaymentMeta}>مبلغ المستثمر: {money(o.invested_amount, 2)}</Text><Text style={styles.investorPaymentMeta}>نصيبه المستلم: {money(o.received_amount, 2)}</Text><Text style={styles.investorPaymentMeta}>المتبقي لهذه الفرصة: {money(o.remaining_amount, 2)}</Text><Text style={styles.investorPaymentMeta}>ربحه المتوقع: {money(o.expected_profit_amount, 2)}</Text></View>)}</>; }
