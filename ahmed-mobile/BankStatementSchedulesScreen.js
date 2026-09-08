import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import BankLogo from './BankLogo';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

const BANKS = [
  { key: 'snb', name: 'البنك الأهلي السعودي' },
  { key: 'alrajhi', name: 'مصرف الراجحي' },
  { key: 'riyad', name: 'بنك الرياض' },
  { key: 'sab', name: 'البنك السعودي الأول' },
  { key: 'anb', name: 'البنك العربي الوطني' },
  { key: 'alinma', name: 'مصرف الإنماء' },
  { key: 'bsf', name: 'البنك السعودي الفرنسي' },
  { key: 'saib', name: 'البنك السعودي للاستثمار' },
  { key: 'aljazira', name: 'بنك الجزيرة' },
  { key: 'albilad', name: 'بنك البلاد' },
  { key: 'gib', name: 'بنك الخليج الدولي - السعودية' },
  { key: 'stc', name: 'STC Bank' },
  { key: 'vision', name: 'Vision Bank' },
  { key: 'd360', name: 'D360 Bank' },
];

export default function BankStatementSchedulesScreen({ onBack }) {
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const configuredCount = useMemo(() => Object.values(days).filter((value) => Number(value) >= 1 && Number(value) <= 31).length, [days]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/bank-statement-schedules`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'load failed');
      const next = {};
      (Array.isArray(json.data) ? json.data : []).forEach((item) => {
        next[item.bank_key] = item.statement_day ? String(item.statement_day) : '';
      });
      setDays(next);
    } catch {
      setMessage('تعذر تحميل جدول مواعيد الكشف.');
    } finally {
      setLoading(false);
    }
  };

  const setDay = (key, value) => {
    const clean = String(value || '').replace(/\D/g, '').slice(0, 2);
    setDays((current) => ({ ...current, [key]: clean }));
  };

  const save = async () => {
    for (const bank of BANKS) {
      const raw = String(days[bank.key] || '').trim();
      if (!raw) continue;
      const day = Number(raw);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        setMessage(`يوم الكشف غير صحيح لبنك ${bank.name}. أدخل رقمًا من 1 إلى 31.`);
        return;
      }
    }

    setSaving(true);
    setMessage('جاري الحفظ...');
    try {
      const response = await fetch(`${API_URL}/bank-statement-schedules`, {
        method: 'PUT',
        headers: ahmedUserHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify({
          schedules: BANKS.map((bank) => ({
            bank_key: bank.key,
            statement_day: String(days[bank.key] || '').trim() ? Number(days[bank.key]) : null,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'save failed');
      setMessage('تم حفظ جدول مواعيد الكشف. سيطبق على المستخدمين بحسب البنوك المضافة لديهم.');
      const next = {};
      (Array.isArray(json.data) ? json.data : []).forEach((item) => {
        next[item.bank_key] = item.statement_day ? String(item.statement_day) : '';
      });
      setDays(next);
    } catch {
      setMessage('تعذر حفظ مواعيد الكشف.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}><Text style={styles.backIcon}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>مواعيد كشف البطاقات</Text>
        <View style={styles.sideSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>جدول موحد لجميع المستخدمين</Text>
          <Text style={styles.infoText}>حدد يوم كشف الحساب لكل بنك مرة واحدة. التنبيه يصل لكل مستخدم فقط إذا كان هذا البنك مضافًا في خزنته.</Text>
          <Text style={styles.countText}>{configuredCount} بنك محدد له موعد</Text>
        </View>

        {!!message ? <Text style={styles.message}>{message}</Text> : null}
        {loading ? <Text style={styles.loading}>جاري تحميل البنوك...</Text> : null}

        {!loading ? BANKS.map((bank) => (
          <View key={bank.key} style={styles.bankRow}>
            <View style={styles.bankIdentity}>
              <BankLogo bankName={bank.name} size={48} />
              <Text style={styles.bankName}>{bank.name}</Text>
            </View>
            <View style={styles.dayBox}>
              <Text style={styles.dayLabel}>يوم الكشف</Text>
              <TextInput
                value={String(days[bank.key] || '')}
                onChangeText={(value) => setDay(bank.key, value)}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="#94a3b8"
                maxLength={2}
                style={styles.dayInput}
                textAlign="center"
              />
            </View>
          </View>
        )) : null}

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveDisabled]} onPress={save} disabled={saving || loading} activeOpacity={0.85}>
          <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ جميع المواعيد'}</Text>
        </TouchableOpacity>
        <Text style={styles.footerHint}>التنبيه الشهري يثبت تلقائيًا عند فتح التطبيق ويعمل الساعة 9:00 صباحًا في يوم الكشف المحدد.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { height: 78, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  backButton: { position: 'absolute', left: 18, width: 50, height: 50, borderRadius: 17, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ee', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#0f172a', fontSize: 40, fontWeight: '700', lineHeight: 42, marginTop: -4 },
  sideSpacer: { position: 'absolute', right: 18, width: 50, height: 50 },
  container: { padding: 18, paddingBottom: 48 },
  infoCard: { backgroundColor: '#0f172a', borderRadius: 26, padding: 20, marginBottom: 16 },
  infoTitle: { color: '#fff', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  infoText: { color: '#cbd5e1', fontSize: 13.5, lineHeight: 23, textAlign: 'right', marginTop: 8 },
  countText: { color: '#c4b5fd', fontSize: 13, fontWeight: '900', textAlign: 'right', marginTop: 12 },
  message: { color: '#075985', backgroundColor: '#ecfeff', borderRadius: 16, padding: 12, fontSize: 13, fontWeight: '800', textAlign: 'right', marginBottom: 12 },
  loading: { color: '#64748b', textAlign: 'center', paddingVertical: 30 },
  bankRow: { backgroundColor: '#fff', borderRadius: 22, padding: 14, marginBottom: 11, borderWidth: 1, borderColor: '#e7edf5', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  bankIdentity: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  bankName: { flex: 1, color: '#0f172a', fontSize: 15.5, fontWeight: '900', textAlign: 'right' },
  dayBox: { width: 82, alignItems: 'center' },
  dayLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', marginBottom: 5 },
  dayInput: { width: 66, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: 19, fontWeight: '900' },
  saveButton: { minHeight: 58, borderRadius: 20, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveDisabled: { opacity: 0.55 },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  footerHint: { color: '#64748b', fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 13, paddingHorizontal: 10 },
});
