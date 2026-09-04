import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const DEFAULT_ANNUAL_RATE = 10.5;
const PRINCIPAL_RETURN_MONTHS = 24;
const ANDROID_STATUS_BAR_INSET =
  Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight || 0, 24) : 0;

const TYPE_FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'investment', label: 'استثمار' },
  { key: 'deposit', label: 'إيداع' },
  { key: 'profit_distribution', label: 'توزيع أرباح' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'كل الحالات' },
  { key: 'completed', label: 'مكتملة' },
  { key: 'pending', label: 'قيد المعالجة' },
];

const TYPE_META = {
  investment: {
    label: 'استثمار',
    icon: 'investments',
    color: '#b45309',
    soft: '#fef3c7',
    sign: '-',
  },
  deposit: {
    label: 'إيداع',
    icon: 'wallet',
    color: '#15803d',
    soft: '#dcfce7',
    sign: '+',
  },
  profit_distribution: {
    label: 'توزيع أرباح',
    icon: 'money',
    color: '#047857',
    soft: '#d1fae5',
    sign: '+',
  },
};

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const money = (value) =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ر.س';

const percent = (value, digits = 2) => Number(value || 0).toFixed(digits) + '%';

const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || '—';
  const year = match[1];
  const month = match[2];
  const day = match[3];
  return Number(day) + ' ' + (MONTHS_AR[Number(month) - 1] || month) + ' ' + year;
};

const validDateFilter = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const normalizeSearch = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '');

function StatCard({ label, value, hint, tone = 'purple' }) {
  return (
    <View style={[styles.statCard, styles['statCard_' + tone]]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, styles['statValue_' + tone]]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
      {!!hint && <Text style={styles.statHint}>{hint}</Text>}
    </View>
  );
}

