import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const DEFAULT_ANNUAL_RATE = 10.5;
const PRINCIPAL_RETURN_MONTHS = 24;

const parseAmount = (value) => {
  const normalized = String(value ?? '')
    .replace(/,/g, '')
    .replace(/٫/g, '.')
    .replace(/[^0-9.]/g, '');
  const number = Number(normalized || 0);
  return Number.isFinite(number) ? number : 0;
};

const cleanInput = (value) =>
  String(value ?? '')
    .replace(/,/g, '')
    .replace(/٫/g, '.')
    .replace(/[^0-9.]/g, '');

const money = (value) =>
  `${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;

export default function SulfaInvestmentScreen({ onBack }) {
  const [amount, setAmount] = useState('');
  const [annualRate, setAnnualRate] = useState(DEFAULT_ANNUAL_RATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const investedAmount = useMemo(() => parseAmount(amount), [amount]);
  const annualProfit = useMemo(
    () => investedAmount * (Number(annualRate || DEFAULT_ANNUAL_RATE) / 100),
    [investedAmount, annualRate]
  );
  const monthlyProfit = useMemo(() => annualProfit / 12, [annualProfit]);
  const monthlyPrincipalReturn = useMemo(
    () => investedAmount / PRINCIPAL_RETURN_MONTHS,
    [investedAmount]
  );

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/sulfa/investment`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل استثمار سلفة');

      const data = json.data || {};
      setAmount(String(Number(data.invested_amount || 0)));
      setAnnualRate(Number(data.annual_rate || DEFAULT_ANNUAL_RATE));
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل استثمار سلفة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (investedAmount < 0) return;

    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/sulfa/investment`, {
        method: 'PUT',
        headers: ahmedUserHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ invested_amount: investedAmount }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ مبلغ الاستثمار');

      const data = json.data || {};
      setAmount(String(Number(data.invested_amount || investedAmount)));
      setAnnualRate(Number(data.annual_rate || DEFAULT_ANNUAL_RATE));
      setMessage('تم حفظ مبلغ استثمار سلفة');
    } catch (error) {
      setMessage(error.message || 'تعذر حفظ مبلغ الاستثمار');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>#S-142 استثمار سلفة</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#7c3aed" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <UiIcon name="sulfa" size={18} color="#ddd6fe" />
            <Text style={styles.heroBadgeText}>سلفة</Text>
          </View>
          <Text style={styles.heroTitle}>استثمار سلفة</Text>
          <Text style={styles.heroText}>سجل المبلغ المستثمر، ويحسب التطبيق الربح الشهري تلقائيًا على عائد سنوي 10.5%، واسترجاع رأس المال على 24 شهرًا.</Text>
        </View>

        {loading ? <ActivityIndicator color="#7c3aed" style={styles.loader} /> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>المبلغ المستثمر</Text>
            <Text style={styles.statValue}>{money(investedAmount)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>الربح السنوي</Text>
            <Text style={styles.statValue}>{Number(annualRate || DEFAULT_ANNUAL_RATE).toFixed(1)}%</Text>
          </View>
          <View style={[styles.statCard, styles.monthlyCard]}>
            <Text style={styles.statLabel}>الربح الشهري</Text>
            <Text style={styles.monthlyValue}>{money(monthlyProfit)}</Text>
            <Text style={styles.formula}>المبلغ المستثمر × 10.5% ÷ 12</Text>
          </View>
          <View style={[styles.statCard, styles.principalCard]}>
            <Text style={styles.statLabel}>استرجاع القسط الشهري</Text>
            <Text style={styles.principalValue}>{money(monthlyPrincipalReturn)}</Text>
            <Text style={styles.principalFormula}>المبلغ المستثمر ÷ 24</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>تسجيل المبلغ المستثمر</Text>
          <Text style={styles.inputLabel}>المبلغ المستثمر في سلفة</Text>
          <TextInput
            value={amount}
            onChangeText={(value) => setAmount(cleanInput(value))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            textAlign="right"
          />

          <View style={styles.previewRow}>
            <Text style={styles.previewValue}>{money(monthlyProfit)}</Text>
            <Text style={styles.previewLabel}>الربح الشهري المتوقع</Text>
          </View>
          <View style={[styles.previewRow, styles.previewPrincipalRow]}>
            <Text style={[styles.previewValue, styles.previewPrincipalValue]}>{money(monthlyPrincipalReturn)}</Text>
            <Text style={[styles.previewLabel, styles.previewPrincipalLabel]}>استرجاع القسط الشهري</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UiIcon name="save" size={20} color="#fff" />
                <Text style={styles.saveText}>حفظ المبلغ</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  backButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, paddingHorizontal: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  content: { padding: 18, paddingTop: 4, paddingBottom: 38 },
  hero: { backgroundColor: '#0f172a', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: 'rgba(124,58,237,0.18)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  heroBadgeText: { color: '#ddd6fe', fontWeight: '900' },
  heroTitle: { marginTop: 16, color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'right' },
  heroText: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, fontWeight: '700', textAlign: 'right' },
  loader: { marginTop: 14 },
  message: { marginTop: 14, color: '#5b21b6', backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 18, padding: 13, fontWeight: '900', textAlign: 'center', overflow: 'hidden' },
  statsGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  monthlyCard: { flexBasis: '100%', backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  principalCard: { flexBasis: '100%', backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  statLabel: { color: '#64748b', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  statValue: { marginTop: 6, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  monthlyValue: { marginTop: 6, color: '#6d28d9', fontSize: 31, fontWeight: '900', textAlign: 'right' },
  formula: { marginTop: 5, color: '#6d28d9', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  principalValue: { marginTop: 6, color: '#0e7490', fontSize: 31, fontWeight: '900', textAlign: 'right' },
  principalFormula: { marginTop: 5, color: '#0e7490', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  formCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 26, padding: 17, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  inputLabel: { marginTop: 14, marginBottom: 7, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { minHeight: 54, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 17, paddingHorizontal: 14, color: '#0f172a', fontSize: 18, fontWeight: '900' },
  previewRow: { marginTop: 12, backgroundColor: '#faf5ff', borderRadius: 17, borderWidth: 1, borderColor: '#e9d5ff', padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  previewLabel: { color: '#6b21a8', fontWeight: '900', textAlign: 'right' },
  previewValue: { color: '#6d28d9', fontWeight: '900', fontSize: 17, textAlign: 'left' },
  previewPrincipalRow: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  previewPrincipalLabel: { color: '#0e7490' },
  previewPrincipalValue: { color: '#0e7490' },
  saveButton: { marginTop: 14, minHeight: 54, borderRadius: 17, backgroundColor: '#7c3aed', flexDirection: 'row-reverse', gap: 8, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.7 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
