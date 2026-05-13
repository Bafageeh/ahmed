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
const pct = (value, digits = 1) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

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

function categoryTone(category) {
  if (String(category).startsWith('A')) return { bg: '#ecfdf5', color: '#0f766e' };
  if (String(category).startsWith('B')) return { bg: '#eff6ff', color: '#2563eb' };
  if (String(category).startsWith('C')) return { bg: '#fff7ed', color: '#c2410c' };
  return { bg: '#f1f5f9', color: '#475569' };
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
        opportunities: 0,
      };
      current.invested += n(allocation.invested_amount);
      current.received += n(allocation.received_amount);
      current.expectedProfit += n(allocation.expected_profit_amount);
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

function registeredAnnualRate(item, meta) {
  const explicit = n(item.registered_annual_profit_rate || meta.registered_annual_profit_rate || item.expected_rate);
  if (explicit > 0) return explicit;
  const principal = n(item.principal_amount);
  const profit = n(item.expected_profit_amount);
  return principal > 0 && profit > 0 ? (profit / principal) * 100 : 0;
}

function receivedAmountOf(item, meta, receipts, allocations) {
  const metaReceived = n(meta.ta3meed_received_total);
  const itemReceived = n(item.received_amount);
  const receiptsReceived = (receipts || []).reduce((sum, receipt) => sum + n(receipt.amount), 0);
  const allocationsReceived = (allocations || []).reduce((sum, allocation) => sum + n(allocation.received_amount), 0);
  return Math.max(metaReceived, itemReceived, receiptsReceived, allocationsReceived);
}

function actualAnnualRate(item, meta, receipts, allocations) {
  const principal = n(item.principal_amount);
  if (principal <= 0) return null;

  const investmentDate = String(
    meta.withdrawal_date ||
    item.withdrawal_date ||
    item.investment_date ||
    item.start_date ||
    ''
  ).slice(0, 10);

  const receiptDates = (receipts || [])
    .map((receipt) => String(receipt.receipt_date || receipt.created_at || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  const lastReceiptDate = receiptDates.length ? receiptDates[receiptDates.length - 1] : '';

  if (!investmentDate || !lastReceiptDate) return null;

  const startDate = new Date(`${investmentDate}T00:00:00`);
  const endDate = new Date(`${lastReceiptDate}T00:00:00`);
  const days = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));

  const receivedAmount = receivedAmountOf(item, meta, receipts, allocations);
  const actualReceivedProfit = Math.max(0, receivedAmount - principal);

  if (actualReceivedProfit <= 0) return null;

  return ((actualReceivedProfit / principal) / days) * 365 * 100;
}

function investmentStartDateOf(item, meta) {
  return String(
    meta.withdrawal_date ||
    item.withdrawal_date ||
    item.investment_date ||
    item.start_date ||
    ''
  ).slice(0, 10);
}