function FilterChip({ active, label, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransactionCard({ item }) {
  const meta = TYPE_META[item.transaction_type] || TYPE_META.investment;
  const opportunityLabel = item.opportunity_number
    ? 'رقم الفرصة #' + item.opportunity_number
    : 'محفظة سلفة';

  return (
    <View style={styles.transactionCard}>
      <View style={[styles.transactionIcon, { backgroundColor: meta.soft }]}>
        <UiIcon name={meta.icon} size={22} color={meta.color} />
      </View>

      <View style={styles.transactionCopy}>
        <View style={styles.transactionTitleRow}>
          <Text style={styles.transactionTitle}>{item.type_label || meta.label}</Text>
          <View
            style={[
              styles.statusBadge,
              item.status === 'pending' && styles.statusBadgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                item.status === 'pending' && styles.statusBadgeTextPending,
              ]}
            >
              {item.status === 'pending' ? 'قيد المعالجة' : 'مكتملة'}
            </Text>
          </View>
        </View>
        <Text style={styles.transactionOpportunity}>{opportunityLabel}</Text>
        <Text style={styles.transactionDate}>{formatDate(item.transaction_date)}</Text>
      </View>

      <Text
        style={[styles.transactionAmount, { color: meta.color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
      >
        {meta.sign}{money(item.amount)}
      </Text>
    </View>
  );
}

export default function SulfaInvestmentScreen({ onBack }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(API_URL + '/sulfa/investment', {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل استثمار سلفة');
      setData(json.data || {});
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل استثمار سلفة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = data.stats || {};
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const investedAmount = Number(data.invested_amount || 0);
  const annualRate = Number(data.annual_rate || DEFAULT_ANNUAL_RATE);
  const monthlyProfit = Number(data.monthly_profit || 0);
  const monthlyPrincipalReturn = Number(data.monthly_principal_return || 0);
  const monthlyCashFlow = Number(
    data.monthly_cash_flow || monthlyProfit + monthlyPrincipalReturn
  );

  const filteredTransactions = useMemo(() => {
    const needle = normalizeSearch(search);
    const validFrom = validDateFilter(fromDate) ? fromDate.trim() : '';
    const validTo = validDateFilter(toDate) ? toDate.trim() : '';

    return transactions.filter((item) => {
      if (typeFilter !== 'all' && item.transaction_type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (validFrom && String(item.transaction_date || '') < validFrom) return false;
      if (validTo && String(item.transaction_date || '') > validTo) return false;

      if (needle) {
        const haystack = [
          item.opportunity_number,
          item.type_label,
          item.transaction_date,
          item.amount,
          item.notes,
        ]
          .map(normalizeSearch)
          .join(' ');
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [transactions, search, typeFilter, statusFilter, fromDate, toDate]);

  const hasFilters =
    search.trim() ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    fromDate.trim() ||
    toDate.trim();

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.78}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <UiIcon name="back" size={23} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle} numberOfLines={1}>استثمار سلفة</Text>
          <Text style={styles.screenId}>#S-142</Text>
        </View>
        <View style={styles.headerIcon}>
          <UiIcon name="sulfa" size={21} color="#6d28d9" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#7c3aed" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <UiIcon name="sulfa" size={17} color="#ddd6fe" />
              <Text style={styles.heroBadgeText}>محفظة سلفة</Text>
            </View>
            <View style={styles.fixedReturnPill}>
              <View style={styles.fixedReturnDot} />
              <Text style={styles.fixedReturnText}>بيانات فعلية</Text>
            </View>
          </View>
          <Text style={styles.heroLabel}>إجمالي المبالغ المستثمرة</Text>
          <Text
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.68}
          >
            {money(investedAmount)}
          </Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>{Number(stats.opportunity_count || 0)}</Text>
              <Text style={styles.heroMetaLabel}>فرصة استثمار</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>{percent(annualRate, 1)}</Text>
              <Text style={styles.heroMetaLabel}>متوسط العائد السنوي</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>{Number(stats.transaction_count || 0)}</Text>
              <Text style={styles.heroMetaLabel}>حركة مسجلة</Text>
            </View>
          </View>
        </View>

        {loading && transactions.length === 0 ? (
          <ActivityIndicator color="#7c3aed" style={styles.loader} />
        ) : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الإحصائيات</Text>
          <Text style={styles.sectionSubtitle}>محسوبة من كل حركة وفرصة مسجلة</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="الأرباح الموزعة"
            value={money(stats.distributed_profits)}
            hint={Number(stats.profit_distribution_count || 0) + ' توزيعات'}
            tone="green"
          />
          <StatCard
            label="إجمالي الإيداعات"
            value={money(stats.total_deposits)}
            hint={Number(stats.deposit_count || 0) + ' إيداعات'}
            tone="blue"
          />
          <StatCard
            label="متوسط العائد المحقق"
            value={percent(stats.average_return)}
            hint="الأرباح الموزعة ÷ الاستثمار"
            tone="purple"
          />
          <StatCard
            label="رصيد المحفظة المحسوب"
            value={money(stats.wallet_balance)}
            hint="الإيداعات + الأرباح − الاستثمارات"
            tone="slate"
          />
          <StatCard
            label="نسبة الفرص المكتملة"
            value={percent(stats.completion_percentage)}
            hint={Number(stats.completed_opportunity_count || 0) + ' فرص مكتملة'}
            tone="amber"
          />
          <StatCard
            label="متوسط مدة الاستثمار"
            value={Number(stats.average_duration_months || PRINCIPAL_RETURN_MONTHS) + ' شهرًا'}
            hint="مدة كل فرصة"
            tone="cyan"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>العائد الشهري المتوقع</Text>
          <Text style={styles.sectionSubtitle}>على الفرص النشطة المسجلة</Text>
        </View>

        <View style={styles.returnsCard}>
          <View style={styles.returnRow}>
            <View style={[styles.returnIcon, styles.profitIcon]}>
              <UiIcon name="investments" size={21} color="#6d28d9" />
            </View>
            <View style={styles.returnCopy}>
              <Text style={styles.returnLabel}>متوسط الربح الشهري</Text>
              <Text style={styles.returnFormula}>الربح المتوقع ÷ مدة كل فرصة</Text>
            </View>
            <Text style={[styles.returnValue, styles.profitValue]}>{money(monthlyProfit)}</Text>
          </View>
          <View style={styles.returnDivider} />
          <View style={styles.returnRow}>
            <View style={[styles.returnIcon, styles.principalIcon]}>
              <UiIcon name="wallet" size={21} color="#0e7490" />
            </View>
            <View style={styles.returnCopy}>
              <Text style={styles.returnLabel}>استرداد رأس المال شهريًا</Text>
              <Text style={styles.returnFormula}>المبالغ النشطة ÷ مدة الفرص</Text>
            </View>
            <Text style={[styles.returnValue, styles.principalValue]}>
              {money(monthlyPrincipalReturn)}
            </Text>
          </View>
        </View>

        <View style={styles.cashFlowCard}>
          <View style={styles.cashFlowIcon}>
            <UiIcon name="money" size={23} color="#fff" />
          </View>
          <View style={styles.cashFlowCopy}>
            <Text style={styles.cashFlowLabel}>إجمالي التدفق الشهري المتوقع</Text>
            <Text style={styles.cashFlowHint}>الربح + استرداد رأس المال</Text>
          </View>
          <Text style={styles.cashFlowValue}>{money(monthlyCashFlow)}</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>سجل الحركات</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredTransactions.length} من {transactions.length} حركة
            </Text>
          </View>
          {hasFilters ? (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>مسح الفلاتر</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filtersCard}>
          <View style={styles.searchBox}>
            <UiIcon name="search" size={20} color="#64748b" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث برقم الفرصة أو النوع أو المبلغ"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              textAlign="right"
            />
          </View>

          <Text style={styles.filterLabel}>نوع الحركة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {TYPE_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                active={typeFilter === item.key}
                onPress={() => setTypeFilter(item.key)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>التاريخ</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateInputLabel}>إلى</Text>
              <TextInput
                value={toDate}
                onChangeText={setToDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                style={styles.dateInput}
                maxLength={10}
                textAlign="center"
              />
            </View>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateInputLabel}>من</Text>
              <TextInput
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                style={styles.dateInput}
                maxLength={10}
                textAlign="center"
              />
            </View>
          </View>

          <Text style={styles.filterLabel}>الحالة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {STATUS_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                active={statusFilter === item.key}
                onPress={() => setStatusFilter(item.key)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.transactionsList}>
          {filteredTransactions.map((item) => (
            <TransactionCard key={item.id} item={item} />
          ))}
          {!loading && filteredTransactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <UiIcon name="search" size={28} color="#94a3b8" />
              <Text style={styles.emptyTitle}>لا توجد حركات مطابقة</Text>
              <Text style={styles.emptyText}>غيّر البحث أو الفلاتر لعرض نتائج أخرى.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.noteCard}>
          <View style={styles.noteIcon}>
            <UiIcon name="stats" size={19} color="#475569" />
          </View>
          <Text style={styles.noteText}>
            الإيداعات لا تُحتسب ضمن الأرباح، وكل توزيع أرباح مرتبط برقم فرصته.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: ANDROID_STATUS_BAR_INSET + 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  topTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  screenId: { marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: '800' },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 34 },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(124,58,237,0.22)',
    top: -104,
    right: -58,
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(14,165,233,0.12)',
    bottom: -68,
    left: -34,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(124,58,237,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: { color: '#ede9fe', fontSize: 12, fontWeight: '900' },
  fixedReturnPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fixedReturnDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  fixedReturnText: { color: '#d1fae5', fontSize: 11, fontWeight: '800' },
  heroLabel: { marginTop: 22, color: '#94a3b8', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  heroAmount: {
    marginTop: 5,
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  heroMetaRow: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.11)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  heroMetaItem: { flex: 1, alignItems: 'center' },
  heroMetaValue: { color: '#f8fafc', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  heroMetaLabel: { marginTop: 3, color: '#94a3b8', fontSize: 9, fontWeight: '700', textAlign: 'center' },
  heroMetaDivider: { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.12)' },
  loader: { marginTop: 16 },
  message: {
    marginTop: 14,
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    padding: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  sectionHeader: { marginTop: 24, marginBottom: 10, alignItems: 'flex-end' },
  sectionHeaderRow: {
    marginTop: 26,
    marginBottom: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  sectionHeaderCopy: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  sectionSubtitle: { marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48.4%',
    minHeight: 116,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statCard_purple: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
  statCard_green: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  statCard_blue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  statCard_slate: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  statCard_amber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  statCard_cyan: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  statLabel: { color: '#475569', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  statValue: { marginTop: 7, width: '100%', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  statValue_purple: { color: '#6d28d9' },
  statValue_green: { color: '#047857' },
  statValue_blue: { color: '#1d4ed8' },
  statValue_slate: { color: '#334155' },
  statValue_amber: { color: '#b45309' },
  statValue_cyan: { color: '#0e7490' },
  statHint: { marginTop: 6, color: '#64748b', fontSize: 9, fontWeight: '700', lineHeight: 14, textAlign: 'right' },
  returnsCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  returnRow: {
    minHeight: 88,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  returnIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  profitIcon: { backgroundColor: '#f3e8ff' },
  principalIcon: { backgroundColor: '#cffafe' },
  returnCopy: { flex: 1, alignItems: 'flex-end' },
  returnLabel: { color: '#1e293b', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  returnFormula: { marginTop: 4, color: '#94a3b8', fontSize: 9, fontWeight: '700', textAlign: 'right' },
  returnValue: {
    maxWidth: 118,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  profitValue: { color: '#6d28d9' },
  principalValue: { color: '#0e7490' },
  returnDivider: { height: 1, marginHorizontal: 14, backgroundColor: '#eef2f7' },
  cashFlowCard: {
    marginTop: 12,
    minHeight: 92,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  cashFlowIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashFlowCopy: { flex: 1, alignItems: 'flex-end' },
  cashFlowLabel: { color: '#065f46', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  cashFlowHint: { marginTop: 4, color: '#047857', fontSize: 9, fontWeight: '700', textAlign: 'right' },
  cashFlowValue: {
    maxWidth: 120,
    color: '#047857',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  clearButton: { backgroundColor: '#ede9fe', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  clearButtonText: { color: '#6d28d9', fontSize: 10, fontWeight: '900' },
  filtersCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 13,
  },
  searchBox: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '700', paddingVertical: 10 },
  filterLabel: { marginTop: 14, marginBottom: 8, color: '#475569', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  chipsRow: { flexDirection: 'row-reverse', gap: 7 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
  filterChipText: { color: '#475569', fontSize: 10, fontWeight: '900' },
  filterChipTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row-reverse', gap: 9 },
  dateInputWrap: { flex: 1 },
  dateInputLabel: { marginBottom: 5, color: '#64748b', fontSize: 9, fontWeight: '800', textAlign: 'right' },
  dateInput: {
    minHeight: 45,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  transactionsList: { marginTop: 11, gap: 9 },
  transactionCard: {
    minHeight: 112,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  transactionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  transactionCopy: { flex: 1, alignItems: 'flex-end' },
  transactionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  transactionTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  statusBadge: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  statusBadgePending: { backgroundColor: '#fef3c7' },
  statusBadgeText: { color: '#15803d', fontSize: 8, fontWeight: '900' },
  statusBadgeTextPending: { color: '#b45309' },
  transactionOpportunity: { marginTop: 7, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  transactionDate: { marginTop: 4, color: '#94a3b8', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  transactionAmount: {
    maxWidth: 112,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    minHeight: 150,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  emptyTitle: { marginTop: 8, color: '#334155', fontSize: 14, fontWeight: '900' },
  emptyText: { marginTop: 4, color: '#94a3b8', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  noteCard: {
    marginTop: 14,
    padding: 13,
    borderRadius: 17,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  noteIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteText: { flex: 1, color: '#64748b', fontSize: 11, fontWeight: '700', lineHeight: 18, textAlign: 'right' },
});
