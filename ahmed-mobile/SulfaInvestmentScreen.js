import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
const PRINCIPAL_RETURN_MONTHS = 24;

const parseNumber = (value) => {
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

const emptySummary = {
  active_count: 0,
  invested_amount: 0,
  total_expected_profit: 0,
  monthly_profit: 0,
  weighted_annual_rate: 0,
  monthly_principal_return: 0,
};

export default function SulfaInvestmentScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedProfit, setExpectedProfit] = useState('');
  const [durationMonths, setDurationMonths] = useState('24');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const formAmount = useMemo(() => parseNumber(amount), [amount]);
  const formProfit = useMemo(() => parseNumber(expectedProfit), [expectedProfit]);
  const formMonths = useMemo(() => Math.max(1, Math.round(parseNumber(durationMonths) || 0)), [durationMonths]);
  const formMonthlyProfit = useMemo(() => formProfit / formMonths, [formProfit, formMonths]);
  const formAnnualizedRate = useMemo(
    () => (formAmount > 0 ? ((formMonthlyProfit * 12) / formAmount) * 100 : 0),
    [formAmount, formMonthlyProfit]
  );

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setAmount('');
    setExpectedProfit('');
    setDurationMonths('24');
    setNotes('');
    setIsActive(true);
  };

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/sulfa/investments`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل استثمارات سلفة');

      setItems(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary || emptySummary);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل استثمارات سلفة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (formAmount <= 0) return setMessage('أدخل المبلغ المستثمر.');
    if (formProfit < 0) return setMessage('أدخل إجمالي الربح المتوقع.');
    if (formMonths < 1) return setMessage('أدخل مدة الاستثمار بالأشهر.');

    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(
        editingId ? `${API_URL}/sulfa/investments/${editingId}` : `${API_URL}/sulfa/investments`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: ahmedUserHeaders({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            label: String(label || '').trim() || null,
            invested_amount: formAmount,
            expected_profit: formProfit,
            duration_months: formMonths,
            is_active: isActive,
            notes: String(notes || '').trim() || null,
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ الاستثمار');

      setMessage(editingId ? 'تم تعديل الاستثمار.' : 'تمت إضافة الاستثمار.');
      resetForm();
      await load();
    } catch (error) {
      setMessage(error.message || 'تعذر حفظ الاستثمار');
    } finally {
      setSaving(false);
    }
  };

  const editItem = (item) => {
    setEditingId(item.id);
    setLabel(item.label || '');
    setAmount(String(Number(item.invested_amount || 0)));
    setExpectedProfit(String(Number(item.expected_profit || 0)));
    setDurationMonths(String(Number(item.duration_months || 24)));
    setNotes(item.notes || '');
    setIsActive(Boolean(item.is_active));
    setMessage('تم فتح الاستثمار للتعديل.');
  };

  const toggleItem = async (item) => {
    try {
      const response = await fetch(`${API_URL}/sulfa/investments/${item.id}/toggle-active`, {
        method: 'POST',
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تحديث حالة الاستثمار');
      await load();
    } catch (error) {
      setMessage(error.message || 'تعذر تحديث حالة الاستثمار');
    }
  };

  const deleteItem = async (item) => {
    try {
      const response = await fetch(`${API_URL}/sulfa/investments/${item.id}`, {
        method: 'DELETE',
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر حذف الاستثمار');
      if (editingId === item.id) resetForm();
      setMessage('تم حذف الاستثمار.');
      await load();
    } catch (error) {
      setMessage(error.message || 'تعذر حذف الاستثمار');
    }
  };

  const confirmDelete = (item) => {
    Alert.alert(
      'حذف الاستثمار',
      'هل تريد حذف هذا الاستثمار من سلفة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => deleteItem(item) },
      ]
    );
  };

  const totalInvestment = Number(summary.invested_amount || 0);
  const monthlyProfit = Number(summary.monthly_profit || 0);
  const weightedRate = Number(summary.weighted_annual_rate ?? summary.annual_rate ?? 0);
  const principalReturn = Number(summary.monthly_principal_return || totalInvestment / PRINCIPAL_RETURN_MONTHS);

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
          <Text style={styles.heroText}>
            الربح الشهري يحسب من كل استثمار فعليًا: إجمالي ربح الاستثمار ÷ مدته، ثم تجمع أرباح الاستثمارات النشطة.
          </Text>
        </View>

        {loading ? <ActivityIndicator color="#7c3aed" style={styles.loader} /> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي الاستثمار النشط</Text>
            <Text style={styles.statValue}>{money(totalInvestment)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>متوسط العائد السنوي</Text>
            <Text style={styles.statValue}>{weightedRate.toFixed(2)}%</Text>
          </View>
          <View style={[styles.statCard, styles.monthlyCard]}>
            <Text style={styles.statLabel}>الربح الشهري المتوقع</Text>
            <Text style={styles.monthlyValue}>{money(monthlyProfit)}</Text>
            <Text style={styles.formula}>مجموع (ربح كل استثمار ÷ مدته بالأشهر)</Text>
          </View>
          <View style={[styles.statCard, styles.principalCard]}>
            <Text style={styles.statLabel}>استرجاع القسط الشهري</Text>
            <Text style={styles.principalValue}>{money(principalReturn)}</Text>
            <Text style={styles.principalFormula}>إجمالي المبلغ المستثمر ÷ 24</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            {editingId ? (
              <TouchableOpacity style={styles.cancelEditButton} onPress={resetForm}>
                <Text style={styles.cancelEditText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            ) : <View />}
            <Text style={styles.formTitle}>{editingId ? 'تعديل الاستثمار' : 'إضافة استثمار'}</Text>
          </View>

          <Text style={styles.inputLabel}>اسم أو وصف الاستثمار</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="مثال: فرصة أغسطس"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            textAlign="right"
          />

          <Text style={styles.inputLabel}>المبلغ المستثمر</Text>
          <TextInput
            value={amount}
            onChangeText={(value) => setAmount(cleanInput(value))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            textAlign="right"
          />

          <Text style={styles.inputLabel}>إجمالي الربح المتوقع لهذا الاستثمار</Text>
          <TextInput
            value={expectedProfit}
            onChangeText={(value) => setExpectedProfit(cleanInput(value))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            textAlign="right"
          />

          <Text style={styles.inputLabel}>مدة الاستثمار بالأشهر</Text>
          <TextInput
            value={durationMonths}
            onChangeText={(value) => setDurationMonths(String(value || '').replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="24"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            textAlign="right"
          />

          <Text style={styles.inputLabel}>ملاحظات</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="اختياري"
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.notesInput]}
            textAlign="right"
            multiline
          />

          <TouchableOpacity
            activeOpacity={0.86}
            style={[styles.activeSelector, !isActive && styles.inactiveSelector]}
            onPress={() => setIsActive((current) => !current)}
          >
            <Text style={[styles.activeSelectorText, !isActive && styles.inactiveSelectorText]}>
              {isActive ? 'الحالة: نشط — يدخل في الحساب' : 'الحالة: منتهي — لا يدخل في الحساب'}
            </Text>
          </TouchableOpacity>

          <View style={styles.previewGrid}>
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>ربحه الشهري</Text>
              <Text style={styles.previewValue}>{money(formMonthlyProfit)}</Text>
            </View>
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>العائد السنوي المكافئ</Text>
              <Text style={styles.previewValue}>{formAnnualizedRate.toFixed(2)}%</Text>
            </View>
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
                <Text style={styles.saveText}>{editingId ? 'حفظ التعديل' : 'إضافة الاستثمار'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listCount}>{items.length} استثمار</Text>
          <Text style={styles.listTitle}>الاستثمارات المسجلة</Text>
        </View>

        {items.length === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>لا توجد استثمارات مسجلة</Text>
            <Text style={styles.emptyText}>أضف كل استثمار ومبلغ ربحه ومدته للحصول على ربح شهري أدق.</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={String(item.id)} style={[styles.itemCard, !item.is_active && styles.itemCardInactive]}>
            <View style={styles.itemHeader}>
              <View style={[styles.statusBadge, !item.is_active && styles.statusBadgeInactive]}>
                <Text style={[styles.statusText, !item.is_active && styles.statusTextInactive]}>
                  {item.is_active ? 'نشط' : 'منتهي'}
                </Text>
              </View>
              <View style={styles.itemTitleBlock}>
                <Text style={styles.itemTitle}>{item.label || `استثمار #${item.id}`}</Text>
                <Text style={styles.itemSub}>مدة الاستثمار: {item.duration_months} شهر</Text>
              </View>
            </View>

            <View style={styles.itemMetrics}>
              <Metric label="المبلغ" value={money(item.invested_amount)} />
              <Metric label="إجمالي الربح" value={money(item.expected_profit)} />
              <Metric label="الربح الشهري" value={money(item.monthly_profit)} accent />
              <Metric label="العائد السنوي" value={`${Number(item.annualized_rate || 0).toFixed(2)}%`} />
            </View>

            {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => editItem(item)}>
                <UiIcon name="edit" size={18} color="#312e81" />
                <Text style={styles.actionText}>تعديل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => toggleItem(item)}>
                <UiIcon name={item.is_active ? 'complete' : 'receive'} size={18} color="#0e7490" />
                <Text style={[styles.actionText, styles.toggleText]}>{item.is_active ? 'إنهاء' : 'تنشيط'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => confirmDelete(item)}>
                <UiIcon name="delete" size={18} color="#b91c1c" />
                <Text style={[styles.actionText, styles.deleteText]}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, accent }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
    </View>
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
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  cancelEditButton: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  cancelEditText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  inputLabel: { marginTop: 14, marginBottom: 7, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { minHeight: 54, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 17, paddingHorizontal: 14, color: '#0f172a', fontSize: 17, fontWeight: '900' },
  notesInput: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  activeSelector: { marginTop: 14, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 16, padding: 13 },
  inactiveSelector: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  activeSelectorText: { color: '#047857', fontWeight: '900', textAlign: 'center' },
  inactiveSelectorText: { color: '#64748b' },
  previewGrid: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 },
  previewBox: { flex: 1, backgroundColor: '#faf5ff', borderRadius: 17, borderWidth: 1, borderColor: '#e9d5ff', padding: 12, alignItems: 'flex-end' },
  previewLabel: { color: '#6b21a8', fontWeight: '900', fontSize: 12, textAlign: 'right' },
  previewValue: { marginTop: 5, color: '#6d28d9', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  saveButton: { marginTop: 14, minHeight: 54, borderRadius: 17, backgroundColor: '#7c3aed', flexDirection: 'row-reverse', gap: 8, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.7 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  listHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  listCount: { color: '#7c3aed', backgroundColor: '#ede9fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '900', overflow: 'hidden' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, alignItems: 'center' },
  emptyTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  emptyText: { marginTop: 6, color: '#64748b', textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  itemCard: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', padding: 15 },
  itemCardInactive: { opacity: 0.72, backgroundColor: '#f8fafc' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemTitleBlock: { flex: 1, alignItems: 'flex-end' },
  itemTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  itemSub: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  statusBadge: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeInactive: { backgroundColor: '#e2e8f0' },
  statusText: { color: '#166534', fontWeight: '900', fontSize: 11 },
  statusTextInactive: { color: '#64748b' },
  itemMetrics: { marginTop: 13, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  metricBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, alignItems: 'flex-end' },
  metricLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  metricValue: { marginTop: 4, color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  metricValueAccent: { color: '#6d28d9' },
  itemNotes: { marginTop: 10, color: '#64748b', fontWeight: '700', lineHeight: 20, textAlign: 'right' },
  actionRow: { marginTop: 13, flexDirection: 'row-reverse', gap: 8 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { color: '#312e81', fontWeight: '900', fontSize: 12 },
  toggleText: { color: '#0e7490' },
  deleteButton: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  deleteText: { color: '#b91c1c' },
});
