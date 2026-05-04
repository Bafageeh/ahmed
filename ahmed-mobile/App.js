import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const platforms = ['تعميد', 'دينار', 'ترميز', 'موني مون'];
const today = () => new Date().toISOString().slice(0, 10);
const profitRates = { A: 2, B: 2, C: 3, D: 4 };
const categoryProfit = (category) => profitRates[category] || 0;
const calcProfit = (amount, category) => Number(amount || 0) * (categoryProfit(category) / 100);

export default function App() {
  const [screen, setScreen] = useState('home');

  if (screen === 'moneymoon') {
    return <MoneyMoonScreen onBack={() => setScreen('home')} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.badge}>Ahmed / حساباتي</Text>
          <Text style={styles.title}>لوحة حساباتي</Text>
          <Text style={styles.subtitle}>مصادر الدخل والاستثمارات والمنصات.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>4</Text>
            <Text style={styles.summaryLabel}>منصات</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>0.00</Text>
            <Text style={styles.summaryLabel}>إجمالي الاستثمار</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>منصات الاستثمار</Text>
        {platforms.map((name) => (
          <TouchableOpacity
            key={name}
            activeOpacity={0.85}
            onPress={() => name === 'موني مون' && setScreen('moneymoon')}
            style={styles.platformCard}
          >
            <Text style={styles.platformName}>{name}</Text>
            <Text style={styles.platformText}>
              {name === 'موني مون'
                ? 'اضغط لإضافة وإدارة استثمارات موني مون'
                : 'جاهزة لإضافة الفرص والحسابات'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyMoonScreen({ onBack }) {
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('A');
  const [investmentDate, setInvestmentDate] = useState(today());
  const [maturityDate, setMaturityDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.principal_amount || 0), 0),
    [items]
  );

  const totalProfit = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.expected_profit_amount || 0), 0),
    [items]
  );

  const formExpectedProfit = calcProfit(amount, category);

  const loadItems = async () => {
    try {
      const response = await fetch(`${API_URL}/moneymoon/investments`);
      const json = await response.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage('تعذر تحميل استثمارات موني مون');
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setCategory('A');
    setInvestmentDate(today());
    setMaturityDate('');
    setNotes('');
  };

  const startEdit = (item) => {
    const meta = safeJson(item.metadata);
    setEditingId(item.id);
    setAmount(String(item.principal_amount || ''));
    setCategory(meta.category || 'A');
    setInvestmentDate(item.start_date || today());
    setMaturityDate(item.maturity_date || '');
    setNotes(item.notes || '');
    setMessage('تم فتح البطاقة للتعديل');
  };

  const saveInvestment = async () => {
    if (!amount || Number(amount) <= 0) {
      setMessage('ادخل مبلغ الاستثمار بشكل صحيح');
      return;
    }

    setSaving(true);
    setMessage(editingId ? 'جاري حفظ التعديل...' : 'جاري الحفظ...');

    try {
      const url = editingId
        ? `${API_URL}/moneymoon/investments/${editingId}`
        : `${API_URL}/moneymoon/investments`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          investment_date: investmentDate,
          maturity_date: maturityDate || null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('save failed');
      }

      resetForm();
      setMessage(editingId ? 'تم تعديل بطاقة موني مون' : 'تم حفظ استثمار موني مون');
      await loadItems();
    } catch (error) {
      setMessage(editingId ? 'تعذر تعديل الاستثمار' : 'تعذر حفظ الاستثمار');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.badge}>موني مون</Text>
          <Text style={styles.title}>إدارة موني مون</Text>
          <Text style={styles.subtitle}>إضافة وتعديل استثمارات موني مون من داخل التطبيق.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{items.length}</Text>
            <Text style={styles.summaryLabel}>استثمارات</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{total.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>إجمالي موني مون</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalProfit.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>إجمالي الربح المتوقع</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{categoryProfit(category)}%</Text>
            <Text style={styles.summaryLabel}>ربح الفئة المختارة</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingId ? 'تعديل بطاقة استثمار' : 'إضافة استثمار جديد'}</Text>

          <Text style={styles.inputLabel}>المبلغ المستثمر</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="مثال: 1000"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>الفئة</Text>
          <View style={styles.categoryRow}>
            {['A', 'B', 'C', 'D'].map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.categoryButton, category === item && styles.categoryActive]}
              >
                <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
                <Text style={[styles.categoryRate, category === item && styles.categoryTextActive]}>{categoryProfit(item)}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.profitBox}>
            <Text style={styles.profitTitle}>الربح المتوقع لهذه العملية</Text>
            <Text style={styles.profitValue}>{formExpectedProfit.toFixed(2)} ر.س</Text>
          </View>

          <Text style={styles.inputLabel}>تاريخ الاستثمار</Text>
          <TextInput
            value={investmentDate}
            onChangeText={setInvestmentDate}
            placeholder="YYYY-MM-DD"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>تاريخ الاستحقاق</Text>
          <TextInput
            value={maturityDate}
            onChangeText={setMaturityDate}
            placeholder="اتركه فارغًا ليكون بعد شهر عند الإضافة"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>ملاحظات</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="اختياري"
            style={[styles.input, styles.notesInput]}
            multiline
          />

          {!!message && <Text style={styles.message}>{message}</Text>}

          <TouchableOpacity style={styles.saveButton} onPress={saveInvestment} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديل' : 'حفظ الاستثمار'}</Text>
          </TouchableOpacity>

          {editingId ? (
            <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelText}>إلغاء التعديل</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>استثمارات موني مون</Text>
        {items.length === 0 ? (
          <View style={styles.platformCard}>
            <Text style={styles.platformName}>لا توجد استثمارات بعد</Text>
            <Text style={styles.platformText}>أضف أول استثمار من النموذج بالأعلى.</Text>
          </View>
        ) : (
          items.map((item) => <MoneyMoonCard key={String(item.id)} item={item} onPress={() => startEdit(item)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyMoonCard({ item, onPress }) {
  const meta = safeJson(item.metadata);
  const category = meta.category || '-';
  const rate = Number(item.expected_rate || meta.profit_rate || categoryProfit(category));
  const profit = Number(item.expected_profit_amount || calcProfit(item.principal_amount, category));

  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.platformCard} onPress={onPress}>
      <Text style={styles.platformName}>فئة {category}</Text>
      <Text style={styles.platformText}>المبلغ: {Number(item.principal_amount || 0).toFixed(2)} ر.س</Text>
      <Text style={styles.platformText}>نسبة الربح: {rate}%</Text>
      <Text style={styles.platformText}>الربح المتوقع: {profit.toFixed(2)} ر.س</Text>
      <Text style={styles.platformText}>تاريخ الاستثمار: {item.start_date || '-'}</Text>
      <Text style={styles.platformText}>تاريخ الاستحقاق: {item.maturity_date || '-'}</Text>
      <Text style={styles.platformText}>الحالة: {item.status || '-'}</Text>
      <Text style={styles.editHint}>اضغط على البطاقة للتعديل</Text>
    </TouchableOpacity>
  );
}

function safeJson(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch (error) {
    return {};
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 16, fontSize: 34, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 16, textAlign: 'right' },
  summaryRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryValue: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 5, color: '#64748b', textAlign: 'right' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  platformName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformText: { marginTop: 6, color: '#64748b', textAlign: 'right' },
  editHint: { marginTop: 10, color: '#075985', fontWeight: '900', textAlign: 'right' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
  formCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 14 },
  inputLabel: { color: '#334155', fontWeight: '800', textAlign: 'right', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, textAlign: 'right', color: '#0f172a' },
  notesInput: { minHeight: 74, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  categoryActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  categoryText: { color: '#0f172a', fontWeight: '900' },
  categoryRate: { marginTop: 3, color: '#64748b', fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#fff' },
  profitBox: { marginTop: 12, backgroundColor: '#ecfeff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#cffafe' },
  profitTitle: { color: '#0e7490', textAlign: 'right', fontWeight: '800' },
  profitValue: { marginTop: 6, color: '#0f172a', textAlign: 'right', fontSize: 20, fontWeight: '900' },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '800' },
  saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelButton: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelText: { color: '#0f172a', fontWeight: '900' },
});
