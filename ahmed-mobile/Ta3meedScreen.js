import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

function asNumber(value) {
  return Number(value || 0);
}

function readMeta(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch (error) {
    return {};
  }
}

export default function Ta3meedScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');

  const totalInvested = useMemo(
    () => items.reduce((sum, item) => sum + asNumber(item.principal_amount), 0),
    [items]
  );

  const totalProfit = useMemo(
    () => items.reduce((sum, item) => sum + asNumber(item.expected_profit_amount), 0),
    [items]
  );

  const loadData = async () => {
    setMessage('جاري تحميل تعميد...');
    try {
      const investmentsResponse = await fetch(`${API_URL}/ta3meed/investments`);
      const investmentsJson = await investmentsResponse.json();
      setItems(Array.isArray(investmentsJson.data) ? investmentsJson.data : []);

      const summaryResponse = await fetch(`${API_URL}/ta3meed/summary`);
      const summaryJson = await summaryResponse.json();
      setSummary(summaryJson.data || null);
      setMessage('');
    } catch (error) {
      setMessage('تعذر تحميل بيانات تعميد');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.badge}>تعميد</Text>
          <Text style={styles.title}>استثمارات تعميد</Text>
          <Text style={styles.subtitle}>الفرص النشطة المدخلة من ملف تعميد مع توزيع المستثمرين.</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.big}>{summary?.active_count ?? items.length}</Text>
            <Text style={styles.label}>فرص نشطة</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.big}>{totalInvested.toFixed(2)}</Text>
            <Text style={styles.label}>إجمالي الاستثمار</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.big}>{totalProfit.toFixed(2)}</Text>
            <Text style={styles.label}>الربح المتوقع</Text>
          </View>
          <TouchableOpacity style={styles.refreshBox} onPress={loadData}>
            <Text style={styles.refreshText}>تحديث</Text>
          </TouchableOpacity>
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}

        {summary?.investors?.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ملخص المستثمرين</Text>
            {summary.investors.map((investor) => (
              <View key={investor.name} style={styles.investorRow}>
                <Text style={styles.investorName}>{investor.name}</Text>
                <Text style={styles.investorText}>استثمار: {asNumber(investor.invested).toFixed(2)} ر.س</Text>
                <Text style={styles.investorText}>ربح: {asNumber(investor.profit).toFixed(2)} ر.س</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>فرص تعميد</Text>
        {items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>لا توجد بيانات</Text>
            <Text style={styles.cardText}>تأكد من تشغيل migrations وإدخال بيانات تعميد.</Text>
          </View>
        ) : (
          items.map((item) => <Ta3meedCard key={String(item.id)} item={item} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Ta3meedCard({ item }) {
  const meta = readMeta(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const overdue = meta.is_overdue || asNumber(meta.remaining_days) < 0;

  return (
    <View style={[styles.card, overdue && styles.overdueCard]}>
      <Text style={[styles.cardTitle, overdue && styles.overdueText]}>{item.reference_number}</Text>
      {overdue ? <Text style={styles.overdueBadge}>متأخر حسب بيانات الإكسل</Text> : null}
      <Text style={styles.cardText}>التصنيف: {meta.category || '-'}</Text>
      <Text style={styles.cardText}>المبلغ: {asNumber(item.principal_amount).toFixed(2)} ر.س</Text>
      <Text style={styles.cardText}>نسبة الربح: {asNumber(item.expected_rate).toFixed(3)}%</Text>
      <Text style={styles.cardText}>الربح: {asNumber(item.expected_profit_amount).toFixed(2)} ر.س</Text>
      <Text style={styles.cardText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
      <Text style={styles.cardText}>تاريخ الاستحقاق: {item.maturity_date || '-'}</Text>
      <Text style={styles.cardText}>مسترد: {asNumber(meta.returned_amount).toFixed(2)} ر.س</Text>
      <Text style={styles.cardText}>متبقي: {meta.remaining_days ?? '-'} يوم</Text>

      {allocations.length ? (
        <View style={styles.allocBox}>
          <Text style={styles.allocTitle}>توزيع المستثمرين</Text>
          {allocations.map((allocation) => (
            <Text key={allocation.id} style={styles.allocText}>
              {allocation.investor_name}: {asNumber(allocation.invested_amount).toFixed(2)} ر.س / ربح {asNumber(allocation.expected_profit_amount).toFixed(2)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 16, fontSize: 34, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 16, textAlign: 'right', lineHeight: 25 },
  row: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 },
  box: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  big: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  label: { marginTop: 5, color: '#64748b', textAlign: 'right' },
  refreshBox: { flex: 1, backgroundColor: '#0f172a', borderRadius: 20, padding: 18, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#fff', fontWeight: '900' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  cardText: { marginTop: 6, color: '#64748b', textAlign: 'right' },
  allocBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12 },
  allocTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  allocText: { color: '#475569', textAlign: 'right', marginTop: 4 },
  investorRow: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 10 },
  investorName: { color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  investorText: { color: '#64748b', textAlign: 'right', marginTop: 4 },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '800' },
  overdueCard: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  overdueText: { color: '#b91c1c' },
  overdueBadge: { marginTop: 8, color: '#991b1b', backgroundColor: '#fee2e2', borderRadius: 12, padding: 8, textAlign: 'right', fontWeight: '900' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
});
