import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const asNumber = (value) => Number(value || 0);
const money = (value) => `${asNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

function readMeta(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch (error) {
    return {};
  }
}

function isReceived(item) {
  return item?.status === 'received' || item?.status === 'completed';
}

function isOverdue(item) {
  const meta = readMeta(item?.metadata);
  return !isReceived(item) && Boolean((item?.maturity_date && item.maturity_date < today()) || meta.is_overdue || asNumber(meta.remaining_days) < 0);
}

function sum(items, key) {
  return (items || []).reduce((total, item) => total + asNumber(item?.[key]), 0);
}

function platformStats(name, icon, items, extra = {}) {
  const activeItems = (items || []).filter((item) => !isReceived(item));
  const receivedItems = (items || []).filter(isReceived);
  const overdueItems = (items || []).filter(isOverdue);
  return {
    name,
    icon,
    count: items?.length || 0,
    activeCount: activeItems.length,
    receivedCount: receivedItems.length,
    overdueCount: overdueItems.length,
    activeAmount: sum(activeItems, 'principal_amount'),
    totalAmount: sum(items, 'principal_amount'),
    expectedProfit: sum(activeItems, 'expected_profit_amount'),
    ...extra,
  };
}

export default function StatsDashboardScreen() {
  const [ta3meedItems, setTa3meedItems] = useState([]);
  const [moneyMoonItems, setMoneyMoonItems] = useState([]);
  const [financeMetrics, setFinanceMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ta3meedResponse, moneyMoonResponse, financeResponse] = await Promise.allSettled([
        fetch(`${API_URL}/ta3meed/investments`, { headers: { Accept: 'application/json' } }),
        fetch(`${API_URL}/moneymoon/investments`, { headers: { Accept: 'application/json' } }),
        fetch(`${API_URL}/income/linked/finance/summary`, { headers: { Accept: 'application/json' } }),
      ]);

      if (ta3meedResponse.status === 'fulfilled') {
        const json = await ta3meedResponse.value.json();
        setTa3meedItems(Array.isArray(json.data) ? json.data : []);
      }

      if (moneyMoonResponse.status === 'fulfilled') {
        const json = await moneyMoonResponse.value.json();
        setMoneyMoonItems(Array.isArray(json.data) ? json.data : []);
      }

      if (financeResponse.status === 'fulfilled') {
        const json = await financeResponse.value.json();
        setFinanceMetrics(Array.isArray(json.data?.metrics) ? json.data.metrics.filter((metric) => metric.visible !== false) : []);
      }
    } catch (loadError) {
      setError('تعذر تحميل الاحصائيات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const platforms = useMemo(() => [
    platformStats('تعميد', '🏦', ta3meedItems),
    platformStats('موني مون', '🌙', moneyMoonItems),
    platformStats('دينار', '🪙', []),
    platformStats('ترميز', '🔷', []),
  ], [ta3meedItems, moneyMoonItems]);

  const totals = useMemo(() => {
    const activeAmount = platforms.reduce((total, platform) => total + platform.activeAmount, 0);
    const expectedProfit = platforms.reduce((total, platform) => total + platform.expectedProfit, 0);
    const activeCount = platforms.reduce((total, platform) => total + platform.activeCount, 0);
    const overdueCount = platforms.reduce((total, platform) => total + platform.overdueCount, 0);
    return { activeAmount, expectedProfit, activeCount, overdueCount };
  }, [platforms]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <Text style={styles.badge}>📊 الاحصائيات</Text>
          <Text style={styles.title}>لوحة الاحصائيات</Text>
          <Text style={styles.subtitle}>ملخص رقمي فقط للاستثمارات وكل منصة.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>جاري تحميل الاحصائيات...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={styles.loadingCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}><Text style={styles.retryText}>إعادة المحاولة</Text></TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.grid}>
          <StatCard icon="💰" label="الاستثمارات النشطة" value={money(totals.activeAmount)} />
          <StatCard icon="📈" label="الأرباح المتوقعة" value={money(totals.expectedProfit)} />
          <StatCard icon="✅" label="عدد النشطة" value={`${totals.activeCount}`} />
          <StatCard icon="⚠️" label="المتأخرة" value={`${totals.overdueCount}`} danger={totals.overdueCount > 0} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>احصائيات المنصات</Text>
          <Text style={styles.sectionBadge}>{platforms.length}</Text>
        </View>

        {platforms.map((platform) => (
          <PlatformCard key={platform.name} platform={platform} />
        ))}

        {financeMetrics.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>احصائيات Finance</Text>
              <Text style={styles.sectionBadge}>{financeMetrics.length}</Text>
            </View>
            {financeMetrics.map((metric) => (
              <View key={metric.key} style={styles.financeCard}>
                <Text style={styles.financeValue}>{money(metric.amount)}</Text>
                <Text style={styles.financeTitle}>{metric.title}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, danger }) {
  return (
    <View style={[styles.statCard, danger && styles.dangerCard]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PlatformCard({ platform }) {
  return (
    <View style={styles.platformCard}>
      <View style={styles.platformTop}>
        <View style={styles.platformIcon}><Text style={styles.platformIconText}>{platform.icon}</Text></View>
        <View style={styles.platformTitleBlock}>
          <Text style={styles.platformName}>{platform.name}</Text>
          <Text style={styles.platformSub}>{platform.count ? `${platform.count} عملية` : 'لم يتم إدخال بيانات بعد'}</Text>
        </View>
      </View>
      <View style={styles.platformGrid}>
        <MiniStat label="نشط" value={`${platform.activeCount}`} />
        <MiniStat label="مستلم" value={`${platform.receivedCount}`} />
        <MiniStat label="متأخر" value={`${platform.overdueCount}`} danger={platform.overdueCount > 0} />
        <MiniStat label="المبلغ النشط" value={money(platform.activeAmount)} wide />
        <MiniStat label="الربح المتوقع" value={money(platform.expectedProfit)} wide />
      </View>
    </View>
  );
}

function MiniStat({ label, value, danger, wide }) {
  return (
    <View style={[styles.miniStat, wide && styles.miniStatWide, danger && styles.miniStatDanger]}>
      <Text style={[styles.miniValue, danger && styles.dangerText]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.miniLabel, danger && styles.dangerText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 34 },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, overflow: 'hidden' },
  headerGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 999, backgroundColor: '#38bdf8', opacity: 0.16, left: -60, top: -70 },
  badge: { alignSelf: 'flex-start', color: '#e0f2fe', backgroundColor: 'rgba(56,189,248,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  title: { marginTop: 16, color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#cbd5e1', textAlign: 'right', fontWeight: '700' },
  loadingCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b', fontWeight: '800' },
  errorText: { color: '#b91c1c', fontWeight: '900', textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '900' },
  grid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  dangerCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  statIcon: { fontSize: 25, marginBottom: 10 },
  statValue: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  statLabel: { marginTop: 5, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  sectionHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  sectionBadge: { color: '#0f766e', backgroundColor: '#ccfbf1', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  platformCard: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  platformTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  platformIcon: { width: 56, height: 56, borderRadius: 21, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccfbf1' },
  platformIconText: { fontSize: 27 },
  platformTitleBlock: { flex: 1, alignItems: 'flex-end' },
  platformName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformSub: { marginTop: 4, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  platformGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  miniStat: { flexBasis: '30%', flexGrow: 1, backgroundColor: '#f8fafc', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'flex-end' },
  miniStatWide: { flexBasis: '47%' },
  miniStatDanger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  miniValue: { color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  miniLabel: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  dangerText: { color: '#b91c1c' },
  financeCard: { marginBottom: 10, backgroundColor: '#fff', borderRadius: 21, padding: 15, borderWidth: 1, borderColor: '#dbeafe', alignItems: 'flex-end' },
  financeValue: { color: '#075985', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  financeTitle: { marginTop: 6, color: '#0f172a', fontWeight: '900', textAlign: 'right' },
});
