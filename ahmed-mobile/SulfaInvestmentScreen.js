import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
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
const ANDROID_STATUS_BAR_INSET =
  Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight || 0, 24) : 0;

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
  const monthlyCashFlow = useMemo(
    () => monthlyProfit + monthlyPrincipalReturn,
    [monthlyProfit, monthlyPrincipalReturn]
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
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.78}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <UiIcon name="back" size={23} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle} numberOfLines={1}>استثمار سلفة</Text>
          <Text style={styles.screenId}>#S-142</Text>
        </View>
        <View style={styles.headerIcon}>
          <UiIcon name="sulfa" size={21} color="#6d28d9" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#7c3aed" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <UiIcon name="sulfa" size={17} color="#ddd6fe" />
              <Text style={styles.heroBadgeText}>محفظة سلفة</Text>
            </View>
            <View style={styles.fixedReturnPill}>
              <View style={styles.fixedReturnDot} />
              <Text style={styles.fixedReturnText}>عائد ثابت</Text>
            </View>
          </View>
          <Text style={styles.heroLabel}>إجمالي المبلغ المستثمر</Text>
          <Text
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {money(investedAmount)}
          </Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>
                {Number(annualRate || DEFAULT_ANNUAL_RATE).toFixed(1)}%
              </Text>
              <Text style={styles.heroMetaLabel}>العائد السنوي</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>{PRINCIPAL_RETURN_MONTHS} شهرًا</Text>
              <Text style={styles.heroMetaLabel}>مدة استرداد رأس المال</Text>
            </View>
          </View>
        </View>

        {loading ? <ActivityIndicator color="#7c3aed" style={styles.loader} /> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ملخص العائد الشهري</Text>
          <Text style={styles.sectionSubtitle}>يُحتسب تلقائيًا حسب المبلغ المستثمر</Text>
        </View>

        <View style={styles.returnsCard}>
          <View style={styles.returnRow}>
            <View style={[styles.returnIcon, styles.profitIcon]}>
              <UiIcon name="investments" size={21} color="#6d28d9" />
            </View>
            <View style={styles.returnCopy}>
              <Text style={styles.returnLabel}>الربح الشهري</Text>
              <Text style={styles.returnFormula}>
                المبلغ × {Number(annualRate || DEFAULT_ANNUAL_RATE).toFixed(1)}% ÷ 12
              </Text>
            </View>
            <Text
              style={[styles.returnValue, styles.profitValue]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {money(monthlyProfit)}
            </Text>
          </View>
          <View style={styles.returnDivider} />
          <View style={styles.returnRow}>
            <View style={[styles.returnIcon, styles.principalIcon]}>
              <UiIcon name="wallet" size={21} color="#0e7490" />
            </View>
            <View style={styles.returnCopy}>
              <Text style={styles.returnLabel}>استرداد رأس المال</Text>
              <Text style={styles.returnFormula}>المبلغ المستثمر ÷ {PRINCIPAL_RETURN_MONTHS}</Text>
            </View>
            <Text
              style={[styles.returnValue, styles.principalValue]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {money(monthlyPrincipalReturn)}
            </Text>
          </View>
        </View>

        <View style={styles.cashFlowCard}>
          <View style={styles.cashFlowIcon}>
            <UiIcon name="money" size={23} color="#fff" />
          </View>
          <View style={styles.cashFlowCopy}>
            <Text style={styles.cashFlowLabel}>إجمالي التدفق الشهري</Text>
            <Text style={styles.cashFlowHint}>الربح الشهري + استرداد رأس المال</Text>
          </View>
          <Text
            style={styles.cashFlowValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {money(monthlyCashFlow)}
          </Text>
        </View>

        <View style={styles.noteCard}>
          <View style={styles.noteIcon}>
            <UiIcon name="stats" size={19} color="#475569" />
          </View>
          <Text style={styles.noteText}>
            القيم تقديرية وتُحدّث فور تعديل مبلغ الاستثمار.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.86}
          style={[styles.editButton, loading && styles.disabledButton]}
          onPress={openEdit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="تعديل المبلغ المستثمر"
        >
          <UiIcon name="edit" size={20} color="#fff" />
          <Text style={styles.editButtonText}>تعديل المبلغ المستثمر</Text>
        </TouchableOpacity>
      </View>

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
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: ANDROID_STATUS_BAR_INSET + 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  topTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  screenId: { marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 20 },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(124,58,237,0.22)',
    top: -104,
    right: -58,
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(14,165,233,0.12)',
    bottom: -68,
    left: -34,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(124,58,237,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: { color: '#ede9fe', fontSize: 12, fontWeight: '900' },
  fixedReturnPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fixedReturnDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  fixedReturnText: { color: '#d1fae5', fontSize: 11, fontWeight: '800' },
  heroLabel: { marginTop: 24, color: '#94a3b8', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  heroAmount: {
    marginTop: 5,
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  heroMetaRow: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.11)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  heroMetaItem: { flex: 1, alignItems: 'center' },
  heroMetaValue: { color: '#f8fafc', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  heroMetaLabel: { marginTop: 3, color: '#94a3b8', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  heroMetaDivider: { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.12)' },
  loader: { marginTop: 14 },
  message: {
    marginTop: 14,
    color: '#5b21b6',
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 16,
    padding: 12,
    fontWeight: '900',
    textAlign: 'center',
    overflow: 'hidden',
  },
  sectionHeader: { marginTop: 24, marginBottom: 10, alignItems: 'flex-end' },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  sectionSubtitle: { marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  returnsCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  returnRow: { minHeight: 88, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  returnIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  profitIcon: { backgroundColor: '#f3e8ff' },
  principalIcon: { backgroundColor: '#cffafe' },
  returnCopy: { flex: 1, alignItems: 'flex-end' },
  returnLabel: { color: '#1e293b', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  returnFormula: { marginTop: 4, color: '#94a3b8', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  returnValue: {
    maxWidth: 118,
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  profitValue: { color: '#6d28d9' },
  principalValue: { color: '#0e7490' },
  returnDivider: { height: 1, marginHorizontal: 14, backgroundColor: '#eef2f7' },
  cashFlowCard: {
    marginTop: 12,
    minHeight: 92,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  cashFlowIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  cashFlowCopy: { flex: 1, alignItems: 'flex-end' },
  cashFlowLabel: { color: '#065f46', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  cashFlowHint: { marginTop: 4, color: '#047857', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  cashFlowValue: {
    maxWidth: 120,
    color: '#047857',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  noteCard: {
    marginTop: 12,
    padding: 13,
    borderRadius: 17,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  noteIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  noteText: { flex: 1, color: '#64748b', fontSize: 11, fontWeight: '700', lineHeight: 18, textAlign: 'right' },
  footer: {
    backgroundColor: '#f6f7fb',
    borderTopWidth: 1,
    borderTopColor: '#e8edf3',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 18 : 8,
  },
  editButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    flexDirection: 'row-reverse',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 13,
    elevation: 5,
  },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)' },
  keyboardAvoider: { flex: 1 },
  modalScroll: { flex: 1 },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: ANDROID_STATUS_BAR_INSET + 24,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 12,
  },
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
