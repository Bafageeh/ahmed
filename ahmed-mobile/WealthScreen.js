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
  const percent = asNumber(item?.principal_amount) > 0 ? (invested / asNumber(item.principal_amount)) * 100 : 0;

  return {
    allocations: mine,
    invested,
    profit,
    percent,
  };
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
    };
  }, [ta3meedActiveMine, moneyMoonActive]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <Text style={styles.badge}>💎 ثروتي</Text>
          <Text style={styles.title}>ممتلكاتي الاستثمارية</Text>
          <Text style={styles.subtitle}>تعرض حصتي الخاصة فقط في تعميد، وكل ممتلكاتي في موني مون.</Text>
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
          <SummaryCard icon="🌙" label="موني مون" value={money(totals.moneyMoonInvested)} />
        </View>

        <SectionTitle title="أملاكي الخاصة في تعميد" count={ta3meedActiveMine.length} />
        {ta3meedActiveMine.length === 0 ? (
          <EmptyBox text="لا توجد حصة خاصة باسم أحمد في تعميد حاليًا." />
        ) : ta3meedActiveMine.map(({ item, mine }) => (
          <Ta3meedMineCard key={String(item.id)} item={item} mine={mine} />
        ))}

        <SectionTitle title="أملاكي في موني مون" count={moneyMoonActive.length} />
        {moneyMoonActive.length === 0 ? (
          <EmptyBox text="لا توجد استثمارات نشطة في موني مون حاليًا." />
        ) : moneyMoonActive.map((item) => (
          <MoneyMoonAssetCard key={String(item.id)} item={item} />
        ))}

        <TouchableOpacity style={styles.openInvestmentsButton} onPress={openInvestments} activeOpacity={0.84}>
          <Text style={styles.openInvestmentsText}>فتح منصات الاستثمار</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value, featured }) {
  return (
    <View style={[styles.summaryCard, featured && styles.featuredSummary]}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <Text style={[styles.summaryValue, featured && styles.featuredValue]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.summaryLabel, featured && styles.featuredLabel]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, count }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function Ta3meedMineCard({ item, mine }) {
  const meta = readMeta(item.metadata);
  const overdue = isOverdue(item);
  return (
    <View style={[styles.assetCard, overdue && styles.overdueCard]}>
      <View style={styles.assetTopRow}>
        <View style={styles.assetIcon}><Text style={styles.assetIconText}>🏦</Text></View>
        <View style={styles.assetTitleBlock}>
          <Text style={styles.assetTitle}>{item.reference_number || 'فرصة تعميد'}</Text>
          <Text style={styles.assetSubtitle}>نسبتي: {mine.percent.toFixed(2)}% · يستحق {item.maturity_date || '-'}</Text>
        </View>
      </View>
      <View style={styles.assetStatsRow}>
        <MiniStat label="حصتي" value={money(mine.invested)} />
        <MiniStat label="ربحي" value={money(mine.profit)} />
        <MiniStat label="التصنيف" value={meta.category || '-'} />
      </View>
      {overdue ? <Text style={styles.overdueText}>متأخر</Text> : null}
    </View>
  );
}

function MoneyMoonAssetCard({ item }) {
  const meta = readMeta(item.metadata);
  const overdue = isOverdue(item);
  return (
    <View style={[styles.assetCard, overdue && styles.overdueCard]}>
      <View style={styles.assetTopRow}>
        <View style={styles.assetIcon}><Text style={styles.assetIconText}>🌙</Text></View>
        <View style={styles.assetTitleBlock}>
          <Text style={styles.assetTitle}>{meta.order_no || meta.external_order_no || item.reference_number || item.title || 'موني مون'}</Text>
          <Text style={styles.assetSubtitle}>يستحق {item.maturity_date || '-'}</Text>
        </View>
      </View>
      <View style={styles.assetStatsRow}>
        <MiniStat label="المبلغ" value={money(item.principal_amount)} />
        <MiniStat label="الربح" value={money(getMoneyMoonProfit(item))} />
        <MiniStat label="الفئة" value={meta.category || '-'} />
      </View>
      {overdue ? <Text style={styles.overdueText}>متأخر</Text> : null}
    </View>
  );
}

function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function EmptyBox({ text }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>◇</Text>
      <Text style={styles.emptyText}>{text}</Text>
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
  summaryIcon: { fontSize: 24, marginBottom: 10 },
  summaryValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  featuredValue: { color: '#ffffff' },
  featuredLabel: { color: '#ccfbf1' },
  sectionHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  sectionCount: { color: '#0f766e', backgroundColor: '#ccfbf1', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  assetCard: { marginBottom: 10, backgroundColor: '#ffffff', borderRadius: 24, padding: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  overdueCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  assetTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  assetIcon: { width: 54, height: 54, borderRadius: 21, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  assetIconText: { fontSize: 26 },
  assetTitleBlock: { flex: 1, alignItems: 'flex-end' },
  assetTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  assetSubtitle: { marginTop: 5, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  assetStatsRow: { marginTop: 13, flexDirection: 'row-reverse', gap: 8 },
  miniStat: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 17, padding: 11, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'flex-end' },
  miniValue: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  miniLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  overdueText: { marginTop: 10, alignSelf: 'flex-end', color: '#c2410c', backgroundColor: '#ffedd5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden', fontWeight: '900' },
  emptyBox: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyIcon: { color: '#94a3b8', fontSize: 30, fontWeight: '900' },
  emptyText: { marginTop: 8, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  openInvestmentsButton: { marginTop: 18, backgroundColor: '#0f172a', borderRadius: 20, paddingVertical: 15, alignItems: 'center' },
  openInvestmentsText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
});
