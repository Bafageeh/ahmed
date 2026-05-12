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

function categoryTone(category) {
  if (String(category).startsWith('A')) return { bg: '#ecfdf5', color: '#0f766e' };
  if (String(category).startsWith('B')) return { bg: '#eff6ff', color: '#2563eb' };
  if (String(category).startsWith('C')) return { bg: '#fff7ed', color: '#c2410c' };
  return { bg: '#f1f5f9', color: '#475569' };
}

export default function Ta3meedCompactFiltersScreen({ onBack }) {
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
  const [picker, setPicker] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState(null);

  const investors = useMemo(() => buildInvestors(items), [items]);
  const selectedInvestor = investors.find((investor) => investor.code === investorFilter);
  const investorLabel = selectedInvestor ? selectedInvestor.name : 'كل المستثمرين';
  const categoryLabel = categoryFilter === 'all' ? 'كل التصنيفات' : categoryFilter;
  const statusLabel = STATUS_FILTERS.find(([key]) => key === statusFilter)?.[1] || 'الكل';
  const hasFilters = investorFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || query.trim();

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

  const resetFilters = () => {
    setInvestorFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setQuery('');
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
          <Text style={styles.heroText}>الفلاتر مدمجة في شريط واحد لتوفير مساحة الشاشة.</Text>
        </View>

        <View style={styles.metricGrid}>
          <Metric title="إجمالي الاستثمار النشط" value={money(totals.invested)} />
          <Metric title="الأرباح المتوقعة النشطة" value={money(totals.profit, 2)} />
          <Metric title="استثمارات نشطة" value={String(totals.active)} />
          <Metric title="مستلم جزئيًا" value={String(totals.partial)} />
          <Metric title="إجمالي المستلم" value={money(totals.received, 2)} wide />
        </View>

        <View style={styles.compactFiltersCard}>
          <View style={styles.compactFiltersHeader}>
            <TouchableOpacity style={[styles.resetButton, !hasFilters && styles.resetButtonDisabled]} onPress={resetFilters} disabled={!hasFilters} activeOpacity={0.85}>
              <Text style={[styles.resetButtonText, !hasFilters && styles.resetButtonTextDisabled]}>إعادة</Text>
            </TouchableOpacity>
            <Text style={styles.compactFiltersTitle}>الفلاتر</Text>
          </View>
          <View style={styles.compactFilterGrid}>
            <CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker('investor')} />
            <CompactFilter label="التصنيف" value={categoryLabel} onPress={() => setPicker('category')} />
            <CompactFilter label="الحالة" value={statusLabel} onPress={() => setPicker('status')} />
          </View>
        </View>

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
          <View style={styles.emptyCard}><Text style={styles.emptyTitle}>لا توجد فرص مطابقة</Text><Text style={styles.emptyText}>غيّر المستثمر أو التصنيف أو الحالة.</Text></View>
        ) : null}
      </ScrollView>

      <FilterPickerModal
        visible={Boolean(picker)}
        type={picker}
        onClose={() => setPicker(null)}
        investors={investors}
        selectedInvestor={investorFilter}
        selectedCategory={categoryFilter}
        selectedStatus={statusFilter}
        onInvestor={(value) => { setInvestorFilter(value); setPicker(null); }}
        onCategory={(value) => { setCategoryFilter(value); setPicker(null); }}
        onStatus={(value) => { setStatusFilter(value); setPicker(null); }}
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

