import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

const money = (value, digits = 2) =>
  `${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ر.س`;

const n = (value) => {
  const number = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const isPaid = (payment) => Boolean(Number(payment?.is_paid));

const dateText = (value) => String(value || '-');

const isPast = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d < today;
};

const paymentStatus = (payment) => {
  if (isPaid(payment)) return { label: 'مدفوع', style: 'paid' };
  if (isPast(payment.due_date)) return { label: 'متأخر', style: 'late' };
  return { label: 'قادم', style: 'pending' };
};

export default function DinarInvestmentsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [unlinkedPayments, setUnlinkedPayments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/dinar/investments`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل دينار');

      const nextItems = Array.isArray(json.data) ? json.data : [];
      setItems(nextItems);
      setUnlinkedPayments(Array.isArray(json.unlinked_payments) ? json.unlinked_payments : []);

      setSelected((current) => {
        if (!current) return null;
        return nextItems.find((item) => item.id === current.id) || current;
      });
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل دينار');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updatePaymentLocal = (updated) => {
    if (!updated) return;

    setItems((current) =>
      current.map((item) => {
        if (item.id !== updated.dinar_investment_id) return item;
        return {
          ...item,
          payments: (item.payments || []).map((payment) =>
            payment.id === updated.id ? updated : payment
          ),
        };
      })
    );

    setSelected((current) => {
      if (!current || current.id !== updated.dinar_investment_id) return current;
      return {
        ...current,
        payments: (current.payments || []).map((payment) =>
          payment.id === updated.id ? updated : payment
        ),
      };
    });
  };

  const togglePaid = async (payment) => {
    try {
      const response = await fetch(`${API_URL}/dinar/payments/${payment.id}/toggle-paid`, {
        method: 'POST',
        headers: ahmedUserHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          is_paid: !isPaid(payment),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحديث الدفعة');
      updatePaymentLocal(json.data);
    } catch (error) {
      setMessage(error.message || 'تعذر تحديث الدفعة');
    }
  };

  const stats = useMemo(() => {
    const totalInvestment = items.reduce((sum, item) => sum + n(item.investment_amount), 0);
    const expected = items.reduce((sum, item) => sum + (item.payments || []).reduce((pSum, payment) => pSum + n(payment.total_distribution), 0), 0);
    const linkedPaid = items.reduce((sum, item) => sum + (item.payments || []).reduce((pSum, payment) => pSum + (isPaid(payment) ? n(payment.paid_amount || payment.total_distribution) : 0), 0), 0);
    const unlinkedPaid = unlinkedPayments.reduce((sum, payment) => sum + n(payment.paid_amount || payment.total_distribution), 0);
    const weightedReturn = totalInvestment
      ? items.reduce((sum, item) => sum + n(item.investment_amount) * n(item.annual_return), 0) / totalInvestment
      : 0;

    const pending = items
      .flatMap((item) => (item.payments || []).map((payment) => ({ ...payment, title: item.title })))
      .filter((payment) => !isPaid(payment))
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];

    return {
      totalInvestment,
      expected,
      linkedPaid,
      unlinkedPaid,
      paid: linkedPaid + unlinkedPaid,
      remaining: Math.max(0, expected - linkedPaid),
      weightedReturn,
      pending,
    };
  }, [items, unlinkedPayments]);

  if (selected) {
    return (
      <DinarDetails
        item={selected}
        onBack={() => setSelected(null)}
        onTogglePaid={togglePaid}
        message={message}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>#S-141 استثمار دينار</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0f766e" />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroBadge}>دينار</Text>
          <Text style={styles.heroTitle}>شركات استثمارية</Text>
          <Text style={styles.heroText}>البيانات محفوظة الآن في قاعدة البيانات، والمدفوعات تحدث من السيرفر.</Text>
        </View>

        {loading ? <ActivityIndicator color="#0f766e" style={{ marginTop: 14 }} /> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.statsGrid}>
          <Stat title="إجمالي الاستثمار" value={money(stats.totalInvestment, 0)} />
          <Stat title="المستلم" value={money(stats.paid, 2)} />
          <Stat title="المتبقي" value={money(stats.remaining, 2)} />
          <Stat title="متوسط العائد" value={`${stats.weightedReturn.toFixed(2)}%`} />
        </View>

        {stats.pending ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextTitle}>أقرب دفعة غير مدفوعة</Text>
            <Text style={styles.nextDate}>{dateText(stats.pending.due_date)}</Text>
            <Text style={styles.nextText} numberOfLines={1}>{stats.pending.title}</Text>
            <Text style={styles.nextAmount}>
              توزيع {money(stats.pending.total_distribution, 2)}
              {n(stats.pending.total_principal) ? ` · رأس مال ${money(stats.pending.total_principal, 2)}` : ''}
            </Text>
          </View>
        ) : null}

        {unlinkedPayments.length ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>مدفوعات محفوظة وغير مربوطة بفرصة</Text>
            {unlinkedPayments.map((payment) => (
              <View key={payment.id} style={styles.warningRow}>
                <Text style={styles.warningAmount}>{money(payment.paid_amount || payment.total_distribution, 2)}</Text>
                <View style={styles.warningTextBlock}>
                  <Text style={styles.warningName} numberOfLines={1}>{payment.title}</Text>
                  <Text style={styles.warningDate}>{dateText(payment.due_date)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>الشركات</Text>

        {items.map((item) => {
          const paid = (item.payments || []).reduce((sum, payment) => sum + (isPaid(payment) ? n(payment.paid_amount || payment.total_distribution) : 0), 0);
          const expected = (item.payments || []).reduce((sum, payment) => sum + n(payment.total_distribution), 0);

          return (
            <TouchableOpacity key={item.id} activeOpacity={0.86} style={styles.companyCard} onPress={() => setSelected(item)}>
              <View style={styles.companyHeader}>
                <View style={styles.iconBox}>
                  <UiIcon name="dinar" size={24} color="#7c3aed" />
                </View>
                <View style={styles.companyTitleBlock}>
                  <Text style={styles.companyTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.companySub} numberOfLines={1}>{item.company_name}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Metric label="العائد" value={`${n(item.annual_return).toFixed(2)}%`} />
                <Metric label="المدة" value={`${item.duration_months} شهر`} />
                <Metric label="الصكوك" value={String(item.units)} />
                <Metric label="الاستثمار" value={money(item.investment_amount, 0)} />
              </View>

              <View style={styles.methodRow}>
                <Text style={styles.methodText}>التوزيع: {item.profit_method}</Text>
                <Text style={styles.methodText}>رأس المال: {item.capital_method}</Text>
              </View>

              <Text style={styles.openText}>
                المستلم {money(paid, 2)} · المتبقي {money(Math.max(0, expected - paid), 2)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function DinarDetails({ item, onBack, onTogglePaid, message }) {
  const payments = item.payments || [];
  const expected = payments.reduce((sum, payment) => sum + n(payment.total_distribution), 0);
  const paid = payments.reduce((sum, payment) => sum + (isPaid(payment) ? n(payment.paid_amount || payment.total_distribution) : 0), 0);
  const totalPrincipal = payments.reduce((sum, payment) => sum + n(payment.total_principal), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHero}>
          <Text style={styles.detailTitle}>{item.title}</Text>
          <Text style={styles.detailSub}>{item.company_name}</Text>
        </View>

        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.statsGrid}>
          <Stat title="الاستثمار" value={money(item.investment_amount, 0)} />
          <Stat title="المستلم" value={money(paid, 2)} />
          <Stat title="المتبقي" value={money(Math.max(0, expected - paid), 2)} />
          <Stat title="التوزيعات" value={money(expected, 2)} />
        </View>

        <View style={styles.infoCard}>
          <Info label="المدة" value={`${item.duration_months} شهر`} />
          <Info label="عدد الصكوك" value={String(item.units)} />
          <Info label="طريقة توزيع الأرباح" value={item.profit_method} />
          <Info label="طريقة رجوع رأس المال" value={item.capital_method} />
          <Info label="رأس المال المتوقع رجوعه" value={money(totalPrincipal, 2)} />
        </View>

        <Text style={styles.sectionTitle}>جدول السداد والتوزيعات</Text>

        <View style={styles.scheduleCard}>
          {payments.map((payment) => {
            const status = paymentStatus(payment);
            const paidNow = isPaid(payment);

            return (
              <View key={payment.id} style={[styles.scheduleRow, paidNow && styles.scheduleRowPaid, status.style === 'late' && styles.scheduleRowLate]}>
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleStatusWrap}>
                    <Text style={styles.scheduleNo}>الدفعة {payment.installment_no}</Text>
                    <Text style={[
                      styles.paymentStatus,
                      status.style === 'paid' && styles.paymentStatusPaid,
                      status.style === 'pending' && styles.paymentStatusPending,
                      status.style === 'late' && styles.paymentStatusLate,
                    ]}>
                      {status.label}
                    </Text>
                  </View>
                  <Text style={styles.scheduleDate}>{dateText(payment.due_date)}</Text>
                </View>

                <View style={styles.scheduleGrid}>
                  <Metric label="توزيع للصك" value={money(payment.distribution_per_unit, 2)} />
                  <Metric label="رأس مال للصك" value={money(payment.principal_per_unit, 2)} />
                  <Metric label="إجمالي التوزيع" value={money(payment.total_distribution, 2)} />
                  <Metric label="إجمالي رأس المال" value={money(payment.total_principal, 2)} />
                </View>

                {paidNow ? (
                  <Text style={styles.paidNote}>
                    تم استلام التوزيع: {money(payment.paid_amount || payment.total_distribution, 2)}
                    {payment.paid_at ? ` بتاريخ ${dateText(payment.paid_at)}` : ''}
                  </Text>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.manualPaidButton, paidNow && styles.manualPaidButtonActive]}
                  onPress={() => onTogglePaid(payment)}
                >
                  <Text style={[styles.manualPaidButtonText, paidNow && styles.manualPaidButtonTextActive]}>
                    {paidNow ? 'إلغاء المدفوع' : 'تحديد كمدفوع'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ title, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { paddingHorizontal: 28, paddingTop: 34, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, marginHorizontal: 12, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  hero: { marginTop: 8, backgroundColor: '#111827', borderRadius: 30, padding: 24, alignItems: 'flex-end' },
  heroBadge: { color: '#ddd6fe', backgroundColor: '#312e81', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontSize: 13, fontWeight: '900' },
  heroTitle: { marginTop: 18, color: '#ffffff', fontSize: 30, fontWeight: '900', textAlign: 'right' },
  heroText: { marginTop: 10, color: '#cbd5e1', fontSize: 14, fontWeight: '800', textAlign: 'right', lineHeight: 23 },
  message: { marginTop: 12, color: '#075985', backgroundColor: '#eff6ff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, textAlign: 'right', fontWeight: '900', overflow: 'hidden' },
  statsGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe3ea', paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  statTitle: { color: '#64748b', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  statValue: { marginTop: 7, color: '#0f766e', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  nextCard: { marginTop: 14, backgroundColor: '#ecfdf5', borderRadius: 20, borderWidth: 1, borderColor: '#99f6e4', padding: 14, alignItems: 'flex-end' },
  nextTitle: { color: '#0f766e', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  nextDate: { marginTop: 6, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  nextText: { marginTop: 4, color: '#475569', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  nextAmount: { marginTop: 6, color: '#0f766e', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  warningCard: { marginTop: 14, backgroundColor: '#fff7ed', borderRadius: 18, borderWidth: 1, borderColor: '#fed7aa', padding: 12 },
  warningTitle: { color: '#9a3412', fontSize: 14, fontWeight: '900', textAlign: 'right', marginBottom: 8 },
  warningRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: 13, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6, gap: 10 },
  warningTextBlock: { flex: 1, alignItems: 'flex-end' },
  warningName: { color: '#0f172a', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  warningDate: { marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  warningAmount: { color: '#c2410c', fontSize: 13, fontWeight: '900' },
  sectionTitle: { marginTop: 18, marginBottom: 8, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  companyCard: { marginBottom: 12, backgroundColor: '#ffffff', borderRadius: 22, borderWidth: 1, borderColor: '#dbe3ea', padding: 14 },
  companyHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  iconBox: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },
  companyTitleBlock: { flex: 1, alignItems: 'flex-end' },
  companyTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right', lineHeight: 25 },
  companySub: { marginTop: 3, color: '#2563eb', fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  metricsRow: { marginTop: 12, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  metricBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#f8fafc', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  metricLabel: { color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  metricValue: { marginTop: 4, color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  methodRow: { marginTop: 10, backgroundColor: '#f5f3ff', borderRadius: 14, padding: 10, gap: 3 },
  methodText: { color: '#4338ca', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  openText: { marginTop: 10, color: '#7c3aed', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  detailHero: { marginTop: 8, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#dbe3ea', padding: 18, alignItems: 'flex-end' },
  detailTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right', lineHeight: 31 },
  detailSub: { marginTop: 5, color: '#2563eb', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  infoCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#dbe3ea', padding: 12 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
  infoLabel: { color: '#64748b', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  infoValue: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'left' },
  scheduleCard: { backgroundColor: '#ffffff', borderRadius: 22, borderWidth: 1, borderColor: '#dbe3ea', padding: 12 },
  scheduleRow: { marginBottom: 10, backgroundColor: '#f8fafc', borderRadius: 16, padding: 10 },
  scheduleRowPaid: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#99f6e4' },
  scheduleRowLate: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  scheduleHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scheduleStatusWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  scheduleNo: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  scheduleDate: { color: '#2563eb', fontSize: 13, fontWeight: '900', textAlign: 'left' },
  scheduleGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  paymentStatus: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden', fontSize: 11, fontWeight: '900' },
  paymentStatusPaid: { color: '#0f766e', backgroundColor: '#ccfbf1' },
  paymentStatusPending: { color: '#475569', backgroundColor: '#e2e8f0' },
  paymentStatusLate: { color: '#c2410c', backgroundColor: '#fed7aa' },
  paidNote: { marginTop: 8, color: '#0f766e', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  manualPaidButton: { marginTop: 10, alignSelf: 'stretch', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 13, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  manualPaidButtonActive: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  manualPaidButtonText: { color: '#0f766e', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  manualPaidButtonTextActive: { color: '#be123c' },
});
