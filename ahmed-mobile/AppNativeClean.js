import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const n = (value) => Number(value || 0);
const money = (value, digits = 0) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;

const tabs = [
  { key: 'home', label: 'الرئيسية', icon: '⌂' },
  { key: 'investments', label: 'استثماراتي', icon: '▦' },
  { key: 'wallet', label: 'محفظتي', icon: '◈' },
  { key: 'more', label: 'مزيد', icon: '☰' },
];

const statusFilters = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'overdue', label: 'متأخر' },
  { key: 'partial_received', label: 'مستلم جزئيًا' },
  { key: 'received', label: 'مستلم' },
];

function metaOf(item) {
  try {
    return typeof item?.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item?.metadata || {};
  } catch {
    return {};
  }
}

function isReceived(item) {
  return item?.status === 'received' || item?.status === 'completed';
}

function isOverdue(item) {
  return !isReceived(item) && item?.status !== 'partial_received' && Boolean(item?.maturity_date && item.maturity_date < today());
}

function statusOf(item) {
  if (isReceived(item)) return { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' };
  if (item?.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', color: '#7c3aed', bg: '#f5f3ff' };
  if (isOverdue(item)) return { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' };
  return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };
}

export default function AppNativeClean() {
  const [tab, setTab] = useState('investments');

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {tab === 'home' ? <PlaceholderScreen title="الرئيسية" text="سيتم إعادة بناء الصفحة الرئيسية بعد تثبيت شاشة تعميد." /> : null}
        {tab === 'investments' ? <InvestmentsScreen /> : null}
        {tab === 'wallet' ? <PlaceholderScreen title="محفظتي" text="سيتم ربط أرصدة المستثمرين والحركات هنا." /> : null}
        {tab === 'more' ? <PlaceholderScreen title="مزيد" text="الإعدادات والروابط سيتم ترتيبها لاحقًا." /> : null}
      </View>
      <BottomTabs active={tab} setActive={setTab} />
    </View>
  );
}

function BottomTabs({ active, setActive }) {
  return (
    <View style={styles.tabsWrap}>
      <View style={styles.tabsBar}>
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={[styles.tabButton, selected && styles.tabButtonActive]} onPress={() => setActive(tab.key)} activeOpacity={0.85}>
              <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function InvestmentsScreen() {
  const [screen, setScreen] = useState('ta3meed');
  if (screen === 'ta3meed') return <Ta3meedScreen onBack={() => setScreen('list')} />;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>استثماراتي</Text>
        <PlatformCard title="تعميد" text="فرص تعميد والسداد الجزئي والكلي." onPress={() => setScreen('ta3meed')} />
        <PlatformCard title="موني مون" text="سيتم إعادة بنائها بعد تعميد." />
        <PlatformCard title="دينار" text="قريبًا." />
        <PlatformCard title="ترميز" text="قريبًا." />
      </ScrollView>
    </SafeAreaView>
  );
}

function PlatformCard({ title, text, onPress }) {
  return (
    <TouchableOpacity style={styles.platformCard} onPress={onPress} activeOpacity={0.86}>
      <Text style={styles.platformTitle}>{title}</Text>
      <Text style={styles.platformText}>{text}</Text>
    </TouchableOpacity>
  );
}

function Ta3meedScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const scrollRef = useRef(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setMessage('');
    try {
      const [investmentsResponse, summaryResponse] = await Promise.all([
        fetch(`${API_URL}/ta3meed/investments`),
        fetch(`${API_URL}/ta3meed/summary`),
      ]);
      const investmentsJson = await investmentsResponse.json();
      const summaryJson = await summaryResponse.json();
      if (!investmentsResponse.ok) throw new Error(investmentsJson.message || 'تعذر تحميل تعميد');
      setItems(Array.isArray(investmentsJson.data) ? investmentsJson.data : []);
      setSummary(summaryJson.data || null);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل بيانات تعميد');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const status = statusOf(item).key;
      if (filter !== 'all' && status !== filter) return false;
      if (!keyword) return true;
      const meta = metaOf(item);
      const haystack = [
        item.reference_number,
        item.notes,
        item.status,
        item.maturity_date,
        meta.category,
        meta.withdrawal_date,
        ...(Array.isArray(item.allocations) ? item.allocations.map((a) => a.investor_name) : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, query, filter]);

  const totals = useMemo(() => {
    const active = items.filter((item) => statusOf(item).key === 'active');
    return {
      invested: active.reduce((sum, item) => sum + n(item.principal_amount), 0),
      profit: active.reduce((sum, item) => sum + n(item.expected_profit_amount), 0),
      activeCount: active.length,
      partialCount: items.filter((item) => statusOf(item).key === 'partial_received').length,
      received: summary?.total_received || items.reduce((sum, item) => sum + n(metaOf(item).ta3meed_received_total), 0),
    };
  }, [items, summary]);

  const parseReceipt = async () => {
    if (!receiptMessage.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setMessage('جاري تحليل الرسالة...');
    setReceiptPreview(null);
    try {
      const response = await fetch(`${API_URL}/ta3meed/receipts/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: receiptMessage }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحليل الرسالة');
      setReceiptPreview(json.data);
      setMessage('تم تحليل الرسالة. راجع الملخص ثم اعتمد الدفعة.');
    } catch (error) {
      setMessage(error.message || 'تعذر تحليل الرسالة');
    }
  };

  const applyReceipt = async () => {
    if (!receiptMessage.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setReceiptSaving(true);
    setMessage('جاري اعتماد الدفعة...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/receipts/apply-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: receiptMessage }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر اعتماد الدفعة');
      setReceiptPreview(json.data?.parsed || null);
      setReceiptMessage('');
      setReceiptOpen(false);
      setMessage('تم اعتماد الدفعة وتوزيعها على المستثمرين');
      await load(true);
    } catch (error) {
      setMessage(error.message || 'تعذر اعتماد الدفعة');
    } finally {
      setReceiptSaving(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openSearch = () => {
    setSearchOpen((value) => {
      const nextValue = !value;
      if (nextValue) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        });
      }
      return nextValue;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.ta3Header}>
        <TouchableOpacity style={styles.headerButton} onPress={openSearch} activeOpacity={0.85}><Text style={styles.headerButtonText}>🔍</Text></TouchableOpacity>
        <Text style={styles.ta3Title}>تعميد</Text>
        <TouchableOpacity style={styles.receiptHeaderButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}><Text style={styles.receiptHeaderText}>سداد</Text></TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.ta3Content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {searchOpen ? (
          <View style={styles.searchBox}>
            <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالكود، المستثمر، التصنيف..." placeholderTextColor="#94a3b8" style={styles.searchInput} textAlign="right" />
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>نسخة React Native الجديدة</Text>
          <Text style={styles.heroTitle}>محفظة تعميد</Text>
          <Text style={styles.heroText}>بحث، فلاتر، سداد جزئي/كلي، وسجل دفعات لكل فرصة.</Text>
        </View>

        <View style={styles.metricsGrid}>
          <Metric title="إجمالي الاستثمار النشط" value={money(totals.invested)} />
          <Metric title="الأرباح المتوقعة النشطة" value={money(totals.profit, 2)} />
          <Metric title="استثمارات نشطة" value={String(totals.activeCount)} />
          <Metric title="مستلم جزئيًا" value={String(totals.partialCount)} />
          <Metric title="إجمالي المستلم" value={money(totals.received, 2)} wide />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {statusFilters.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.filterChip, filter === item.key && styles.filterChipActive]} onPress={() => setFilter(item.key)} activeOpacity={0.85}>
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!!message && <Text style={styles.messageBox}>{message}</Text>}
        {loading ? <ActivityIndicator style={{ marginTop: 18 }} color="#0f766e" /> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionCounter}>{filteredItems.length} من {items.length}</Text>
          <Text style={styles.sectionTitle}>فرص تعميد</Text>
        </View>

        {filteredItems.length === 0 && !loading ? <EmptyCard /> : null}
        {filteredItems.map((item) => (
          <Ta3meedCard
            key={String(item.id)}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
          />
        ))}
      </ScrollView>

      <ReceiptModal
        visible={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receiptMessage={receiptMessage}
        setReceiptMessage={setReceiptMessage}
        preview={receiptPreview}
        parseReceipt={parseReceipt}
        applyReceipt={applyReceipt}
        saving={receiptSaving}
      />
    </SafeAreaView>
  );
}

function Metric({ title, value, wide }) {
  return (
    <View style={[styles.metricCard, wide && styles.metricWide]}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Ta3meedCard({ item, expanded, onToggle }) {
  const meta = metaOf(item);
  const status = statusOf(item);
  const receipts = Array.isArray(item.receipts) ? item.receipts : [];
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const receivedTotal = n(meta.ta3meed_received_total);
  const remaining = n(meta.ta3meed_remaining_amount);
  const diff = n(meta.ta3meed_settlement_difference);

  return (
    <View style={[styles.investmentCard, { borderColor: status.color }]}> 
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardCode}>{item.reference_number || 'فرصة تعميد'}</Text>
          <Text style={styles.cardMeta}>تصنيف {meta.category || '-'} · يستحق {item.maturity_date || '-'}</Text>
        </View>
      </View>

      <View style={styles.moneyRow}>
        <SmallAmount label="المبلغ" value={money(item.principal_amount)} />
        <SmallAmount label="الربح المتوقع" value={money(item.expected_profit_amount, 2)} />
        <SmallAmount label="المستلم" value={money(receivedTotal, 2)} />
      </View>

      <TouchableOpacity style={styles.detailsButton} onPress={onToggle} activeOpacity={0.85}>
        <Text style={styles.detailsButtonText}>{expanded ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.detailsBox}>
          <Text style={styles.detailText}>المتبقي: {money(remaining, 2)}</Text>
          {diff !== 0 ? <Text style={styles.detailText}>فرق التسوية: {money(diff, 2)}</Text> : null}
          <Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
          <Text style={styles.detailTitle}>سجل الدفعات</Text>
          {receipts.length ? receipts.map((receipt) => (
            <View key={String(receipt.id)} style={styles.receiptRow}>
              <Text style={styles.receiptRowText}>{receipt.receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي'}</Text>
              <Text style={styles.receiptRowText}>{money(receipt.amount, 2)}</Text>
              <Text style={styles.receiptRowDate}>{receipt.receipt_date || '-'}</Text>
            </View>
          )) : <Text style={styles.detailMuted}>لا توجد دفعات مسجلة بعد.</Text>}
          <Text style={styles.detailTitle}>توزيع المستثمرين</Text>
          {allocations.map((allocation) => (
            <Text key={String(allocation.id)} style={styles.detailText}>{allocation.investor_name}: مستثمر {money(allocation.invested_amount, 2)} · مستلم {money(allocation.received_amount, 2)}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SmallAmount({ label, value }) {
  return (
    <View style={styles.smallAmount}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.smallValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ReceiptModal({ visible, onClose, receiptMessage, setReceiptMessage, preview, parseReceipt, applyReceipt, saving }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>لصق رسالة استلام تعميد</Text>
          </View>
          <Text style={styles.modalText}>الصق رسالة السداد من منصة تعميد وسيتم استخراج رقم الفرصة والمبلغ ونوع السداد تلقائيًا.</Text>
          <TextInput
            value={receiptMessage}
            onChangeText={setReceiptMessage}
            style={styles.receiptInput}
            multiline
            textAlign="right"
            textAlignVertical="top"
            placeholder={'مثال: تم إضافة سداد جزئي بقيمة 3741.53 للفرصة رقم ER-TIQX836'}
            placeholderTextColor="#94a3b8"
          />
          {preview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>ملخص القراءة</Text>
              <Text style={styles.previewText}>رقم الفرصة: {preview.reference_number || '-'}</Text>
              <Text style={styles.previewText}>المبلغ: {money(preview.amount, 2)}</Text>
              <Text style={styles.previewText}>النوع: {preview.label || '-'}</Text>
              <Text style={styles.previewText}>{preview.is_final ? 'يغلق البطاقة كمستلمة بالكامل' : 'دفعة جزئية ولا يغلق البطاقة'}</Text>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={parseReceipt} activeOpacity={0.85}><Text style={styles.secondaryText}>تحليل الرسالة</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={applyReceipt} disabled={saving} activeOpacity={0.85}><Text style={styles.primaryText}>{saving ? 'جاري الاعتماد...' : 'اعتماد الدفعة'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EmptyCard() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>لا توجد فرص مطابقة</Text>
      <Text style={styles.emptyText}>غيّر البحث أو الفلتر لعرض فرص أخرى.</Text>
    </View>
  );
}

function PlaceholderScreen({ title, text }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.placeholder}>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.placeholderText}>{text}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef2f7' },
  screen: { flex: 1, paddingBottom: 90 },
  safe: { flex: 1, backgroundColor: '#eef2f7' },
  container: { padding: 18, paddingBottom: 28 },
  placeholder: { flex: 1, justifyContent: 'center', padding: 24 },
  placeholderText: { marginTop: 10, color: '#64748b', textAlign: 'center', fontWeight: '700', lineHeight: 22 },
  pageTitle: { color: '#0f172a', fontSize: 30, fontWeight: '900', textAlign: 'right', marginBottom: 14 },
  tabsWrap: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  tabsBar: { minHeight: 72, borderRadius: 28, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ef', flexDirection: 'row-reverse', alignItems: 'center', padding: 6 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, paddingVertical: 8 },
  tabButtonActive: { backgroundColor: '#ecfdf5' },
  tabIcon: { color: '#64748b', fontSize: 19, fontWeight: '900' },
  tabIconActive: { color: '#0f766e' },
  tabLabel: { marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: '900' },
  tabLabelActive: { color: '#0f766e' },
  platformCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#dbe3ef' },
  platformTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformText: { marginTop: 6, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  ta3Header: { height: 92, paddingTop: 22, paddingHorizontal: 12, backgroundColor: '#eef2f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'center', justifyContent: 'center' },
  headerButtonText: { fontSize: 18 },
  receiptHeaderButton: { minWidth: 58, height: 44, borderRadius: 16, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  receiptHeaderText: { color: '#ffffff', fontWeight: '900' },
  ta3Title: { color: '#0f172a', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  ta3Content: { padding: 16, paddingBottom: 28 },
  searchBox: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe3ef', paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { color: '#0f172a', fontWeight: '800', paddingVertical: 12 },
  heroCard: { backgroundColor: '#0f766e', borderRadius: 28, padding: 20, marginBottom: 12 },
  heroKicker: { color: '#ccfbf1', textAlign: 'right', fontWeight: '900' },
  heroTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900', textAlign: 'right', marginTop: 6 },
  heroText: { color: '#e6fffb', textAlign: 'right', fontWeight: '700', marginTop: 6, lineHeight: 22 },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  metricCard: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'flex-end' },
  metricWide: { flexBasis: '100%' },
  metricTitle: { color: '#64748b', fontWeight: '800', textAlign: 'right', fontSize: 12 },
  metricValue: { color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 20, marginTop: 5 },
  filtersRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 12 },
  filterChip: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#dbe3ef' },
  filterChipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  filterText: { color: '#334155', fontWeight: '900', fontSize: 12 },
  filterTextActive: { color: '#ffffff' },
  messageBox: { backgroundColor: '#eff6ff', color: '#075985', borderRadius: 16, padding: 12, textAlign: 'right', fontWeight: '800', marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  sectionTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  sectionCounter: { color: '#0f766e', fontWeight: '900', backgroundColor: '#d1fae5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  investmentCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 14, borderWidth: 1, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitleBlock: { flex: 1, alignItems: 'flex-end' },
  cardCode: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  cardMeta: { color: '#64748b', fontWeight: '700', textAlign: 'right', marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontWeight: '900', fontSize: 12 },
  moneyRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  smallAmount: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, alignItems: 'flex-end' },
  smallLabel: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  smallValue: { color: '#0f172a', fontSize: 14, fontWeight: '900', marginTop: 4 },
  detailsButton: { marginTop: 12, backgroundColor: '#f0fdfa', borderRadius: 16, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#ccfbf1' },
  detailsButtonText: { color: '#0f766e', fontWeight: '900' },
  detailsBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  detailText: { color: '#334155', fontWeight: '800', textAlign: 'right', marginTop: 5 },
  detailTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginTop: 12, marginBottom: 5 },
  detailMuted: { color: '#94a3b8', fontWeight: '700', textAlign: 'right' },
  receiptRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8, backgroundColor: '#ffffff', borderRadius: 12, padding: 10, marginTop: 6 },
  receiptRowText: { color: '#0f172a', fontWeight: '900' },
  receiptRowDate: { color: '#64748b', fontWeight: '800' },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'center' },
  emptyTitle: { color: '#0f172a', fontWeight: '900', fontSize: 18 },
  emptyText: { marginTop: 5, color: '#64748b', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.34)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe3ef' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  closeText: { color: '#0f172a', fontWeight: '900', fontSize: 24, marginTop: -2 },
  modalTitle: { flex: 1, color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right', marginRight: 10 },
  modalText: { color: '#64748b', fontWeight: '700', textAlign: 'right', marginTop: 10, lineHeight: 21 },
  receiptInput: { marginTop: 12, minHeight: 110, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 13, color: '#0f172a', fontWeight: '800' },
  previewBox: { marginTop: 12, backgroundColor: '#f0fdfa', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#ccfbf1' },
  previewTitle: { color: '#0f766e', fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  previewText: { color: '#0f172a', fontWeight: '800', textAlign: 'right', marginTop: 3 },
  modalActions: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  primaryButton: { flex: 1, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontWeight: '900' },
  secondaryButton: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
});