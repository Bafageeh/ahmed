import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const n = (value) => {
  const number = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const money = (value) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
const percent = (value) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
const today = () => new Date().toISOString().slice(0, 10);

function monthLabel(value) {
  const [year, month] = String(value || '').split('-').map(Number);
  if (!year || !month) return '-';
  return `${MONTHS[month - 1]} ${year}`;
}

function dateLabel(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  return `${day}-${month}-${year}`;
}

function statusInfo(status) {
  const map = {
    paid: { label: 'مدفوع', style: 'paid' },
    partial: { label: 'جزئي', style: 'partial' },
    late_partial: { label: 'جزئي متأخر', style: 'late' },
    late: { label: 'متأخر', style: 'late' },
    pending: { label: 'قادم', style: 'pending' },
    active: { label: 'نشط', style: 'active' },
    completed: { label: 'منتهي', style: 'paid' },
  };
  return map[status] || map.pending;
}

export default function DebtsScreen({ onBack }) {
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('remaining');
  const [paymentItem, setPaymentItem] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());
  const [savingPayment, setSavingPayment] = useState(false);

  const load = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/debts`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل الديون');
      setDebts(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary || {});
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل الديون');
    } finally {
      if (showRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  };

  const loadDetail = async (debtId, showLoading = true) => {
    if (showLoading) setDetailLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/debts/${debtId}`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل تفاصيل الدين');
      setDetail(json.data || null);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل تفاصيل الدين');
    } finally {
      if (showLoading) setDetailLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDebt = (debt) => {
    setSelectedDebt(debt);
    setDetail(null);
    setFilter('remaining');
    loadDetail(debt.id);
  };

  const closeDebt = () => {
    setSelectedDebt(null);
    setDetail(null);
    setMessage('');
  };

  const installments = useMemo(() => {
    const rows = Array.isArray(detail?.installments) ? detail.installments : [];
    if (filter === 'all') return rows;
    if (filter === 'paid') return rows.filter((item) => item.status === 'paid');
    if (filter === 'late') return rows.filter((item) => item.status === 'late' || item.status === 'late_partial');
    return rows.filter((item) => n(item.remaining_amount) > 0);
  }, [detail, filter]);

  const openPayment = (item) => {
    setPaymentItem(item);
    setPaymentAmount(String(n(item.remaining_amount)));
    setPaymentDate(today());
  };

  const cleanAmount = (value) => {
    const cleaned = String(value || '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    setPaymentAmount(parts.length > 2 ? `${parts.shift()}.${parts.join('')}` : cleaned);
  };

  const savePayment = async () => {
    if (!paymentItem || n(paymentAmount) <= 0) return;
    setSavingPayment(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/debts/installments/${paymentItem.id}/pay`, {
        method: 'POST',
        headers: ahmedUserHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          paid_amount: n(paymentAmount),
          paid_at: paymentDate || today(),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تسجيل السداد');
      setPaymentItem(null);
      await Promise.all([load(), loadDetail(selectedDebt.id, false)]);
    } catch (error) {
      setMessage(error.message || 'تعذر تسجيل السداد');
    } finally {
      setSavingPayment(false);
    }
  };

  const undoPayment = (item) => {
    Alert.alert('إلغاء السداد', `هل تريد إعادة قسط ${monthLabel(item.due_date)} إلى غير مدفوع؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'نعم، إلغاء السداد',
        style: 'destructive',
        onPress: async () => {
          setMessage('');
          try {
            const response = await fetch(`${API_URL}/debts/installments/${item.id}/payment`, {
              method: 'DELETE',
              headers: ahmedUserHeaders({ Accept: 'application/json' }),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.message || 'تعذر إلغاء السداد');
            await Promise.all([load(), loadDetail(selectedDebt.id, false)]);
          } catch (error) {
            setMessage(error.message || 'تعذر إلغاء السداد');
          }
        },
      },
    ]);
  };

  if (selectedDebt) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={closeDebt}>
            <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>تفاصيل الدين</Text>
          <View style={styles.backButton} />
        </View>

        {detailLoading ? (
          <View style={styles.centerState}><ActivityIndicator color={ICON_COLOR} /><Text style={styles.stateText}>جاري تحميل الجدول...</Text></View>
        ) : (
          <FlatList
            data={installments}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.detailContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => Promise.all([load(true), loadDetail(selectedDebt.id, false)])} tintColor={ICON_COLOR} colors={[ICON_COLOR]} />}
            ListHeaderComponent={
              <>
                <DebtDetailHero debt={detail || selectedDebt} />
                {!!message ? <Text style={styles.message}>{message}</Text> : null}
                <View style={styles.filterRow}>
                  <FilterButton label="المتبقي" active={filter === 'remaining'} onPress={() => setFilter('remaining')} />
                  <FilterButton label="المتأخر" active={filter === 'late'} onPress={() => setFilter('late')} />
                  <FilterButton label="المدفوع" active={filter === 'paid'} onPress={() => setFilter('paid')} />
                  <FilterButton label="الكل" active={filter === 'all'} onPress={() => setFilter('all')} />
                </View>
                <Text style={styles.listTitle}>الجدول الزمني للأقساط</Text>
              </>
            }
            ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyText}>لا توجد أقساط ضمن هذا التصنيف.</Text></View>}
            renderItem={({ item, index }) => (
              <InstallmentRow
                item={item}
                previous={installments[index - 1]}
                onPay={() => openPayment(item)}
                onUndo={() => undoPayment(item)}
              />
            )}
          />
        )}

        <PaymentModal
          item={paymentItem}
          amount={paymentAmount}
          setAmount={cleanAmount}
          date={paymentDate}
          setDate={setPaymentDate}
          saving={savingPayment}
          onClose={() => setPaymentItem(null)}
          onSave={savePayment}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>#S-124 ديوني</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={ICON_COLOR} colors={[ICON_COLOR]} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroBadge}><UiIcon name="payments" size={18} color="#ddd6fe" /><Text style={styles.heroBadgeText}>حساباتي</Text></View>
          <Text style={styles.heroTitle}>إدارة الديون والأقساط</Text>
          <Text style={styles.heroText}>تم تحويل خط الأقساط من الشيت إلى جدول مؤتمت، وكل سداد يخصم مباشرة من المتبقي.</Text>
        </View>

        {loading ? <View style={styles.centerState}><ActivityIndicator color={ICON_COLOR} /><Text style={styles.stateText}>جاري تحميل الديون...</Text></View> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiCard label="إجمالي الديون" value={money(summary.total_original)} icon="payments" featured />
          <KpiCard label="المتبقي" value={money(summary.total_remaining)} icon="wallet" />
          <KpiCard label="تم سداده" value={money(summary.total_paid)} icon="done" />
          <KpiCard label="دفعة هذا الشهر" value={money(summary.current_month_due)} icon="money" />
          <KpiCard label="المتأخرات" value={money(summary.overdue_amount)} icon="alert" danger={n(summary.overdue_amount) > 0} />
          <KpiCard label="نسبة الإنجاز" value={percent(summary.progress_percent)} icon="stats" />
        </View>

        <View style={styles.insightsCard}>
          <Text style={styles.insightsTitle}>إحصائيات مفيدة</Text>
          <InsightRow label="أقرب دفعة" value={summary.next_payment ? `${monthLabel(summary.next_payment.due_date)} • ${money(summary.next_payment.remaining_amount)}` : 'لا توجد دفعات'} />
          <InsightRow label="أعلى شهر التزام" value={summary.highest_month ? `${monthLabel(`${summary.highest_month.month}-01`)} • ${money(summary.highest_month.amount)}` : '-'} />
          <InsightRow label="متوسط الالتزام الشهري" value={money(summary.average_monthly_commitment)} />
          <InsightRow label="آخر دفعة" value={summary.last_payment_date ? monthLabel(summary.last_payment_date) : '-'} last />
        </View>

        <Text style={styles.sectionTitle}>الديون</Text>
        {debts.map((debt) => <DebtCard key={debt.id} debt={debt} onPress={() => openDebt(debt)} />)}
        {!loading && debts.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyText}>لا توجد ديون مضافة لهذا الحساب.</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, icon, featured, danger }) {
  return (
    <View style={[styles.kpiCard, featured && styles.kpiFeatured, danger && styles.kpiDanger]}>
      <View style={[styles.kpiIcon, featured && styles.kpiIconFeatured, danger && styles.kpiIconDanger]}>
        <UiIcon name={icon} size={23} color={featured ? '#ffffff' : danger ? '#c2410c' : ICON_COLOR} />
      </View>
      <Text style={[styles.kpiValue, featured && styles.kpiValueFeatured, danger && styles.kpiValueDanger]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.kpiLabel, featured && styles.kpiLabelFeatured, danger && styles.kpiLabelDanger]}>{label}</Text>
    </View>
  );
}

