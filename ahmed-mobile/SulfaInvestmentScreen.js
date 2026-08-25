import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  const [draftAmount, setDraftAmount] = useState('');
  const [annualRate, setAnnualRate] = useState(DEFAULT_ANNUAL_RATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [message, setMessage] = useState('');

  const investedAmount = useMemo(() => parseAmount(amount), [amount]);
  const draftInvestedAmount = useMemo(() => parseAmount(draftAmount), [draftAmount]);

  const annualProfit = useMemo(
    () => investedAmount * (Number(annualRate || DEFAULT_ANNUAL_RATE) / 100),
    [investedAmount, annualRate]
  );
  const monthlyProfit = useMemo(() => annualProfit / 12, [annualProfit]);
  const monthlyPrincipalReturn = useMemo(
    () => investedAmount / PRINCIPAL_RETURN_MONTHS,
    [investedAmount]
  );

  const draftAnnualProfit = useMemo(
    () => draftInvestedAmount * (Number(annualRate || DEFAULT_ANNUAL_RATE) / 100),
    [draftInvestedAmount, annualRate]
  );
  const draftMonthlyProfit = useMemo(() => draftAnnualProfit / 12, [draftAnnualProfit]);
  const draftMonthlyPrincipalReturn = useMemo(
    () => draftInvestedAmount / PRINCIPAL_RETURN_MONTHS,
    [draftInvestedAmount]
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

  const openEdit = () => {
    setDraftAmount(amount);
    setMessage('');
    setEditVisible(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditVisible(false);
  };

  const save = async () => {
    const nextInvestedAmount = parseAmount(draftAmount);
    if (nextInvestedAmount < 0) return;

    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/sulfa/investment`, {
        method: 'PUT',
        headers: ahmedUserHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ invested_amount: nextInvestedAmount }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ مبلغ الاستثمار');

      const data = json.data || {};
      setAmount(String(Number(data.invested_amount ?? nextInvestedAmount)));
      setAnnualRate(Number(data.annual_rate || DEFAULT_ANNUAL_RATE));
      setEditVisible(false);
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

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.editButton}
          onPress={openEdit}
          disabled={loading}
        >
          <UiIcon name="edit" size={21} color="#fff" />
          <Text style={styles.editButtonText}>تعديل المبلغ المستثمر</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeEdit}
      >
        <View style={styles.modalRoot}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoider}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeEdit}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <UiIcon name="close" size={23} color="#475569" />
                  </TouchableOpacity>
                  <View style={styles.modalTitleWrap}>
                    <Text style={styles.modalTitle}>تعديل المبلغ المستثمر</Text>
                    <Text style={styles.modalSubtitle}>أدخل المبلغ الجديد ثم احفظ التعديل</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>المبلغ المستثمر في سلفة</Text>
                <TextInput
                  autoFocus
                  value={draftAmount}
                  onChangeText={(value) => setDraftAmount(cleanInput(value))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  textAlign="right"
                  selectTextOnFocus
                  returnKeyType="done"
                />

                <View style={styles.previewRow}>
                  <Text style={styles.previewValue}>{money(draftMonthlyProfit)}</Text>
                  <Text style={styles.previewLabel}>الربح الشهري المتوقع</Text>
                </View>
                <View style={[styles.previewRow, styles.previewPrincipalRow]}>
                  <Text style={[styles.previewValue, styles.previewPrincipalValue]}>{money(draftMonthlyPrincipalReturn)}</Text>
                  <Text style={[styles.previewLabel, styles.previewPrincipalLabel]}>استرجاع القسط الشهري</Text>
                </View>

                {!!message ? <Text style={styles.modalMessage}>{message}</Text> : null}

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
                      <Text style={styles.saveText}>حفظ التعديل</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  editButton: { marginTop: 14, minHeight: 56, borderRadius: 18, backgroundColor: '#7c3aed', flexDirection: 'row-reverse', gap: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)' },
  keyboardAvoider: { flex: 1 },
  modalScroll: { flex: 1 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 28 },
  modalCard: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 28, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  closeButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  modalTitleWrap: { flex: 1, alignItems: 'flex-end' },
  modalTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  modalSubtitle: { marginTop: 4, color: '#64748b', fontSize: 13, fontWeight: '700', textAlign: 'right' },
  inputLabel: { marginTop: 18, marginBottom: 7, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { minHeight: 58, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 18, paddingHorizontal: 14, color: '#0f172a', fontSize: 20, fontWeight: '900' },
  previewRow: { marginTop: 12, backgroundColor: '#faf5ff', borderRadius: 17, borderWidth: 1, borderColor: '#e9d5ff', padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  previewLabel: { color: '#6b21a8', fontWeight: '900', textAlign: 'right', flexShrink: 1 },
  previewValue: { color: '#6d28d9', fontWeight: '900', fontSize: 17, textAlign: 'left' },
  previewPrincipalRow: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  previewPrincipalLabel: { color: '#0e7490' },
  previewPrincipalValue: { color: '#0e7490' },
  modalMessage: { marginTop: 12, color: '#b91c1c', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 10, fontWeight: '800', textAlign: 'center' },
  saveButton: { marginTop: 14, minHeight: 56, borderRadius: 18, backgroundColor: '#7c3aed', flexDirection: 'row-reverse', gap: 8, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.7 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
