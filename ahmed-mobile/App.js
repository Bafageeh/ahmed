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
import FinanceSummaryScreen from './FinanceSummaryScreen';
import Ta3meedScreen from './Ta3meedScreen';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const platforms = ['تعميد', 'دينار', 'ترميز', 'موني مون'];
const today = () => new Date().toISOString().slice(0, 10);
const profitRates = { A: 2, B: 2, C: 3, D: 4 };
const categoryProfit = (category) => profitRates[category] || 0;
const calcProfit = (amount, category) => Number(amount || 0) * (categoryProfit(category) / 100);
const isReceived = (item) => item.status === 'received' || item.status === 'completed';
const isOverdue = (item) => Boolean(item.maturity_date && item.maturity_date < today() && !isReceived(item));

export default function App() {
  const [screen, setScreen] = useState('home');

  if (screen === 'ta3meed') {
    return <Ta3meedScreen onBack={() => setScreen('home')} />;
  }

  if (screen === 'moneymoon') {
    return <MoneyMoonScreen onBack={() => setScreen('home')} />;
  }

  if (screen === 'income') {
    return <BasicIncomeScreen onBack={() => setScreen('home')} />;
  }

  if (screen === 'finance') {
    return <FinanceSummaryScreen onBack={() => setScreen('home')} />;
  }

  const openPlatform = (name) => {
    if (name === 'تعميد') {
      setScreen('ta3meed');
      return;
    }

    if (name === 'موني مون') {
      setScreen('moneymoon');
    }
  };

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

        <Text style={styles.sectionTitle}>أساسيات الحساب</Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setScreen('income')} style={styles.platformCard}>
          <Text style={styles.platformName}>الدخل الأساسي</Text>
          <Text style={styles.platformText}>إدخال نوع الدخل والمبلغ وإدارتهما.</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} onPress={() => setScreen('finance')} style={styles.platformCard}>
          <Text style={styles.platformName}>Finance</Text>
          <Text style={styles.platformText}>عرض الأقساط والأرباح والعملاء والتنبيهات القادمة من تطبيق Finance.</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>منصات الاستثمار</Text>
        {platforms.map((name) => (
          <TouchableOpacity
            key={name}
            activeOpacity={0.85}
            onPress={() => openPlatform(name)}
            style={styles.platformCard}
          >
            <Text style={styles.platformName}>{name}</Text>
            <Text style={styles.platformText}>
              {name === 'تعميد'
                ? 'اضغط لعرض فرص تعميد النشطة وتوزيع المستثمرين'
                : name === 'موني مون'
                ? 'اضغط لإضافة وإدارة استثمارات موني مون'
                : 'جاهزة لإضافة الفرص والحسابات'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function BasicIncomeScreen({ onBack }) {
  const [incomeType, setIncomeType] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const totalIncome = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items]
  );

  const loadItems = async () => {
    try {
      const response = await fetch(`${API_URL}/income/basic`);
      const json = await response.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage('تعذر تحميل بيانات الدخل');
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const saveIncome = async () => {
    if (!incomeType.trim()) {
      setMessage('ادخل نوع الدخل');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setMessage('ادخل المبلغ بشكل صحيح');
      return;
    }

    setSaving(true);
    setMessage('جاري الحفظ...');

    try {
      const response = await fetch(`${API_URL}/income/basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          income_type: incomeType.trim(),
          amount: Number(amount),
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('save failed');
      }

      setIncomeType('');
      setAmount('');
      setNotes('');
      setMessage('تم حفظ الدخل الأساسي');
      await loadItems();
    } catch (error) {
      setMessage('تعذر حفظ الدخل');
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
          <Text style={styles.badge}>أساسيات الحساب</Text>
          <Text style={styles.title}>الدخل الأساسي</Text>
          <Text style={styles.subtitle}>إدخال نوع الدخل والمبلغ وحفظهما في الحساب.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{items.length}</Text>
            <Text style={styles.summaryLabel}>سجلات دخل</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalIncome.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>إجمالي الدخل</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>إضافة دخل أساسي</Text>

          <Text style={styles.inputLabel}>نوع الدخل</Text>
          <TextInput
            value={incomeType}
            onChangeText={setIncomeType}
            placeholder="مثال: راتب، إيجار، عمولة"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>المبلغ</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="مثال: 5000"
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

          <TouchableOpacity style={styles.saveButton} onPress={saveIncome} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ الدخل'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>سجلات الدخل</Text>
        {items.length === 0 ? (
          <View style={styles.platformCard}>
            <Text style={styles.platformName}>لا يوجد دخل مسجل</Text>
            <Text style={styles.platformText}>أضف أول دخل من النموذج بالأعلى.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={String(item.id)} style={styles.platformCard}>
              <Text style={styles.platformName}>{item.income_type || 'دخل'}</Text>
              <Text style={styles.platformText}>المبلغ: {Number(item.amount || 0).toFixed(2)} ر.س</Text>
              <Text style={styles.platformText}>التاريخ: {item.transaction_date || '-'}</Text>
              <Text style={styles.platformText}>الحالة: {item.status || '-'}</Text>
              {item.description ? <Text style={styles.platformText}>ملاحظات: {item.description}</Text> : null}
            </View>
          ))
        )}
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
  const [receivingId, setReceivingId] = useState(null);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.principal_amount || 0), 0),
    [items]
  );

  const totalProfit = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.expected_profit_amount || 0), 0),
    [items]
  );

  const overdueCount = useMemo(
    () => items.filter((item) => isOverdue(item)).length,
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

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');

    try {
      const response = await fetch(`${API_URL}/moneymoon/investments/${item.id}/receive`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error('receive failed');
      }

      setMessage('تم اعتبار الاستثمار مستلمًا');
      await loadItems();
    } catch (error) {
      setMessage('تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
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
          <Text style={styles.subtitle}>إضافة وتعديل واستلام استثمارات موني مون من داخل التطبيق.</Text>
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
          <View style={[styles.summaryCard, overdueCount > 0 && styles.overdueSummary]}>
            <Text style={[styles.summaryValue, overdueCount > 0 && styles.overdueText]}>{overdueCount}</Text>
            <Text style={[styles.summaryLabel, overdueCount > 0 && styles.overdueText]}>متأخر غير مستلم</Text>
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
          items.map((item) => (
            <MoneyMoonCard
              key={String(item.id)}
              item={item}
              onEdit={() => startEdit(item)}
              onReceive={() => receiveInvestment(item)}
              receiving={receivingId === item.id}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyMoonCard({ item, onEdit, onReceive, receiving }) {
  const meta = safeJson(item.metadata);
  const category = meta.category || '-';
  const rate = Number(item.expected_rate || meta.profit_rate || categoryProfit(category));
  const profit = Number(item.expected_profit_amount || calcProfit(item.principal_amount, category));
  const received = isReceived(item);
  const overdue = isOverdue(item);

  return (
    <View style={[styles.platformCard, overdue && styles.overdueCard, received && styles.receivedCard]}>
      <Text style={[styles.platformName, overdue && styles.overdueText]}>فئة {category}</Text>
      {overdue ? <Text style={styles.overdueBadge}>متأخر ولم يتم الاستلام</Text> : null}
      {received ? <Text style={styles.receivedBadge}>تم الاستلام</Text> : null}
      <Text style={styles.platformText}>المبلغ: {Number(item.principal_amount || 0).toFixed(2)} ر.س</Text>
      <Text style={styles.platformText}>نسبة الربح: {rate}%</Text>
      <Text style={styles.platformText}>الربح المتوقع: {profit.toFixed(2)} ر.س</Text>
      <Text style={styles.platformText}>تاريخ الاستثمار: {item.start_date || '-'}</Text>
      <Text style={styles.platformText}>تاريخ الاستحقاق: {item.maturity_date || '-'}</Text>
      <Text style={styles.platformText}>الحالة: {received ? 'مستلم' : item.status || '-'}</Text>

      <View style={styles.cardActions}>
        {!received ? (
          <TouchableOpacity style={styles.receiveButton} onPress={onReceive} disabled={receiving}>
            <Text style={styles.receiveText}>{receiving ? 'جاري التسجيل...' : 'تم الاستلام'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editText}>تعديل البطاقة</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  overdueSummary: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  overdueText: { color: '#b91c1c' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  overdueCard: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  receivedCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  platformName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformText: { marginTop: 6, color: '#64748b', textAlign: 'right' },
  overdueBadge: { marginTop: 8, color: '#991b1b', backgroundColor: '#fee2e2', borderRadius: 12, padding: 8, textAlign: 'right', fontWeight: '900' },
  receivedBadge: { marginTop: 8, color: '#166534', backgroundColor: '#dcfce7', borderRadius: 12, padding: 8, textAlign: 'right', fontWeight: '900' },
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
  cardActions: { marginTop: 14, flexDirection: 'row-reverse', gap: 8 },
  receiveButton: { flex: 1, backgroundColor: '#166534', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  receiveText: { color: '#fff', fontWeight: '900' },
  editButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  editText: { color: '#0f172a', fontWeight: '900' },
});