function InsightRow({ label, value, last }) {
  return (
    <View style={[styles.insightRow, last && styles.insightRowLast]}>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

function DebtCard({ debt, onPress }) {
  const status = statusInfo(debt.status);
  return (
    <TouchableOpacity style={styles.debtCard} onPress={onPress} activeOpacity={0.84}>
      <View style={styles.debtTopRow}>
        <View style={[styles.statusBadge, styles[`status_${status.style}`]]}><Text style={[styles.statusText, styles[`statusText_${status.style}`]]}>{status.label}</Text></View>
        <View style={styles.debtTitleBlock}>
          <Text style={styles.debtTitle}>{debt.name}</Text>
          <Text style={styles.debtCategory}>{debt.category || 'دين'}</Text>
        </View>
        <View style={styles.debtIcon}><UiIcon name={debt.category === 'سيارة' ? 'payments' : 'properties'} size={25} /></View>
      </View>

      <View style={styles.debtMoneyRow}>
        <View style={styles.debtMoneyBox}><Text style={styles.debtMoneyValue}>{money(debt.remaining_amount)}</Text><Text style={styles.debtMoneyLabel}>المتبقي</Text></View>
        <View style={styles.debtMoneyBox}><Text style={styles.debtMoneyValue}>{money(debt.paid_amount)}</Text><Text style={styles.debtMoneyLabel}>المسدد</Text></View>
      </View>

      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, n(debt.progress_percent)))}%` }]} /></View>
      <View style={styles.progressMeta}><Text style={styles.progressPercent}>{percent(debt.progress_percent)}</Text><Text style={styles.progressText}>{debt.paid_installments_count} من {debt.installments_count} قسط</Text></View>

      <View style={styles.debtFooter}>
        <UiIcon name="back" size={20} color={ICON_COLOR_DARK} />
        <Text style={styles.debtFooterText}>أقرب دفعة: {debt.next_installment ? `${monthLabel(debt.next_installment.due_date)} • ${money(debt.next_installment.remaining_amount)}` : 'مكتمل'}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DebtDetailHero({ debt }) {
  const status = statusInfo(debt?.status);
  return (
    <>
      <View style={styles.detailHero}>
        <View style={styles.detailHeroTop}>
          <View style={[styles.statusBadge, styles[`status_${status.style}`]]}><Text style={[styles.statusText, styles[`statusText_${status.style}`]]}>{status.label}</Text></View>
          <View style={styles.detailTitleBlock}><Text style={styles.detailTitle}>{debt?.name || '-'}</Text><Text style={styles.detailCategory}>{debt?.category || 'دين'}</Text></View>
        </View>
        <Text style={styles.detailRemaining}>{money(debt?.remaining_amount)}</Text>
        <Text style={styles.detailRemainingLabel}>المبلغ المتبقي</Text>
        <View style={styles.detailProgressTrack}><View style={[styles.detailProgressFill, { width: `${Math.min(100, Math.max(0, n(debt?.progress_percent)))}%` }]} /></View>
        <Text style={styles.detailProgressText}>تم إنجاز {percent(debt?.progress_percent)}</Text>
      </View>

      <View style={styles.detailStatsGrid}>
        <MiniStat label="المبلغ الأصلي" value={money(debt?.original_amount)} />
        <MiniStat label="تم سداده" value={money(debt?.paid_amount)} />
        <MiniStat label="دفعة هذا الشهر" value={money(debt?.current_month_due)} />
        <MiniStat label="آخر دفعة" value={debt?.end_date ? monthLabel(debt.end_date) : '-'} />
      </View>
    </>
  );
}

function MiniStat({ label, value }) {
  return <View style={styles.miniStat}><Text style={styles.miniStatValue}>{value}</Text><Text style={styles.miniStatLabel}>{label}</Text></View>;
}

function FilterButton({ label, active, onPress }) {
  return <TouchableOpacity onPress={onPress} style={[styles.filterButton, active && styles.filterButtonActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></TouchableOpacity>;
}

function InstallmentRow({ item, previous, onPay, onUndo }) {
  const info = statusInfo(item.status);
  const showYear = !previous || String(previous.due_date).slice(0, 4) !== String(item.due_date).slice(0, 4);
  return (
    <View>
      {showYear ? <View style={styles.yearDivider}><Text style={styles.yearText}>{String(item.due_date).slice(0, 4)}</Text></View> : null}
      <View style={[styles.installmentRow, (item.status === 'late' || item.status === 'late_partial') && styles.installmentLateRow]}>
        <View style={[styles.statusBadge, styles[`status_${info.style}`]]}><Text style={[styles.statusText, styles[`statusText_${info.style}`]]}>{info.label}</Text></View>
        <View style={styles.installmentTextBlock}>
          <Text style={styles.installmentMonth}>{monthLabel(item.due_date)}</Text>
          <Text style={styles.installmentSub}>المستحق {money(item.scheduled_amount)}{n(item.paid_amount) > 0 ? ` • المسدد ${money(item.paid_amount)}` : ''}</Text>
          {item.paid_at ? <Text style={styles.installmentPaidDate}>تاريخ السداد: {dateLabel(item.paid_at)}</Text> : null}
        </View>
        {item.status === 'paid' ? (
          <TouchableOpacity style={styles.undoButton} onPress={onUndo}><Text style={styles.undoText}>إلغاء</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.payButton} onPress={onPay}><Text style={styles.payText}>سداد</Text></TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PaymentModal({ item, amount, setAmount, date, setDate, saving, onClose, onSave }) {
  return (
    <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>تسجيل سداد</Text>
          </View>
          <Text style={styles.modalSubtitle}>{item ? monthLabel(item.due_date) : ''}</Text>
          <Text style={styles.inputLabel}>المبلغ المدفوع</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" />
          <Text style={styles.inputHint}>المتبقي على القسط: {money(item?.remaining_amount)}</Text>
          <Text style={styles.inputLabel}>تاريخ السداد</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" />
          <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>حفظ السداد وخصمه</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  backButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  content: { padding: 18, paddingTop: 2, paddingBottom: 36 },
  hero: { backgroundColor: '#0f172a', borderRadius: 30, padding: 24, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 999, backgroundColor: '#7c3aed', opacity: 0.15, top: -80, left: -55 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  heroBadgeText: { color: '#ddd6fe', fontWeight: '900' },
  heroTitle: { marginTop: 17, color: '#ffffff', fontSize: 31, fontWeight: '900', textAlign: 'right' },
  heroText: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  centerState: { padding: 24, alignItems: 'center' },
  stateText: { marginTop: 8, color: '#64748b', fontWeight: '800' },
  message: { marginTop: 12, backgroundColor: '#fff1f2', color: '#b91c1c', borderRadius: 16, padding: 12, fontWeight: '900', textAlign: 'center', overflow: 'hidden' },
  kpiGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexBasis: '47.5%', flexGrow: 1, minHeight: 145, backgroundColor: '#ffffff', borderRadius: 23, borderWidth: 1, borderColor: '#e2e8f0', padding: 15, alignItems: 'flex-end' },
  kpiFeatured: { backgroundColor: ICON_COLOR_DARK, borderColor: ICON_COLOR_DARK },
  kpiDanger: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  kpiIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiIconFeatured: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.22)' },
  kpiIconDanger: { backgroundColor: '#ffedd5', borderColor: '#fed7aa' },
  kpiValue: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  kpiValueFeatured: { color: '#ffffff' },
  kpiValueDanger: { color: '#c2410c' },
  kpiLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  kpiLabelFeatured: { color: '#e2e8f0' },
  kpiLabelDanger: { color: '#c2410c' },
  insightsCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', padding: 15 },
  insightsTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right', marginBottom: 4 },
  insightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f7', gap: 12 },
  insightRowLast: { borderBottomWidth: 0 },
  insightLabel: { color: '#64748b', fontWeight: '800', textAlign: 'right' },
  insightValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'left' },
  sectionTitle: { marginTop: 18, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  debtCard: { backgroundColor: '#ffffff', borderRadius: 25, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 11 },
  debtTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  debtTitleBlock: { flex: 1, alignItems: 'flex-end' },
  debtTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  debtCategory: { marginTop: 3, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  debtIcon: { width: 49, height: 49, borderRadius: 18, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },
  debtMoneyRow: { marginTop: 14, flexDirection: 'row-reverse', gap: 8 },
  debtMoneyBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 17, borderWidth: 1, borderColor: '#eef2f7', padding: 11, alignItems: 'flex-end' },
  debtMoneyValue: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  debtMoneyLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  progressTrack: { marginTop: 14, height: 8, backgroundColor: '#ede9fe', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 99 },
  progressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPercent: { color: '#7c3aed', fontWeight: '900' },
  progressText: { color: '#64748b', fontWeight: '800' },
  debtFooter: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  debtFooterText: { flex: 1, color: '#334155', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '900' },
  status_paid: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  statusText_paid: { color: '#047857' },
  status_pending: { backgroundColor: '#f8fafc', borderColor: '#dbe3ea' },
  statusText_pending: { color: '#475569' },
  status_partial: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  statusText_partial: { color: '#a16207' },
  status_late: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  statusText_late: { color: '#be123c' },
  status_active: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  statusText_active: { color: '#4338ca' },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyText: { color: '#64748b', fontWeight: '800', textAlign: 'center' },
  detailContent: { padding: 18, paddingTop: 2, paddingBottom: 40 },
  detailHero: { backgroundColor: '#0f172a', borderRadius: 28, padding: 20 },
  detailHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  detailTitleBlock: { flex: 1, alignItems: 'flex-end' },
  detailTitle: { color: '#ffffff', fontSize: 25, fontWeight: '900', textAlign: 'right' },
  detailCategory: { marginTop: 4, color: '#cbd5e1', fontWeight: '800' },
  detailRemaining: { marginTop: 18, color: '#ffffff', fontSize: 30, fontWeight: '900', textAlign: 'right' },
  detailRemainingLabel: { marginTop: 4, color: '#cbd5e1', fontWeight: '800', textAlign: 'right' },
  detailProgressTrack: { marginTop: 15, height: 9, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  detailProgressFill: { height: '100%', borderRadius: 99, backgroundColor: '#a78bfa' },
  detailProgressText: { marginTop: 6, color: '#ddd6fe', fontWeight: '900', textAlign: 'right' },
  detailStatsGrid: { marginTop: 11, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  miniStat: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, alignItems: 'flex-end' },
  miniStatValue: { color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  miniStatLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  filterRow: { marginTop: 13, flexDirection: 'row-reverse', gap: 7 },
  filterButton: { flex: 1, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, alignItems: 'center' },
  filterButtonActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  filterText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#ffffff' },
  listTitle: { marginTop: 16, marginBottom: 9, color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  yearDivider: { marginTop: 9, marginBottom: 6, alignItems: 'center' },
  yearText: { backgroundColor: '#ede9fe', color: '#5b21b6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, fontWeight: '900', overflow: 'hidden' },
  installmentRow: { backgroundColor: '#ffffff', borderRadius: 19, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  installmentLateRow: { backgroundColor: '#fff7f7', borderColor: '#fecdd3' },
  installmentTextBlock: { flex: 1, alignItems: 'flex-end' },
  installmentMonth: { color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  installmentSub: { marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  installmentPaidDate: { marginTop: 3, color: '#047857', fontSize: 10, fontWeight: '800', textAlign: 'right' },
  payButton: { backgroundColor: '#7c3aed', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10 },
  payText: { color: '#ffffff', fontWeight: '900', fontSize: 12 },
  undoButton: { backgroundColor: '#f1f5f9', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 },
  undoText: { color: '#64748b', fontWeight: '900', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 27, borderWidth: 1, borderColor: '#e2e8f0', padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0f172a', fontSize: 26, fontWeight: '900', marginTop: -2 },
  modalTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  modalSubtitle: { marginTop: 8, color: '#7c3aed', fontWeight: '900', textAlign: 'right' },
  inputLabel: { marginTop: 13, marginBottom: 6, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 12, color: '#0f172a', fontWeight: '900', fontSize: 16 },
  inputHint: { marginTop: 5, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  saveButton: { marginTop: 17, backgroundColor: '#7c3aed', borderRadius: 17, paddingVertical: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  saveText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
});
