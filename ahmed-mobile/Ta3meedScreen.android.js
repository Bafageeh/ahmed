import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const asNumber = (value) => Number(value || 0);

const filters = [
  { key: 'all', label: 'الكل', dot: '#0f766e' },
  { key: 'active', label: 'نشط', dot: '#36a852' },
  { key: 'overdue', label: 'متأخر', dot: '#f97316' },
  { key: 'received', label: 'مستلم', dot: '#2f93df' },
];

const exampleTitles = ['استثمار شركة ألف', 'استثمار مصنع النور', 'استثمار الواحة العقارية', 'استثمار السوق الذكي', 'استثمار المستقبل'];
const iconThemes = [
  { bg: '#007371', icon: '▥' },
  { bg: '#6d5aa7', icon: '▤' },
  { bg: '#ff8a00', icon: '▦' },
  { bg: '#05a5a3', icon: '▱' },
  { bg: '#2e72bd', icon: '◇' },
];

function readMeta(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch (error) { return {}; }
}
function isReceived(item) { return item.status === 'received' || item.status === 'completed'; }
function isOverdue(item) {
  const meta = readMeta(item.metadata);
  return !isReceived(item) && Boolean((item.maturity_date && item.maturity_date < today()) || meta.is_overdue || asNumber(meta.remaining_days) < 0);
}
function getStatus(item) {
  if (isReceived(item)) return { key: 'received', label: 'مستلم' };
  if (isOverdue(item)) return { key: 'overdue', label: 'متأخر' };
  return { key: 'active', label: 'نشط' };
}
function formatMoney(value, digits = 0) {
  return asNumber(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function investmentTitle(item, index) {
  const meta = readMeta(item.metadata);
  return item.title || meta.title || meta.name || item.reference_number || exampleTitles[index % exampleTitles.length];
}
function searchText(item) {
  const meta = readMeta(item.metadata);
  return [item.title, item.reference_number, item.notes, item.status, meta.category, meta.withdrawal_date, item.maturity_date]
    .filter(Boolean).join(' ').toLowerCase();
}

export default function Ta3meedScreen({ onBack }) {
  const [tab, setTab] = useState('investments');
  const [statusFilter, setStatusFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [receivingId, setReceivingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');

  const totalInvested = useMemo(() => items.reduce((sum, item) => sum + asNumber(item.principal_amount), 0), [items]);
  const totalProfit = useMemo(() => items.reduce((sum, item) => sum + asNumber(item.expected_profit_amount), 0), [items]);
  const activeCount = useMemo(() => items.filter((item) => getStatus(item).key === 'active').length, [items]);
  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => (statusFilter === 'all' || getStatus(item).key === statusFilter) && (!keyword || searchText(item).includes(keyword)));
  }, [items, search, statusFilter]);

  const loadData = async () => {
    setMessage('جاري تحميل تعميد...');
    try {
      const investmentsResponse = await fetch(`${API_URL}/ta3meed/investments`);
      const investmentsJson = await investmentsResponse.json();
      setItems(Array.isArray(investmentsJson.data) ? investmentsJson.data : []);
      const summaryResponse = await fetch(`${API_URL}/ta3meed/summary`);
      const summaryJson = await summaryResponse.json();
      setSummary(summaryJson.data || null);
      setMessage('');
    } catch (error) {
      setMessage('تعذر تحميل بيانات تعميد');
    }
  };

  useEffect(() => { loadData(); }, []);

  const startEdit = (item) => {
    const meta = readMeta(item.metadata);
    setEditing({
      id: item.id,
      code: item.reference_number || '',
      total_amount: String(item.principal_amount || ''),
      profit: String(item.expected_profit_amount || ''),
      profit_rate: String(item.expected_rate || ''),
      category: meta.category || '',
      months: String(meta.months || ''),
      start_date: meta.withdrawal_date || item.start_date || '',
      maturity_date: item.maturity_date || '',
      returned_amount: String(meta.returned_amount || ''),
      notes: item.notes || '',
      allocationsText: (item.allocations || []).map((a) => `${a.investor_name}:${a.invested_amount}`).join('\n'),
    });
    setTab('edit');
    setMessage('تم فتح الاستثمار للتعديل');
  };

  const saveEdit = async () => {
    if (!editing?.code || !editing?.total_amount) return setMessage('أدخل الكود والمبلغ');
    const allocations = editing.allocationsText.split('\n').map((line) => {
      const [investor, amount] = line.split(':');
      return { investor: (investor || '').trim(), amount: Number(amount || 0) };
    }).filter((item) => item.investor && item.amount > 0);
    setMessage('جاري حفظ التعديل...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          code: editing.code,
          total_amount: Number(editing.total_amount),
          profit: Number(editing.profit || 0),
          profit_rate: Number(editing.profit_rate || 0),
          category: editing.category || null,
          months: editing.months ? Number(editing.months) : null,
          start_date: editing.start_date || null,
          maturity_date: editing.maturity_date || null,
          returned_amount: editing.returned_amount ? Number(editing.returned_amount) : null,
          notes: editing.notes || null,
          allocations,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setEditing(null);
      setTab('investments');
      setMessage('تم حفظ تعديل تعميد');
      await loadData();
    } catch (error) { setMessage('تعذر حفظ تعديل تعميد'); }
  };

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/${item.id}/receive`, { method: 'POST', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('receive failed');
      setMessage('تم اعتبار استثمار تعميد مستلمًا');
      await loadData();
    } catch (error) { setMessage('تعذر تسجيل الاستلام'); } finally { setReceivingId(null); }
  };

  const cycleFilter = () => {
    const currentIndex = filters.findIndex((filter) => filter.key === statusFilter);
    setStatusFilter(filters[(currentIndex + 1) % filters.length].key);
  };
  const showInfo = (text) => setMessage(text);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View style={styles.leftTopActions}>
              <HeaderIcon icon="‹" onPress={onBack} large />
              <HeaderIcon icon="⊕" onPress={() => showInfo('إضافة استثمار تعميد ستكون من زر الإضافة عند تفعيل نموذج الإدخال.')} />
              <HeaderIcon icon="▽" onPress={cycleFilter} />
              <HeaderIcon icon="⌕" onPress={() => { setSearchVisible((value) => !value); setTab('investments'); }} />
            </View>
            <Text style={styles.screenTitle}>تعميد</Text>
            <HeaderIcon icon="⋮" onPress={() => setTab(tab === 'investors' ? 'investments' : 'investors')} />
          </View>

          {searchVisible ? <View style={styles.searchBox}><TextInput value={search} onChangeText={setSearch} placeholder="ابحث في تعميد" placeholderTextColor="#94a3b8" style={styles.searchInput} /><Text style={styles.searchGlyph}>⌕</Text></View> : null}

          <View style={styles.summaryRow}>
            <SummaryCard icon="♙" iconStyle={styles.greenCircle} label="الاستثمارات النشطة" value={`${summary?.active_count ?? activeCount}`} suffix="استثمار" tint={styles.summaryGreen} />
            <SummaryCard icon="↗" iconStyle={styles.goldCircle} label="الأرباح المتوقعة" value={formatMoney(totalProfit)} prefix="ر.س" tint={styles.summaryGold} />
            <SummaryCard icon="▢" iconStyle={styles.tealCircle} label="إجمالي الاستثمار" value={formatMoney(totalInvested)} prefix="ر.س" tint={styles.summaryTeal} />
          </View>

          {tab === 'investments' ? <View style={styles.filterShell}>{filters.map((filter) => <FilterSegment key={filter.key} filter={filter} active={statusFilter === filter.key} onPress={() => setStatusFilter(filter.key)} />)}</View> : null}
          {!!message && <Text style={styles.message}>{message}</Text>}
          {tab === 'investors' ? <InvestorStats summary={summary} /> : null}
          {tab === 'edit' && editing ? <EditForm editing={editing} setEditing={setEditing} saveEdit={saveEdit} cancel={() => { setEditing(null); setTab('investments'); }} /> : null}
          {tab === 'investments' ? <View style={styles.listArea}>{filteredItems.length === 0 ? <EmptyCard /> : filteredItems.map((item, index) => <Ta3meedCard key={String(item.id)} item={item} index={index} expanded={expandedId === item.id} onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))} onEdit={() => startEdit(item)} onReceive={() => receiveInvestment(item)} onDelete={() => showInfo('زر الحذف ظاهر لمطابقة التصميم، ولم يتم تفعيل حذف تعميد في API بعد.')} receiving={receivingId === item.id} />)}</View> : null}
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
  const isAll = filter.key === 'all';
  return <TouchableOpacity style={[styles.filterSegment, isAll && styles.allFilterSegment, active && styles.filterSegmentActive]} onPress={onPress} activeOpacity={0.84}>{isAll ? <Text style={[styles.gridIcon, active && styles.gridIconActive]}>▦</Text> : <View style={[styles.filterDot, { backgroundColor: filter.dot }]} />}<Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{filter.label}</Text></TouchableOpacity>;
}
function Ta3meedCard({ item, index, onEdit, onReceive, onDelete, receiving, expanded, onToggle }) {
  const meta = readMeta(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const status = getStatus(item);
  const received = status.key === 'received';
  const overdue = status.key === 'overdue';
  const theme = iconThemes[index % iconThemes.length];
  const date = received ? (meta.received_date || item.received_at || item.maturity_date || '-') : (item.maturity_date || '-');
  const dateText = received ? `تم الاستلام في ${date}` : overdue ? `كان يستحق في ${date}` : `يستحق في ${date}`;
  return <View style={styles.investmentCard}><View style={styles.itemIconWrap}><View style={[styles.itemIcon, { backgroundColor: theme.bg }]}><Text style={styles.itemIconText}>{theme.icon}</Text></View></View><View style={styles.itemCenter}><Text style={styles.itemTitle} numberOfLines={1}>{investmentTitle(item, index)}</Text><Text style={[styles.statusPill, overdue && styles.statusOverdue, received && styles.statusReceived]}>{status.label}</Text><View style={styles.dateRow}><Text style={styles.calendarIcon}>▣</Text><Text style={styles.dateText} numberOfLines={1}>{dateText}</Text>{received ? <Text style={styles.inlineCheck}>✓</Text> : null}</View></View><View style={styles.itemLeft}><View style={styles.amountLine}><Text style={styles.currencySmall}>ر.س</Text><Text style={styles.amountValue}>{formatMoney(item.principal_amount)}</Text></View><Text style={[styles.profitText, overdue && styles.profitOverdue, received && styles.profitReceived]}>{received ? 'ربح متحقق' : 'ربح متوقع'} {formatMoney(item.expected_profit_amount, 2)} ر.س</Text><View style={styles.actionsRow}><CircleAction icon="⌫" tone="delete" onPress={onDelete} />{!received ? <CircleAction icon={receiving ? '…' : '✓'} tone="receive" onPress={onReceive} disabled={receiving} /> : <CircleAction icon="✓" tone="receive" onPress={onToggle} />}<CircleAction icon="✎" tone="edit" onPress={onEdit} /><CircleAction icon={expanded ? '⌃' : '◉'} tone="view" onPress={onToggle} /></View></View>{expanded ? <View style={styles.expandedArea}><Text style={styles.detailText}>الكود: {item.reference_number || '-'}</Text><Text style={styles.detailText}>التصنيف: {meta.category || '-'}</Text><Text style={styles.detailText}>نسبة الربح: {asNumber(item.expected_rate).toFixed(3)}%</Text><Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text><Text style={styles.detailText}>المسترد: {formatMoney(meta.returned_amount, 2)} ر.س</Text>{allocations.length ? <View style={styles.allocBox}><Text style={styles.allocTitle}>توزيع المستثمرين</Text>{allocations.map((a) => <Text key={a.id} style={styles.allocText}>{a.investor_name}: {formatMoney(a.invested_amount, 2)} ر.س / ربح {formatMoney(a.expected_profit_amount, 2)}</Text>)}</View> : null}</View> : null}</View>;
}
function CircleAction({ icon, tone, onPress, disabled }) {
  return <TouchableOpacity style={[styles.circleAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}><Text style={[styles.circleActionText, tone === 'delete' && styles.deleteActionText, tone === 'receive' && styles.receiveActionText, tone === 'edit' && styles.editActionText]}>{icon}</Text></TouchableOpacity>;
}
function InvestorStats({ summary }) {
  const investors = summary?.investors || [];
  if (!investors.length) return <EmptyCard title="لا توجد إحصائيات" text="لا توجد بيانات مستثمرين بعد." />;
  return <View style={styles.investorsCard}><Text style={styles.panelTitle}>إحصائيات كل مستثمر</Text>{investors.map((investor) => <View key={investor.name} style={styles.investorRow}><View style={styles.investorAvatar}><Text style={styles.investorAvatarText}>{String(investor.name || 'م').slice(0, 1)}</Text></View><View style={styles.investorInfo}><Text style={styles.investorName}>{investor.name}</Text><Text style={styles.investorText}>مجموع استثماراته: {formatMoney(investor.invested, 2)} ر.س</Text><Text style={styles.investorText}>مجموع أرباحه المتوقعة: {formatMoney(investor.profit, 2)} ر.س</Text></View></View>)}</View>;
}
function EditForm({ editing, setEditing, saveEdit, cancel }) {
  const setField = (key, value) => setEditing((current) => ({ ...current, [key]: value }));
  return <View style={styles.editCard}><Text style={styles.panelTitle}>تعديل استثمار تعميد</Text><View style={styles.formGrid}><Field label="الكود" value={editing.code} onChangeText={(v) => setField('code', v)} /><Field label="المبلغ" value={editing.total_amount} onChangeText={(v) => setField('total_amount', v)} keyboardType="decimal-pad" /><Field label="الربح" value={editing.profit} onChangeText={(v) => setField('profit', v)} keyboardType="decimal-pad" /><Field label="نسبة الربح" value={editing.profit_rate} onChangeText={(v) => setField('profit_rate', v)} keyboardType="decimal-pad" /><Field label="التصنيف" value={editing.category} onChangeText={(v) => setField('category', v)} /><Field label="الشهور" value={editing.months} onChangeText={(v) => setField('months', v)} keyboardType="number-pad" /><Field label="تاريخ السحب" value={editing.start_date} onChangeText={(v) => setField('start_date', v)} /><Field label="تاريخ الاستحقاق" value={editing.maturity_date} onChangeText={(v) => setField('maturity_date', v)} /><Field label="المسترد" value={editing.returned_amount} onChangeText={(v) => setField('returned_amount', v)} keyboardType="decimal-pad" /></View><Text style={styles.inputLabel}>توزيع المستثمرين</Text><TextInput value={editing.allocationsText} onChangeText={(v) => setField('allocationsText', v)} style={[styles.input, styles.multiInput]} multiline placeholder={'أحمد:10000\nأمل:5000'} placeholderTextColor="#94a3b8" /><Field label="ملاحظات" value={editing.notes} onChangeText={(v) => setField('notes', v)} /><View style={styles.formActions}><TouchableOpacity style={styles.formSaveButton} onPress={saveEdit} activeOpacity={0.85}><Text style={styles.formSaveText}>حفظ التعديل</Text></TouchableOpacity><TouchableOpacity style={styles.formCancelButton} onPress={cancel} activeOpacity={0.85}><Text style={styles.formCancelText}>إلغاء</Text></TouchableOpacity></View></View>;
}
function Field({ label, value, onChangeText, keyboardType }) {
  return <View style={styles.fieldBox}><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.input} textAlign="right" placeholderTextColor="#94a3b8" /></View>;
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
  leftTopActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenTitle: { position: 'absolute', left: 0, right: 0, top: 23, textAlign: 'center', fontSize: 24, fontWeight: '900', color: '#0f2233', letterSpacing: -0.5 },
  headerIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#edf0f2', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1, zIndex: 2 },
  headerIconText: { color: '#081525', fontSize: 19, fontWeight: '800', lineHeight: 22 },
  headerBackText: { fontSize: 27, lineHeight: 29, marginTop: -1 },
  searchBox: { marginTop: 6, height: 48, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e7ecef', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14 },
  searchInput: { flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: '800', paddingVertical: 8 },
  searchGlyph: { color: '#0f766e', fontSize: 18, fontWeight: '900', marginLeft: 8 },
  summaryRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, minHeight: 142, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e4ebea', shadowColor: '#1f2937', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  summaryGreen: { backgroundColor: '#f2fbf8' },
  summaryGold: { backgroundColor: '#fffaf1' },
  summaryTeal: { backgroundColor: '#f2fbf9' },
  summaryIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 13, shadowColor: '#111827', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  greenCircle: { backgroundColor: '#35b95a' },
  goldCircle: { backgroundColor: '#deb33c' },
  tealCircle: { backgroundColor: '#18a99a' },
  summaryIconText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: '#0f1f2e', fontSize: 12.5, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  valueLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  currencyText: { color: '#0f172a', fontSize: 11.5, fontWeight: '800' },
  summaryValue: { color: '#0b1726', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  summarySuffix: { color: '#334155', fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  filterShell: { marginTop: 24, height: 57, borderRadius: 24, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e4e8eb', flexDirection: 'row-reverse', alignItems: 'center', padding: 5, shadowColor: '#111827', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  filterSegment: { flex: 1, height: 47, borderRadius: 20, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  allFilterSegment: { flex: 1.22 },
  filterSegmentActive: { backgroundColor: '#006168', shadowColor: '#00383d', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  filterDot: { width: 8, height: 8, borderRadius: 8 },
  filterLabel: { color: '#111827', fontSize: 16, fontWeight: '800' },
  filterLabelActive: { color: '#ffffff' },
  gridIcon: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  gridIconActive: { color: '#ffffff' },
  message: { marginTop: 10, color: '#075985', textAlign: 'right', fontWeight: '800', backgroundColor: '#eff6ff', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, overflow: 'hidden' },
  listArea: { marginTop: 20 },
  investmentCard: { minHeight: 108, backgroundColor: '#ffffff', borderRadius: 21, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  itemIconWrap: { width: 58, alignItems: 'flex-end', justifyContent: 'center' },
  itemIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#111827', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  itemIconText: { color: '#ffffff', fontSize: 23, fontWeight: '900' },
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
  circleAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8edf1', alignItems: 'center', justifyContent: 'center' },
  circleActionText: { color: '#334155', fontSize: 14, fontWeight: '900' },
  deleteActionText: { color: '#ef1d1d' },
  receiveActionText: { color: '#14823b' },
  editActionText: { color: '#1d70d8' },
  disabledAction: { opacity: 0.5 },
  expandedArea: { position: 'absolute', left: 12, right: 12, top: 106, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, zIndex: 4 },
  detailText: { color: '#475569', textAlign: 'right', fontWeight: '800', marginTop: 4 },
  allocBox: { marginTop: 9, backgroundColor: '#ffffff', borderRadius: 13, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  allocTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  allocText: { color: '#475569', textAlign: 'right', marginTop: 4, fontSize: 12, fontWeight: '700' },
  investorsCard: { marginTop: 20, backgroundColor: '#ffffff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#edf0f2' },
  panelTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 12 },
  investorRow: { marginTop: 8, flexDirection: 'row-reverse', gap: 10, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 17, padding: 11 },
  investorAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  investorAvatarText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  investorInfo: { flex: 1, alignItems: 'flex-end' },
  investorName: { color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  investorText: { color: '#64748b', textAlign: 'right', marginTop: 3, fontSize: 12, fontWeight: '800' },
  editCard: { marginTop: 20, backgroundColor: '#ffffff', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#edf0f2' },
  formGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  fieldBox: { flexBasis: '48%', flexGrow: 1 },
  inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginTop: 9, marginBottom: 5, fontSize: 12 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 11, color: '#0f172a', fontWeight: '800' },
  multiInput: { minHeight: 92, textAlignVertical: 'top', textAlign: 'right' },
  formActions: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  formSaveButton: { flex: 1, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  formSaveText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  formCancelButton: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  formCancelText: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  emptyCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#edf0f2', alignItems: 'center' },
  emptyIcon: { color: '#0f766e', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  bottomWrap: { position: 'absolute', left: 16, right: 16, bottom: 7, height: 82, alignItems: 'center', justifyContent: 'flex-end' },
  bottomBar: { height: 66, width: '100%', borderRadius: 27, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e7ecef', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSpace: { flex: 0.88 },
  bottomIcon: { color: '#4b5563', fontSize: 25, fontWeight: '900', lineHeight: 25 },
  bottomIconActive: { color: '#0f766e' },
  bottomLabel: { marginTop: 4, color: '#4b5563', fontSize: 12, fontWeight: '700' },
  bottomLabelActive: { color: '#0f766e', fontWeight: '900' },
  centerFab: { position: 'absolute', bottom: 26, width: 74, height: 74, borderRadius: 37, backgroundColor: '#007371', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#f4f8f8', shadowColor: '#003f44', shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  centerFabIcon: { color: '#ffffff', fontSize: 21, fontWeight: '900', lineHeight: 20 },
  centerFabBars: { color: '#ffffff', fontSize: 19, fontWeight: '900', lineHeight: 20, marginTop: -1 },
});
