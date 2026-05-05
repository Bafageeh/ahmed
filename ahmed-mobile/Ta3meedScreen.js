import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const asNumber = (value) => Number(value || 0);

const statusFilters = [
  { key: 'all', label: 'الكل', dot: '#0f766e' },
  { key: 'active', label: 'نشط', dot: '#16a34a' },
  { key: 'overdue', label: 'متأخر', dot: '#f97316' },
  { key: 'received', label: 'مستلم', dot: '#2563eb' },
];

function readMeta(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch (error) {
    return {};
  }
}

function isReceived(item) {
  return item.status === 'received' || item.status === 'completed';
}

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
  return [
    item.reference_number,
    item.notes,
    item.status,
    meta.category,
    meta.withdrawal_date,
    item.maturity_date,
    ...(Array.isArray(item.allocations) ? item.allocations.map((a) => a.investor_name) : []),
  ].filter(Boolean).join(' ').toLowerCase();
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
  const overdueCount = useMemo(() => items.filter(isOverdue).length, [items]);
  const receivedCount = useMemo(() => items.filter(isReceived).length, [items]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const status = getStatus(item).key;
      const matchesStatus = statusFilter === 'all' || statusFilter === status;
      const matchesSearch = !keyword || searchText(item).includes(keyword);
      return matchesStatus && matchesSearch;
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
    if (!editing?.code || !editing?.total_amount) {
      setMessage('أدخل الكود والمبلغ');
      return;
    }

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

  const cycleFilter = () => {
    const currentIndex = statusFilters.findIndex((filter) => filter.key === statusFilter);
    const next = statusFilters[(currentIndex + 1) % statusFilters.length];
    setStatusFilter(next.key);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIcon} onPress={onBack} activeOpacity={0.82}>
            <Text style={styles.topIconText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.topTitleBlock}>
            <Text style={styles.screenTitle}>تعميد</Text>
            <Text style={styles.screenSubtitle}>فرص واستثمارات مضغوطة</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.topIcon} onPress={() => { setSearchVisible((value) => !value); setTab('investments'); }} activeOpacity={0.82}>
              <Text style={styles.smallIconText}>⌕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topIcon} onPress={cycleFilter} activeOpacity={0.82}>
              <Text style={styles.smallIconText}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.topIcon, styles.primaryTopIcon]} onPress={loadData} activeOpacity={0.82}>
              <Text style={styles.primaryTopIconText}>↻</Text>
            </TouchableOpacity>
          </View>
        </View>

        {searchVisible ? (
          <View style={styles.searchBox}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث بالكود، التصنيف، المستثمر..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
            <Text style={styles.searchIcon}>⌕</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}><Text style={styles.heroIconText}>⇡</Text></View>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroKicker}>محفظة تعميد</Text>
              <Text style={styles.heroTitle}>لوحة تحكم سريعة</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <MetricCard icon="▣" label="إجمالي الاستثمار" value={formatMoney(totalInvested)} tone="teal" />
            <MetricCard icon="↗" label="الأرباح المتوقعة" value={formatMoney(totalProfit)} tone="gold" />
            <MetricCard icon="✓" label="النشطة" value={`${summary?.active_count ?? activeCount}`} sub="استثمار" tone="green" />
            <MetricCard icon="!" label="المتأخرة" value={`${overdueCount}`} sub="فرصة" tone="orange" />
          </View>
        </View>

        <View style={styles.segmentCard}>
          <TouchableOpacity style={[styles.segmentButton, tab === 'investments' && styles.segmentActive]} onPress={() => setTab('investments')} activeOpacity={0.82}>
            <Text style={[styles.segmentText, tab === 'investments' && styles.segmentTextActive]}>الفرص</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, tab === 'investors' && styles.segmentActive]} onPress={() => setTab('investors')} activeOpacity={0.82}>
            <Text style={[styles.segmentText, tab === 'investors' && styles.segmentTextActive]}>المستثمرين</Text>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity style={[styles.segmentButton, tab === 'edit' && styles.segmentActive]} onPress={() => setTab('edit')} activeOpacity={0.82}>
              <Text style={[styles.segmentText, tab === 'edit' && styles.segmentTextActive]}>تعديل</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {tab === 'investments' ? (
          <View style={styles.filterRow}>
            {statusFilters.map((filter) => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                dot={filter.dot}
                active={statusFilter === filter.key}
                onPress={() => setStatusFilter(filter.key)}
              />
            ))}
          </View>
        ) : null}

        {!!message && <Text style={styles.message}>{message}</Text>}

        {tab === 'investors' ? <InvestorStats summary={summary} /> : null}
        {tab === 'edit' && editing ? <EditForm editing={editing} setEditing={setEditing} saveEdit={saveEdit} cancel={() => { setEditing(null); setTab('investments'); }} /> : null}
        {tab === 'investments' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>فرص تعميد</Text>
              <Text style={styles.sectionCounter}>{filteredItems.length} من {items.length}</Text>
            </View>
            {filteredItems.length === 0 ? (
              <EmptyCard />
            ) : filteredItems.map((item) => (
              <Ta3meedCard
                key={String(item.id)}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                onEdit={() => startEdit(item)}
                onReceive={() => receiveInvestment(item)}
                receiving={receivingId === item.id}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ icon, label, value, sub, tone }) {
  return (
    <View style={[styles.metricCard, styles[`${tone}Metric`]]}>
      <View style={[styles.metricIcon, styles[`${tone}Icon`]]}><Text style={styles.metricIconText}>{icon}</Text></View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function FilterChip({ label, dot, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.filterDot, { backgroundColor: dot }]} />
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InvestorStats({ summary }) {
  const investors = summary?.investors || [];
  if (!investors.length) return <EmptyCard title="لا توجد إحصائيات" text="لا توجد بيانات مستثمرين بعد." />;
  return (
    <View style={styles.investorsCard}>
      <View style={styles.sectionHeaderInline}>
        <Text style={styles.cardTitle}>إحصائيات كل مستثمر</Text>
        <Text style={styles.cardBadge}>{investors.length}</Text>
      </View>
      {investors.map((investor) => (
        <View key={investor.name} style={styles.investorRow}>
          <View style={styles.investorAvatar}><Text style={styles.investorAvatarText}>{String(investor.name || 'م').slice(0, 1)}</Text></View>
          <View style={styles.investorInfo}>
            <Text style={styles.investorName}>{investor.name}</Text>
            <Text style={styles.investorText}>الاستثمار: {formatMoney(investor.invested, 2)}</Text>
            <Text style={styles.investorText}>الربح المتوقع: {formatMoney(investor.profit, 2)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function EditForm({ editing, setEditing, saveEdit, cancel }) {
  const setField = (key, value) => setEditing((current) => ({ ...current, [key]: value }));
  return (
    <View style={styles.editCard}>
      <View style={styles.sectionHeaderInline}>
        <Text style={styles.cardTitle}>تعديل استثمار تعميد</Text>
        <Text style={styles.cardBadge}>✎</Text>
      </View>
      <View style={styles.formGrid}>
        <Field label="الكود" value={editing.code} onChangeText={(v) => setField('code', v)} />
        <Field label="المبلغ" value={editing.total_amount} onChangeText={(v) => setField('total_amount', v)} keyboardType="decimal-pad" />
        <Field label="الربح" value={editing.profit} onChangeText={(v) => setField('profit', v)} keyboardType="decimal-pad" />
        <Field label="نسبة الربح" value={editing.profit_rate} onChangeText={(v) => setField('profit_rate', v)} keyboardType="decimal-pad" />
        <Field label="التصنيف" value={editing.category} onChangeText={(v) => setField('category', v)} />
        <Field label="الشهور" value={editing.months} onChangeText={(v) => setField('months', v)} keyboardType="number-pad" />
        <Field label="تاريخ السحب" value={editing.start_date} onChangeText={(v) => setField('start_date', v)} />
        <Field label="تاريخ الاستحقاق" value={editing.maturity_date} onChangeText={(v) => setField('maturity_date', v)} />
        <Field label="المسترد" value={editing.returned_amount} onChangeText={(v) => setField('returned_amount', v)} keyboardType="decimal-pad" />
      </View>
      <Text style={styles.inputLabel}>توزيع المستثمرين</Text>
      <TextInput
        value={editing.allocationsText}
        onChangeText={(v) => setField('allocationsText', v)}
        style={[styles.input, styles.multiInput]}
        multiline
        placeholder={'أحمد:10000\nأمل:5000'}
        placeholderTextColor="#94a3b8"
      />
      <Field label="ملاحظات" value={editing.notes} onChangeText={(v) => setField('notes', v)} />
      <View style={styles.formActions}>
        <TouchableOpacity style={styles.saveButton} onPress={saveEdit} activeOpacity={0.85}><Text style={styles.saveText}>✓ حفظ</Text></TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={cancel} activeOpacity={0.85}><Text style={styles.cancelText}>× إلغاء</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
        textAlign="right"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

function Ta3meedCard({ item, onEdit, onReceive, receiving, expanded, onToggle }) {
  const meta = readMeta(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const status = getStatus(item);
  const received = status.key === 'received';

  return (
    <View style={[styles.investmentCard, status.key === 'overdue' && styles.investmentCardOverdue, received && styles.investmentCardReceived]}>
      <View style={styles.cardTopRow}>
        <View style={[styles.platformIcon, status.key === 'overdue' && styles.platformIconOverdue, received && styles.platformIconReceived]}>
          <Text style={styles.platformIconText}>▥</Text>
        </View>
        <View style={styles.cardMainInfo}>
          <View style={styles.titleRow}>
            <StatusPill status={status} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.reference_number || 'فرصة تعميد'}</Text>
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>تصنيف {meta.category || '-'} · يستحق {item.maturity_date || '-'}</Text>
        </View>
      </View>

      <View style={styles.moneyRow}>
        <View style={styles.moneyBlock}>
          <Text style={styles.moneyLabel}>المبلغ</Text>
          <Text style={styles.moneyValue}>{formatMoney(item.principal_amount)}</Text>
        </View>
        <View style={styles.moneyBlock}>
          <Text style={styles.moneyLabel}>الربح</Text>
          <Text style={[styles.moneyValue, status.key === 'overdue' && styles.orangeMoney]}>{formatMoney(item.expected_profit_amount, 2)}</Text>
        </View>
        <View style={styles.moneyBlockSmall}>
          <Text style={styles.moneyLabel}>النسبة</Text>
          <Text style={styles.rateValue}>{asNumber(item.expected_rate).toFixed(2)}%</Text>
        </View>
      </View>

      {expanded ? (
        <View style={styles.detailsBox}>
          <Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
          <Text style={styles.detailText}>المسترد: {formatMoney(meta.returned_amount, 2)}</Text>
          <Text style={styles.detailText}>الحالة: {received ? 'مستلم' : item.status || '-'}</Text>
          {allocations.length ? (
            <View style={styles.allocBox}>
              <Text style={styles.allocTitle}>توزيع المستثمرين</Text>
              {allocations.map((a) => (
                <Text key={a.id} style={styles.allocText}>{a.investor_name}: {formatMoney(a.invested_amount, 2)} / ربح {formatMoney(a.expected_profit_amount, 2)}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.iconActionsRow}>
        <IconAction icon={expanded ? '⌃' : '👁'} label="تفاصيل" onPress={onToggle} />
        <IconAction icon="✎" label="تعديل" onPress={onEdit} tone="edit" />
        {!received ? <IconAction icon={receiving ? '…' : '✓'} label="استلام" onPress={onReceive} tone="receive" disabled={receiving} /> : null}
      </View>
    </View>
  );
}

function StatusPill({ status }) {
  return <Text style={[styles.statusPill, styles[`${status.style}Pill`]]}>{status.label}</Text>;
}

function IconAction({ icon, label, onPress, tone, disabled }) {
  return (
    <TouchableOpacity style={[styles.iconAction, tone === 'edit' && styles.editAction, tone === 'receive' && styles.receiveAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>
      <Text style={[styles.iconActionText, tone === 'receive' && styles.receiveActionText]}>{icon}</Text>
      <Text style={styles.iconActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({ title = 'لا توجد بيانات', text = 'لا توجد فرص مطابقة للفلتر الحالي.' }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>◇</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f7f6' },
  container: { padding: 16, paddingBottom: 34 },
  topBar: { marginTop: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  topTitleBlock: { flex: 1, alignItems: 'center' },
  screenTitle: { color: '#0f172a', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  screenSubtitle: { marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  topActions: { flexDirection: 'row-reverse', gap: 7 },
  topIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  topIconText: { color: '#0f172a', fontSize: 32, fontWeight: '800', marginTop: -3 },
  smallIconText: { color: '#0f172a', fontSize: 21, fontWeight: '900' },
  primaryTopIcon: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  primaryTopIconText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  searchBox: { marginTop: 14, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: '#dbe7e5' },
  searchInput: { flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: '800', paddingVertical: 11 },
  searchIcon: { color: '#0f766e', fontSize: 20, fontWeight: '900', marginLeft: 8 },
  heroCard: { marginTop: 16, backgroundColor: '#ffffff', borderRadius: 28, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  heroHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  heroIconText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroTextBlock: { flex: 1, alignItems: 'flex-end' },
  heroKicker: { color: '#0f766e', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  heroTitle: { marginTop: 2, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  metricCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 20, padding: 12, minHeight: 118, borderWidth: 1, alignItems: 'flex-end' },
  tealMetric: { backgroundColor: '#f0fdfa', borderColor: '#ccfbf1' },
  goldMetric: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  greenMetric: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  orangeMetric: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  metricIcon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  tealIcon: { backgroundColor: '#0f766e' },
  goldIcon: { backgroundColor: '#d97706' },
  greenIcon: { backgroundColor: '#16a34a' },
  orangeIcon: { backgroundColor: '#f97316' },
  metricIconText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  metricLabel: { color: '#475569', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  metricValue: { marginTop: 5, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  metricSub: { marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  segmentCard: { marginTop: 14, flexDirection: 'row-reverse', backgroundColor: '#ffffff', borderRadius: 19, padding: 5, borderWidth: 1, borderColor: '#dbe7e5' },
  segmentButton: { flex: 1, borderRadius: 15, paddingVertical: 11, alignItems: 'center' },
  segmentActive: { backgroundColor: '#0f766e' },
  segmentText: { color: '#64748b', fontWeight: '900', fontSize: 13 },
  segmentTextActive: { color: '#ffffff' },
  filterRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  filterDot: { width: 8, height: 8, borderRadius: 99 },
  filterText: { color: '#334155', fontWeight: '900', fontSize: 12 },
  filterTextActive: { color: '#ffffff' },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', backgroundColor: '#eff6ff', borderRadius: 16, padding: 12, overflow: 'hidden' },
  sectionHeader: { marginTop: 22, marginBottom: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderInline: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sectionCounter: { color: '#0f766e', fontSize: 12, fontWeight: '900', backgroundColor: '#ccfbf1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  investmentCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#dbe7e5', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 1 },
  investmentCardOverdue: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  investmentCardReceived: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cardTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  platformIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  platformIconOverdue: { backgroundColor: '#f97316' },
  platformIconReceived: { backgroundColor: '#2563eb' },
  platformIconText: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  cardMainInfo: { flex: 1, alignItems: 'stretch' },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  cardTitle: { flex: 1, color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  cardMeta: { marginTop: 5, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '900' },
  activePill: { backgroundColor: '#dcfce7', color: '#166534' },
  overduePill: { backgroundColor: '#ffedd5', color: '#c2410c' },
  receivedPill: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  moneyRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  moneyBlock: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 15, padding: 10, alignItems: 'flex-end' },
  moneyBlockSmall: { width: 82, backgroundColor: '#f8fafc', borderRadius: 15, padding: 10, alignItems: 'flex-end' },
  moneyLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  moneyValue: { marginTop: 3, color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  orangeMoney: { color: '#ea580c' },
  rateValue: { marginTop: 3, color: '#0f766e', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  detailsBox: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  detailText: { color: '#475569', textAlign: 'right', fontWeight: '800', marginTop: 4 },
  allocBox: { marginTop: 10, backgroundColor: '#ffffff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  allocTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  allocText: { color: '#475569', textAlign: 'right', marginTop: 4, fontWeight: '700' },
  iconActionsRow: { marginTop: 11, flexDirection: 'row-reverse', gap: 8 },
  iconAction: { minWidth: 74, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#f8fafc', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  editAction: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  receiveAction: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  disabledAction: { opacity: 0.55 },
  iconActionText: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  receiveActionText: { color: '#ffffff' },
  iconActionLabel: { color: '#334155', fontSize: 11, fontWeight: '900' },
  investorsCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#dbe7e5' },
  cardBadge: { color: '#0f766e', backgroundColor: '#ccfbf1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  investorRow: { marginTop: 8, flexDirection: 'row-reverse', gap: 10, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, padding: 11 },
  investorAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  investorAvatarText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  investorInfo: { flex: 1, alignItems: 'flex-end' },
  investorName: { color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  investorText: { color: '#64748b', textAlign: 'right', marginTop: 3, fontSize: 12, fontWeight: '800' },
  editCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#dbe7e5' },
  formGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  fieldBox: { flexBasis: '48%', flexGrow: 1 },
  inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginTop: 9, marginBottom: 5, fontSize: 12 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 11, color: '#0f172a', fontWeight: '800' },
  multiInput: { minHeight: 92, textAlignVertical: 'top', textAlign: 'right' },
  formActions: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  saveButton: { flex: 1, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  cancelButton: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelText: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  emptyCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#dbe7e5', alignItems: 'center' },
  emptyIcon: { color: '#0f766e', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  cardText: { marginTop: 6, color: '#64748b', textAlign: 'center', fontWeight: '800' },
});
