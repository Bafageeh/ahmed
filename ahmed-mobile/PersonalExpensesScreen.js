import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const formatMoney = (value) => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
const frequencyLabel = (value) => value === 'annual' ? 'سنوي' : 'شهري';
const monthlyEquivalent = (item) => item.frequency === 'annual' ? Number(item.amount || 0) / 12 : Number(item.amount || 0);
const annualEquivalent = (item) => item.frequency === 'annual' ? Number(item.amount || 0) : Number(item.amount || 0) * 12;

export default function PersonalExpensesScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [definition, setDefinition] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(today());
  const [frequency, setFrequency] = useState('monthly');
  const [notes, setNotes] = useState('');

  const totals = useMemo(() => {
    const monthly = items.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
    const annual = items.reduce((sum, item) => sum + annualEquivalent(item), 0);
    return { monthly, annual };
  }, [items]);

  const loadItems = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/personal-expenses`, { headers: { Accept: 'application/json' } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل المصروفات.');
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل المصروفات.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setDefinition('');
    setAmount('');
    setExpenseDate(today());
    setFrequency('monthly');
    setNotes('');
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setDefinition(item.definition || '');
    setAmount(String(item.amount || ''));
    setExpenseDate(item.expense_date || today());
    setFrequency(item.frequency === 'annual' ? 'annual' : 'monthly');
    setNotes(item.notes || '');
    setMessage('');
  };

  const saveExpense = async () => {
    const cleanDefinition = String(definition || '').trim();
    const cleanAmount = Number(amount || 0);
    if (!cleanDefinition) return setMessage('أدخل التعريف.');
    if (!cleanAmount || cleanAmount <= 0) return setMessage('أدخل المبلغ بشكل صحيح.');
    if (!expenseDate) return setMessage('أدخل التاريخ.');

    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(editingId ? `${API_URL}/personal-expenses/${editingId}` : `${API_URL}/personal-expenses`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          definition: cleanDefinition,
          amount: cleanAmount,
          expense_date: expenseDate,
          frequency,
          notes: String(notes || '').trim() || null,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ المصروف.');
      resetForm();
      await loadItems();
      setMessage(editingId ? 'تم تعديل المصروف.' : 'تمت إضافة المصروف.');
    } catch (error) {
      setMessage(error.message || 'تعذر حفظ المصروف.');
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id) => {
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/personal-expenses/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر حذف المصروف.');
      if (editingId === id) resetForm();
      await loadItems();
      setMessage('تم حذف المصروف.');
    } catch (error) {
      setMessage(error.message || 'تعذر حذف المصروف.');
    }
  };

  const onlyNumbers = (value) => setAmount(String(value || '').replace(/[^0-9.]/g, ''));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>‹</Text></TouchableOpacity>
            <Text style={styles.topTitle}>مصروفاتي</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={loadItems}><Text style={styles.refreshText}>تحديث</Text></TouchableOpacity>
          </View>

          <View style={styles.header}>
            <Text style={styles.badge}>حساباتي</Text>
            <Text style={styles.title}>مصروفاتي</Text>
            <Text style={styles.subtitle}>مصروفات خاصة بالحساب الحالي فقط، مع تحويل الشهري والسنوي وإظهار الناتج النهائي.</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>الناتج الشهري</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.monthly)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>الناتج السنوي</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.annual)}</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل مصروف' : 'إضافة مصروف'}</Text>
            <Text style={styles.inputLabel}>التعريف</Text>
            <TextInput value={definition} onChangeText={setDefinition} placeholder="مثال: إيجار، اشتراك، بنزين" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" />
            <Text style={styles.inputLabel}>المبلغ</Text>
            <TextInput value={amount} onChangeText={onlyNumbers} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" />
            <Text style={styles.inputLabel}>التاريخ</Text>
            <TextInput value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" />
            <Text style={styles.inputLabel}>النوع</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity onPress={() => setFrequency('monthly')} style={[styles.toggleButton, frequency === 'monthly' && styles.toggleActive]}><Text style={[styles.toggleText, frequency === 'monthly' && styles.toggleTextActive]}>شهري</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setFrequency('annual')} style={[styles.toggleButton, frequency === 'annual' && styles.toggleActive]}><Text style={[styles.toggleText, frequency === 'annual' && styles.toggleTextActive]}>سنوي</Text></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>الملاحظات</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="اختياري" placeholderTextColor="#94a3b8" style={[styles.input, styles.notesInput]} textAlign="right" multiline />

            {!!message ? <Text style={styles.message}>{message}</Text> : null}

            <TouchableOpacity disabled={saving} onPress={saveExpense} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editingId ? 'حفظ التعديل' : 'إضافة المصروف'}</Text>}
            </TouchableOpacity>
            {editingId ? <TouchableOpacity onPress={resetForm} style={styles.cancelButton}><Text style={styles.cancelText}>إلغاء التعديل</Text></TouchableOpacity> : null}
          </View>

          <Text style={styles.sectionTitle}>قائمة المصروفات</Text>
          {loading ? <ActivityIndicator style={styles.loader} /> : null}
          {!loading && items.length === 0 ? <Text style={styles.emptyText}>لا توجد مصروفات مضافة بعد.</Text> : null}
          {!loading ? items.map((item) => (
            <View key={String(item.id)} style={styles.expenseCard}>
              <View style={styles.expenseHeader}>
                <View style={styles.frequencyBadge}><Text style={styles.frequencyText}>{frequencyLabel(item.frequency)}</Text></View>
                <View style={styles.expenseTitleBlock}>
                  <Text style={styles.expenseTitle}>{item.definition}</Text>
                  <Text style={styles.expenseDate}>التاريخ: {item.expense_date || '-'}</Text>
                </View>
              </View>
              <Text style={styles.expenseAmount}>{formatMoney(item.amount)}</Text>
              <View style={styles.equivalentRow}>
                <Text style={styles.equivalentText}>شهريًا: {formatMoney(item.monthly_equivalent ?? monthlyEquivalent(item))}</Text>
                <Text style={styles.equivalentText}>سنويًا: {formatMoney(item.annual_equivalent ?? annualEquivalent(item))}</Text>
              </View>
              {item.notes ? <Text style={styles.notesText}>ملاحظات: {item.notes}</Text> : null}
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.editButton}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteExpense(item.id)} style={styles.deleteButton}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
              </View>
            </View>
          )) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  keyboard: { flex: 1 },
  page: { padding: 18, paddingBottom: 34 },
  topBar: { marginTop: 12, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#0f172a', fontSize: 36, fontWeight: '900', marginTop: -4 },
  topTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  refreshButton: { minWidth: 72, height: 52, borderRadius: 18, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  refreshText: { color: '#fff', fontWeight: '900' },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  badge: { alignSelf: 'flex-start', color: '#cbd5e1', backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, fontWeight: '900' },
  title: { marginTop: 16, color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  summaryGrid: { marginTop: 16, flexDirection: 'row-reverse', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#ecfdf5', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#99f6e4', alignItems: 'flex-end' },
  summaryLabel: { color: '#0f766e', fontWeight: '900', fontSize: 14 },
  summaryValue: { marginTop: 6, color: '#0f172a', fontWeight: '900', fontSize: 22, textAlign: 'right' },
  formCard: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { color: '#0f172a', fontWeight: '900', fontSize: 22, textAlign: 'right', marginBottom: 6 },
  inputLabel: { marginTop: 10, marginBottom: 6, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, color: '#0f172a', fontWeight: '900', fontSize: 15 },
  notesInput: { minHeight: 84, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row-reverse', gap: 8 },
  toggleButton: { flex: 1, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', paddingVertical: 13, alignItems: 'center' },
  toggleActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  toggleText: { color: '#334155', fontWeight: '900' },
  toggleTextActive: { color: '#fff' },
  message: { marginTop: 12, color: '#0f766e', backgroundColor: '#ecfdf5', borderRadius: 16, padding: 12, textAlign: 'center', fontWeight: '900', overflow: 'hidden' },
  saveButton: { marginTop: 16, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  disabled: { opacity: 0.65 },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelButton: { marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: '#0f172a', fontWeight: '900' },
  sectionTitle: { marginTop: 20, marginBottom: 10, color: '#0f172a', fontWeight: '900', fontSize: 20, textAlign: 'right' },
  loader: { marginTop: 14 },
  emptyText: { color: '#64748b', fontWeight: '800', textAlign: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, overflow: 'hidden' },
  expenseCard: { marginBottom: 10, backgroundColor: '#fff', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  expenseHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  expenseTitleBlock: { flex: 1, alignItems: 'flex-end' },
  expenseTitle: { color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right' },
  expenseDate: { marginTop: 3, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  frequencyBadge: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  frequencyText: { color: '#3730a3', fontWeight: '900', fontSize: 12 },
  expenseAmount: { marginTop: 10, color: '#0f766e', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  equivalentRow: { marginTop: 8, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  equivalentText: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: '900', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  notesText: { marginTop: 8, color: '#475569', fontWeight: '800', lineHeight: 21, textAlign: 'right' },
  actionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  editButton: { flex: 1, backgroundColor: '#eef2ff', borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  editText: { color: '#3730a3', fontWeight: '900' },
  deleteButton: { flex: 1, backgroundColor: '#fff1f2', borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  deleteText: { color: '#be123c', fontWeight: '900' },
});