function CompactFilter({ label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.compactFilterButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.compactFilterLabel}>{label}</Text>
      <View style={styles.compactFilterValueRow}>
        <Text style={styles.compactFilterArrow}>▾</Text>
        <Text style={styles.compactFilterValue} numberOfLines={1}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FilterPickerModal({ visible, type, onClose, investors, selectedInvestor, selectedCategory, selectedStatus, onInvestor, onCategory, onStatus }) {
  const [query, setQuery] = useState('');
  const investorItems = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return investors;
    return investors.filter((investor) => investor.name.includes(keyword) || investor.code.includes(keyword));
  }, [investors, query]);

  const title = type === 'investor' ? 'اختيار المستثمر' : type === 'category' ? 'اختيار التصنيف' : 'اختيار الحالة';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.pickerCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>

          {type === 'investor' ? <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="ابحث باسم المستثمر" placeholderTextColor="#94a3b8" textAlign="right" /> : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pickerList}>
            {type === 'investor' ? (
              <>
                <PickerOption label="كل المستثمرين" sub="إظهار جميع الفرص" active={selectedInvestor === 'all'} onPress={() => onInvestor('all')} />
                {investorItems.map((investor) => (
                  <PickerOption key={investor.code} label={investor.name} sub={`فرص ${investor.opportunities} · مستثمر ${money(investor.invested, 2)}`} active={selectedInvestor === investor.code} onPress={() => onInvestor(investor.code)} />
                ))}
              </>
            ) : null}

            {type === 'category' ? (
              <>
                <PickerOption label="كل التصنيفات" active={selectedCategory === 'all'} onPress={() => onCategory('all')} />
                {CATEGORIES.map((category) => <PickerOption key={category} label={category} active={selectedCategory === category} onPress={() => onCategory(category)} />)}
              </>
            ) : null}

            {type === 'status' ? STATUS_FILTERS.map(([key, label]) => <PickerOption key={key} label={label} active={selectedStatus === key} onPress={() => onStatus(key)} />) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PickerOption({ label, sub, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.pickerOption, active && styles.pickerOptionActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.pickerCheck, active && styles.pickerCheckActive]}>{active ? '✓' : ''}</Text>
      <View style={styles.pickerTextBlock}>
        <Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{label}</Text>
        {sub ? <Text style={styles.pickerSub}>{sub}</Text> : null}
      </View>
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
  const tone = categoryTone(category);
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
        <View style={[styles.categoryPill, { backgroundColor: tone.bg }]}><Text style={[styles.categoryText, { color: tone.color }]}>{category === '-' ? 'بدون تصنيف' : `تصنيف ${category}`}</Text></View>
        <View style={styles.cardTitleBlock}><Text style={styles.cardCode}>{item.reference_number || 'فرصة تعميد'}</Text><Text style={styles.cardMeta}>يستحق {item.maturity_date || '-'}</Text></View>
      </View>
      <View style={styles.amounts}><Mini label="المبلغ" value={money(item.principal_amount)} /><Mini label="الربح" value={money(item.expected_profit_amount, 2)} /><Mini label="المستلم" value={money(receivedTotal, 2)} /></View>
      <View style={styles.progressBox}>
        <View style={styles.progressHeader}><Text style={styles.progressPercent}>{pct(progress)}</Text><Text style={styles.progressTitle}>نسبة الاستلام</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.progressMeta}>المتبقي {money(remaining, 2)} · الدفعات {receipts.length} · الجزئية {partialCount}{fullCount ? ` · كلي ${fullCount}` : ''}</Text>
        {lastReceipt ? <Text style={styles.progressMeta}>آخر دفعة: {lastReceipt.receipt_date || '-'} · {money(lastReceipt.amount, 2)}</Text> : null}
        {meta.ta3meed_settlement_note ? <Text style={styles.settlementNote}>{meta.ta3meed_settlement_note}</Text> : null}
      </View>
      <TouchableOpacity style={styles.detailsButton} onPress={onToggle} activeOpacity={0.85}><Text style={styles.detailsButtonText}>{open ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text></TouchableOpacity>
      {open ? (
        <View style={styles.detailsBox}>
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
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  header: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f7fb' },
  headerIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#0f172a', fontSize: 31, fontWeight: '900', textAlign: 'center' },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  payButton: { height: 54, minWidth: 74, borderRadius: 19, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  payText: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  searchInput: { marginTop: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, color: '#0f172a', fontWeight: '900' },
  heroCard: { marginTop: 8, backgroundColor: '#0f766e', borderRadius: 28, padding: 24, alignItems: 'flex-end' },
  heroKicker: { color: '#ecfdf5', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  heroTitle: { marginTop: 14, color: '#0f172a', fontSize: 31, fontWeight: '900', textAlign: 'right' },
  heroText: { marginTop: 12, color: '#f8fafc', fontSize: 15, fontWeight: '800', lineHeight: 24, textAlign: 'right' },
  metricGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  metricCard: { flexBasis: '48%', flexGrow: 1, minHeight: 96, backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'flex-end' },
  metricWide: { flexBasis: '100%' },
  metricTitle: { color: '#64748b', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  metricValue: { marginTop: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  compactFiltersCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#dbe3ea', padding: 12 },
  compactFiltersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  compactFiltersTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  resetButton: { backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  resetButtonDisabled: { backgroundColor: '#f1f5f9' },
  resetButtonText: { color: '#0f766e', fontWeight: '900', fontSize: 12 },
  resetButtonTextDisabled: { color: '#94a3b8' },
  compactFilterGrid: { flexDirection: 'row-reverse', gap: 8 },
  compactFilterButton: { flex: 1, minHeight: 58, backgroundColor: '#f8fafc', borderRadius: 17, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'flex-end', justifyContent: 'center' },
  compactFilterLabel: { color: '#94a3b8', fontSize: 10.5, fontWeight: '900', textAlign: 'right' },
  compactFilterValueRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  compactFilterArrow: { color: '#0f766e', fontSize: 11, fontWeight: '900' },
  compactFilterValue: { flexShrink: 1, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  message: { marginTop: 12, color: '#075985', backgroundColor: '#eff6ff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, textAlign: 'right', fontWeight: '900', overflow: 'hidden' },
  loader: { marginTop: 14 },
  sectionRow: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  counter: { color: '#0f766e', backgroundColor: '#ccfbf1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '900', overflow: 'hidden' },
  card: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1.3, padding: 14 },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7 },
  cardTitleBlock: { flex: 1, alignItems: 'flex-end' },
  cardCode: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  cardMeta: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '900' },
  categoryPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  categoryText: { fontSize: 11, fontWeight: '900' },
  amounts: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  mini: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10, alignItems: 'flex-end' },
  miniLabel: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  miniValue: { marginTop: 5, color: '#0f172a', fontSize: 14, fontWeight: '900' },
  progressBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPercent: { color: '#0f766e', fontWeight: '900' },
  progressTitle: { color: '#334155', fontWeight: '900' },
  progressTrack: { marginTop: 8, height: 8, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#0f766e' },
  progressMeta: { marginTop: 8, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  settlementNote: { marginTop: 7, color: '#0f766e', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  detailsButton: { marginTop: 12, backgroundColor: '#ecfdf5', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  detailsButtonText: { color: '#0f766e', fontWeight: '900' },
  detailsBox: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12 },
  detail: { color: '#475569', textAlign: 'right', fontWeight: '800', marginTop: 5, lineHeight: 21 },
  subTitle: { marginTop: 12, color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  receiptLine: { marginTop: 7, backgroundColor: '#fff', borderRadius: 13, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fullReceiptLine: { backgroundColor: '#ecfdf5' },
  receiptText: { flex: 1, color: '#475569', textAlign: 'right', fontWeight: '800' },
  deleteReceipt: { backgroundColor: '#fee2e2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  deleteReceiptText: { color: '#b91c1c', fontSize: 11, fontWeight: '900' },
  muted: { color: '#94a3b8', textAlign: 'right', fontWeight: '800', marginTop: 8 },
  emptyCard: { marginTop: 10, backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center' },
  emptyTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900' },
  emptyText: { marginTop: 7, color: '#64748b', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  pickerCard: { width: '100%', maxHeight: '76%', backgroundColor: '#fff', borderRadius: 28, padding: 18 },
  modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { flex: 1, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  closeButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0f172a', fontSize: 30, fontWeight: '900', lineHeight: 34 },
  pickerList: { paddingBottom: 6 },
  pickerOption: { marginTop: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerOptionActive: { backgroundColor: '#ecfdf5', borderColor: '#99f6e4' },
  pickerCheck: { width: 28, color: '#0f766e', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  pickerCheckActive: { color: '#0f766e' },
  pickerTextBlock: { flex: 1, alignItems: 'flex-end' },
  pickerLabel: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  pickerLabelActive: { color: '#0f766e' },
  pickerSub: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  receiptInput: { minHeight: 150, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 18, padding: 14, color: '#0f172a', fontWeight: '800' },
  preview: { marginTop: 12, backgroundColor: '#ecfdf5', borderRadius: 16, padding: 12 },
  previewText: { color: '#0f766e', fontWeight: '900', textAlign: 'right', marginTop: 3 },
  modalActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#dbe3ea', paddingVertical: 13, alignItems: 'center' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  primary: { flex: 1, borderRadius: 16, backgroundColor: '#0f766e', paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
