import React, { useEffect, useMemo, useRef, useState } from 'react';
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
const INVESTOR_COLORS = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#be123c', '#0891b2'];
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

function normalizeSearchValue(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0625\u0623\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addSearchPart(parts, value) {
  if (value === null || value === undefined || value === '') return;
  const raw = String(value);
  parts.push(raw);
  const numeric = raw.replace(/,/g, '');
  if (numeric !== raw) parts.push(numeric);
}

function searchTextOf(item) {
  const meta = metaOf(item);
  const parts = [];

  [
    item.reference_number,
    item.code,
    meta.reference_number,
    meta.code,
    meta.company_name,
    item.company_name,
    meta.activity,
    item.activity,
    meta.description,
    item.description,
    meta.tasks,
    item.tasks,
    meta.executor,
    item.executor,
    item.principal_amount,
    item.total_amount,
    item.amount,
    meta.total_amount,
    meta.amount,
  ].forEach((value) => addSearchPart(parts, value));

  (item.allocations || []).forEach((allocation) => {
    [
      allocation.investor_name,
      allocation.investor_code,
      allocation.invested_amount,
    ].forEach((value) => addSearchPart(parts, value));
  });

  const normalized = normalizeSearchValue(parts.join(' '));
  const collapsed = normalized.replace(/\s+/g, '');
  return { normalized, collapsed };
}

function itemMatchesSearch(item, tokens) {
  if (!tokens.length) return true;

  const { normalized, collapsed } = searchTextOf(item);

  return tokens.every((token) => {
    const cleanToken = normalizeSearchValue(token);
    if (!cleanToken) return true;
    const collapsedToken = cleanToken.replace(/\s+/g, '');
    return normalized.includes(cleanToken) || collapsed.includes(collapsedToken);
  });
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


function activeRemainingInvestmentAmount(items, selectedInvestor = 'all') {
  return (items || []).reduce((total, item) => {
    if (statusOf(item).key === 'received') return total;

    const allocations = item.allocations || [];
    const selectedAllocations = selectedInvestor && selectedInvestor !== 'all'
      ? allocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
      : allocations;

    if (selectedInvestor && selectedInvestor !== 'all' && selectedAllocations.length === 0) {
      return total;
    }

    const meta = metaOf(item);
    const receivedTotal = receivedAmountOf(item, meta, item.receipts || [], allocations);

    if (selectedAllocations.length > 0) {
      const totalAllocated = allocations.reduce((sum, allocation) => sum + n(allocation.invested_amount), 0);

      return total + selectedAllocations.reduce((sum, allocation) => {
        const invested = n(allocation.invested_amount);
        const proportionalReceived = totalAllocated > 0 ? receivedTotal * (invested / totalAllocated) : 0;
        return sum + Math.max(0, invested - Math.min(invested, proportionalReceived));
      }, 0);
    }

    const invested = n(item.principal_amount);
    return total + Math.max(0, invested - Math.min(invested, receivedTotal));
  }, 0);
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


function withdrawalSortValue(item) {
  const meta = metaOf(item);
  const dateText = String(
    meta.withdrawal_date ||
    item.withdrawal_date ||
    item.investment_date ||
    item.start_date ||
    item.created_at ||
    ''
  ).slice(0, 10);
  const value = dateText ? new Date(`${dateText}T00:00:00`).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function formatRealInvestmentDuration(days) {
  if (!days) return '-';

  const months = Math.floor(days / 30);
  const restDays = days % 30;

  if (months > 0 && restDays > 0) return `${months} شهر و ${restDays} يوم`;
  if (months > 0) return `${months} شهر`;
  return `${days} يوم`;
}

export default function Ta3meedCompactFiltersScreen({ onBack, onOpenMore }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [investorFilter, setInvestorFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const scrollRef = useRef(null);
  const searchInputRef = useRef(null);
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
    company_name: '',
    tasks: '',
    executor: '',
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

  const handleSearchPress = () => {
    setShowSearch(true);

    const scrollToSearch = () => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    };

    scrollToSearch();
    requestAnimationFrame(() => {
      scrollToSearch();
      searchInputRef.current?.focus?.();
    });
    setTimeout(() => {
      scrollToSearch();
      searchInputRef.current?.focus?.();
    }, 80);
    setTimeout(scrollToSearch, 180);
  };

  const filteredItems = useMemo(() => {
    const tokens = normalizeSearchValue(query).split(' ').filter(Boolean);

    return items.filter((item) => {
      const status = statusOf(item).key;
      const category = categoryOf(item);

      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (!itemHasInvestor(item, investorFilter)) return false;
      if (!itemMatchesSearch(item, tokens)) return false;

      return true;
    }).sort((a, b) => {
      const dateValue = (item) => {
        const dateText = String(item?.maturity_date || item?.due_date || '').slice(0, 10);
        if (!dateText) return null;
        const value = new Date(`${dateText}T00:00:00`).getTime();
        return Number.isFinite(value) ? value : null;
      };

      const aValue = dateValue(a);
      const bValue = dateValue(b);

      if (aValue === null && bValue !== null) return -1;
      if (aValue !== null && bValue === null) return 1;
      if (aValue !== null && bValue !== null && aValue !== bValue) return aValue - bValue;

      return String(a?.reference_number || a?.code || a?.id || '').localeCompare(
        String(b?.reference_number || b?.code || b?.id || ''),
        'ar'
      );
    });
  }, [items, statusFilter, categoryFilter, investorFilter, query]);

  const totals = useMemo(() => {
    const active = filteredItems.filter((item) => statusOf(item).key === 'active');
    return {
      invested: activeRemainingInvestmentAmount(items, investorFilter),
      profit: active.reduce((sum, item) => sum + n(item.expected_profit_amount), 0),
      active: active.length,
      partial: filteredItems.filter((item) => statusOf(item).key === 'partial_received').length,
      received: filteredItems.reduce((sum, item) => sum + receivedAmountOf(item, metaOf(item), item.receipts || [], item.allocations || []), 0),
    };
  }, [filteredItems, items, investorFilter]);

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

  const saveReceiptDate = async (receipt, ownerItem = null) => {
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
        body: JSON.stringify({
          receipt_date: date,
          notes: receipt.notes || null,
        }),
      });

      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');
      setItems((currentItems) => currentItems.map((item) => {
        if (String(item.id) !== String(receipt.opportunity_id)) return item;
        return {
          ...item,
          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),
        };
      }));
      setEditingReceiptId(null);
      setEditingReceiptDate('');
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
      company_name: String(meta.company_name || item.company_name || ''),
      tasks: String(meta.tasks || item.tasks || ''),
      executor: String(meta.executor || item.executor || ''),
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
          company_name: opportunityForm.company_name || null,
          tasks: opportunityForm.tasks || null,
          executor: opportunityForm.executor || null,
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
          <TouchableOpacity style={styles.headerIcon} onPress={handleSearchPress} activeOpacity={0.85}>
            <UiIcon name="search" size={21} color={ICON_COLOR_DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.payButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}>
            <Text style={styles.payText}>سداد</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {showSearch ? <TextInput ref={searchInputRef} style={styles.searchInput} value={query} onChangeText={(text) => { setQuery(text); setExpandedId(null); }} placeholder="ابحث برقم الفرصة، الشركة، النشاط، المستثمر، المبلغ" placeholderTextColor="#94a3b8" textAlign="right" /> : null}

        <View style={styles.compactFiltersCard}>
          <View style={styles.compactFilterGrid}>
            <CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker('investor')} />
            <CompactFilter label="التصنيف" value={categoryLabel} onPress={() => setPicker('category')} />
            <CompactFilter label="الحالة" value={statusLabel} onPress={() => setPicker('status')} />
          </View>
        </View>

        <View style={styles.metricGrid}>
          <Metric title="استثمار تعميد" value={money(totals.invested)} />
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

      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => onOpenMore ? onOpenMore() : onBack?.()}
        style={styles.moreFloatingButton}
      >
        <UiIcon name="more" size={27} color={ICON_COLOR_DARK} />
      </TouchableOpacity>


      <FilterPickerModal visible={Boolean(picker)} type={picker} onClose={() => setPicker(null)} investors={investors} selectedInvestor={investorFilter} selectedCategory={categoryFilter} selectedStatus={statusFilter} onInvestor={(value) => { setInvestorFilter(value); setPicker(null); }} onCategory={(value) => { setCategoryFilter(value); setPicker(null); }} onStatus={(value) => { setStatusFilter(value); setPicker(null); }} />

      <Modal visible={opportunityEditOpen} transparent animationType="fade" onRequestClose={() => setOpportunityEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.opportunityEditCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOpportunityEditOpen(false)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل فرصة تعميد</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.opportunityEditScroll}>
              <View style={styles.editFormSection}>
                <Text style={styles.editFormSectionTitle}>بيانات الفرصة</Text>
                <EditField label="رقم الفرصة" value={opportunityForm.code} onChangeText={(v) => setOpportunityField('code', v)} placeholder="مثال: 123456" />
                <EditField label="مبلغ الاستثمار" value={opportunityForm.total_amount} onChangeText={(v) => setOpportunityField('total_amount', v)} placeholder="مبلغ الاستثمار" keyboardType="decimal-pad" />
                <EditField label="الربح" value={opportunityForm.profit} onChangeText={(v) => setOpportunityField('profit', v)} placeholder="قيمة الربح" keyboardType="decimal-pad" />
                <EditField label="النسبة" value={opportunityForm.profit_rate} onChangeText={(v) => setOpportunityField('profit_rate', v)} placeholder="نسبة الربح" keyboardType="decimal-pad" />
                <EditField label="التصنيف" value={opportunityForm.category} onChangeText={(v) => setOpportunityField('category', v)} placeholder="A+ / A / B ..." />
                <EditField label="عدد الشهور" value={opportunityForm.months} onChangeText={(v) => setOpportunityField('months', v)} placeholder="مدة الفرصة بالشهور" keyboardType="number-pad" />
                <EditField label="تاريخ الاستثمار" value={opportunityForm.start_date} onChangeText={(v) => setOpportunityField('start_date', v)} placeholder="YYYY-MM-DD" />
                <EditField label="تاريخ الاستحقاق" value={opportunityForm.maturity_date} onChangeText={(v) => setOpportunityField('maturity_date', v)} placeholder="YYYY-MM-DD" />
                <EditField label="اسم الشركة" value={opportunityForm.company_name} onChangeText={(v) => setOpportunityField('company_name', v)} placeholder="اسم الشركة المرتبطة بالفرصة" />
                <EditField label="المهام" value={opportunityForm.tasks} onChangeText={(v) => setOpportunityField('tasks', v)} placeholder="المهام أو وصف العمل" multiline inputStyle={{ minHeight: 58, textAlignVertical: 'top' }} />
                <EditField label="المنفذ" value={opportunityForm.executor} onChangeText={(v) => setOpportunityField('executor', v)} placeholder="اسم المنفذ" />
                <EditField label="المستثمرون" value={opportunityForm.allocations} onChangeText={(v) => setOpportunityField('allocations', v)} placeholder={'كل سطر: الاسم المبلغ'} multiline inputStyle={{ minHeight: 66, textAlignVertical: 'top' }} />
                <EditField label="ملاحظات" value={opportunityForm.notes} onChangeText={(v) => setOpportunityField('notes', v)} placeholder="أي ملاحظات إضافية" multiline inputStyle={{ minHeight: 58, textAlignVertical: 'top' }} />
              </View>
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


function EditField({ label, value, onChangeText, placeholder, keyboardType, multiline, inputStyle }) {
  return (
    <View style={[styles.editFieldBox, multiline && styles.editFieldBoxMultiline]}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={[styles.editFieldInput, multiline && styles.editFieldInputMultiline, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlign="right"
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
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
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.pickerCard}><View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity><Text style={styles.modalTitle}>{title}</Text></View>{type === 'investor' ? <TextInput style={styles.searchInput} value={query} onChangeText={(text) => { setQuery(text); setExpandedId(null); }} placeholder="ابحث باسم المستثمر" placeholderTextColor="#94a3b8" textAlign="right" /> : null}<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pickerList}>{type === 'investor' ? <><PickerOption label="كل المستثمرين" sub="إظهار جميع الفرص" active={selectedInvestor === 'all'} onPress={() => onInvestor('all')} />{investorItems.map((investor) => <PickerOption key={investor.code} label={investor.name} sub={`فرص ${investor.opportunities} · مستثمر ${money(investor.invested, 2)}`} active={selectedInvestor === investor.code} onPress={() => onInvestor(investor.code)} />)}</> : null}{type === 'category' ? <><PickerOption label="كل التصنيفات" active={selectedCategory === 'all'} onPress={() => onCategory('all')} />{CATEGORIES.map((category) => <PickerOption key={category} label={category} active={selectedCategory === category} onPress={() => onCategory(category)} />)}</> : null}{type === 'status' ? STATUS_FILTERS.map(([key, label]) => <PickerOption key={key} label={label} active={selectedStatus === key} onPress={() => onStatus(key)} />) : null}</ScrollView></View></View></Modal>;
}

function PickerOption({ label, sub, active, onPress }) {
  return <TouchableOpacity style={[styles.pickerOption, active && styles.pickerOptionActive]} onPress={onPress} activeOpacity={0.85}><Text style={[styles.pickerCheck, active && styles.pickerCheckActive]}>{active ? '✓' : ''}</Text><View style={styles.pickerTextBlock}><Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{label}</Text>{sub ? <Text style={styles.pickerSub}>{sub}</Text> : null}</View></TouchableOpacity>;
}

function Metric({ title, value, wide }) {
  return <View style={[styles.metricCard, wide && styles.metricWide]}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

function Mini({ label, value, emphasis }) {
  return (
    <View style={[styles.mini, emphasis && styles.miniPrimary]}>
      <Text style={[styles.miniLabel, emphasis && styles.miniPrimaryLabel]}>{label}</Text>
      <Text style={[styles.miniValue, emphasis && styles.miniPrimaryValue]} numberOfLines={1}>{value}</Text>
    </View>
  );
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
  const annualRate = registeredAnnualRate(item, meta);
  const realRate = actualAnnualRate(item, meta, receipts, allocations);
  const raisedMonths = raisedMonthsOf(item, meta);
  const companyName = String(meta.company_name || item.company_name || '').trim();
  const withdrawalDate = investmentStartDateOf(item, meta) || '-';

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const maturityDateValue = item.maturity_date ? new Date(`${String(item.maturity_date).slice(0, 10)}T00:00:00`) : null;
  const remainingDaysValue = maturityDateValue && !Number.isNaN(maturityDateValue.getTime())
    ? Math.ceil((maturityDateValue.getTime() - todayDate.getTime()) / 86400000)
    : null;
  const remainingDaysBadgeText = remainingDaysValue === null
    ? ''
    : remainingDaysValue >= 0
      ? `متبقي ${remainingDaysValue} يوم`
      : `متأخر ${Math.abs(remainingDaysValue)} يوم`;
  const durationBadgeText = raisedMonths ? `الشهور ${raisedMonths}` : '';

  const sortedReceipts = [...receipts].sort((a, b) => String(b.receipt_date || b.created_at || '').localeCompare(String(a.receipt_date || a.created_at || '')));

  const SummaryKpi = ({ label, value, primary }) => (
    <View style={[styles.summaryKpi, primary && styles.summaryKpiPrimary]}>
      <Text style={[styles.summaryKpiLabel, primary && styles.summaryKpiPrimaryLabel]}>{label}</Text>
      <Text style={[styles.summaryKpiValue, primary && styles.summaryKpiPrimaryValue]} numberOfLines={1}>{value}</Text>
    </View>
  );

  const renderReceipt = (receipt, index) => {
    const isEditingDate = editingReceiptId === receipt.id;
    const isFull = receipt.receipt_type === 'full';

    return (
      <View key={receipt.id || `${receipt.receipt_date}-${index}`} style={styles.receiptTimelineItem}>
        <View style={[styles.receiptTimelineDot, isFull && styles.receiptTimelineDotFull]} />

        <View style={[styles.receiptTimelineCard, isFull && styles.receiptTimelineCardFull]}>
          <View style={styles.receiptOneLine}>
            <View style={styles.receiptActions}>
              <TouchableOpacity disabled={deletingReceiptId === receipt.id} onPress={() => onDeleteReceipt(receipt)} style={[styles.receiptActionButton, styles.receiptDeleteAction]}>
                <UiIcon name="delete" size={14} color="#b91c1c" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startEditReceiptDate(receipt)} style={[styles.receiptActionButton, styles.receiptEditAction]}>
                <UiIcon name="edit" size={14} color="#2563eb" />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptInfoBlock}>
              <Text style={styles.receiptDateText}>{receipt.receipt_date || '-'}</Text>
              <Text style={styles.receiptTypeText}>{isFull ? 'كلي' : 'جزئي'}</Text>
            </View>

            <Text style={styles.receiptAmountText}>{money(receipt.amount, 2)}</Text>
          </View>

          {isEditingDate ? (
            <View style={styles.receiptEditBox}>
              <TextInput
                value={editingReceiptDate}
                onChangeText={setEditingReceiptDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                style={styles.receiptEditInput}
              />
              <View style={styles.receiptEditActions}>
                <TouchableOpacity onPress={() => saveReceiptDate(receipt, item)} disabled={savingReceiptDateId === receipt.id} style={[styles.receiptSaveButton, savingReceiptDateId === receipt.id && styles.disabled]}>
                  <Text style={styles.receiptSaveText}>{savingReceiptDateId === receipt.id ? '...' : 'حفظ'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelEditReceiptDate} style={styles.receiptCancelButton}>
                  <Text style={styles.receiptCancelText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderInvestor = (allocation, index) => {
    const investorName = allocation.investor_name || allocation.investor_code || 'مستثمر';
    const invested = n(allocation.invested_amount);
    const received = n(allocation.received_amount);
    const expectedProfit = n(allocation.expected_profit_amount);
    const investorExpectedTotal = invested + expectedProfit;
    const ownershipPct = n(item.principal_amount) > 0 ? Math.min(100, Math.max(0, (invested / n(item.principal_amount)) * 100)) : 0;
    const receivedSharePct = receivedTotal > 0 ? Math.min(100, Math.max(0, (received / receivedTotal) * 100)) : 0;
    const remainingShare = Math.max(0, investorExpectedTotal - received);
    const actualProfit = received - invested;
    const color = INVESTOR_COLORS[index % INVESTOR_COLORS.length];

    return (
      <View key={`investor-${allocation.id || index}`} style={styles.investorCard}>
        <View style={styles.investorHeaderLine}>
          <View style={[styles.detailInvestorDot, { backgroundColor: color }]} />
          <Text style={styles.investorCardName} numberOfLines={1}>{investorName}</Text>
          <Text style={[styles.investorShareText, { color }]}>{pct(ownershipPct)}</Text>
        </View>

        <View style={styles.investorMiniGrid}>
          <View style={styles.investorMiniBox}>
            <Text style={styles.investorMiniLabel}>مستثمر</Text>
            <Text style={styles.investorMiniValue}>{money(invested, 2)}</Text>
          </View>
          <View style={styles.investorMiniBox}>
            <Text style={styles.investorMiniLabel}>مستلم</Text>
            <Text style={styles.investorMiniValue}>{money(received, 2)}</Text>
          </View>
          <View style={styles.investorMiniBox}>
            <Text style={styles.investorMiniLabel}>متبقي</Text>
            <Text style={styles.investorMiniValue}>{money(remainingShare, 2)}</Text>
          </View>
          <View style={styles.investorMiniBox}>
            <Text style={styles.investorMiniLabel}>ربح فعلي</Text>
            <Text style={[styles.investorMiniValue, actualProfit < 0 && styles.negativeValue]}>{money(actualProfit, 2)}</Text>
          </View>
        </View>

        <View style={styles.investorLineBlock}>
          <View style={styles.investorLineHeader}>
            <Text style={styles.investorLinePercent}>{pct(ownershipPct)}</Text>
            <Text style={styles.investorLineTitle}>خط الملكية</Text>
          </View>
          <View style={styles.investorLineTrack}>
            <View style={[styles.investorLineFill, { width: `${ownershipPct}%`, backgroundColor: color }]} />
          </View>
        </View>

        <View style={styles.investorLineBlock}>
          <View style={styles.investorLineHeader}>
            <Text style={styles.investorLinePercent}>{pct(receivedSharePct)}</Text>
            <Text style={styles.investorLineTitle}>خط المستلم</Text>
          </View>
          <View style={styles.investorLineTrack}>
            <View style={[styles.investorLineFill, { width: `${receivedSharePct}%`, backgroundColor: '#0f766e' }]} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, { borderColor: status.color }]}>
      <View style={styles.opportunityHeader}>
        <View style={styles.headerRightMeta}>
          <View style={[styles.categoryTopPill, { backgroundColor: tone.color }]}>
            <Text style={styles.categoryTopText}>{category === '-' ? '-' : category}</Text>
          </View>
        </View>

        <View style={styles.opportunityTitleBlock}>
          <Text style={styles.cardCode}>{item.reference_number || 'فرصة تعميد'}</Text>
          <Text style={styles.cardMeta}>يستحق {item.maturity_date || '-'}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          onPress={(event) => { event.stopPropagation?.(); onEdit?.(item); }}
          style={styles.inlineEditButton}
        >
          <UiIcon name="edit" size={20} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
      </View>

      <View style={styles.badgeStrip}>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {durationBadgeText ? (
          <View style={[styles.categoryPill, { backgroundColor: '#ecfeff' }]}>
            <Text style={[styles.categoryText, { color: '#0f766e' }]}>{durationBadgeText}</Text>
          </View>
        ) : null}
        {remainingDaysBadgeText ? (
          <View style={[styles.categoryPill, { backgroundColor: remainingDaysValue < 0 ? '#fef2f2' : '#eff6ff' }]}>
            <Text style={[styles.categoryText, { color: remainingDaysValue < 0 ? '#dc2626' : '#2563eb' }]}>{remainingDaysBadgeText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.summaryDashboard}>
        <View style={styles.amountHero}>
          <Text style={styles.amountHeroLabel}>المبلغ</Text>
          <Text style={styles.amountHeroValue} numberOfLines={1}>{money(item.principal_amount)}</Text>
        </View>

        <View style={styles.summaryKpiGrid}>
          <SummaryKpi label="الربح" value={money(item.expected_profit_amount, 2)} />
          <SummaryKpi label="المستلم" value={money(receivedTotal, 2)} />
          <SummaryKpi label="المتبقي" value={money(remaining, 2)} />
        </View>

        <View style={styles.progressBox}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressPercent}>{pct(progress)}</Text>
            <Text style={styles.progressTitle}>نسبة الاستلام</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressMeta}>الدفعات {receipts.length} · الجزئية {partialCount}{fullCount ? ` · الكلية ${fullCount}` : ''}</Text>
          {meta.ta3meed_settlement_note ? <Text style={styles.settlementNote}>{meta.ta3meed_settlement_note}</Text> : null}
        </View>
      </View>

      {companyName ? (
        <View style={styles.companyCardLine}>
          <Text style={styles.companyCardLabel}>الشركة</Text>
          <Text style={styles.companyCardValue} numberOfLines={1}>{companyName}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.detailsButton} onPress={onToggle} activeOpacity={0.85}>
        <Text style={styles.detailsButtonText}>{open ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.detailsBox}>
          <View style={styles.withdrawalCard}>
            <TouchableOpacity onPress={() => startEditWithdrawalDate(item)} style={styles.withdrawalIconButton}>
              <UiIcon name="edit" size={15} color="#0f766e" />
            </TouchableOpacity>

            {editingWithdrawalId === item.id ? (
              <View style={styles.withdrawalEditArea}>
                <TextInput
                  value={editingWithdrawalDate}
                  onChangeText={setEditingWithdrawalDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  style={styles.withdrawalEditInput}
                />
                <View style={styles.withdrawalEditActions}>
                  <TouchableOpacity onPress={() => saveWithdrawalDate(item)} disabled={savingWithdrawalId === item.id} style={[styles.withdrawalSaveButton, savingWithdrawalId === item.id && styles.disabled]}>
                    <Text style={styles.withdrawalSaveText}>{savingWithdrawalId === item.id ? '...' : 'حفظ'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelEditWithdrawalDate} style={styles.withdrawalCancelButton}>
                    <Text style={styles.withdrawalCancelText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.withdrawalTextBlock}>
                <Text style={styles.withdrawalLabel}>تاريخ السحب</Text>
                <Text style={styles.withdrawalValue}>{withdrawalDate}</Text>
              </View>
            )}
          </View>

          <View style={styles.detailSectionHeader}>
            <Text style={styles.detailSectionCount}>{receipts.length} دفعة</Text>
            <Text style={styles.detailSectionTitle}>سجل الدفعات</Text>
          </View>

          <View style={styles.receiptTimeline}>
            {sortedReceipts.length ? sortedReceipts.map(renderReceipt) : (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyTimelineText}>لا توجد دفعات</Text>
              </View>
            )}
          </View>

          <View style={styles.detailSectionHeader}>
            <Text style={styles.detailSectionCount}>{allocations.length} مستثمر</Text>
            <Text style={styles.detailSectionTitle}>المستثمرين</Text>
          </View>

          <View style={styles.investorPanel}>
            {allocations.length ? allocations.map(renderInvestor) : (
              <Text style={styles.emptyTimelineText}>لا يوجد مستثمرين</Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ReceiptModal({ visible, onClose, receiptText, setReceiptText, preview, parseReceipt, applyReceipt, saving }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity><Text style={styles.modalTitle}>لصق رسالة استلام تعميد</Text></View><TextInput style={styles.receiptInput} multiline textAlign="right" textAlignVertical="top" value={receiptText} onChangeText={setReceiptText} placeholder="الصق رسالة تعميد هنا" placeholderTextColor="#94a3b8" />{preview ? <View style={styles.preview}><Text style={styles.previewText}>رقم الفرصة: {preview.reference_number || '-'}</Text><Text style={styles.previewText}>المبلغ: {money(preview.amount, 2)}</Text><Text style={styles.previewText}>النوع: {preview.label || '-'}</Text></View> : null}<View style={styles.modalActions}><TouchableOpacity style={styles.secondary} onPress={parseReceipt}><Text style={styles.secondaryText}>تحليل الرسالة</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, saving && styles.disabled]} onPress={applyReceipt} disabled={saving}><Text style={styles.primaryText}>{saving ? 'جاري...' : 'اعتماد الدفعة'}</Text></TouchableOpacity></View></View></View></Modal>;
}

const styles = StyleSheet.create({

  moreFloatingButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 50,
  },
  cardTitleLeft: {
    width: '100%',
    alignItems: 'flex-start',
    textAlign: 'left'
  },
  cardCodeLeft: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  cardMetaLeft: {
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  companyCardLine: {
    marginTop: 7,
    marginBottom: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  companyCardLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  companyCardValue: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'left',
    marginRight: 10,
  },
  investorPanel: {
    marginTop: 8,
    marginBottom: 8,
    padding: 8,
    borderRadius: 17,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  investorPanelHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  investorPanelTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right'
  },
  investorPanelCount: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '900'
  },
  investorCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    padding: 8,
    marginTop: 7
  },
  investorHeaderLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7
  },
  investorCardName: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '900',
    textAlign: 'right'
  },
  investorShareText: {
    fontSize: 14,
    fontWeight: '900'
  },
  investorMiniGrid: {
    flexDirection: 'row-reverse',
    gap: 5,
    marginBottom: 6
  },
  investorMiniBox: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#ecfdf5',
    borderRadius: 11,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  investorMiniLabel: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  investorMiniValue: {
    marginTop: 2,
    color: '#0f766e',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  investorLineBlock: {
    marginTop: 6
  },
  investorLineHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  investorLineTitle: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '900'
  },
  investorLinePercent: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900'
  },
  investorLineTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden'
  },

  investorLineFill: {
    height: '100%',
    borderRadius: 999
  },
  investorBadgesBox: {
    marginTop: 8,
    marginBottom: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  investorBadgesHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  investorBadgesTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  investorBadgesCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  investorBadgesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  investorBadge: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  investorBadgeName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  investorBadgeAmount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  editFormSection: {
    marginTop: 0,
    gap: 6,
    paddingBottom: 6
  },
  editFormSectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 0
  },

  editFieldBoxMultiline: {
    alignItems: 'flex-start',
    paddingTop: 7,
    paddingBottom: 7
  },

  editFieldInputMultiline: {
    minHeight: 48,
    paddingTop: 7
  },
  editFieldBox: {
    minHeight: 42,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8
  },
  editFieldLabel: {
    width: 92,
    color: '#334155',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right'
  },
  editFieldInput: {
    flex: 1,
    minHeight: 32,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 13,
    textAlign: 'right'
  },
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
  inlineEditButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    alignItems: 'center',
    justifyContent: 'center'
  },
  amounts: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    width: '100%',
    alignSelf: 'stretch'
  },
  miniPrimary: {
    flexBasis: '100%',
    minHeight: 64,
    backgroundColor: '#ecfdf5',
    borderColor: '#99f6e4',
    borderWidth: 1.5
  },

  cardTitleBlock: {
    order: -30,
    width: '100%',
    flexBasis: '100%',
    marginBottom: 6,
    alignItems: 'flex-start'
  },
  cardCode: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'left',
    writingDirection: 'ltr'
  },
  cardMeta: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'left'
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  summaryTopBlock: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 2,
    marginBottom: 8
  },
  rateBadgesRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 7
  },
  miniLabel: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'center'
  },
  miniValue: {
    marginTop: 4,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center'
  },
  progressBox: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 15,
    padding: 9,
    width: '100%',
    alignSelf: 'stretch'
  },
  progressMeta: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 17
  },

  progressHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },

  progressPercent: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900'
  },

  progressTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900'
  },

  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden'
  },

  detailsButtonText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900'
  },
  card: {
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    padding: 12,
    overflow: 'hidden'
  },
  opportunityTitleBlock: {
    width: '100%',
    marginBottom: 8,
    alignItems: 'flex-start'
  },
  cardHeaderRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    marginBottom: 8
  },
  cardBadgesRow: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 5
  },
  detailsButton: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%'
  },
  miniPrimaryLabel: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900'
  },
  miniPrimaryValue: {
    color: '#064e3b',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  mini: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 58,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  opportunityEditScroll: {
    paddingBottom: 8
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16, maxHeight: '84%' },
  pickerCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16, maxHeight: '78%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: { color: '#0f172a', fontSize: 25, fontWeight: '900' },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right'
  },
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

  card: {
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    padding: 12,
    overflow: 'hidden',
  },
  opportunityHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  opportunityTitleBlock: {
    flex: 1,
    alignItems: 'flex-start',
  },
  cardCode: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  cardMeta: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'left',
  },
  inlineEditButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryDashboard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  amountHero: {
    minHeight: 72,
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  amountHeroLabel: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  amountHeroValue: {
    marginTop: 4,
    color: '#064e3b',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryKpiGrid: {
    flexDirection: 'row-reverse',
    gap: 7,
    width: '100%',
  },
  summaryKpi: {
    flex: 1,
    minHeight: 58,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  summaryKpiPrimary: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  summaryKpiLabel: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryKpiValue: {
    marginTop: 4,
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryKpiPrimaryLabel: {
    color: '#0f766e',
  },
  summaryKpiPrimaryValue: {
    color: '#064e3b',
  },
  progressBox: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 9,
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  progressPercent: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0f766e',
  },
  progressMeta: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 17,
  },
  companyCardLine: {
    marginTop: 7,
    marginBottom: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  companyCardLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  companyCardValue: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'left',
    marginRight: 10,
  },
  detailsButton: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
  },
  detailsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  withdrawalCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  withdrawalIconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#99f6e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawalTextBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  withdrawalLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
  },
  withdrawalValue: {
    marginTop: 3,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  withdrawalEditArea: {
    flex: 1,
    gap: 7,
  },
  withdrawalEditInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#0f172a',
    fontWeight: '900',
    textAlign: 'right',
  },
  withdrawalEditActions: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  withdrawalSaveButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  withdrawalSaveText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
  },
  withdrawalCancelButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  withdrawalCancelText: {
    color: '#475569',
    fontWeight: '900',
    fontSize: 11,
  },
  investorPanel: {
    gap: 8,
  },
  investorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    padding: 9,
  },
  investorHeaderLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  detailInvestorDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  investorCardName: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  investorShareText: {
    fontSize: 14,
    fontWeight: '900',
  },
  investorMiniGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 7,
  },
  investorMiniBox: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 48,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  investorMiniLabel: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  investorMiniValue: {
    marginTop: 2,
    color: '#0f766e',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  negativeValue: {
    color: '#dc2626',
  },
  investorLineBlock: {
    marginTop: 7,
  },
  investorLineHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  investorLineTitle: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '900',
  },
  investorLinePercent: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '900',
  },
  investorLineTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  investorLineFill: {
    height: '100%',
    borderRadius: 999,
  },
  disabled: {
    opacity: 0.55,
  },
  emptyTimeline: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  emptyTimelineText: {
    color: '#94a3b8',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
  },

  detailSectionHeader: {
    marginTop: 5,
    marginBottom: 5,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailSectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  detailSectionCount: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '900',
  },
  receiptTimeline: {
    gap: 5,
  },
  receiptTimelineItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  receiptTimelineDot: {
    width: 7,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  receiptTimelineDotFull: {
    backgroundColor: '#0f766e',
  },
  receiptTimelineCard: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
  },
  receiptTimelineCardFull: {
    backgroundColor: '#ecfdf5',
    borderColor: '#99f6e4',
  },
  receiptOneLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  receiptActions: {
    flexDirection: 'row-reverse',
    gap: 4,
  },
  receiptActionButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  receiptEditAction: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  receiptDeleteAction: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  receiptInfoBlock: {
    minWidth: 78,
    alignItems: 'flex-end',
  },
  receiptDateText: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 16,
  },
  receiptTypeText: {
    marginTop: 0,
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 12,
  },
  receiptAmountText: {
    flex: 1,
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  receiptEditBox: {
    marginTop: 5,
    gap: 5,
  },
  receiptEditInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'right',
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 11.5,
  },
  receiptEditActions: {
    flexDirection: 'row-reverse',
    gap: 5,
  },
  receiptSaveButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  receiptSaveText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
  },
  receiptCancelButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  receiptCancelText: {
    color: '#475569',
    fontWeight: '900',
    fontSize: 10,
  },

  headerRightMeta: {
    minWidth: 54,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },

  categoryTopPill: {
    minWidth: 48,
    height: 44,
    borderRadius: 15,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryTopText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
});
