import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const CATEGORIES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];
const STATUS_FILTERS = [
  ['all', 'الكل'],
  ['active', 'نشط'],
  ['overdue', 'متأخر'],
  ['partial_received', 'مستلم جزئيًا'],
  ['received', 'مستلم'],
];
const today = () => new Date().toISOString().slice(0, 10);
const n = (value) => Number(value || 0);
const money = (value, digits = 0) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;
const pct = (value) => `${n(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: `رد غير JSON من ${path}` }; }
  if (!response.ok) {
    const error = new Error(json.message || `خطأ ${response.status}`);
    error.status = response.status;
    error.data = json.data;
    throw error;
  }
  return json;
}

function metaOf(item) {
  try { return typeof item?.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item?.metadata || {}; } catch { return {}; }
}

function categoryOf(item) {
  const raw = String(metaOf(item).category || item.category || '').trim().toUpperCase().replace(/\s+/g, '');
  return CATEGORIES.includes(raw) ? raw : '-';
}

function statusOf(item) {
  if (item?.status === 'received' || item?.status === 'completed') return { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' };
  if (item?.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', color: '#7c3aed', bg: '#f5f3ff' };
  if (item?.maturity_date && item.maturity_date < today()) return { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' };
  return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };
}

function categoryStyle(category) {
  if (String(category).startsWith('A')) return { bg: '#ecfdf5', color: '#0f766e', label: `تصنيف ${category}` };
  if (String(category).startsWith('B')) return { bg: '#eff6ff', color: '#2563eb', label: `تصنيف ${category}` };
  if (String(category).startsWith('C')) return { bg: '#fff7ed', color: '#c2410c', label: `تصنيف ${category}` };
  return { bg: '#f1f5f9', color: '#475569', label: 'بدون تصنيف' };
}

function investorKey(allocation) {
  return String(allocation?.investor_code || allocation?.investor_name || '').trim();
}

function buildInvestors(items) {
  const map = new Map();
  items.forEach((item) => {
    (item.allocations || []).forEach((allocation) => {
      const key = investorKey(allocation);
      if (!key) return;
      const current = map.get(key) || {
        code: key,
        name: allocation.investor_name || key,
        invested: 0,
        received: 0,
        expectedProfit: 0,
        actualProfit: 0,
        opportunities: 0,
      };
      current.invested += n(allocation.invested_amount);
      current.received += n(allocation.received_amount);
      current.expectedProfit += n(allocation.expected_profit_amount);
      current.actualProfit += n(allocation.actual_profit_amount);
      current.opportunities += 1;
      map.set(key, current);
    });
  });
  return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
}

function itemHasInvestor(item, selectedInvestor) {
  if (!selectedInvestor || selectedInvestor === 'all') return true;
  return (item.allocations || []).some((allocation) => investorKey(allocation) === selectedInvestor);
}

export default function Ta3meedInvestorFilteredScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [investorFilter, setInvestorFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [investorsOpen, setInvestorsOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState(null);

  const investors = useMemo(() => buildInvestors(items), [items]);
  const selectedInvestor = investors.find((investor) => investor.code === investorFilter);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setMessage('');
    try {
      const json = await apiJson('/ta3meed/investments');
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل بيانات تعميد');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const status = statusOf(item).key;
      const category = categoryOf(item);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (!itemHasInvestor(item, investorFilter)) return false;
      if (!keyword) return true;
      const meta = metaOf(item);
      const text = [
        item.reference_number,
        item.status,
        item.maturity_date,
        meta.category,
        category,
        meta.withdrawal_date,
        ...(item.allocations || []).map((allocation) => allocation.investor_name),
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(keyword);
    });
  }, [items, statusFilter, categoryFilter, investorFilter, query]);

  const totals = useMemo(() => {
    const active = filteredItems.filter((item) => statusOf(item).key === 'active');
    return {
      invested: active.reduce((sum, item) => sum + n(item.principal_amount), 0),
      profit: active.reduce((sum, item) => sum + n(item.expected_profit_amount), 0),
      active: active.length,
      partial: filteredItems.filter((item) => statusOf(item).key === 'partial_received').length,
      received: filteredItems.reduce((sum, item) => sum + n(metaOf(item).ta3meed_received_total), 0),
    };
  }, [filteredItems]);

  const parseReceipt = async () => {
    if (!receiptText.trim()) return setMessage('الصق رسالة تعميد أولًا');
    try {
      const json = await apiJson('/ta3meed/receipts/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: receiptText }),
      });
      setReceiptPreview(json.data);
      setMessage('تم تحليل الرسالة');
    } catch (error) {
      setMessage(error.message || 'تعذر تحليل الرسالة');
    }
  };

  const submitReceipt = async (confirmed = false) => {
    const path = confirmed ? '/ta3meed/receipts/apply-message-confirmed' : '/ta3meed/receipts/apply-message';
    await apiJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: receiptText }),
    });
    setReceiptText('');
    setReceiptPreview(null);
    setReceiptOpen(false);
    setMessage(confirmed ? 'تمت إضافة الدفعة المكررة بعد التأكيد' : 'تم اعتماد الدفعة وتوزيعها على المستثمرين');
    await load(true);
  };

  const applyReceipt = async () => {
    if (!receiptText.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setSavingReceipt(true);
    try {
      await submitReceipt(false);
    } catch (error) {
      if (error.status === 409 && error.data?.needs_confirmation) {
        const parsed = error.data?.parsed;
        Alert.alert(
          'دفعة مكررة',
          `هذه الدفعة مسجلة سابقًا${parsed?.reference_number ? ` للفرصة ${parsed.reference_number}` : ''}${parsed?.amount ? ` بمبلغ ${money(parsed.amount, 2)}` : ''}. هل تريد إضافتها مرة أخرى؟`,
          [
            { text: 'لا', style: 'cancel', onPress: () => setMessage('لم تتم إضافة الدفعة المكررة') },
            { text: 'نعم، أضفها', onPress: async () => { try { await submitReceipt(true); } catch (e) { setMessage(e.message || 'تعذر إضافة الدفعة المكررة'); } } },
          ]
        );
      } else {
        setMessage(error.message || 'تعذر اعتماد الدفعة');
      }
    } finally {
      setSavingReceipt(false);
    }
  };

  const deleteReceipt = async (receipt) => {
    const doDelete = async () => {
      setDeletingReceiptId(receipt.id);
      try {
        await apiJson(`/ta3meed/receipts/${receipt.id}`, { method: 'DELETE' });
        setMessage('تم حذف الدفعة وإعادة الحساب');
        await load(true);
      } catch (error) {
        setMessage(error.message || 'تعذر حذف الدفعة');
      } finally {
        setDeletingReceiptId(null);
      }
    };
    Alert.alert('حذف دفعة تعميد', `حذف دفعة ${money(receipt.amount, 2)}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={onBack} activeOpacity={0.85}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعميد</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setShowSearch((value) => !value)} activeOpacity={0.85}>
            <UiIcon name="search" size={21} color={ICON_COLOR_DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setInvestorsOpen(true)} activeOpacity={0.85}>
            <UiIcon name="users" size={22} color={ICON_COLOR_DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.payButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}>
            <Text style={styles.payText}>سداد</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        {showSearch ? (
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="ابحث بالكود أو المستثمر أو التصنيف" placeholderTextColor="#94a3b8" textAlign="right" />
        ) : null}

        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>شاشة تعميد</Text>
          <Text style={styles.heroTitle}>محفظة تعميد</Text>
          <Text style={styles.heroText}>فلتر المستثمرين ظاهر هنا فوق الفرص، ويؤثر على الإحصائيات والبطاقات.</Text>
        </View>

        <View style={styles.metricGrid}>
          <Metric title="إجمالي الاستثمار النشط" value={money(totals.invested)} />
          <Metric title="الأرباح المتوقعة النشطة" value={money(totals.profit, 2)} />
          <Metric title="استثمارات نشطة" value={String(totals.active)} />
          <Metric title="مستلم جزئيًا" value={String(totals.partial)} />
          <Metric title="إجمالي المستلم" value={money(totals.received, 2)} wide />
        </View>

        <FilterHeader title="فلتر المستثمرين" value={selectedInvestor ? selectedInvestor.name : 'كل المستثمرين'} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Chip label="الكل" active={investorFilter === 'all'} onPress={() => setInvestorFilter('all')} />
          {investors.map((investor) => <Chip key={investor.code} label={investor.name} count={investor.opportunities} active={investorFilter === investor.code} onPress={() => setInvestorFilter(investor.code)} />)}
        </ScrollView>

        <FilterHeader title="فلتر التصنيف" value={categoryFilter === 'all' ? 'كل التصنيفات' : categoryFilter} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Chip label="كل التصنيفات" active={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
          {CATEGORIES.map((category) => <Chip key={category} label={category} active={categoryFilter === category} onPress={() => setCategoryFilter(category)} />)}
        </ScrollView>

        <FilterHeader title="فلتر الحالة" value={STATUS_FILTERS.find(([key]) => key === statusFilter)?.[1] || 'الكل'} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUS_FILTERS.map(([key, label]) => <Chip key={key} label={label} active={statusFilter === key} onPress={() => setStatusFilter(key)} />)}
        </ScrollView>

        {!!message && <Text style={styles.message}>{message}</Text>}
        {loading ? <ActivityIndicator color="#0f766e" style={styles.loader} /> : null}

        <View style={styles.sectionRow}>
          <Text style={styles.counter}>{filteredItems.length} من {items.length}</Text>
          <Text style={styles.sectionTitle}>فرص تعميد</Text>
        </View>

        {filteredItems.map((item) => (
          <Ta3meedCard
            key={String(item.id)}
            item={item}
            open={expandedId === item.id}
            onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
            onDeleteReceipt={deleteReceipt}
            deletingReceiptId={deletingReceiptId}
          />
        ))}

        {!loading && filteredItems.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyTitle}>لا توجد فرص مطابقة</Text><Text style={styles.emptyText}>غيّر فلتر المستثمر أو التصنيف أو الحالة.</Text></View>
        ) : null}
      </ScrollView>

      <InvestorsModal
        visible={investorsOpen}
        onClose={() => setInvestorsOpen(false)}
        investors={investors}
        selectedInvestor={investorFilter}
        onSelect={(code) => { setInvestorFilter(code); setInvestorsOpen(false); }}
      />
      <ReceiptModal
        visible={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receiptText={receiptText}
        setReceiptText={setReceiptText}
        preview={receiptPreview}
        parseReceipt={parseReceipt}
        applyReceipt={applyReceipt}
        saving={savingReceipt}
      />
    </SafeAreaView>
  );
}

