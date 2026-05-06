import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK, ICON_COLOR_SOFT } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const asNumber = (value) => Number(value || 0);

const statusFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'overdue', label: 'متأخر' },
  { key: 'received', label: 'مستلم' },
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
  if (isReceived(item)) return { key: 'received', label: 'مستلم', style: 'received' };
  if (isOverdue(item)) return { key: 'overdue', label: 'متأخر', style: 'overdue' };
  return { key: 'active', label: 'نشط', style: 'active' };
}
function formatMoney(value, digits = 0) {
  return `${asNumber(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;
}
function searchText(item) {
  const meta = readMeta(item.metadata);
  return [item.reference_number, item.notes, item.status, meta.category, meta.withdrawal_date, item.maturity_date, ...(Array.isArray(item.allocations) ? item.allocations.map((a) => a.investor_name) : [])].filter(Boolean).join(' ').toLowerCase();
}

export default function Ta3meedModernScreen() {
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
  const overdueCount = useMemo(() => items.filter(isOverdue).length, [items]);
  const receivedCount = useMemo(() => items.filter(isReceived).length, [items]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const status = getStatus(item).key;
      return (statusFilter === 'all' || statusFilter === status) && (!keyword || searchText(item).includes(keyword));
    });
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

  const cycleFilter = () => {
    const currentIndex = statusFilters.findIndex((filter) => filter.key === statusFilter);
    setStatusFilter(statusFilters[(currentIndex + 1) % statusFilters.length].key);
  };

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
    }).filter((row) => row.investor && row.amount > 0);

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
    } catch (error) {
      setMessage('تعذر حفظ تعديل تعميد');
    }
  };

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/${item.id}/receive`, { method: 'POST', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('receive failed');
      setMessage('تم اعتبار استثمار تعميد مستلمًا');
      await loadData();
    } catch (error) {
      setMessage('تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIcon} onPress={() => { setSearchVisible((value) => !value); setTab('investments'); }} activeOpacity={0.82}>
            <UiIcon name="search" size={21} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>تعميد</Text>
          <TouchableOpacity style={styles.topIcon} onPress={cycleFilter} activeOpacity={0.82}>
            <UiIcon name="more" size={22} />
          </TouchableOpacity>
        </View>

        {searchVisible ? (
          <View style={styles.searchBox}>
            <UiIcon name="search" size={19} color={ICON_COLOR_SOFT} />
            <TextInput value={search} onChangeText={setSearch} placeholder="ابحث بالكود، التصنيف، المستثمر..." placeholderTextColor="#94a3b8" style={styles.searchInput} />
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}><UiIcon name="ta3meed" size={27} color="#ffffff" /></View>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroKicker}>محفظة تعميد</Text>
              <Text style={styles.heroTitle}>لوحة تحكم سريعة</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <MetricCard icon="wallet" label="إجمالي الاستثمار" value={formatMoney(totalInvested)} />
            <MetricCard icon="investments" label="الأرباح المتوقعة" value={formatMoney(totalProfit)} />
            <MetricCard icon="done" label="النشطة" value={`${summary?.active_count ?? activeCount}`} sub="استثمار" />
            <MetricCard icon="alert" label="المتأخرة" value={`${overdueCount}`} sub="فرصة" danger={overdueCount > 0} />
          </View>
        </View>

        <View style={styles.segmentCard}>
          <SegmentButton label="الفرص" icon="investments" active={tab === 'investments'} onPress={() => setTab('investments')} />
          <SegmentButton label="المستثمرين" icon="users" active={tab === 'investors'} onPress={() => setTab('investors')} />
          {editing ? <SegmentButton label="تعديل" icon="edit" active={tab === 'edit'} onPress={() => setTab('edit')} /> : null}
        </View>

        {tab === 'investments' ? <View style={styles.filterRow}>{statusFilters.map((filter) => <FilterChip key={filter.key} label={filter.label} active={statusFilter === filter.key} onPress={() => setStatusFilter(filter.key)} />)}</View> : null}
        {!!message && <Text style={styles.message}>{message}</Text>}

        {tab === 'investors' ? <InvestorStats summary={summary} /> : null}
        {tab === 'edit' && editing ? <EditForm editing={editing} setEditing={setEditing} saveEdit={saveEdit} cancel={() => { setEditing(null); setTab('investments'); }} /> : null}
        {tab === 'investments' ? (
          <>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>فرص تعميد</Text><Text style={styles.sectionCounter}>{filteredItems.length} من {items.length}</Text></View>
            {filteredItems.length === 0 ? <EmptyCard /> : filteredItems.map((item) => <Ta3meedCard key={String(item.id)} item={item} expanded={expandedId === item.id} onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))} onEdit={() => startEdit(item)} onReceive={() => receiveInvestment(item)} receiving={receivingId === item.id} />)}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SegmentButton({ label, icon, active, onPress }) {
  return <TouchableOpacity style={[styles.segmentButton, active && styles.segmentActive]} onPress={onPress} activeOpacity={0.82}><UiIcon name={icon} size={18} color={active ? '#ffffff' : ICON_COLOR} /><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text></TouchableOpacity>;
}
function MetricCard({ icon, label, value, sub, danger }) {
  return <View style={[styles.metricCard, danger && styles.metricDanger]}><View style={[styles.metricIcon, danger && styles.metricIconDanger]}><UiIcon name={icon} size={23} color={danger ? '#c2410c' : ICON_COLOR} /></View><Text style={[styles.metricLabel, danger && styles.dangerText]}>{label}</Text><Text style={[styles.metricValue, danger && styles.dangerText]} numberOfLines={1}>{value}</Text>{sub ? <Text style={[styles.metricSub, danger && styles.dangerText]}>{sub}</Text> : null}</View>;
}
function FilterChip({ label, active, onPress }) {
  return <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.82}><UiIcon name="filter" size={17} color={active ? '#ffffff' : ICON_COLOR_SOFT} /><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></TouchableOpacity>;
}
function InvestorStats({ summary }) {
  const investors = summary?.investors || [];
  if (!investors.length) return <EmptyCard title="لا توجد إحصائيات" text="لا توجد بيانات مستثمرين بعد." />;
  return <View style={styles.investorsCard}><View style={styles.sectionHeaderInline}><Text style={styles.cardTitle}>إحصائيات كل مستثمر</Text><Text style={styles.cardBadge}>{investors.length}</Text></View>{investors.map((investor) => <View key={investor.name} style={styles.investorRow}><View style={styles.investorAvatar}><UiIcon name="users" size={23} color="#ffffff" /></View><View style={styles.investorInfo}><Text style={styles.investorName}>{investor.name}</Text><Text style={styles.investorText}>الاستثمار: {formatMoney(investor.invested, 2)}</Text><Text style={styles.investorText}>الربح المتوقع: {formatMoney(investor.profit, 2)}</Text></View></View>)}</View>;
}
function EditForm({ editing, setEditing, saveEdit, cancel }) {
  const setField = (key, value) => setEditing((current) => ({ ...current, [key]: value }));
  return <View style={styles.editCard}><View style={styles.sectionHeaderInline}><Text style={styles.cardTitle}>تعديل استثمار تعميد</Text><UiIcon name="edit" size={23} /></View><View style={styles.formGrid}><Field label="الكود" value={editing.code} onChangeText={(v) => setField('code', v)} /><Field label="المبلغ" value={editing.total_amount} onChangeText={(v) => setField('total_amount', v)} keyboardType="decimal-pad" /><Field label="الربح" value={editing.profit} onChangeText={(v) => setField('profit', v)} keyboardType="decimal-pad" /><Field label="نسبة الربح" value={editing.profit_rate} onChangeText={(v) => setField('profit_rate', v)} keyboardType="decimal-pad" /><Field label="التصنيف" value={editing.category} onChangeText={(v) => setField('category', v)} /><Field label="الشهور" value={editing.months} onChangeText={(v) => setField('months', v)} keyboardType="number-pad" /><Field label="تاريخ السحب" value={editing.start_date} onChangeText={(v) => setField('start_date', v)} /><Field label="تاريخ الاستحقاق" value={editing.maturity_date} onChangeText={(v) => setField('maturity_date', v)} /><Field label="المسترد" value={editing.returned_amount} onChangeText={(v) => setField('returned_amount', v)} keyboardType="decimal-pad" /></View><Text style={styles.inputLabel}>توزيع المستثمرين</Text><TextInput value={editing.allocationsText} onChangeText={(v) => setField('allocationsText', v)} style={[styles.input, styles.multiInput]} multiline placeholder={'أحمد:10000\nأمل:5000'} placeholderTextColor="#94a3b8" /><Field label="ملاحظات" value={editing.notes} onChangeText={(v) => setField('notes', v)} /><View style={styles.formActions}><TouchableOpacity style={styles.saveButton} onPress={saveEdit} activeOpacity={0.85}><UiIcon name="save" size={19} color="#ffffff" /><Text style={styles.saveText}>حفظ</Text></TouchableOpacity><TouchableOpacity style={styles.cancelButton} onPress={cancel} activeOpacity={0.85}><UiIcon name="close" size={19} /><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity></View></View>;
}
function Field({ label, value, onChangeText, keyboardType }) {
  return <View style={styles.fieldBox}><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.input} textAlign="right" placeholderTextColor="#94a3b8" /></View>;
}
function Ta3meedCard({ item, onEdit, onReceive, receiving, expanded, onToggle }) {
  const meta = readMeta(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const status = getStatus(item);
  const received = status.key === 'received';
  return <View style={[styles.investmentCard, status.key === 'overdue' && styles.investmentCardOverdue, received && styles.investmentCardReceived]}><View style={styles.cardTopRow}><View style={styles.platformIcon}><UiIcon name="ta3meed" size={23} /></View><View style={styles.cardMainInfo}><View style={styles.titleRow}><StatusPill status={status} /><Text style={styles.cardTitle} numberOfLines={1}>{item.reference_number || 'فرصة تعميد'}</Text></View><Text style={styles.cardMeta} numberOfLines={1}>تصنيف {meta.category || '-'} · يستحق {item.maturity_date || '-'}</Text></View></View><View style={styles.moneyRow}><MoneyBlock label="المبلغ" value={formatMoney(item.principal_amount)} /><MoneyBlock label="الربح" value={formatMoney(item.expected_profit_amount, 2)} danger={status.key === 'overdue'} /><MoneyBlock label="النسبة" value={`${asNumber(item.expected_rate).toFixed(2)}%`} small /></View>{expanded ? <View style={styles.detailsBox}><Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text><Text style={styles.detailText}>المسترد: {formatMoney(meta.returned_amount, 2)}</Text><Text style={styles.detailText}>الحالة: {received ? 'مستلم' : item.status || '-'}</Text>{allocations.length ? <View style={styles.allocBox}><Text style={styles.allocTitle}>توزيع المستثمرين</Text>{allocations.map((a) => <Text key={a.id} style={styles.allocText}>{a.investor_name}: {formatMoney(a.invested_amount, 2)} / ربح {formatMoney(a.expected_profit_amount, 2)}</Text>)}</View> : null}</View> : null}<View style={styles.iconActionsRow}><IconAction icon={expanded ? 'close' : 'view'} label={expanded ? 'إغلاق' : 'تفاصيل'} onPress={onToggle} /><IconAction icon="edit" label="تعديل" onPress={onEdit} />{!received ? <IconAction icon={receiving ? 'refresh' : 'done'} label="استلام" onPress={onReceive} disabled={receiving} /> : null}</View></View>;
}
function MoneyBlock({ label, value, danger, small }) {
  return <View style={small ? styles.moneyBlockSmall : styles.moneyBlock}><Text style={styles.moneyLabel}>{label}</Text><Text style={[small ? styles.rateValue : styles.moneyValue, danger && styles.dangerText]}>{value}</Text></View>;
}
function StatusPill({ status }) { return <Text style={[styles.statusPill, styles[`${status.style}Pill`]]}>{status.label}</Text>; }
function IconAction({ icon, label, onPress, disabled }) {
  return <TouchableOpacity style={[styles.iconAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}><UiIcon name={icon} size={20} /><Text style={styles.iconActionLabel}>{label}</Text></TouchableOpacity>;
}
function EmptyCard({ title = 'لا توجد بيانات', text = 'لا توجد فرص مطابقة للفلتر الحالي.' }) {
  return <View style={styles.emptyCard}><UiIcon name="view" size={30} color={ICON_COLOR_SOFT} /><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f7f6' },
  container: { padding: 16, paddingTop: 98, paddingBottom: 34 },
  topBar: { position: 'absolute', left: 16, right: 16, top: 22, zIndex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { flex: 1, color: '#0f172a', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  topIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eaf0', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.045, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  searchBox: { marginTop: 0, marginBottom: 14, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: '#dbe7e5' },
  searchInput: { flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: '800', paddingVertical: 11 },
  heroCard: { marginTop: 0, backgroundColor: '#ffffff', borderRadius: 28, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  heroHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: ICON_COLOR, alignItems: 'center', justifyContent: 'center' },
  heroTextBlock: { flex: 1, alignItems: 'flex-end' },
  heroKicker: { color: ICON_COLOR_DARK, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  heroTitle: { marginTop: 2, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  metricCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 20, padding: 12, minHeight: 118, borderWidth: 1, alignItems: 'flex-end', backgroundColor: '#fff', borderColor: '#e2e8f0' },
  metricDanger: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  metricIcon: { width: 38, height: 38, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 9, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  metricIconDanger: { backgroundColor: '#ffedd5', borderColor: '#fed7aa' },
  metricLabel: { color: '#475569', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  metricValue: { marginTop: 5, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  metricSub: { marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  segmentCard: { marginTop: 14, flexDirection: 'row-reverse', backgroundColor: '#ffffff', borderRadius: 19, padding: 5, borderWidth: 1, borderColor: '#dbe7e5' },
  segmentButton: { flex: 1, borderRadius: 15, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 6 },
  segmentActive: { backgroundColor: ICON_COLOR },
  segmentText: { color: '#64748b', fontWeight: '900', fontSize: 13 },
  segmentTextActive: { color: '#ffffff' },
  filterRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  filterText: { color: '#334155', fontWeight: '900', fontSize: 12 },
  filterTextActive: { color: '#ffffff' },
  message: { marginTop: 12, color: '#475569', textAlign: 'right', fontWeight: '900', backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHeader: { marginTop: 22, marginBottom: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderInline: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sectionCounter: { color: ICON_COLOR_DARK, fontSize: 12, fontWeight: '900', backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  investmentCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#dbe7e5', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 1 },
  investmentCardOverdue: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  investmentCardReceived: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cardTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  platformIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cardMainInfo: { flex: 1, alignItems: 'stretch' },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  cardTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'right' },
  cardMeta: { marginTop: 4, color: '#64748b', fontWeight: '800', fontSize: 12, textAlign: 'right' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '900' },
  activePill: { color: '#166534', backgroundColor: '#dcfce7' },
  overduePill: { color: '#c2410c', backgroundColor: '#ffedd5' },
  receivedPill: { color: '#1d4ed8', backgroundColor: '#dbeafe' },
  moneyRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  moneyBlock: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'flex-end' },
  moneyBlockSmall: { width: 84, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'flex-end' },
  moneyLabel: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  moneyValue: { marginTop: 3, color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  rateValue: { marginTop: 3, color: ICON_COLOR_DARK, fontSize: 14, fontWeight: '900' },
  detailsBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  detailText: { color: '#475569', textAlign: 'right', fontWeight: '800', marginBottom: 5 },
  allocBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  allocTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  allocText: { color: '#64748b', textAlign: 'right', fontWeight: '800', marginTop: 3 },
  iconActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  iconAction: { flex: 1, minHeight: 44, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 6 },
  disabledAction: { opacity: 0.6 },
  iconActionLabel: { color: '#64748b', fontSize: 11, fontWeight: '900' },
  investorsCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 15, marginTop: 14, borderWidth: 1, borderColor: '#dbe7e5' },
  cardBadge: { color: ICON_COLOR_DARK, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  investorRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  investorAvatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: ICON_COLOR, alignItems: 'center', justifyContent: 'center' },
  investorInfo: { flex: 1, alignItems: 'flex-end' },
  investorName: { color: '#0f172a', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  investorText: { marginTop: 3, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  editCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 24, padding: 15, borderWidth: 1, borderColor: '#dbe7e5' },
  formGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  fieldBox: { flexBasis: '47.5%', flexGrow: 1 },
  inputLabel: { color: '#334155', fontSize: 12, fontWeight: '900', textAlign: 'right', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '800' },
  multiInput: { minHeight: 98, textAlignVertical: 'top', textAlign: 'right' },
  formActions: { flexDirection: 'row-reverse', gap: 9, marginTop: 12 },
  saveButton: { flex: 1, backgroundColor: ICON_COLOR_DARK, borderRadius: 17, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7 },
  saveText: { color: '#ffffff', fontWeight: '900' },
  cancelButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 17, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7 },
  cancelText: { color: '#475569', fontWeight: '900' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 22, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
  cardText: { marginTop: 6, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  dangerText: { color: '#c2410c' },
});
