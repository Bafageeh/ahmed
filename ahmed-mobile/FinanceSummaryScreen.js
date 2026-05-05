import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const money = (value, currency = 'SAR') => `${Number(value || 0).toFixed(2)} ${currency === 'SAR' ? 'ر.س' : currency}`;

export default function FinanceSummaryScreen({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/income/linked/finance/summary`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error('finance');
      setData(json.data || null);
    } catch (e) {
      setData(null);
      setError('تعذر جلب بيانات Finance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = Array.isArray(data?.metrics) ? data.metrics.filter((m) => m.visible !== false) : [];
  const currency = data?.currency || 'SAR';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.badge}>Finance</Text>
          <Text style={styles.title}>قيم Finance</Text>
          <Text style={styles.subtitle}>القيم مستوردة من Finance لحساب أحمد admin@pm.sa ولا يتم حسابها داخل أحمد.</Text>
        </View>
        {loading ? <View style={styles.card}><ActivityIndicator /><Text style={styles.centerText}>جاري جلب بيانات Finance...</Text></View> : null}
        {!loading && error ? <View style={styles.card}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.button} onPress={load}><Text style={styles.buttonText}>إعادة المحاولة</Text></TouchableOpacity></View> : null}
        {!loading && data ? <View style={styles.card}><Text style={styles.label}>آخر تحديث</Text><Text style={styles.text}>{data.synced_at || '-'}</Text></View> : null}
        {!loading && metrics.map((metric) => (
          <View key={metric.key} style={[styles.card, metric.key === 'ahmed_net_profit_after_stuck_deduction' && styles.featureCard]}>
            <Text style={styles.value}>{money(metric.amount, metric.currency || currency)}</Text>
            <Text style={styles.label}>{metric.title}</Text>
            {metric.description ? <Text style={styles.text}>{metric.description}</Text> : null}
            <Text style={styles.type}>{metric.type}</Text>
            {Array.isArray(metric.details) ? metric.details.map((detail) => (
              <Text key={detail.path} style={styles.detail}>{detail.title}: {money(detail.amount, detail.currency || currency)}</Text>
            )) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#e2e8f0' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 14, color: '#0f172a', fontSize: 30, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', lineHeight: 22, textAlign: 'right' },
  card: { marginTop: 12, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  featureCard: { backgroundColor: '#f8fbff', borderColor: '#bfdbfe' },
  value: { color: '#075985', fontSize: 24, fontWeight: '900', textAlign: 'right' },
  label: { marginTop: 6, color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  text: { marginTop: 6, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  type: { marginTop: 6, color: '#64748b', textAlign: 'right', fontSize: 12, fontWeight: '800' },
  detail: { marginTop: 7, color: '#0f172a', textAlign: 'right', fontWeight: '800' },
  centerText: { marginTop: 8, color: '#64748b', textAlign: 'center' },
  errorText: { color: '#b91c1c', textAlign: 'right', fontWeight: '900' },
  button: { marginTop: 14, backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '900' },
});