function InvestorsModal({ visible, onClose, investors, selectedInvestor, onSelect }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return investors;
    return investors.filter((investor) => investor.name.includes(keyword) || investor.code.includes(keyword));
  }, [investors, query]);
  const totals = useMemo(() => investors.reduce((acc, investor) => {
    acc.invested += investor.invested;
    acc.received += investor.received;
    acc.expectedProfit += investor.expectedProfit;
    acc.actualProfit += investor.actualProfit;
    return acc;
  }, { invested: 0, received: 0, expectedProfit: 0, actualProfit: 0 }), [investors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.investorsModalCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>فلتر المستثمرين وحساباتهم</Text>
          </View>
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="ابحث باسم المستثمر" placeholderTextColor="#94a3b8" textAlign="right" />
          <View style={styles.modalMetricRow}>
            <Metric title="إجمالي المستثمر" value={money(totals.invested, 2)} />
            <Metric title="المستلم" value={money(totals.received, 2)} />
          </View>
          <ScrollView style={styles.investorsList} showsVerticalScrollIndicator={false}>
            <InvestorRow investor={{ code: 'all', name: 'كل المستثمرين', opportunities: investors.length, invested: totals.invested, received: totals.received, expectedProfit: totals.expectedProfit, actualProfit: totals.actualProfit }} active={selectedInvestor === 'all'} onPress={() => onSelect('all')} />
            {filtered.map((investor) => <InvestorRow key={investor.code} investor={investor} active={selectedInvestor === investor.code} onPress={() => onSelect(investor.code)} />)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InvestorRow({ investor, active, onPress }) {
  const balance = investor.invested + investor.expectedProfit - investor.received;
  return (
    <TouchableOpacity style={[styles.investorCard, active && styles.investorCardActive]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.investorTopRow}>
        <Text style={[styles.selectedBadge, active && styles.selectedBadgeActive]}>{active ? 'محدد' : 'فلترة'}</Text>
        <Text style={styles.investorName}>{investor.name}</Text>
      </View>
      <Text style={styles.investorLine}>الرصيد المتوقع: {money(balance, 2)}</Text>
      <Text style={styles.investorLine}>مستثمر {money(investor.invested, 2)} · مستلم {money(investor.received, 2)} · فرص {investor.opportunities}</Text>
      <Text style={styles.investorLine}>ربح متوقع {money(investor.expectedProfit, 2)} · ربح فعلي {money(investor.actualProfit, 2)}</Text>
    </TouchableOpacity>
  );
}

function FilterHeader({ title, value }) {
  return <View style={styles.filterHeader}><Text style={styles.filterValue} numberOfLines={1}>{value}</Text><Text style={styles.filterTitle}>{title}</Text></View>;
}

function Chip({ label, active, onPress, count }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.82}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
      {count !== undefined ? <Text style={[styles.chipCount, active && styles.chipTextActive]}>{count}</Text> : null}
    </TouchableOpacity>
  );
}

function Metric({ title, value, wide }) {
  return <View style={[styles.metricCard, wide && styles.metricWide]}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

function Mini({ label, value }) {
  return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}

function Ta3meedCard({ item, open, onToggle, onDeleteReceipt, deletingReceiptId }) {
  const meta = metaOf(item);
  const status = statusOf(item);
  const category = categoryOf(item);
  const categoryTone = categoryStyle(category);
  const receipts = item.receipts || [];
  const allocations = item.allocations || [];
  const expectedTotal = n(item.principal_amount) + n(item.expected_profit_amount);
  const receivedTotal = n(meta.ta3meed_received_total);
  const remaining = meta.ta3meed_remaining_amount !== undefined ? n(meta.ta3meed_remaining_amount) : Math.max(0, expectedTotal - receivedTotal);
  const progress = expectedTotal > 0 ? Math.min(100, Math.max(0, (receivedTotal / expectedTotal) * 100)) : 0;
  const partialCount = receipts.filter((receipt) => receipt.receipt_type !== 'full').length;
  const fullCount = receipts.filter((receipt) => receipt.receipt_type === 'full').length;
  const lastReceipt = receipts[0];

  return (
    <View style={[styles.card, { borderColor: status.color }]}>
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View>
        <View style={[styles.categoryPill, { backgroundColor: categoryTone.bg }]}><Text style={[styles.categoryText, { color: categoryTone.color }]}>{categoryTone.label}</Text></View>
        <View style={styles.cardTitleBlock}><Text style={styles.cardCode}>{item.reference_number || 'فرصة تعميد'}</Text><Text style={styles.cardMeta}>يستحق {item.maturity_date || '-'}</Text></View>
      </View>
      <View style={styles.amounts}><Mini label="المبلغ" value={money(item.principal_amount)} /><Mini label="الربح" value={money(item.expected_profit_amount, 2)} /><Mini label="المستلم" value={money(receivedTotal, 2)} /></View>
      <View style={styles.progressBox}>
        <View style={styles.progressHeader}><Text style={styles.progressPercent}>{pct(progress)}</Text><Text style={styles.progressTitle}>نسبة الاستلام</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.progressMeta}>التصنيف {category} · المتبقي {money(remaining, 2)} · الدفعات {receipts.length} · الجزئية {partialCount}{fullCount ? ` · كلي ${fullCount}` : ''}</Text>
        {lastReceipt ? <Text style={styles.progressMeta}>آخر دفعة: {lastReceipt.receipt_date || '-'} · {money(lastReceipt.amount, 2)}</Text> : null}
        {meta.ta3meed_settlement_note ? <Text style={styles.settlementNote}>{meta.ta3meed_settlement_note}</Text> : null}
      </View>
      <TouchableOpacity style={styles.detailsButton} onPress={onToggle} activeOpacity={0.85}><Text style={styles.detailsButtonText}>{open ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text></TouchableOpacity>
      {open ? (
        <View style={styles.detailsBox}>
          <Text style={styles.detail}>تصنيف الفرصة: {categoryTone.label}</Text>
          <Text style={styles.detail}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
          <Text style={styles.detail}>المسترد: {money(meta.returned_amount, 2)}</Text>
          <Text style={styles.subTitle}>سجل الدفعات</Text>
          {receipts.length ? receipts.map((receipt) => (
            <View key={receipt.id} style={[styles.receiptLine, receipt.receipt_type === 'full' && styles.fullReceiptLine]}>
              <TouchableOpacity disabled={deletingReceiptId === receipt.id} onPress={() => onDeleteReceipt(receipt)} style={styles.deleteReceipt}><Text style={styles.deleteReceiptText}>{deletingReceiptId === receipt.id ? '...' : 'حذف'}</Text></TouchableOpacity>
              <Text style={styles.receiptText}>{receipt.receipt_date || '-'} · {receipt.receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي'} · {money(receipt.amount, 2)}</Text>
            </View>
          )) : <Text style={styles.muted}>لا توجد دفعات</Text>}
          <Text style={styles.subTitle}>المستثمرين</Text>
          {allocations.map((allocation) => {
            const share = n(item.principal_amount) > 0 ? (n(allocation.invested_amount) / n(item.principal_amount)) * 100 : 0;
            const expected = n(allocation.invested_amount) + n(allocation.expected_profit_amount);
            const investorRemaining = Math.max(0, expected - n(allocation.received_amount));
            const actualProfit = n(allocation.received_amount) - n(allocation.invested_amount);
            return <Text key={allocation.id || `${allocation.investor_name}-${allocation.invested_amount}`} style={styles.detail}>{allocation.investor_name}: نسبة {pct(share)} · مستثمر {money(allocation.invested_amount, 2)} · مستلم {money(allocation.received_amount, 2)} · ربح فعلي {money(actualProfit, 2)} · متبقي {money(investorRemaining, 2)}</Text>;
          })}
        </View>
      ) : null}
    </View>
  );
}

function ReceiptModal({ visible, onClose, receiptText, setReceiptText, preview, parseReceipt, applyReceipt, saving }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity><Text style={styles.modalTitle}>لصق رسالة استلام تعميد</Text></View>
          <TextInput style={styles.receiptInput} multiline textAlign="right" textAlignVertical="top" value={receiptText} onChangeText={setReceiptText} placeholder="الصق رسالة تعميد هنا" placeholderTextColor="#94a3b8" />
          {preview ? <View style={styles.preview}><Text style={styles.previewText}>رقم الفرصة: {preview.reference_number || '-'}</Text><Text style={styles.previewText}>المبلغ: {money(preview.amount, 2)}</Text><Text style={styles.previewText}>النوع: {preview.label || '-'}</Text></View> : null}
          <View style={styles.modalActions}><TouchableOpacity style={styles.secondary} onPress={parseReceipt}><Text style={styles.secondaryText}>تحليل الرسالة</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, saving && styles.disabled]} onPress={applyReceipt} disabled={saving}><Text style={styles.primaryText}>{saving ? 'جاري...' : 'اعتماد الدفعة'}</Text></TouchableOpacity></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2f7' },
  header: { height: 92, paddingTop: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: { minWidth: 46, height: 46, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dbe3ef', paddingHorizontal: 8 },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#0f172a' },
  headerActions: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  payButton: { height: 46, minWidth: 62, borderRadius: 17, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  payText: { color: '#fff', fontWeight: '900' },
  content: { padding: 16, paddingBottom: 30 },
  searchInput: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe3ef', padding: 13, marginBottom: 12, color: '#0f172a', fontWeight: '800' },
  heroCard: { backgroundColor: '#0f766e', borderRadius: 28, padding: 20, marginBottom: 12 },
  heroKicker: { color: '#ccfbf1', fontWeight: '900', textAlign: 'right' },
  heroTitle: { color: '#fff', fontSize: 29, fontWeight: '900', textAlign: 'right', marginTop: 8 },
  heroText: { color: '#e6fffb', fontWeight: '700', textAlign: 'right', marginTop: 8, lineHeight: 22 },
  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  modalMetricRow: { flexDirection: 'row-reverse', gap: 9 },
  metricCard: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'flex-end' },
  metricWide: { flexBasis: '100%' },
  metricTitle: { color: '#64748b', fontWeight: '800', textAlign: 'right' },
  metricValue: { color: '#0f172a', fontWeight: '900', fontSize: 21, marginTop: 6, textAlign: 'right' },
  filterHeader: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterTitle: { color: '#0f172a', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  filterValue: { maxWidth: '55%', color: '#0f766e', backgroundColor: '#d1fae5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', fontWeight: '900' },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 10 },
  chip: { maxWidth: 160, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#dbe3ef' },
  chipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { color: '#334155', fontWeight: '900' },
  chipTextActive: { color: '#fff' },
  chipCount: { color: '#64748b', fontWeight: '900', fontSize: 11 },
  message: { backgroundColor: '#eff6ff', color: '#075985', padding: 12, borderRadius: 16, textAlign: 'right', fontWeight: '800', marginBottom: 8, overflow: 'hidden' },
  loader: { marginVertical: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  counter: { backgroundColor: '#d1fae5', color: '#0f766e', fontWeight: '900', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  sectionTitle: { fontSize: 23, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginTop: 12 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#dbe3ef' },
  emptyTitle: { fontWeight: '900', color: '#0f172a', fontSize: 18 },
  emptyText: { color: '#64748b', fontWeight: '800', marginTop: 6, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 14, borderWidth: 1, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontWeight: '900' },
  categoryPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  categoryText: { fontWeight: '900' },
  cardTitleBlock: { flex: 1, alignItems: 'flex-end' },
  cardCode: { fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  cardMeta: { color: '#64748b', fontWeight: '700', marginTop: 3, textAlign: 'right' },
  amounts: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  mini: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, alignItems: 'flex-end' },
  miniLabel: { color: '#64748b', fontWeight: '800', fontSize: 11 },
  miniValue: { color: '#0f172a', fontWeight: '900', marginTop: 4 },
  progressBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 16, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { color: '#0f172a', fontWeight: '900' },
  progressPercent: { color: '#0f766e', fontWeight: '900' },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 8, backgroundColor: '#0f766e', borderRadius: 999 },
  progressMeta: { color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 7 },
  settlementNote: { color: '#b45309', backgroundColor: '#fffbeb', borderRadius: 10, padding: 7, textAlign: 'right', fontWeight: '900', marginTop: 7, overflow: 'hidden' },
  detailsButton: { marginTop: 12, backgroundColor: '#f0fdfa', borderRadius: 16, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#ccfbf1' },
  detailsButtonText: { color: '#0f766e', fontWeight: '900' },
  detailsBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  detail: { color: '#334155', fontWeight: '800', textAlign: 'right', marginTop: 5, lineHeight: 21 },
  subTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginTop: 12 },
  muted: { color: '#94a3b8', fontWeight: '800', textAlign: 'center', marginTop: 6 },
  receiptLine: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 7, marginTop: 6 },
  fullReceiptLine: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  receiptText: { flex: 1, color: '#334155', fontWeight: '800', textAlign: 'right' },
  deleteReceipt: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  deleteReceiptText: { color: '#dc2626', fontWeight: '900', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.34)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16 },
  investorsModalCard: { maxHeight: '88%', backgroundColor: '#fff', borderRadius: 26, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginTop: -2 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  investorsList: { marginTop: 10 },
  investorCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'flex-end', marginTop: 8 },
  investorCardActive: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' },
  investorTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  investorName: { color: '#0f172a', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  investorLine: { color: '#64748b', fontWeight: '800', marginTop: 4, textAlign: 'right' },
  selectedBadge: { color: '#0f766e', backgroundColor: '#d1fae5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', fontWeight: '900', fontSize: 12 },
  selectedBadgeActive: { color: '#fff', backgroundColor: '#0f766e' },
  receiptInput: { marginTop: 12, minHeight: 110, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 13, color: '#0f172a', fontWeight: '800' },
  preview: { marginTop: 12, backgroundColor: '#f0fdfa', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#ccfbf1' },
  previewText: { color: '#0f172a', fontWeight: '800', textAlign: 'right', marginTop: 3 },
  modalActions: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  primary: { flex: 1, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  disabled: { opacity: 0.65 },
});
