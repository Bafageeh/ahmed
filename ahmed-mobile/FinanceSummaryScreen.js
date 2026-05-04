import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

const labels = {
  income: {
    monthly_installments_total: 'مجموع الأقساط الشهرية',
    monthly_profit_total: 'إجمالي الربح الشهري',
    ahmed_monthly_profit: 'ربح أحمد الشهري',
    ali_monthly_profit: 'ربح علي الشهري',
  },
  portfolio: {
    remaining_installments_total: 'إجمالي المتبقي من الأقساط',
    remaining_principal_total: 'رأس المال المتبقي',
    ahmed_total_profit: 'إجمالي ربح أحمد',
  },
  counts: {
    clients_total: 'إجمالي العملاء',
    clients_active: 'النشطين',
    clients_stuck: 'المتعثرين',
    clients_done: 'المنتهين',
    clients_court: 'قضايا',
    clients_overdue: 'عملاء متأخرين',
    overdue_installments: 'عدد الأقساط المتأخرة',
  },
  alerts: {
    overdue_amount: 'مبلغ الأقساط المتأخرة',
  },
};

const money = (value, currency = 'SAR') => `${Number(value || 0).toFixed(2)} ${currency === 'SAR' ? 'ر.س' : currency}`;
const count = (value) => String(Number(value || 0));

export default function FinanceSummaryScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const currency = summary?.currency || 'SAR';
  const period = summary?.period || {};

  const topCards = useMemo(() => [
    {
      label: labels.income.ahmed_monthly_profit,
      value: money(summary?.income?.ahmed_monthly_profit, currency),
    },
    {
      label: labels.income.monthly_installments_total,
      value: money(summary?.income?.monthly_installments_total, currency),
    },
  ], [summary, currency]);

  const loadSummary = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/income/linked/finance/summary`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || 'load failed');
      }

      setSummary(json.data || null);
    } catch (error) {
      setMessage('تعذر تحميل بيانات Finance');
    } finally {
      setLoading(false);
    }
  };

  const syncSummary = async () => {
    setSyncing(true);
    setMessage('جاري مزامنة بيانات Finance...');

    try {
      const response = await fetch(`${API_URL}/income/linked/finance/summary/sync`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || 'sync failed');
      }

      setSummary(json?.data?.summary || summary);
      setMessage('تم تحديث وحفظ بيانات Finance داخل أحمد');
    } catch (error) {
      setMessage('تعذر مزامنة بيانات Finance');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.badge}>Finance</Text>
          <Text style={styles.title}>قيم Finance في أحمد</Text>
          <Text style={styles.subtitle}>عرض مباشر للأقساط والأرباح والعملاء والتنبيهات من تطبيق Finance.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل بيانات Finance...</Text>
          </View>
        ) : null}

        {!loading && summary ? (
          <>
            <View style={styles.summaryRow}>
              {topCards.map((item) => (
                <View key={item.label} style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.syncCard}>
              <Text style={styles.syncTitle}>آخر تحديث</Text>
              <Text style={styles.syncText}>{summary.synced_at || '-'}</Text>
              <Text style={styles.syncText}>الفترة: {period.from || '-'} إلى {period.to || '-'}</Text>
              {!!message && <Text style={styles.message}>{message}</Text>}
              <TouchableOpacity style={styles.saveButton} onPress={syncSummary} disabled={syncing}>
                <Text style={styles.saveText}>{syncing ? 'جاري المزامنة...' : 'تحديث وحفظ في أحمد'}</Text>
              </TouchableOpacity>
            </View>

            <Section title="الدخل" data={summary.income} labelMap={labels.income} currency={currency} formatter={money} />
            <Section title="المحفظة" data={summary.portfolio} labelMap={labels.portfolio} currency={currency} formatter={money} />
            <Section title="العملاء والحالات" data={summary.counts} labelMap={labels.counts} formatter={count} />
            <Section title="التنبيهات" data={summary.alerts} labelMap={labels.alerts} currency={currency} formatter={money} danger />
          </>
        ) : null}

        {!loading && !summary ? (
          <View style={styles.syncCard}>
            <Text style={styles.syncTitle}>لم تصل بيانات Finance</Text>
            <Text style={styles.syncText}>تأكد أن endpoint الخاص بـ Finance يعمل، ثم أعد المحاولة.</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
            <TouchableOpacity style={styles.saveButton} onPress={loadSummary}>
              <Text style={styles.saveText}>إعادة التحميل</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, data = {}, labelMap = {}, currency, formatter, danger }) {
  const entries = Object.keys(labelMap).map((key) => ({
    key,
    label: labelMap[key],
    value: data?.[key],
  }));

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {entries.map((item) => (
          <View key={item.key} style={[styles.metricCard, danger && Number(item.value || 0) > 0 && styles.dangerCard]}>
            <Text style={[styles.metricValue, danger && Number(item.value || 0) > 0 && styles.dangerText]}>
              {formatter(item.value, currency)}
            </Text>
            <Text style={[styles.metricLabel, danger && Number(item.value || 0) > 0 && styles.dangerText]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 16, fontSize: 31, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 16, textAlign: 'right' },
  loadingCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '800' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
  summaryRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryValue: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 5, color: '#64748b', textAlign: 'right' },
  syncCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  syncTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  syncText: { marginTop: 6, color: '#64748b', textAlign: 'right' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', backgroundColor: '#fff', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  metricLabel: { marginTop: 6, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  dangerCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  dangerText: { color: '#b91c1c' },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '800' },
  saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
