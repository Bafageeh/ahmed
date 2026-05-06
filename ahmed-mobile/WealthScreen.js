import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const myInvestorNames = ['أحمد', 'احمد', 'Ahmed', 'ahmed', 'admin', 'admin@pm.sa'];

function asNumber(value) {
  return Number(value || 0);
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

function isReceived(item) {
  return item?.status === 'received' || item?.status === 'completed';
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

export default function WealthScreen({ openInvestments }) {
  const [ta3meedItems, setTa3meedItems] = useState([]);
  const [moneyMoonItems, setMoneyMoonItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ta3meedResult, moneyMoonResult] = await Promise.allSettled([
        fetch(`${API_URL}/ta3meed/investments`, { headers: { Accept: 'application/json' } }),
        fetch(`${API_URL}/moneymoon/investments`, { headers: { Accept: 'application/json' } }),
      ]);

      if (ta3meedResult.status === 'fulfilled') {
        const json = await ta3meedResult.value.json();
        setTa3meedItems(Array.isArray(json.data) ? json.data : []);
      }

      if (moneyMoonResult.status === 'fulfilled') {
        const json = await moneyMoonResult.value.json();
        setMoneyMoonItems(Array.isArray(json.data) ? json.data : []);
      }
    } catch (loadError) {
      setError('تعذر تحميل بيانات ثروتي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ta3meedMine = useMemo(() => {
    return ta3meedItems
      .map((item) => ({ item, mine: getMineFromTa3meed(item) }))
      .filter(({ mine }) => mine.invested > 0);
  }, [ta3meedItems]);

  const ta3meedActiveMine = useMemo(() => ta3meedMine.filter(({ item }) => !isReceived(item)), [ta3meedMine]);
  const moneyMoonActive = useMemo(() => moneyMoonItems.filter((item) => !isReceived(item)), [moneyMoonItems]);
  const overdueCount = useMemo(() => {
    const ta3meedOverdue = ta3meedActiveMine.filter(({ item }) => isOverdue(item)).length;
    const moneyMoonOverdue = moneyMoonActive.filter(isOverdue).length;
    return ta3meedOverdue + moneyMoonOverdue;
  }, [ta3meedActiveMine, moneyMoonActive]);

  const totals = useMemo(() => {
    const ta3meedInvested = ta3meedActiveMine.reduce((total, row) => total + row.mine.invested, 0);
    const ta3meedProfit = ta3meedActiveMine.reduce((total, row) => total + row.mine.profit, 0);
    const moneyMoonInvested = moneyMoonActive.reduce((total, item) => total + asNumber(item.principal_amount), 0);
    const moneyMoonProfit = moneyMoonActive.reduce((total, item) => total + getMoneyMoonProfit(item), 0);
    return {
      totalWealth: ta3meedInvested + moneyMoonInvested,
      totalProfit: ta3meedProfit + moneyMoonProfit,
      ta3meedInvested,
      ta3meedProfit,
      moneyMoonInvested,
      moneyMoonProfit,
      ta3meedCount: ta3meedActiveMine.length,
      moneyMoonCount: moneyMoonActive.length,
      totalCount: ta3meedActiveMine.length + moneyMoonActive.length,
      overdueCount,
    };
  }, [ta3meedActiveMine, moneyMoonActive, overdueCount]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <Text style={styles.badge}>💎 ثروتي</Text>
          <Text style={styles.title}>ملخص ممتلكاتي</Text>
          <Text style={styles.subtitle}>بطاقات إحصائية فقط لحصتي في تعميد وممتلكاتي في موني مون.</Text>
        </View>

        {loading ? (
          <View style={styles.statusCard}>
            <ActivityIndicator />
            <Text style={styles.statusText}>جاري تحميل ممتلكاتي...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.statusCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.84}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <SummaryCard icon="💰" label="إجمالي ثروتي النشطة" value={money(totals.totalWealth)} featured />
          <SummaryCard icon="📈" label="أرباحي المتوقعة" value={money(totals.totalProfit)} />
          <SummaryCard icon="🏦" label="حصتي في تعميد" value={money(totals.ta3meedInvested)} />
          <SummaryCard icon="💵" label="ربحي من تعميد" value={money(totals.ta3meedProfit)} />
          <SummaryCard icon="🌙" label="موني مون" value={money(totals.moneyMoonInvested)} />
          <SummaryCard icon="✨" label="ربح موني مون" value={money(totals.moneyMoonProfit)} />
          <SummaryCard icon="🧾" label="عدد استثماراتي النشطة" value={`${totals.totalCount}`} />
          <SummaryCard icon="⚠️" label="استثمارات متأخرة" value={`${totals.overdueCount}`} danger={totals.overdueCount > 0} />
        </View>

        <View style={styles.platformCardsRow}>
          <PlatformSummary icon="🏦" title="تعميد" amount={money(totals.ta3meedInvested)} profit={money(totals.ta3meedProfit)} count={totals.ta3meedCount} />
          <PlatformSummary icon="🌙" title="موني مون" amount={money(totals.moneyMoonInvested)} profit={money(totals.moneyMoonProfit)} count={totals.moneyMoonCount} />
        </View>

        <TouchableOpacity style={styles.openInvestmentsButton} onPress={openInvestments} activeOpacity={0.84}>
          <Text style={styles.openInvestmentsText}>فتح منصات الاستثمار</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value, featured, danger }) {
  return (
    <View style={[styles.summaryCard, featured && styles.featuredSummary, danger && styles.dangerSummary]}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <Text style={[styles.summaryValue, featured && styles.featuredValue, danger && styles.dangerValue]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.summaryLabel, featured && styles.featuredLabel, danger && styles.dangerLabel]}>{label}</Text>
    </View>
  );
}

function PlatformSummary({ icon, title, amount, profit, count }) {
  return (
    <View style={styles.platformSummaryCard}>
      <View style={styles.platformTopRow}>
        <View style={styles.platformIcon}><Text style={styles.platformIconText}>{icon}</Text></View>
        <View style={styles.platformTitleBlock}>
          <Text style={styles.platformTitle}>{title}</Text>
          <Text style={styles.platformCount}>{count} استثمار نشط</Text>
        </View>
      </View>
      <View style={styles.platformMiniGrid}>
        <View style={styles.miniBox}>
          <Text style={styles.miniValue}>{amount}</Text>
          <Text style={styles.miniLabel}>المبلغ</Text>
        </View>
        <View style={styles.miniBox}>
          <Text style={styles.miniValue}>{profit}</Text>
          <Text style={styles.miniLabel}>الربح</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 34 },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, overflow: 'hidden' },
  headerGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 999, backgroundColor: '#14b8a6', opacity: 0.18, top: -70, left: -50 },
  badge: { alignSelf: 'flex-start', color: '#ccfbf1', backgroundColor: 'rgba(20,184,166,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  title: { marginTop: 16, color: '#ffffff', fontSize: 32, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  statusCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  statusText: { marginTop: 8, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  errorText: { color: '#b91c1c', fontWeight: '900', textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '900' },
  summaryGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  featuredSummary: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  dangerSummary: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  summaryIcon: { fontSize: 24, marginBottom: 10 },
  summaryValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  featuredValue: { color: '#ffffff' },
  featuredLabel: { color: '#ccfbf1' },
  dangerValue: { color: '#c2410c' },
  dangerLabel: { color: '#c2410c' },
  platformCardsRow: { marginTop: 16, gap: 10 },
  platformSummaryCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  platformTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  platformIcon: { width: 52, height: 52, borderRadius: 20, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  platformIconText: { fontSize: 25 },
  platformTitleBlock: { flex: 1, alignItems: 'flex-end' },
  platformTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  platformCount: { marginTop: 4, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  platformMiniGrid: { marginTop: 13, flexDirection: 'row-reverse', gap: 8 },
  miniBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 17, padding: 11, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'flex-end' },
  miniValue: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  miniLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  openInvestmentsButton: { marginTop: 8, backgroundColor: '#0f172a', borderRadius: 20, paddingVertical: 15, alignItems: 'center' },
  openInvestmentsText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
});
