import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const n = (v) => Number(v || 0);
const money = (v, d = 0) => n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const filters = [
  { key: 'all', label: 'الكل', dot: '#0f766e' },
  { key: 'active', label: 'نشط', dot: '#36a852' },
  { key: 'overdue', label: 'متأخر', dot: '#f97316' },
  { key: 'received', label: 'مستلم', dot: '#2f93df' },
];
const titles = ['استثمار شركة ألف', 'استثمار مصنع النور', 'استثمار الواحة العقارية', 'استثمار السوق الذكي', 'استثمار المستقبل'];
const themes = [
  { bg: '#007371', icon: '▥' },
  { bg: '#6d5aa7', icon: '▤' },
  { bg: '#ff8a00', icon: '▦' },
  { bg: '#05a5a3', icon: '▱' },
  { bg: '#2e72bd', icon: '◇' },
];

function metaOf(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; }
}
function isReceived(item) { return item.status === 'received' || item.status === 'completed'; }
function isOverdue(item) {
  const meta = metaOf(item.metadata);
  return !isReceived(item) && Boolean((item.maturity_date && item.maturity_date < today()) || meta.is_overdue || n(meta.remaining_days) < 0);
}
function statusOf(item) {
  if (isReceived(item)) return { key: 'received', label: 'مستلم' };
  if (isOverdue(item)) return { key: 'overdue', label: 'متأخر' };
  return { key: 'active', label: 'نشط' };
}
function titleOf(item, index) {
  const meta = metaOf(item.metadata);
  return item.title || meta.title || meta.name || item.reference_number || titles[index % titles.length];
}
function searchable(item) {
  const meta = metaOf(item.metadata);
  return [item.title, item.reference_number, item.notes, item.status, meta.category, item.maturity_date].filter(Boolean).join(' ').toLowerCase();
}

export default function Ta3meedScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('investments');
  const [message, setMessage] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [receivingId, setReceivingId] = useState(null);

  const totalInvested = useMemo(() => items.reduce((s, i) => s + n(i.principal_amount), 0), [items]);
  const totalProfit = useMemo(() => items.reduce((s, i) => s + n(i.expected_profit_amount), 0), [items]);
  const activeCount = useMemo(() => items.filter((i) => statusOf(i).key === 'active').length, [items]);
  const filtered = useMemo(() => {
    const word = search.trim().toLowerCase();
    return items.filter((item) => (filter === 'all' || statusOf(item).key === filter) && (!word || searchable(item).includes(word)));
  }, [items, filter, search]);

  const loadData = async () => {
    setMessage('جاري تحميل تعميد...');
    try {
      const r = await fetch(`${API_URL}/ta3meed/investments`);
      const json = await r.json();
      setItems(Array.isArray(json.data) ? json.data : []);
      const sr = await fetch(`${API_URL}/ta3meed/summary`);
      const sj = await sr.json();
      setSummary(sj.data || null);
      setMessage('');
    } catch {
      setMessage('تعذر تحميل بيانات تعميد');
    }
  };
  useEffect(() => { loadData(); }, []);

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');
    try {
      const r = await fetch(`${API_URL}/ta3meed/investments/${item.id}/receive`, { method: 'POST', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('failed');
      setMessage('تم اعتبار استثمار تعميد مستلمًا');
      await loadData();
    } catch {
      setMessage('تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
    }
  };
  const cycleFilter = () => {
    const i = filters.findIndex((x) => x.key === filter);
    setFilter(filters[(i + 1) % filters.length].key);
  };
  const showInfo = (text) => setMessage(text);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View style={styles.leftTopActions}>
              <HeaderIcon icon="‹" onPress={onBack} large />
              <HeaderIcon icon="⊕" onPress={() => showInfo('إضافة استثمار تعميد')} />
              <HeaderIcon icon="▽" onPress={cycleFilter} />
              <HeaderIcon icon="⌕" onPress={() => setSearchVisible((v) => !v)} />
            </View>
            <Text style={styles.screenTitle}>تعميد</Text>
            <HeaderIcon icon="⋮" onPress={() => setTab(tab === 'investors' ? 'investments' : 'investors')} />
          </View>

          {searchVisible ? <View style={styles.searchBox}><TextInput value={search} onChangeText={setSearch} placeholder="ابحث في تعميد" placeholderTextColor="#94a3b8" style={styles.searchInput} /><Text style={styles.searchGlyph}>⌕</Text></View> : null}

          <View style={styles.summaryRow}>
            <SummaryCard icon="♙" iconStyle={styles.greenCircle} label="الاستثمارات النشطة" value={`${summary?.active_count ?? activeCount}`} suffix="استثمار" tint={styles.summaryGreen} />
            <SummaryCard icon="↗" iconStyle={styles.goldCircle} label="الأرباح المتوقعة" value={money(totalProfit)} prefix="ر.س" tint={styles.summaryGold} />
            <SummaryCard icon="▢" iconStyle={styles.tealCircle} label="إجمالي الاستثمار" value={money(totalInvested)} prefix="ر.س" tint={styles.summaryTeal} />
          </View>

          {tab === 'investments' ? <View style={styles.filterShell}>{filters.map((f) => <FilterSegment key={f.key} filter={f} active={filter === f.key} onPress={() => setFilter(f.key)} />)}</View> : null}
          {!!message && <Text style={styles.message}>{message}</Text>}
          {tab === 'investors' ? <InvestorStats summary={summary} /> : null}
          {tab === 'investments' ? <View style={styles.listArea}>{filtered.length === 0 ? <EmptyCard /> : filtered.map((item, index) => <Ta3meedCard key={String(item.id)} item={item} index={index} expanded={expandedId === item.id} onToggle={() => setExpandedId((cur) => cur === item.id ? null : item.id)} onReceive={() => receiveInvestment(item)} receiving={receivingId === item.id} onEdit={() => showInfo('التعديل من شاشة تعميد')} onDelete={() => showInfo('الحذف غير مفعل في API')} />)}</View> : null}
        </ScrollView>
        <BottomTabs onHome={onBack} onInfo={showInfo} />
      </View>
    </SafeAreaView>
  );
}

