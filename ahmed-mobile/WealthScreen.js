import React, { useEffect, useMemo, useState } from 'react';
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
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const myInvestorNames = ['أحمد', 'احمد', 'Ahmed', 'ahmed', 'admin', 'admin@pm.sa'];
const closedStatuses = ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'cancelled', 'canceled'];

function asNumber(value) {
  const number = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}
function money(value) {
  return `${asNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
}
function readMeta(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch (error) {
    return {};
  }
}
function statusValue(item) {
  return String(item?.status || '').trim().toLowerCase();
}
function isReceived(item) {
  return closedStatuses.includes(statusValue(item));
}
function isOverdue(item) {
  const meta = readMeta(item?.metadata);
  return !isReceived(item) && Boolean((item?.maturity_date && item.maturity_date < today()) || meta.is_overdue || asNumber(meta.remaining_days) < 0);
}
function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا');
}
function isMineAllocation(allocation) {
  const name = normalizeName(allocation?.investor_name || allocation?.name || allocation?.investor || '');
  return myInvestorNames.some((mine) => normalizeName(mine) === name);
}
function getMineFromTa3meed(item) {
  const allocations = Array.isArray(item?.allocations) ? item.allocations : [];
  const mine = allocations.filter(isMineAllocation);
  const invested = mine.reduce((total, allocation) => total + asNumber(allocation.invested_amount || allocation.amount), 0);
  const profit = mine.reduce((total, allocation) => total + asNumber(allocation.expected_profit_amount || allocation.profit), 0);
  return { invested, profit };
}
function getMoneyMoonProfit(item) {
  const meta = readMeta(item?.metadata);
  const rate = asNumber(item?.expected_rate || meta.profit_rate || 0);
  if (asNumber(item?.expected_profit_amount) > 0) return asNumber(item.expected_profit_amount);
  return asNumber(item?.principal_amount) * (rate / 100);
}
function isDinarPaymentPaid(payment) {
  return Boolean(Number(payment?.is_paid)) || String(payment?.status || '').toLowerCase() === 'paid';
}
function getDinarProfit(item) {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce(
    (total, payment) => total + asNumber(payment?.total_distribution || payment?.expected_profit_amount || payment?.amount),
    0
  );
}
function isDinarOverdue(item) {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.some((payment) => !isDinarPaymentPaid(payment) && payment?.due_date && payment.due_date < today());
}

export default function WealthScreen({ openInvestments }) {
  const [ta3meedItems, setTa3meedItems] = useState([]);
  const [moneyMoonItems, setMoneyMoonItems] = useState([]);
  const [dinarItems, setDinarItems] = useState([]);
  const [bankRow, setBankRow] = useState(null);
  const [bankInput, setBankInput] = useState('');
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const headers = ahmedUserHeaders({ Accept: 'application/json' });
      const [ta3meedResult, moneyMoonResult, dinarResult, bankResult] = await Promise.allSettled([
        fetch(`${API_URL}/ta3meed/investments`, { headers }),
        fetch(`${API_URL}/moneymoon/investments`, { headers }),
        fetch(`${API_URL}/dinar/investments`, { headers }),
        fetch(`${API_URL}/monthly-incomes?screen=wealth`, { headers }),
      ]);

      let loadedSources = 0;

      if (ta3meedResult.status === 'fulfilled' && ta3meedResult.value.ok) {
        const json = await ta3meedResult.value.json();
        setTa3meedItems(Array.isArray(json.data) ? json.data : []);
        loadedSources += 1;
      }

      if (moneyMoonResult.status === 'fulfilled' && moneyMoonResult.value.ok) {
        const json = await moneyMoonResult.value.json();
        setMoneyMoonItems(Array.isArray(json.data) ? json.data : []);
        loadedSources += 1;
      }

      if (dinarResult.status === 'fulfilled' && dinarResult.value.ok) {
        const json = await dinarResult.value.json();
        setDinarItems(Array.isArray(json.data) ? json.data : []);
        loadedSources += 1;
      }

      if (bankResult.status === 'fulfilled' && bankResult.value.ok) {
        const json = await bankResult.value.json();
        const rows = Array.isArray(json.data) ? json.data : [];
        const savedBank = rows.find((item) => String(item?.name || '').trim() === 'الحساب البنكي') || rows[0] || null;
        setBankRow(savedBank);
        loadedSources += 1;
      }

      if (loadedSources === 0) throw new Error('all sources failed');
    } catch (loadError) {
      setError('تعذر تحميل بيانات ثروتي');
    } finally {
      if (showRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ta3meedMine = useMemo(
    () => ta3meedItems.map((item) => ({ item, mine: getMineFromTa3meed(item) })).filter(({ mine }) => mine.invested > 0),
    [ta3meedItems]
  );
  const ta3meedActiveMine = useMemo(() => ta3meedMine.filter(({ item }) => !isReceived(item)), [ta3meedMine]);
  const moneyMoonActive = useMemo(() => moneyMoonItems.filter((item) => !isReceived(item)), [moneyMoonItems]);
  const dinarActive = useMemo(() => dinarItems.filter((item) => !isReceived(item)), [dinarItems]);
  const bankAmount = asNumber(bankRow?.amount);
  const bankMonthlyProfit = (bankAmount * 0.12) / 12;

  const overdueCount = useMemo(
    () =>
      ta3meedActiveMine.filter(({ item }) => isOverdue(item)).length +
      moneyMoonActive.filter(isOverdue).length +
      dinarActive.filter(isDinarOverdue).length,
    [ta3meedActiveMine, moneyMoonActive, dinarActive]
  );

  const totals = useMemo(() => {
    const ta3meedInvested = ta3meedActiveMine.reduce((total, row) => total + row.mine.invested, 0);
    const ta3meedProfit = ta3meedActiveMine.reduce((total, row) => total + row.mine.profit, 0);
    const moneyMoonInvested = moneyMoonActive.reduce((total, item) => total + asNumber(item.principal_amount), 0);
    const moneyMoonProfit = moneyMoonActive.reduce((total, item) => total + getMoneyMoonProfit(item), 0);
    const dinarInvested = dinarActive.reduce((total, item) => total + asNumber(item.investment_amount || item.investment), 0);
    const dinarProfit = dinarActive.reduce((total, item) => total + getDinarProfit(item), 0);

    return {
      totalWealth: ta3meedInvested + moneyMoonInvested + dinarInvested + bankAmount,
      totalProfit: ta3meedProfit + moneyMoonProfit + dinarProfit + bankMonthlyProfit,
      ta3meedInvested,
      ta3meedProfit,
      moneyMoonInvested,
      moneyMoonProfit,
      dinarInvested,
      dinarProfit,
      bankAmount,
      bankMonthlyProfit,
      ta3meedCount: ta3meedActiveMine.length,
      moneyMoonCount: moneyMoonActive.length,
      dinarCount: dinarActive.length,
      totalCount: ta3meedActiveMine.length + moneyMoonActive.length + dinarActive.length,
      overdueCount,
    };
  }, [ta3meedActiveMine, moneyMoonActive, dinarActive, bankAmount, bankMonthlyProfit, overdueCount]);

  const openBankEditor = () => {
    setBankInput(bankAmount ? String(bankAmount) : '');
    setBankModalOpen(true);
  };

  const saveBankAmount = async () => {
    const amount = asNumber(bankInput);
    setSavingBank(true);
    setError('');

    try {
      const isUpdate = Boolean(bankRow?.id);
      const response = await fetch(
        isUpdate ? `${API_URL}/monthly-incomes/${bankRow.id}` : `${API_URL}/monthly-incomes`,
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: ahmedUserHeaders({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            screen: 'wealth',
            name: 'الحساب البنكي',
            amount,
          }),
        }
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ الحساب البنكي');
      setBankRow(json.data || { id: bankRow?.id, name: 'الحساب البنكي', amount });
      setBankModalOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'تعذر حفظ الحساب البنكي');
    } finally {
      setSavingBank(false);
    }
  };

  const cleanBankInput = (value) => {
    const cleaned = String(value || '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    setBankInput(parts.length > 2 ? `${parts.shift()}.${parts.join('')}` : cleaned);
  };

  const bankPreview = (asNumber(bankInput) * 0.12) / 12;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#7c3aed" colors={['#7c3aed']} />}
      >
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <View style={styles.badge}><UiIcon name="wealth" size={18} color="#cbd5e1" /><Text style={styles.badgeText}>ثروتي</Text></View>
          <Text style={styles.title}>ملخص ممتلكاتي</Text>
          <Text style={styles.subtitle}>ملخص حصتي في تعميد وموني مون ودينار وترميز والحساب البنكي.</Text>
        </View>

        {loading ? <View style={styles.statusCard}><ActivityIndicator /><Text style={styles.statusText}>جاري تحميل ممتلكاتي...</Text></View> : null}
        {!loading && error ? <View style={styles.statusCard}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => load()} activeOpacity={0.84}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}

        <View style={styles.summaryGrid}>
          <SummaryCard icon="money" label="إجمالي ثروتي النشطة" value={money(totals.totalWealth)} featured />
          <SummaryCard icon="investments" label="أرباحي المتوقعة" value={money(totals.totalProfit)} />
          <SummaryCard icon="ta3meed" label="حصتي في تعميد" value={money(totals.ta3meedInvested)} />
          <SummaryCard icon="money" label="ربحي من تعميد" value={money(totals.ta3meedProfit)} />
          <SummaryCard icon="moneymoon" label="موني مون" value={money(totals.moneyMoonInvested)} />
          <SummaryCard icon="wallet" label="ربح موني مون" value={money(totals.moneyMoonProfit)} />
          <SummaryCard icon="dinar" label="استثمار دينار" value={money(totals.dinarInvested)} />
          <SummaryCard icon="investments" label="ربح دينار المتوقع" value={money(totals.dinarProfit)} />
          <SummaryCard icon="payments" label="الحساب البنكي" value={money(totals.bankAmount)} onPress={openBankEditor} />
          <SummaryCard icon="money" label="ربح البنك الشهري" value={money(totals.bankMonthlyProfit)} onPress={openBankEditor} />
          <SummaryCard icon="reports" label="عدد استثماراتي النشطة" value={`${totals.totalCount}`} />
          <SummaryCard icon="alert" label="استثمارات متأخرة" value={`${totals.overdueCount}`} danger={totals.overdueCount > 0} />
        </View>

        <View style={styles.platformCardsRow}>
          <PlatformSummary icon="ta3meed" title="تعميد" amount={money(totals.ta3meedInvested)} profit={money(totals.ta3meedProfit)} count={totals.ta3meedCount} />
          <PlatformSummary icon="moneymoon" title="موني مون" amount={money(totals.moneyMoonInvested)} profit={money(totals.moneyMoonProfit)} count={totals.moneyMoonCount} />
          <PlatformSummary icon="dinar" title="دينار" amount={money(totals.dinarInvested)} profit={money(totals.dinarProfit)} count={totals.dinarCount} />
          <PlatformSummary icon="tokenize" title="ترميز" amount={money(0)} profit={money(0)} count={0} note="تظهر القيم تلقائيًا عند تفعيل المنصة" />
          <BankSummary amount={money(totals.bankAmount)} profit={money(totals.bankMonthlyProfit)} onEdit={openBankEditor} />
        </View>

        <TouchableOpacity style={styles.openInvestmentsButton} onPress={openInvestments} activeOpacity={0.84}>
          <UiIcon name="investments" size={20} color="#ffffff" />
          <Text style={styles.openInvestmentsText}>فتح منصات الاستثمار</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={bankModalOpen} transparent animationType="fade" onRequestClose={() => setBankModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setBankModalOpen(false)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>الحساب البنكي</Text>
            </View>
            <Text style={styles.inputLabel}>المبلغ الموجود في الحساب</Text>
            <TextInput
              value={bankInput}
              onChangeText={cleanBankInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              textAlign="right"
            />
            <View style={styles.formulaCard}>
              <Text style={styles.formulaTitle}>الربح الشهري المتوقع</Text>
              <Text style={styles.formulaValue}>{money(bankPreview)}</Text>
              <Text style={styles.formulaText}>المبلغ × 0.12 ÷ 12</Text>
            </View>
            <TouchableOpacity style={[styles.saveButton, savingBank && styles.disabledButton]} onPress={saveBankAmount} disabled={savingBank}>
              {savingBank ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value, featured, danger, onPress }) {
  const CardComponent = onPress ? TouchableOpacity : View;
  return (
    <CardComponent
      style={[styles.summaryCard, featured && styles.featuredSummary, danger && styles.dangerSummary]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <View style={[styles.summaryIconBox, featured && styles.featuredIconBox, danger && styles.dangerIconBox]}>
        <UiIcon name={icon} size={24} color={featured ? '#ffffff' : danger ? '#c2410c' : ICON_COLOR} />
      </View>
      <Text style={[styles.summaryValue, featured && styles.featuredValue, danger && styles.dangerValue]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.summaryLabel, featured && styles.featuredLabel, danger && styles.dangerLabel]}>{label}</Text>
      {onPress ? <Text style={styles.editHint}>اضغط للتعديل</Text> : null}
    </CardComponent>
  );
}

function PlatformSummary({ icon, title, amount, profit, count, note }) {
  return (
    <View style={styles.platformSummaryCard}>
      <View style={styles.platformTopRow}>
        <View style={styles.platformIcon}><UiIcon name={icon} size={26} /></View>
        <View style={styles.platformTitleBlock}>
          <Text style={styles.platformTitle}>{title}</Text>
          <Text style={styles.platformCount}>{count} استثمار نشط</Text>
        </View>
      </View>
      <View style={styles.platformMiniGrid}>
        <View style={styles.miniBox}><Text style={styles.miniValue}>{amount}</Text><Text style={styles.miniLabel}>المبلغ</Text></View>
        <View style={styles.miniBox}><Text style={styles.miniValue}>{profit}</Text><Text style={styles.miniLabel}>الربح</Text></View>
      </View>
      {note ? <Text style={styles.platformNote}>{note}</Text> : null}
    </View>
  );
}

function BankSummary({ amount, profit, onEdit }) {
  return (
    <TouchableOpacity style={[styles.platformSummaryCard, styles.bankSummaryCard]} onPress={onEdit} activeOpacity={0.84}>
      <View style={styles.platformTopRow}>
        <View style={styles.platformIcon}><UiIcon name="payments" size={26} /></View>
        <View style={styles.platformTitleBlock}>
          <Text style={styles.platformTitle}>الحساب البنكي</Text>
          <Text style={styles.platformCount}>إدخال يدوي قابل للتعديل</Text>
        </View>
      </View>
      <View style={styles.platformMiniGrid}>
        <View style={styles.miniBox}><Text style={styles.miniValue}>{amount}</Text><Text style={styles.miniLabel}>الرصيد</Text></View>
        <View style={styles.miniBox}><Text style={styles.miniValue}>{profit}</Text><Text style={styles.miniLabel}>الربح الشهري</Text></View>
      </View>
      <Text style={styles.bankFormula}>الرصيد × 0.12 ÷ 12</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 34 },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, overflow: 'hidden' },
  headerGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 999, backgroundColor: '#64748b', opacity: 0.14, top: -70, left: -50 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  badgeText: { color: '#cbd5e1', fontWeight: '900' },
  title: { marginTop: 16, color: '#ffffff', fontSize: 32, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  statusCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  statusText: { marginTop: 8, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  errorText: { color: '#b91c1c', fontWeight: '900', textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '900' },
  summaryGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end', minHeight: 152 },
  featuredSummary: { backgroundColor: ICON_COLOR_DARK, borderColor: ICON_COLOR_DARK },
  dangerSummary: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  summaryIconBox: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  featuredIconBox: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.22)' },
  dangerIconBox: { backgroundColor: '#ffedd5', borderColor: '#fed7aa' },
  summaryValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  featuredValue: { color: '#ffffff' },
  featuredLabel: { color: '#e2e8f0' },
  dangerValue: { color: '#c2410c' },
  dangerLabel: { color: '#c2410c' },
  editHint: { marginTop: 5, color: '#7c3aed', fontSize: 10, fontWeight: '900', textAlign: 'right' },
  platformCardsRow: { marginTop: 16, gap: 10 },
  platformSummaryCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  bankSummaryCard: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  platformTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  platformIcon: { width: 52, height: 52, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  platformTitleBlock: { flex: 1, alignItems: 'flex-end' },
  platformTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  platformCount: { marginTop: 4, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  platformMiniGrid: { marginTop: 13, flexDirection: 'row-reverse', gap: 8 },
  miniBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 17, padding: 11, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'flex-end' },
  miniValue: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  miniLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  platformNote: { marginTop: 10, color: '#7c3aed', fontWeight: '800', textAlign: 'right', fontSize: 12 },
  bankFormula: { marginTop: 10, color: '#5b21b6', fontWeight: '900', textAlign: 'right', fontSize: 12 },
  openInvestmentsButton: { marginTop: 8, backgroundColor: '#0f172a', borderRadius: 20, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8 },
  openInvestmentsText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 28, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  closeButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0f172a', fontSize: 26, fontWeight: '900', marginTop: -2 },
  inputLabel: { marginTop: 8, marginBottom: 7, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 17, paddingHorizontal: 14, paddingVertical: 13, color: '#0f172a', fontWeight: '900', fontSize: 17 },
  formulaCard: { marginTop: 14, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 20, padding: 14, alignItems: 'flex-end' },
  formulaTitle: { color: '#5b21b6', fontWeight: '900', textAlign: 'right' },
  formulaValue: { marginTop: 6, color: '#0f172a', fontWeight: '900', fontSize: 22, textAlign: 'right' },
  formulaText: { marginTop: 4, color: '#7c3aed', fontWeight: '800', fontSize: 12, textAlign: 'right' },
  saveButton: { marginTop: 16, backgroundColor: '#7c3aed', borderRadius: 17, paddingVertical: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.65 },
  saveText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
});