function lastReceiptDateOf(receipts) {
  const dates = (receipts || [])
    .map((receipt) => String(receipt.receipt_date || receipt.created_at || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  return dates.length ? dates[dates.length - 1] : '';
}

function daysBetweenDates(startDateText, endDateText) {
  if (!startDateText || !endDateText) return null;

  const startDate = new Date(`${startDateText}T00:00:00`);
  const endDate = new Date(`${endDateText}T00:00:00`);
  const diff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

  return Number.isFinite(diff) && diff >= 0 ? Math.max(1, diff) : null;
}

function raisedMonthsOf(item, meta) {
  const explicit = n(
    item.months ||
    item.duration_months ||
    item.investment_months ||
    item.raised_months ||
    meta.months ||
    meta.duration_months ||
    meta.investment_months ||
    meta.raised_months ||
    meta.ta3meed_months
  );

  if (explicit > 0) return explicit;

  const startDate = investmentStartDateOf(item, meta);
  const endDate = String(item.maturity_date || '').slice(0, 10);
  const days = daysBetweenDates(startDate, endDate);

  return days ? Math.max(1, Math.round(days / 30)) : null;
}

function realInvestmentDaysOf(item, meta, receipts) {
  const startDate = investmentStartDateOf(item, meta);
  const lastReceiptDate = lastReceiptDateOf(receipts);
  return daysBetweenDates(startDate, lastReceiptDate);
}

function formatRealInvestmentDuration(days) {
  if (!days) return '-';

  const months = Math.floor(days / 30);
  const restDays = days % 30;

  if (months > 0 && restDays > 0) return `${months} شهر و ${restDays} يوم`;
  if (months > 0) return `${months} شهر`;
  return `${days} يوم`;
}

export default function Ta3meedCompactFiltersScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
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
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editingReceiptDate, setEditingReceiptDate] = useState('');
  const [savingReceiptDateId, setSavingReceiptDateId] = useState(null);
  const [editingWithdrawalId, setEditingWithdrawalId] = useState(null);
  const [editingWithdrawalDate, setEditingWithdrawalDate] = useState('');
  const [savingWithdrawalId, setSavingWithdrawalId] = useState(null);
  const [opportunityEditOpen, setOpportunityEditOpen] = useState(false);
  const [editingOpportunityId, setEditingOpportunityId] = useState(null);
  const [savingOpportunityEdit, setSavingOpportunityEdit] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState({
    code: '',
    total_amount: '',
    profit: '',
    profit_rate: '',
    category: '',
    months: '',
    start_date: today(),
    maturity_date: '',
    allocations: '',
    notes: '',
  });

  const investors = useMemo(() => buildInvestors(items), [items]);
  const selectedInvestor = investors.find((investor) => investor.code === investorFilter);
  const investorLabel = selectedInvestor ? selectedInvestor.name : 'كل المستثمرين';
  const categoryLabel = categoryFilter === 'all' ? 'كل التصنيفات' : categoryFilter;
  const statusLabel = STATUS_FILTERS.find(([key]) => key === statusFilter)?.[1] || 'نشط';
  const hasFilters = investorFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'active' || query.trim();

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
    setStatusFilter('active');
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
      received: filteredItems.reduce((sum, item) => sum + receivedAmountOf(item, metaOf(item), item.receipts || [], item.allocations || []), 0),
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



  const startEditWithdrawalDate = (item) => {
    const meta = metaOf(item);
    const currentDate = investmentStartDateOf(item, meta) || today();
    setEditingWithdrawalId(item.id);
    setEditingWithdrawalDate(currentDate);
  };

  const cancelEditWithdrawalDate = () => {
    setEditingWithdrawalId(null);
    setEditingWithdrawalDate('');
  };

  const saveWithdrawalDate = async (item) => {
    const date = String(editingWithdrawalDate || '').trim();
    if (!date) {
      setMessage('أدخل تاريخ السحب أولًا');
      return;
    }

    const meta = metaOf(item);
    const category = categoryOf(item);
    const months = raisedMonthsOf(item, meta);
    const allocations = (item.allocations || []).map((allocation) => ({
      investor: allocation.investor_name || allocation.investor_code,
      amount: n(allocation.invested_amount),
    })).filter((allocation) => allocation.investor && allocation.amount > 0);

    setSavingWithdrawalId(item.id);
    try {
      await apiJson(`/ta3meed/investments/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: item.reference_number || item.code || '',
          total_amount: n(item.principal_amount),
          profit: n(item.expected_profit_amount),
          profit_rate: n(item.expected_rate),
          category: category === '-' ? null : category,
          months: months || null,
          start_date: date,
          maturity_date: item.maturity_date || null,
          returned_amount: n(meta.returned_amount),
          notes: item.notes || null,
          allocations,
        }),
      });

      setMessage('تم تعديل تاريخ السحب وإعادة حساب المدة والنسبة');
      setEditingWithdrawalId(null);
      setEditingWithdrawalDate('');
      await load(true);
    } catch (error) {
      setMessage(error.message || 'تعذر تعديل تاريخ السحب');
    } finally {
      setSavingWithdrawalId(null);
    }
  };

  const startEditReceiptDate = (receipt) => {
    setEditingReceiptId(receipt.id);
    setEditingReceiptDate(String(receipt.receipt_date || today()).slice(0, 10));
  };

  const cancelEditReceiptDate = () => {
    setEditingReceiptId(null);
    setEditingReceiptDate('');
  };

  const saveReceiptDate = async (receipt) => {
    const date = String(editingReceiptDate || '').trim();
    if (!date) {
      setMessage('أدخل تاريخ الدفعة أولًا');
      return;
    }

    setSavingReceiptDateId(receipt.id);
    try {
      await apiJson(`/ta3meed/receipts/${receipt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_date: date, notes: receipt.notes || null }),
      });

      setMessage('تم تعديل تاريخ الدفعة وإعادة حساب الفرصة');
      setEditingReceiptId(null);
      setEditingReceiptDate('');
      await load(true);
    } catch (error) {
      setMessage(error.message || 'تعذر تعديل تاريخ الدفعة');
    } finally {
      setSavingReceiptDateId(null);
    }
  };


  const openOpportunityEdit = (item) => {
    const meta = metaOf(item);
    const category = categoryOf(item);
    setEditingOpportunityId(item.id);
    setOpportunityForm({
      code: String(item.reference_number || item.code || ''),
      total_amount: String(n(item.principal_amount) || ''),
      profit: String(n(item.expected_profit_amount) || ''),
      profit_rate: String(n(item.expected_rate) || n(item.registered_annual_profit_rate) || ''),
      category: category === '-' ? '' : category,
      months: String(n(meta.months || item.months || item.duration_months) || ''),
      start_date: String(meta.withdrawal_date || item.withdrawal_date || item.start_date || item.investment_date || today()).slice(0, 10),
      maturity_date: String(item.maturity_date || '').slice(0, 10),
      allocations: (item.allocations || []).map((allocation) => `${allocation.investor_name || allocation.investor_code || ''} ${n(allocation.invested_amount)}`.trim()).filter(Boolean).join('\n'),
      notes: item.notes || '',
    });
    setOpportunityEditOpen(true);
  };

  const setOpportunityField = (key, value) => {
    setOpportunityForm((current) => ({ ...current, [key]: value }));
  };

  const parseOpportunityAllocations = (text) => String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const amount = n(String(parts.pop() || '').replace(/,/g, ''));
      return { investor: parts.join(' '), amount };
    })
    .filter((row) => row.investor && row.amount > 0);

  const saveOpportunityEdit = async () => {
    if (!editingOpportunityId) return;
    if (!opportunityForm.code.trim()) return setMessage('أدخل رقم الفرصة');
    if (!n(opportunityForm.total_amount)) return setMessage('أدخل مبلغ الاستثمار');

    setSavingOpportunityEdit(true);
    try {
      await apiJson(`/ta3meed/investments/${editingOpportunityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: opportunityForm.code.trim(),
          total_amount: n(String(opportunityForm.total_amount).replace(/,/g, '')),
          profit: n(String(opportunityForm.profit).replace(/,/g, '')),
          profit_rate: n(opportunityForm.profit_rate) || null,
          category: opportunityForm.category.trim() || null,
          months: n(opportunityForm.months) || null,
          start_date: opportunityForm.start_date || null,
          withdrawal_date: opportunityForm.start_date || null,
          maturity_date: opportunityForm.maturity_date || null,
          notes: opportunityForm.notes || null,
          allocations: parseOpportunityAllocations(opportunityForm.allocations),
        }),
      });
      setOpportunityEditOpen(false);
      setEditingOpportunityId(null);
      setMessage('تم تعديل الفرصة');
      await load(true);
    } catch (error) {
      setMessage(error.message || 'تعذر تعديل الفرصة');
    } finally {
      setSavingOpportunityEdit(false);
    }
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

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} showsVerticalScrollIndicator={false}>
        {showSearch ? <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="ابحث بالكود أو المستثمر أو التصنيف" placeholderTextColor="#94a3b8" textAlign="right" /> : null}

        <View style={styles.compactFiltersCard}>
          <View style={styles.compactFilterGrid}>
            <CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker('investor')} />
            <CompactFilter label="التصنيف" value={categoryLabel} onPress={() => setPicker('category')} />
            <CompactFilter label="الحالة" value={statusLabel} onPress={() => setPicker('status')} />
          </View>
          {hasFilters ? <TouchableOpacity style={styles.resetButton} onPress={resetFilters} activeOpacity={0.85}><Text style={styles.resetButtonText}>إعادة الفلتر إلى نشط</Text></TouchableOpacity> : null}
        </View>

        <View style={styles.metricGrid}>
          <Metric title="إجمالي الاستثمار النشط" value={money(totals.invested)} />
          <Metric title="الأرباح المتوقعة النشطة" value={money(totals.profit, 2)} />
          <Metric title="استثمارات نشطة" value={String(totals.active)} />
          <Metric title="مستلم جزئيًا" value={String(totals.partial)} />
          <Metric title="إجمالي المستلم" value={money(totals.received, 2)} wide />
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}
        {loading ? <ActivityIndicator color="#0f766e" style={styles.loader} /> : null}

        <View style={styles.sectionRow}>
          <Text style={styles.counter}>{filteredItems.length} من {items.length}</Text>
          <Text style={styles.sectionTitle}>فرص تعميد</Text>
        </View>

        {filteredItems.map((item) => <Ta3meedCard key={String(item.id)} item={item} open={expandedId === item.id} onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)} onDeleteReceipt={deleteReceipt} deletingReceiptId={deletingReceiptId} editingReceiptId={editingReceiptId} editingReceiptDate={editingReceiptDate} setEditingReceiptDate={setEditingReceiptDate} startEditReceiptDate={startEditReceiptDate} cancelEditReceiptDate={cancelEditReceiptDate} saveReceiptDate={saveReceiptDate} savingReceiptDateId={savingReceiptDateId} editingWithdrawalId={editingWithdrawalId} editingWithdrawalDate={editingWithdrawalDate} setEditingWithdrawalDate={setEditingWithdrawalDate} startEditWithdrawalDate={startEditWithdrawalDate} cancelEditWithdrawalDate={cancelEditWithdrawalDate} saveWithdrawalDate={saveWithdrawalDate} savingWithdrawalId={savingWithdrawalId} onEdit={openOpportunityEdit} />)}

        {!loading && filteredItems.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>لا توجد فرص مطابقة</Text><Text style={styles.emptyText}>غيّر المستثمر أو التصنيف أو الحالة.</Text></View> : null}
      </ScrollView>

      <FilterPickerModal visible={Boolean(picker)} type={picker} onClose={() => setPicker(null)} investors={investors} selectedInvestor={investorFilter} selectedCategory={categoryFilter} selectedStatus={statusFilter} onInvestor={(value) => { setInvestorFilter(value); setPicker(null); }} onCategory={(value) => { setCategoryFilter(value); setPicker(null); }} onStatus={(value) => { setStatusFilter(value); setPicker(null); }} />

      <Modal visible={opportunityEditOpen} transparent animationType="fade" onRequestClose={() => setOpportunityEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOpportunityEditOpen(false)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل فرصة تعميد</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput style={styles.searchInput} value={opportunityForm.code} onChangeText={(v) => setOpportunityField('code', v)} placeholder="رقم الفرصة" placeholderTextColor="#94a3b8" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.total_amount} onChangeText={(v) => setOpportunityField('total_amount', v)} placeholder="مبلغ الاستثمار" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.profit} onChangeText={(v) => setOpportunityField('profit', v)} placeholder="الربح" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.profit_rate} onChangeText={(v) => setOpportunityField('profit_rate', v)} placeholder="النسبة" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.category} onChangeText={(v) => setOpportunityField('category', v)} placeholder="التصنيف" placeholderTextColor="#94a3b8" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.months} onChangeText={(v) => setOpportunityField('months', v)} placeholder="الشهور" placeholderTextColor="#94a3b8" keyboardType="number-pad" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.start_date} onChangeText={(v) => setOpportunityField('start_date', v)} placeholder="تاريخ الاستثمار YYYY-MM-DD" placeholderTextColor="#94a3b8" textAlign="right" />
              <TextInput style={styles.searchInput} value={opportunityForm.maturity_date} onChangeText={(v) => setOpportunityField('maturity_date', v)} placeholder="تاريخ الاستحقاق YYYY-MM-DD" placeholderTextColor="#94a3b8" textAlign="right" />
              <TextInput style={[styles.searchInput, { minHeight: 86, textAlignVertical: 'top' }]} value={opportunityForm.allocations} onChangeText={(v) => setOpportunityField('allocations', v)} placeholder={'المستثمرين، كل سطر: الاسم المبلغ'} placeholderTextColor="#94a3b8" multiline textAlign="right" />
              <TextInput style={[styles.searchInput, { minHeight: 70, textAlignVertical: 'top' }]} value={opportunityForm.notes} onChangeText={(v) => setOpportunityField('notes', v)} placeholder="ملاحظات" placeholderTextColor="#94a3b8" multiline textAlign="right" />
              <TouchableOpacity style={styles.payButton} onPress={saveOpportunityEdit} disabled={savingOpportunityEdit}>
                <Text style={styles.payText}>{savingOpportunityEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ReceiptModal visible={receiptOpen} onClose={() => setReceiptOpen(false)} receiptText={receiptText} setReceiptText={setReceiptText} preview={receiptPreview} parseReceipt={parseReceipt} applyReceipt={applyReceipt} saving={savingReceipt} />
    </SafeAreaView>
  );
}

function CompactFilter({ label, value, onPress }) {
  return <TouchableOpacity style={styles.compactFilterButton} onPress={onPress} activeOpacity={0.85}><Text style={styles.compactFilterLabel}>{label}</Text><View style={styles.compactFilterValueRow}><Text style={styles.compactFilterArrow}>▾</Text><Text style={styles.compactFilterValue} numberOfLines={1}>{value}</Text></View></TouchableOpacity>;
}

function FilterPickerModal({ visible, type, onClose, investors, selectedInvestor, selectedCategory, selectedStatus, onInvestor, onCategory, onStatus }) {
  const [query, setQuery] = useState('');
  const investorItems = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return investors;
    return investors.filter((investor) => investor.name.includes(keyword) || investor.code.includes(keyword));
  }, [investors, query]);
  const title = type === 'investor' ? 'اختيار المستثمر' : type === 'category' ? 'اختيار التصنيف' : 'اختيار الحالة';
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.pickerCard}><View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity><Text style={styles.modalTitle}>{title}</Text></View>{type === 'investor' ? <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="ابحث باسم المستثمر" placeholderTextColor="#94a3b8" textAlign="right" /> : null}<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pickerList}>{type === 'investor' ? <><PickerOption label="كل المستثمرين" sub="إظهار جميع الفرص" active={selectedInvestor === 'all'} onPress={() => onInvestor('all')} />{investorItems.map((investor) => <PickerOption key={investor.code} label={investor.name} sub={`فرص ${investor.opportunities} · مستثمر ${money(investor.invested, 2)}`} active={selectedInvestor === investor.code} onPress={() => onInvestor(investor.code)} />)}</> : null}{type === 'category' ? <><PickerOption label="كل التصنيفات" active={selectedCategory === 'all'} onPress={() => onCategory('all')} />{CATEGORIES.map((category) => <PickerOption key={category} label={category} active={selectedCategory === category} onPress={() => onCategory(category)} />)}</> : null}{type === 'status' ? STATUS_FILTERS.map(([key, label]) => <PickerOption key={key} label={label} active={selectedStatus === key} onPress={() => onStatus(key)} />) : null}</ScrollView></View></View></Modal>;
}

function PickerOption({ label, sub, active, onPress }) {
  return <TouchableOpacity style={[styles.pickerOption, active && styles.pickerOptionActive]} onPress={onPress} activeOpacity={0.85}><Text style={[styles.pickerCheck, active && styles.pickerCheckActive]}>{active ? '✓' : ''}</Text><View style={styles.pickerTextBlock}><Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{label}</Text>{sub ? <Text style={styles.pickerSub}>{sub}</Text> : null}</View></TouchableOpacity>;
}

function Metric({ title, value, wide }) {
  return <View style={[styles.metricCard, wide && styles.metricWide]}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

function Mini({ label, value }) {
  return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}

function RateBadge({ children, tone }) {
  return <Text style={[styles.rateBadge, tone === 'actual' && styles.actualRateBadge]}>{children}</Text>;
}

function Ta3meedCard({ item, open, onToggle, onDeleteReceipt, deletingReceiptId, editingReceiptId, editingReceiptDate, setEditingReceiptDate, startEditReceiptDate, cancelEditReceiptDate, saveReceiptDate, savingReceiptDateId, editingWithdrawalId, editingWithdrawalDate, setEditingWithdrawalDate, startEditWithdrawalDate, cancelEditWithdrawalDate, saveWithdrawalDate, savingWithdrawalId, onEdit }) {
  const meta = metaOf(item);
  const status = statusOf(item);
  const category = categoryOf(item);
  const tone = categoryTone(category);
  const receipts = item.receipts || [];
  const allocations = item.allocations || [];
  const expectedTotal = n(item.principal_amount) + n(item.expected_profit_amount);
  const receivedTotal = receivedAmountOf(item, meta, receipts, allocations);
  const remaining = meta.ta3meed_remaining_amount !== undefined ? n(meta.ta3meed_remaining_amount) : Math.max(0, expectedTotal - receivedTotal);
  const progress = expectedTotal > 0 ? Math.min(100, Math.max(0, (receivedTotal / expectedTotal) * 100)) : 0;
  const partialCount = receipts.filter((receipt) => receipt.receipt_type !== 'full').length;
  const fullCount = receipts.filter((receipt) => receipt.receipt_type === 'full').length;
  const lastReceipt = receipts[0];
  const annualRate = registeredAnnualRate(item, meta);
  const realRate = actualAnnualRate(item, meta, receipts, allocations);
  const raisedMonths = raisedMonthsOf(item, meta);
  const realInvestmentDays = realInvestmentDaysOf(item, meta, receipts);
  const realInvestmentDuration = formatRealInvestmentDuration(realInvestmentDays);

  return <View style={[styles.card, { borderColor: status.color }]}>
<View style={styles.cardTop}><TouchableOpacity activeOpacity={0.84} onPress={(event) => { event.stopPropagation?.(); onEdit?.(item); }} style={styles.inlineEditButton}><UiIcon name="edit" size={20} color={ICON_COLOR_DARK} /></TouchableOpacity><View style={[styles.statusPill, { backgroundColor: status.bg }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View><View style={[styles.categoryPill, { backgroundColor: tone.bg }]}><Text style={[styles.categoryText, { color: tone.color }]}>{category === '-' ? '-' : category}</Text></View><View style={styles.cardTitleBlock}><Text style={styles.cardCode}>{item.reference_number || 'فرصة تعميد'}</Text><Text style={styles.cardMeta}>يستحق {item.maturity_date || '-'}</Text></View></View><View style={styles.rateBadgesRow}><RateBadge>سنوي مرفوع {pct(annualRate, 2)}</RateBadge>{realRate !== null ? <RateBadge tone="actual">سنوي حقيقي {pct(realRate, 2)}</RateBadge> : null}</View><View style={styles.durationBadgesRow}><Text style={styles.durationBadge}>الشهور المرفوعة {raisedMonths ? `${raisedMonths} شهر` : '-'}</Text><Text style={styles.durationBadge}>المدة الفعلية {realInvestmentDuration}</Text></View><View style={styles.amounts}><Mini label="المبلغ" value={money(item.principal_amount)} /><Mini label="الربح" value={money(item.expected_profit_amount, 2)} /><Mini label="المستلم" value={money(receivedTotal, 2)} /></View><View style={styles.progressBox}><View style={styles.progressHeader}><Text style={styles.progressPercent}>{pct(progress)}</Text><Text style={styles.progressTitle}>نسبة الاستلام</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><Text style={styles.progressMeta}>المتبقي {money(remaining, 2)} · الدفعات {receipts.length} · الجزئية {partialCount}{fullCount ? ` · كلي ${fullCount}` : ''}</Text>{lastReceipt ? <Text style={styles.progressMeta}>آخر دفعة: {lastReceipt.receipt_date || '-'} · {money(lastReceipt.amount, 2)}</Text> : null}{meta.ta3meed_settlement_note ? <Text style={styles.settlementNote}>{meta.ta3meed_settlement_note}</Text> : null}</View><TouchableOpacity style={styles.detailsButton} onPress={onToggle} activeOpacity={0.85}><Text style={styles.detailsButtonText}>{open ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text></TouchableOpacity>{open ? <View style={styles.detailsBox}><Text style={styles.detail}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
          <View style={styles.withdrawalEditBox}>
            {editingWithdrawalId === item.id ? (
              <>
                <TextInput
                  value={editingWithdrawalDate}
                  onChangeText={setEditingWithdrawalDate}
                  placeholder="تاريخ السحب YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  style={styles.withdrawalDateInput}
                />
                <View style={styles.withdrawalEditActions}>
                  <TouchableOpacity onPress={() => saveWithdrawalDate(item)} disabled={savingWithdrawalId === item.id} style={styles.withdrawalSaveButton}>
                    <Text style={styles.withdrawalSaveText}>{savingWithdrawalId === item.id ? '...' : 'حفظ'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelEditWithdrawalDate} style={styles.withdrawalCancelButton}>
                    <Text style={styles.withdrawalCancelText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity onPress={() => startEditWithdrawalDate(item)} style={styles.withdrawalEditButton}>
                <Text style={styles.withdrawalEditText}>تعديل تاريخ السحب</Text>
              </TouchableOpacity>
            )}
          </View>
<Text style={styles.detail}>المسترد: {money(meta.returned_amount, 2)}</Text><Text style={styles.subTitle}>سجل الدفعات</Text>{receipts.length ? receipts.map((receipt) => {
  const isEditingDate = editingReceiptId === receipt.id;
  return (
    <View key={receipt.id} style={[styles.receiptLine, receipt.receipt_type === 'full' && styles.fullReceiptLine]}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
        <TouchableOpacity disabled={deletingReceiptId === receipt.id} onPress={() => onDeleteReceipt(receipt)} style={styles.deleteReceipt}>
          <Text style={styles.deleteReceiptText}>{deletingReceiptId === receipt.id ? '...' : 'حذف'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => startEditReceiptDate(receipt)} style={[styles.deleteReceipt, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Text style={[styles.deleteReceiptText, { color: '#2563eb' }]}>تعديل</Text>
        </TouchableOpacity>
      </View>

      {isEditingDate ? (
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 6 }}>
          <TextInput
            value={editingReceiptDate}
            onChangeText={setEditingReceiptDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            style={{ minWidth: 120, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, textAlign: 'right', color: '#0f172a', fontWeight: '900', fontSize: 12 }}
          />
          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            <TouchableOpacity onPress={() => saveReceiptDate(receipt)} disabled={savingReceiptDateId === receipt.id} style={{ backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 11 }}>{savingReceiptDateId === receipt.id ? '...' : 'حفظ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelEditReceiptDate} style={{ backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#475569', fontWeight: '900', fontSize: 11 }}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.receiptText}>{receipt.receipt_date || '-'} · {receipt.receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي'} · {money(receipt.amount, 2)}</Text>
      )}
    </View>
  );
}) : <Text style={styles.muted}>لا توجد دفعات</Text>}<Text style={styles.subTitle}>المستثمرين</Text>{allocations.map((allocation) => { const share = n(item.principal_amount) > 0 ? (n(allocation.invested_amount) / n(item.principal_amount)) * 100 : 0; const expected = n(allocation.invested_amount) + n(allocation.expected_profit_amount); const investorRemaining = Math.max(0, expected - n(allocation.received_amount)); const actualProfit = n(allocation.received_amount) - n(allocation.invested_amount); return <Text key={allocation.id || `${allocation.investor_name}-${allocation.invested_amount}`} style={styles.detail}>{allocation.investor_name}: نسبة {pct(share)} · مستثمر {money(allocation.invested_amount, 2)} · مستلم {money(allocation.received_amount, 2)} · ربح فعلي {money(actualProfit, 2)} · متبقي {money(investorRemaining, 2)}</Text>; })}</View> : null}</View>;
}

function ReceiptModal({ visible, onClose, receiptText, setReceiptText, preview, parseReceipt, applyReceipt, saving }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity><Text style={styles.modalTitle}>لصق رسالة استلام تعميد</Text></View><TextInput style={styles.receiptInput} multiline textAlign="right" textAlignVertical="top" value={receiptText} onChangeText={setReceiptText} placeholder="الصق رسالة تعميد هنا" placeholderTextColor="#94a3b8" />{preview ? <View style={styles.preview}><Text style={styles.previewText}>رقم الفرصة: {preview.reference_number || '-'}</Text><Text style={styles.previewText}>المبلغ: {money(preview.amount, 2)}</Text><Text style={styles.previewText}>النوع: {preview.label || '-'}</Text></View> : null}<View style={styles.modalActions}><TouchableOpacity style={styles.secondary} onPress={parseReceipt}><Text style={styles.secondaryText}>تحليل الرسالة</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, saving && styles.disabled]} onPress={applyReceipt} disabled={saving}><Text style={styles.primaryText}>{saving ? 'جاري...' : 'اعتماد الدفعة'}</Text></TouchableOpacity></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  header: { paddingHorizontal: 22, paddingTop: 34, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f7fb' },
  headerIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  payButton: { height: 46, minWidth: 62, borderRadius: 16, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  payText: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
  content: { paddingHorizontal: 14, paddingBottom: 28 },
  searchInput: { marginTop: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', fontWeight: '900' },
  metricGrid: { marginTop: 6, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5 },
  metricCard: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, padding: 7, borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'flex-end' },
  metricWide: { flexBasis: '100%' },
  metricTitle: { color: '#64748b', fontSize: 9.5, fontWeight: '800', textAlign: 'right' },
  metricValue: { marginTop: 3, color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  compactFiltersCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 24, padding: 12, borderWidth: 1, borderColor: '#dbe3ea' },
  compactFilterGrid: { flexDirection: 'row-reverse', gap: 8 },
  compactFilterButton: { flex: 1, minHeight: 88, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  compactFilterLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '900', marginBottom: 8 },
  compactFilterValueRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  compactFilterArrow: { color: '#64748b', fontWeight: '900', fontSize: 11 },
  compactFilterValue: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  resetButton: { marginTop: 10, alignSelf: 'stretch', backgroundColor: '#ecfdf5', borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  resetButtonText: { color: '#0f766e', fontWeight: '900' },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', backgroundColor: '#eff6ff', borderRadius: 16, padding: 12, overflow: 'hidden' },
  loader: { marginTop: 18 },
  sectionRow: { marginTop: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontSize: 25, fontWeight: '900', textAlign: 'right' },
  counter: { color: '#0f766e', backgroundColor: '#ccfbf1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, overflow: 'hidden', fontWeight: '900' },
  inlineEditButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 6, backgroundColor: '#fff', borderRadius: 16, padding: 9, borderWidth: 1.4, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  cardTitleBlock: { flex: 1, alignItems: 'flex-end' },
  cardCode: { color: '#0f172a', fontSize: 13.5, fontWeight: '900', textAlign: 'right' },
  cardMeta: { marginTop: 1, color: '#64748b', fontSize: 9, fontWeight: '800', textAlign: 'right' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 9.5, fontWeight: '900' },
  categoryPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  categoryText: { fontSize: 9.5, fontWeight: '900' },
  rateBadgesRow: { marginTop: 6, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5 },
  withdrawalEditBox: { marginTop: 7, alignItems: 'flex-end' },
  withdrawalEditButton: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 11, paddingHorizontal: 9, paddingVertical: 6 },
  withdrawalEditText: { color: '#c2410c', fontSize: 10.5, fontWeight: '900' },
  withdrawalDateInput: { minWidth: 150, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7, textAlign: 'right', color: '#0f172a', fontWeight: '900', fontSize: 12 },
  withdrawalEditActions: { marginTop: 6, flexDirection: 'row-reverse', gap: 6 },
  withdrawalSaveButton: { backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  withdrawalSaveText: { color: '#0f172a', fontWeight: '900', fontSize: 11 },
  withdrawalCancelButton: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  withdrawalCancelText: { color: '#475569', fontWeight: '900', fontSize: 11 },
  durationBadgesRow: { marginTop: 6, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5 },
  durationBadge: { backgroundColor: '#f8fafc', color: '#475569', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  rateBadge: { backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  actualRateBadge: { backgroundColor: '#dcfce7', color: '#166534' },
  amounts: { marginTop: 7, flexDirection: 'row-reverse', gap: 5 },
  mini: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 11, padding: 6, alignItems: 'flex-end' },
  miniLabel: { color: '#64748b', fontSize: 8.5, fontWeight: '800', textAlign: 'right' },
  miniValue: { marginTop: 2, color: '#0f172a', fontSize: 10.5, fontWeight: '900', textAlign: 'right' },
  progressBox: { marginTop: 7, backgroundColor: '#f8fafc', borderRadius: 12, padding: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPercent: { color: '#0f766e', fontSize: 10.5, fontWeight: '900' },
  progressTitle: { color: '#64748b', fontSize: 9.5, fontWeight: '900' },
  progressTrack: { marginTop: 10, height: 12, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0f766e' },
  progressMeta: { marginTop: 5, color: '#64748b', fontSize: 9.5, fontWeight: '800', textAlign: 'right' },
  settlementNote: { marginTop: 8, color: '#b45309', backgroundColor: '#fffbeb', borderRadius: 12, padding: 8, overflow: 'hidden', textAlign: 'right', fontWeight: '900' },
  detailsButton: { marginTop: 7, borderRadius: 12, borderWidth: 1, borderColor: '#99f6e4', backgroundColor: '#f0fdfa', paddingVertical: 9, alignItems: 'center' },
  detailsButtonText: { color: '#0f766e', fontSize: 12, fontWeight: '900' },
  detailsBox: { marginTop: 14, backgroundColor: '#fff', borderRadius: 18, padding: 12, alignItems: 'flex-end' },
  detail: { color: '#334155', fontWeight: '900', textAlign: 'right', marginTop: 7, lineHeight: 24 },
  subTitle: { marginTop: 14, color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  muted: { color: '#94a3b8', fontWeight: '900', textAlign: 'right', marginTop: 8 },
  receiptLine: { marginTop: 8, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 14, padding: 10 },
  fullReceiptLine: { backgroundColor: '#ecfdf5' },
  receiptText: { flex: 1, color: '#334155', fontWeight: '900', textAlign: 'right' },
  deleteReceipt: { backgroundColor: '#fee2e2', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  deleteReceiptText: { color: '#b91c1c', fontWeight: '900' },
  emptyCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 22, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 6, color: '#64748b', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16, maxHeight: '84%' },
  pickerCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16, maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0f172a', fontSize: 25, fontWeight: '900' },
  modalTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  pickerList: { paddingBottom: 8 },
  pickerOption: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 18, padding: 13, borderWidth: 1, borderColor: '#e2e8f0' },
  pickerOptionActive: { backgroundColor: '#ecfdf5', borderColor: '#99f6e4' },
  pickerCheck: { width: 25, color: '#0f766e', fontWeight: '900', fontSize: 18 },
  pickerCheckActive: { color: '#0f766e' },
  pickerTextBlock: { flex: 1, alignItems: 'flex-end' },
  pickerLabel: { color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  pickerLabelActive: { color: '#0f766e' },
  pickerSub: { marginTop: 4, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  receiptInput: { minHeight: 150, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 14, color: '#0f172a', fontWeight: '800' },
  preview: { marginTop: 12, backgroundColor: '#ecfdf5', borderRadius: 16, padding: 12 },
  previewText: { color: '#0f766e', textAlign: 'right', fontWeight: '900', marginTop: 3 },
  modalActions: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  secondary: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  primary: { flex: 1, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#0f172a', fontWeight: '900' },
  disabled: { opacity: 1.6 },
});