function HeaderIcon({ icon, onPress, large }) {
  return <TouchableOpacity style={styles.headerIcon} onPress={onPress} activeOpacity={0.82}><Text style={[styles.headerIconText, large && styles.headerBackText]}>{icon}</Text></TouchableOpacity>;
}
function SummaryCard({ icon, iconStyle, label, value, prefix, suffix, tint }) {
  return <View style={[styles.summaryCard, tint]}><View style={[styles.summaryIcon, iconStyle]}><Text style={styles.summaryIconText}>{icon}</Text></View><Text style={styles.summaryLabel}>{label}</Text><View style={styles.valueLine}>{prefix ? <Text style={styles.currencyText}>{prefix}</Text> : null}<Text style={styles.summaryValue}>{value}</Text></View>{suffix ? <Text style={styles.summarySuffix}>{suffix}</Text> : null}</View>;
}
function FilterSegment({ filter, active, onPress }) {
  const all = filter.key === 'all';
  return <TouchableOpacity style={[styles.filterSegment, all && styles.allFilterSegment, active && styles.filterSegmentActive]} onPress={onPress} activeOpacity={0.84}>{all ? <Text style={[styles.gridIcon, active && styles.gridIconActive]}>▦</Text> : <View style={[styles.filterDot, { backgroundColor: filter.dot }]} />}<Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{filter.label}</Text></TouchableOpacity>;
}
function Ta3meedCard({ item, index, onEdit, onReceive, onDelete, receiving, expanded, onToggle }) {
  const meta = metaOf(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const status = statusOf(item);
  const received = status.key === 'received';
  const overdue = status.key === 'overdue';
  const theme = themes[index % themes.length];
  const date = received ? (meta.received_date || item.received_at || item.maturity_date || '-') : (item.maturity_date || '-');
  const dateText = received ? `تم الاستلام في ${date}` : overdue ? `كان يستحق في ${date}` : `يستحق في ${date}`;
  return <View style={styles.investmentCard}><View style={styles.itemIconWrap}><View style={[styles.itemIcon, { backgroundColor: theme.bg }]}><Text style={styles.itemIconText}>{theme.icon}</Text></View></View><View style={styles.itemCenter}><Text style={styles.itemTitle} numberOfLines={1}>{titleOf(item, index)}</Text><Text style={[styles.statusPill, overdue && styles.statusOverdue, received && styles.statusReceived]}>{status.label}</Text><View style={styles.dateRow}><Text style={styles.calendarIcon}>▣</Text><Text style={styles.dateText} numberOfLines={1}>{dateText}</Text>{received ? <Text style={styles.inlineCheck}>✓</Text> : null}</View></View><View style={styles.itemLeft}><View style={styles.amountLine}><Text style={styles.currencySmall}>ر.س</Text><Text style={styles.amountValue}>{money(item.principal_amount)}</Text></View><Text style={[styles.profitText, overdue && styles.profitOverdue, received && styles.profitReceived]}>{received ? 'ربح متحقق' : 'ربح متوقع'} {money(item.expected_profit_amount, 2)} ر.س</Text><View style={styles.actionsRow}><CircleAction icon="⌫" tone="delete" onPress={onDelete} />{!received ? <CircleAction icon={receiving ? '…' : '✓'} tone="receive" onPress={onReceive} disabled={receiving} /> : <CircleAction icon="✓" tone="receive" onPress={onToggle} />}<CircleAction icon="✎" tone="edit" onPress={onEdit} /><CircleAction icon={expanded ? '⌃' : '◉'} tone="view" onPress={onToggle} /></View></View>{expanded ? <View style={styles.expandedArea}><Text style={styles.detailText}>الكود: {item.reference_number || '-'}</Text><Text style={styles.detailText}>التصنيف: {meta.category || '-'}</Text><Text style={styles.detailText}>نسبة الربح: {n(item.expected_rate).toFixed(3)}%</Text><Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>{allocations.length ? <View style={styles.allocBox}><Text style={styles.allocTitle}>توزيع المستثمرين</Text>{allocations.map((a) => <Text key={a.id} style={styles.allocText}>{a.investor_name}: {money(a.invested_amount, 2)} ر.س / ربح {money(a.expected_profit_amount, 2)}</Text>)}</View> : null}</View> : null}</View>;
}
function CircleAction({ icon, tone, onPress, disabled }) {
  return <TouchableOpacity style={[styles.circleAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}><Text style={[styles.circleActionText, tone === 'delete' && styles.deleteActionText, tone === 'receive' && styles.receiveActionText, tone === 'edit' && styles.editActionText]}>{icon}</Text></TouchableOpacity>;
}
function InvestorStats({ summary }) {
  const investors = summary?.investors || [];
  if (!investors.length) return <EmptyCard title="لا توجد إحصائيات" text="لا توجد بيانات مستثمرين بعد." />;
  return <View style={styles.investorsCard}><Text style={styles.panelTitle}>إحصائيات كل مستثمر</Text>{investors.map((investor) => <View key={investor.name} style={styles.investorRow}><View style={styles.investorAvatar}><Text style={styles.investorAvatarText}>{String(investor.name || 'م').slice(0, 1)}</Text></View><View style={styles.investorInfo}><Text style={styles.investorName}>{investor.name}</Text><Text style={styles.investorText}>مجموع استثماراته: {money(investor.invested, 2)} ر.س</Text><Text style={styles.investorText}>مجموع أرباحه المتوقعة: {money(investor.profit, 2)} ر.س</Text></View></View>)}</View>;
}
function BottomTabs({ onHome, onInfo }) {
  return <View pointerEvents="box-none" style={styles.bottomWrap}><View style={styles.bottomBar}><BottomItem icon="▦" label="المزيد" onPress={() => onInfo('تبويب المزيد')} /><BottomItem icon="▭" label="محفظتي" onPress={() => onInfo('تبويب محفظتي')} /><View style={styles.centerSpace} /><BottomItem icon="◔" label="استثماراتي" active onPress={() => onInfo('أنت الآن في استثماراتي')} /><BottomItem icon="⌂" label="الرئيسية" onPress={onHome} /></View><TouchableOpacity style={styles.centerFab} activeOpacity={0.86} onPress={() => onInfo('لوحة الاستثمارات')}><Text style={styles.centerFabIcon}>↗</Text><Text style={styles.centerFabBars}>▥</Text></TouchableOpacity></View>;
}
function BottomItem({ icon, label, active, onPress }) {
  return <TouchableOpacity style={styles.bottomItem} onPress={onPress} activeOpacity={0.82}><Text style={[styles.bottomIcon, active && styles.bottomIconActive]}>{icon}</Text><Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{label}</Text></TouchableOpacity>;
}
function EmptyCard({ title = 'لا توجد بيانات', text = 'لا توجد فرص مطابقة للفلتر الحالي.' }) {
  return <View style={styles.emptyCard}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8faf9' },
  screen: { flex: 1, backgroundColor: '#fbfcfc' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 112 },
  topBar: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftTopActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  screenTitle: { position: 'absolute', left: 0, right: 0, top: 24, textAlign: 'center', fontSize: 24, fontWeight: '900', color: '#0f2233' },
  headerIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#edf0f2', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1, zIndex: 2 },
  headerIconText: { color: '#081525', fontSize: 18, fontWeight: '800', lineHeight: 21 },
  headerBackText: { fontSize: 26, lineHeight: 28, marginTop: -1 },
  searchBox: { marginTop: 6, height: 48, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7ecef', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14 },
  searchInput: { flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: '800', paddingVertical: 8 },
  searchGlyph: { color: '#0f766e', fontSize: 18, fontWeight: '900', marginLeft: 8 },
  summaryRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, minHeight: 138, borderRadius: 22, paddingVertical: 15, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e4ebea', shadowColor: '#1f2937', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  summaryGreen: { backgroundColor: '#f2fbf8' },
  summaryGold: { backgroundColor: '#fffaf1' },
  summaryTeal: { backgroundColor: '#f2fbf9' },
  summaryIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#111827', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  greenCircle: { backgroundColor: '#35b95a' },
  goldCircle: { backgroundColor: '#deb33c' },
  tealCircle: { backgroundColor: '#18a99a' },
  summaryIconText: { color: '#fff', fontSize: 19, fontWeight: '900' },
  summaryLabel: { color: '#0f1f2e', fontSize: 10.5, fontWeight: '800', textAlign: 'center', marginBottom: 5, lineHeight: 18 },
  valueLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 3 },
  currencyText: { color: '#0f172a', fontSize: 9.5, fontWeight: '800' },
  summaryValue: { color: '#0b1726', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  summarySuffix: { color: '#334155', fontSize: 10, fontWeight: '700', marginTop: 1 },
  filterShell: { marginTop: 24, height: 57, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e8eb', flexDirection: 'row-reverse', alignItems: 'center', padding: 5, shadowColor: '#111827', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  filterSegment: { flex: 1, height: 47, borderRadius: 20, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  allFilterSegment: { flex: 1.22 },
  filterSegmentActive: { backgroundColor: '#006168' },
  filterDot: { width: 8, height: 8, borderRadius: 8 },
  filterLabel: { color: '#111827', fontSize: 16, fontWeight: '800' },
  filterLabelActive: { color: '#fff' },
  gridIcon: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  gridIconActive: { color: '#fff' },
  message: { marginTop: 10, color: '#075985', textAlign: 'right', fontWeight: '800', backgroundColor: '#eff6ff', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, overflow: 'hidden' },
  listArea: { marginTop: 20 },
  investmentCard: { minHeight: 108, backgroundColor: '#fff', borderRadius: 21, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  itemIconWrap: { width: 58, alignItems: 'flex-end', justifyContent: 'center' },
  itemIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#111827', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  itemIconText: { color: '#fff', fontSize: 23, fontWeight: '900' },
  itemCenter: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8, paddingLeft: 7 },
  itemTitle: { color: '#06111f', fontSize: 17, fontWeight: '900', textAlign: 'right', maxWidth: '100%' },
  statusPill: { marginTop: 7, color: '#087337', backgroundColor: '#eaf7e8', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 13, paddingVertical: 4, fontSize: 11.5, fontWeight: '900', textAlign: 'center' },
  statusOverdue: { color: '#e34a19', backgroundColor: '#fff0e9' },
  statusReceived: { color: '#1267b3', backgroundColor: '#e8f2fb' },
  dateRow: { marginTop: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  calendarIcon: { color: '#4b5563', fontSize: 12, fontWeight: '900' },
  dateText: { color: '#374151', fontSize: 11.5, fontWeight: '600', textAlign: 'right' },
  inlineCheck: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#0d7772', color: '#0d7772', textAlign: 'center', fontWeight: '900', lineHeight: 16, marginRight: 4 },
  itemLeft: { width: 150, alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 1 },
  amountLine: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  currencySmall: { color: '#0f172a', fontSize: 11.5, fontWeight: '800' },
  amountValue: { color: '#0a1424', fontSize: 17, fontWeight: '900' },
  profitText: { color: '#008b54', fontSize: 12.5, fontWeight: '800', textAlign: 'left' },
  profitOverdue: { color: '#f05a12' },
  profitReceived: { color: '#1673ca' },
  actionsRow: { flexDirection: 'row', gap: 9, marginTop: 13, alignItems: 'center' },
  circleAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf1', alignItems: 'center', justifyContent: 'center' },
  circleActionText: { color: '#334155', fontSize: 14, fontWeight: '900' },
  deleteActionText: { color: '#ef1d1d' },
  receiveActionText: { color: '#14823b' },
  editActionText: { color: '#1d70d8' },
  disabledAction: { opacity: 0.5 },
  expandedArea: { position: 'absolute', left: 12, right: 12, top: 106, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, zIndex: 4 },
  detailText: { color: '#475569', textAlign: 'right', fontWeight: '800', marginTop: 4 },
  allocBox: { marginTop: 9, backgroundColor: '#fff', borderRadius: 13, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  allocTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  allocText: { color: '#475569', textAlign: 'right', marginTop: 4, fontSize: 12, fontWeight: '700' },
  investorsCard: { marginTop: 20, backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#edf0f2' },
  panelTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 12 },
  investorRow: { marginTop: 8, flexDirection: 'row-reverse', gap: 10, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 17, padding: 11 },
  investorAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  investorAvatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  investorInfo: { flex: 1, alignItems: 'flex-end' },
  investorName: { color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  investorText: { color: '#64748b', textAlign: 'right', marginTop: 3, fontSize: 12, fontWeight: '800' },
  emptyCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#edf0f2', alignItems: 'center' },
  emptyIcon: { color: '#0f766e', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  bottomWrap: { position: 'absolute', left: 16, right: 16, bottom: 7, height: 82, alignItems: 'center', justifyContent: 'flex-end' },
  bottomBar: { height: 66, width: '100%', borderRadius: 27, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7ecef', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSpace: { flex: 0.88 },
  bottomIcon: { color: '#4b5563', fontSize: 25, fontWeight: '900', lineHeight: 25 },
  bottomIconActive: { color: '#0f766e' },
  bottomLabel: { marginTop: 4, color: '#4b5563', fontSize: 12, fontWeight: '700' },
  bottomLabelActive: { color: '#0f766e', fontWeight: '900' },
  centerFab: { position: 'absolute', bottom: 26, width: 74, height: 74, borderRadius: 37, backgroundColor: '#007371', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#f4f8f8', shadowColor: '#003f44', shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  centerFabIcon: { color: '#fff', fontSize: 21, fontWeight: '900', lineHeight: 20 },
  centerFabBars: { color: '#fff', fontSize: 19, fontWeight: '900', lineHeight: 20, marginTop: -1 },
});