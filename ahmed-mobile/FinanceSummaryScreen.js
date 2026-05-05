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
const money = (value, currency = 'SAR') => `${Number(value || 0).toFixed(2)} ${currency === 'SAR' ? 'ر.س' : currency}`;

export default function FinanceSummaryScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState(null);
  const [message, setMessage] = useState('');

  const currency = summary?.currency || 'SAR';
  const metrics = Array.isArray(summary?.metrics) ? summary.metrics : [];
  const visibleMetrics = useMemo(() => metrics.filter((metric) => metric.visible !== false), [metrics]);
  const hiddenMetrics = useMemo(() => metrics.filter((metric) => metric.visible === false), [metrics]);
  const incomeMetrics = visibleMetrics.filter((metric) => metric.group === 'income');
  const portfolioMetrics = visibleMetrics.filter((metric) => metric.group === 'portfolio');
  const period = summary?.period || {};

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
      setMessage('تعذر جلب بيانات Finance.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleMetric = async (metric) => {
    const nextVisible = metric.visible === false;
    setUpdatingKey(metric.key);
    setMessage('');

    setSummary((current) => {
      if (!current?.metrics) return current;
      return {
        ...current,
        metrics: current.metrics.map((item) =>
          item.key === metric.key ? { ...item, visible: nextVisible } : item
        ),
      };
    });

    try {
      const response = await fetch(`${API_URL}/income/linked/finance/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ key: metric.key, visible: nextVisible }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || 'visibility failed');
      }
    } catch (error) {
      setMessage('تعذر حفظ حالة الإظهار للبطاقة.');
      await loadSummary();
    } finally {
      setUpdatingKey(null);
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
          <Text style={styles.title}>الدخل والتمويل من Finance</Text>
          <Text style={styles.subtitle}>مصدر البيانات: Finance لحساب أحمد admin@pm.sa. القيم مستوردة للعرض فقط ولا تُعدل يدويًا داخل أحمد.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري جلب بيانات Finance...</Text>
          </View>
        ) : null}

        {!loading && summary ? (
          <>
            <View style={styles.syncCard}>
              <Text style={styles.syncTitle}>مصدر البيانات</Text>
              <Text style={styles.syncText}>Finance</Text>
              <Text style={styles.syncText}>الحساب: {summary.source_email || 'admin@pm.sa'}</Text>
              <Text style={styles.syncText}>آخر مزامنة من Finance: {summary.synced_at || '-'}</Text>
              <Text style={styles.syncText}>الفترة: {period.from || '-'} إلى {period.to || '-'}</Text>
              {!!message && <Text style={styles.message}>{message}</Text>}
              <TouchableOpacity style={styles.refreshButton} onPress={loadSummary}>
                <Text style={styles.refreshText}>تحديث القراءة من Finance</Text>
              </TouchableOpacity>
            </View>

            <MetricSection title="دخل مستورد من Finance" metrics={incomeMetrics} currency={currency} onToggle={toggleMetric} updatingKey={updatingKey} />
            <MetricSection title="محفظة / تمويل" metrics={portfolioMetrics} currency={currency} onToggle={toggleMetric} updatingKey={updatingKey} />

            {hiddenMetrics.length > 0 ? (
              <MetricSection title="بطاقات مخفية" metrics={hiddenMetrics} currency={currency} onToggle={toggleMetric} updatingKey={updatingKey} hidden />
            ) : null}
          </>
        ) : null}

        {!loading && !summary ? (
          <View style={styles.syncCard}>
            <Text style={styles.syncTitle}>تعذر جلب بيانات Finance.</Text>
            <Text style={styles.syncText}>لم يتم حساب أي قيمة داخل أحمد. أعد المحاولة بعد التأكد من توفر رابط Finance.</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
            <TouchableOpacity style={styles.refreshButton} onPress={loadSummary}>
              <Text style={styles.refreshText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricSection({ title, metrics, currency, onToggle, updatingKey, hidden }) {
  if (!metrics.length) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {metrics.map((metric) => (
          <FinanceMetricCard
            key={metric.key}
            metric={metric}
            currency={currency}
            onToggle={onToggle}
            updating={updatingKey === metric.key}
            hidden={hidden}
          />
        ))}
      </View>
    </View>
  );
}

function FinanceMetricCard({ metric, currency, onToggle, updating, hidden }) {
  const details = Array.isArray(metric.details) ? metric.details : [];
  const isNetProfitCard = metric.key === 'ahmed_net_profit_after_stuck_deduction';

  return (
    <View style={[styles.metricCard, isNetProfitCard && styles.featureMetricCard, hidden && styles.hiddenMetricCard]}>
      <View style={styles.metricTopRow}>
        <Text style={styles.sourcePill}>Finance</Text>
        <Text style={styles.lockPill}>غير قابل للتعديل</Text>
      </View>
      <Text style={[styles.metricValue, isNetProfitCard && styles.featureMetricValue, hidden && styles.hiddenText]}>
        {money(metric.amount, metric.currency || currency)}
      </Text>
      <Text style={[styles.metricLabel, hidden && styles.hiddenText]}>{metric.title}</Text>
      {metric.description ? <Text style={styles.metricDescription}>{metric.description}</Text> : null}
      <Text style={styles.metricType}>{metric.type}</Text>
      <Text style={styles.metricPath}>{metric.path}</Text>

      {details.length > 0 ? (
        <View style={styles.detailsBox}>
          {details.map((detail) => (
            <View key={detail.path} style={styles.detailRow}>
              <Text style={styles.detailValue}>{money(detail.amount, detail.currency || currency)}</Text>
              <Text style={styles.detailTitle}>{detail.title}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.toggleButton, hidden && styles.showButton]}
        onPress={() => onToggle(metric)}
        disabled={updating}
        activeOpacity={0.82}
      >
        <Text style={[styles.toggleText, hidden && styles.showText]}>
          {updating ? 'جاري الحفظ...' : hidden ? 'إظهار البطاقة' : 'إخفاء البطاقة'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 16, fontSize: 30, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 15, lineHeight: 24, textAlign: 'right' },
  loadingCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '800' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
  syncCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  syncTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  syncText: { marginTop: 6, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  featureMetricCard: { width: '100%', backgroundColor: '#f8fbff', borderColor: '#bfdbfe' },
  hiddenMetricCard: { backgroundColor: '#f8fafc', opacity: 0.78 },
  metricTopRow: { flexDirection: 'row-reverse', gap: 5, flexWrap: 'wrap', marginBottom: 10 },
  sourcePill: { backgroundColor: '#ecfeff', color: '#0e7490', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  lockPill: { backgroundColor: '#f1f5f9', color: '#475569', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  featureMetricValue: { color: '#075985', fontSize: 24 },
  metricLabel: { marginTop: 7, color: '#0f172a', textAlign: 'right', fontWeight: '900', lineHeight: 20 },
  metricDescription: { marginTop: 8, color: '#475569', textAlign: 'right', fontSize: 12, lineHeight: 19, fontWeight: '700' },
  metricType: { marginTop: 5, color: '#64748b', textAlign: 'right', fontSize: 12, fontWeight: '800' },
  metricPath: { marginTop: 4, color: '#94a3b8', textAlign: 'right', fontSize: 10, fontWeight: '700' },
  detailsBox: { marginTop: 12, backgroundColor: '#fff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#dbeafe' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 5 },
  detailTitle: { flex: 1, color: '#64748b', textAlign: 'right', fontSize: 12, fontWeight: '800' },
  detailValue: { color: '#0f172a', textAlign: 'left', fontSize: 12, fontWeight: '900' },
  hiddenText: { color: '#64748b' },
  toggleButton: { marginTop: 12, borderRadius: 14, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  showButton: { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' },
  toggleText: { color: '#c2410c', fontWeight: '900', fontSize: 12 },
  showText: { color: '#166534' },
  refreshButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  refreshText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  message: { marginTop: 12, color: '#b91c1c', textAlign: 'right', fontWeight: '900' },
});
