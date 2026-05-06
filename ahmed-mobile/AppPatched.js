import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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

function getMoneyMoonCategory(item) {
  return safeJson(item?.metadata).category || '-';
}

function getMoneyMoonProfit(item) {
  const meta = safeJson(item?.metadata);
  return Number(item?.expected_profit_amount || calcProfit(item?.principal_amount, meta.category));
}

export default function App() {
  const [screen, setScreen] = useState('home');

  if (screen === 'ta3meed') return <Ta3meedScreen onBack={() => setScreen('home')} />;
  if (screen === 'moneymoon') return <MoneyMoonScreen onBack={() => setScreen('home')} />;
  if (screen === 'income') return <BasicIncomeScreen onBack={() => setScreen('home')} />;
  if (screen === 'finance') return <FinanceSummaryScreen onBack={() => setScreen('home')} />;

  const openPlatform = (name) => {
    if (name === 'تعميد') setScreen('ta3meed');
    if (name === 'موني مون') setScreen('moneymoon');
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
          <TouchableOpacity key={name} activeOpacity={0.85} onPress={() => openPlatform(name)} style={styles.platformCard}>
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

  const totalIncome = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount || 0), 0), [items]);

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
    if (!incomeType.trim()) return setMessage('ادخل نوع الدخل');
    if (!amount || Number(amount) <= 0) return setMessage('ادخل المبلغ بشكل صحيح');

    setSaving(true);
    setMessage('جاري الحفظ...');

    try {
      const response = await fetch(`${API_URL}/income/basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ income_type: incomeType.trim(), amount: Number(amount), notes: notes || null }),
      });

      if (!response.ok) throw new Error('save failed');

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
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.badge}>أساسيات الحساب</Text>
          <Text style={styles.title}>الدخل الأساسي</Text>
          <Text style={styles.subtitle}>إدخال نوع الدخل والمبلغ وحفظهما في الحساب.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>سجلات دخل</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{totalIncome.toFixed(2)}</Text><Text style={styles.summaryLabel}>إجمالي الدخل</Text></View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>إضافة دخل أساسي</Text>
          <Text style={styles.inputLabel}>نوع الدخل</Text>
          <TextInput value={incomeType} onChangeText={setIncomeType} placeholder="مثال: راتب، إيجار، عمولة" style={styles.input} />
          <Text style={styles.inputLabel}>المبلغ</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="مثال: 5000" style={styles.input} />
          <Text style={styles.inputLabel}>ملاحظات</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="اختياري" style={[styles.input, styles.notesInput]} multiline />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <TouchableOpacity style={styles.saveButton} onPress={saveIncome} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ الدخل'}</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>سجلات الدخل</Text>
        {items.length === 0 ? (
          <View style={styles.platformCard}><Text style={styles.platformName}>لا يوجد دخل مسجل</Text><Text style={styles.platformText}>أضف أول دخل من النموذج بالأعلى.</Text></View>
        ) : items.map((item) => (
          <View key={String(item.id)} style={styles.platformCard}>
            <Text style={styles.platformName}>{item.income_type || 'دخل'}</Text>
            <Text style={styles.platformText}>المبلغ: {Number(item.amount || 0).toFixed(2)} ر.س</Text>
            <Text style={styles.platformText}>التاريخ: {item.transaction_date || '-'}</Text>
            <Text style={styles.platformText}>الحالة: {item.status || '-'}</Text>
            {item.description ? <Text style={styles.platformText}>ملاحظات: {item.description}</Text> : null}
          </View>
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
  const [receivingId, setReceivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const activeItems = useMemo(() => items.filter((item) => !isReceived(item)), [items]);
  const activeTotal = useMemo(() => activeItems.reduce((sum, item) => sum + Number(item.principal_amount || 0), 0), [activeItems]);
  const activeProfit = useMemo(() => activeItems.reduce((sum, item) => sum + getMoneyMoonProfit(item), 0), [activeItems]);
  const overdueCount = useMemo(() => items.filter((item) => isOverdue(item)).length, [items]);
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
    if (!amount || Number(amount) <= 0) return setMessage('ادخل مبلغ الاستثمار بشكل صحيح');

    setSaving(true);
    setMessage(editingId ? 'جاري حفظ التعديل...' : 'جاري الحفظ...');

    try {
      const url = editingId ? `${API_URL}/moneymoon/investments/${editingId}` : `${API_URL}/moneymoon/investments`;
      const method = editingId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ amount: Number(amount), category, investment_date: investmentDate, maturity_date: maturityDate || null, notes: notes || null }),
      });

      if (!response.ok) throw new Error('save failed');

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
      const response = await fetch(`${API_URL}/moneymoon/investments/${item.id}/receive`, { method: 'POST', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('receive failed');
      setMessage('تم اعتبار الاستثمار مستلمًا');
      await loadItems();
    } catch (error) {
      setMessage('تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
    }
  };

  const deleteInvestment = async (item) => {
    setDeletingId(item.id);
    setMessage('جاري حذف الاستثمار...');

    try {
      const response = await fetch(`${API_URL}/moneymoon/investments/${item.id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('delete failed');

      if (editingId === item.id) resetForm();
      setItems((current) => current.filter((investment) => investment.id !== item.id));
      setMessage('تم حذف الاستثمار');
      await loadItems();
    } catch (error) {
      setMessage('تعذر حذف الاستثمار');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteInvestment = (item) => {
    Alert.alert(
      'حذف الاستثمار',
      'هل تريد حذف هذا الاستثمار من موني مون؟ لا يمكن التراجع عن الحذف.',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => deleteInvestment(item) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.badge}>موني مون</Text>
          <Text style={styles.title}>إدارة موني مون</Text>
          <Text style={styles.subtitle}>بطاقات الإجمالي والأرباح النشطة تستبعد كل استثمار تم تسجيله كمستلم.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{activeItems.length}</Text><Text style={styles.summaryLabel}>استثمارات نشطة</Text></View>
          <View style={styles.activeSummaryCard}><Text style={styles.activeSummaryValue}>{activeTotal.toFixed(2)}</Text><Text style={styles.activeSummaryLabel}>إجمالي موني مون النشطة</Text></View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.activeProfitCard}><Text style={styles.activeProfitValue}>{activeProfit.toFixed(2)}</Text><Text style={styles.activeProfitLabel}>أرباح موني مون النشطة</Text></View>
          <View style={[styles.summaryCard, overdueCount > 0 && styles.overdueSummary]}><Text style={[styles.summaryValue, overdueCount > 0 && styles.overdueText]}>{overdueCount}</Text><Text style={[styles.summaryLabel, overdueCount > 0 && styles.overdueText]}>متأخر غير مستلم</Text></View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingId ? 'تعديل بطاقة استثمار' : 'إضافة استثمار جديد'}</Text>
          <Text style={styles.inputLabel}>المبلغ المستثمر</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="مثال: 1000" style={styles.input} />
          <Text style={styles.inputLabel}>الفئة</Text>
          <View style={styles.categoryRow}>
            {['A', 'B', 'C', 'D'].map((item) => (
              <TouchableOpacity key={item} onPress={() => setCategory(item)} style={[styles.categoryButton, category === item && styles.categoryActive]}>
                <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
                <Text style={[styles.categoryRate, category === item && styles.categoryTextActive]}>{categoryProfit(item)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.profitBox}><Text style={styles.profitTitle}>الربح المتوقع لهذه العملية</Text><Text style={styles.profitValue}>{formExpectedProfit.toFixed(2)} ر.س</Text></View>
          <Text style={styles.inputLabel}>تاريخ الاستثمار</Text>
          <TextInput value={investmentDate} onChangeText={setInvestmentDate} placeholder="YYYY-MM-DD" style={styles.input} />
          <Text style={styles.inputLabel}>تاريخ الاستحقاق</Text>
          <TextInput value={maturityDate} onChangeText={setMaturityDate} placeholder="اتركه فارغًا ليكون بعد شهر عند الإضافة" style={styles.input} />
          <Text style={styles.inputLabel}>ملاحظات</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="اختياري" style={[styles.input, styles.notesInput]} multiline />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <TouchableOpacity style={styles.saveButton} onPress={saveInvestment} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديل' : 'حفظ الاستثمار'}</Text></TouchableOpacity>
          {editingId ? <TouchableOpacity style={styles.cancelButton} onPress={resetForm}><Text style={styles.cancelText}>إلغاء التعديل</Text></TouchableOpacity> : null}
        </View>

        <Text style={styles.sectionTitle}>استثمارات موني مون</Text>
        {items.length === 0 ? (
          <View style={styles.platformCard}><Text style={styles.platformName}>لا توجد استثمارات بعد</Text><Text style={styles.platformText}>أضف أول استثمار من النموذج بالأعلى.</Text></View>
        ) : items.map((item) => (
          <MoneyMoonCard
            key={String(item.id)}
            item={item}
            onEdit={() => startEdit(item)}
            onReceive={() => receiveInvestment(item)}
            onDelete={() => confirmDeleteInvestment(item)}
            receiving={receivingId === item.id}
            deleting={deletingId === item.id}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyMoonCard({ item, onEdit, onReceive, onDelete, receiving, deleting }) {
  const category = getMoneyMoonCategory(item);
  const meta = safeJson(item.metadata);
  const orderNo = moneyMoonOrderNumber(item, meta);
  const rate = Number(item.expected_rate || meta.profit_rate || categoryProfit(category));
  const profit = getMoneyMoonProfit(item);
  const received = isReceived(item);
  const overdue = isOverdue(item);
  const statusText = received ? 'مستلم' : overdue ? 'متأخر' : 'نشط';

  return (
    <View style={[styles.moneyMoonCard, overdue && styles.moneyMoonOverdueCard, received && styles.moneyMoonReceivedCard]}>
      <View style={styles.moneyMoonTopRow}>
        <View style={styles.moneyMoonTitleBlock}>
          <View style={styles.moneyMoonBadgesRow}>
            <Text style={styles.categoryMiniBadge}>{category}</Text>
            <Text style={[styles.statusMiniBadge, overdue && styles.statusOverdueBadge, received && styles.statusReceivedBadge]}>{statusText}</Text>
          </View>
          <Text style={styles.orderLabel}>رقم الطلب</Text>
          <Text style={styles.orderNumber} numberOfLines={1}>{orderNo || '-'}</Text>
        </View>
        <View style={styles.moneyMoonAmountBlock}>
          <Text style={styles.moneyMoonAmount}>{Number(item.principal_amount || 0).toLocaleString('en-US')}</Text>
          <Text style={styles.moneyMoonCurrency}>ر.س</Text>
        </View>
      </View>

      <View style={styles.compactStatsRow}>
        <CompactStat label="الربح" value={`${profit.toFixed(2)} ر.س`} />
        <CompactStat label="النسبة" value={`${rate}%`} />
        <CompactStat label="الاستثمار" value={item.start_date || '-'} />
        <CompactStat label="الاستحقاق" value={item.maturity_date || '-'} />
      </View>

      <View style={styles.iconActionsRow}>
        {!received ? (
          <TouchableOpacity style={[styles.iconActionButton, styles.receiveIconButton]} onPress={onReceive} disabled={receiving || deleting} activeOpacity={0.82}>
            <Text style={styles.iconActionText}>{receiving ? '…' : '✓'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.iconActionButton, styles.editIconButton]} onPress={onEdit} disabled={deleting} activeOpacity={0.82}>
          <Text style={styles.iconActionText}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionButton, styles.deleteIconButton]} onPress={onDelete} disabled={deleting} activeOpacity={0.82}>
          <Text style={[styles.iconActionText, styles.deleteIconText]}>{deleting ? '…' : '⌫'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CompactStat({ label, value }) {
  return (
    <View style={styles.compactStatBox}>
      <Text style={styles.compactStatLabel}>{label}</Text>
      <Text style={styles.compactStatValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function moneyMoonOrderNumber(item, meta) {
  if (meta?.external_order_no) return String(meta.external_order_no);
  if (meta?.order_no) return String(meta.order_no);
  const titleMatch = String(item.title || '').match(/L-[A-Za-z0-9-]+/);
  if (titleMatch) return titleMatch[0];
  const notesMatch = String(item.notes || '').match(/L-[A-Za-z0-9-]+/);
  return notesMatch ? notesMatch[0] : '';
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
  summaryLabel: { marginTop: 5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  activeSummaryCard: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#a5f3fc' },
  activeSummaryValue: { color: '#0e7490', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  activeSummaryLabel: { marginTop: 5, color: '#155e75', textAlign: 'right', fontWeight: '800' },
  activeProfitCard: { flex: 1, backgroundColor: '#f0fdf4', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#bbf7d0' },
  activeProfitValue: { color: '#166534', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  activeProfitLabel: { marginTop: 5, color: '#166534', textAlign: 'right', fontWeight: '800' },
  overdueSummary: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  overdueText: { color: '#b91c1c' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  platformName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformText: { marginTop: 6, color: '#64748b', textAlign: 'right' },
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
  moneyMoonCard: { backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  moneyMoonOverdueCard: { backgroundColor: '#fff7f7', borderColor: '#fecaca' },
  moneyMoonReceivedCard: { backgroundColor: '#f7fff9', borderColor: '#bbf7d0' },
  moneyMoonTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  moneyMoonTitleBlock: { flex: 1, alignItems: 'flex-end' },
  moneyMoonBadgesRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 6 },
  categoryMiniBadge: { minWidth: 28, textAlign: 'center', backgroundColor: '#ecfeff', color: '#0891b2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontWeight: '900', fontSize: 12 },
  statusMiniBadge: { backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden', fontWeight: '900', fontSize: 12 },
  statusOverdueBadge: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  statusReceivedBadge: { backgroundColor: '#dcfce7', color: '#166534' },
  orderLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  orderNumber: { marginTop: 2, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  moneyMoonAmountBlock: { alignItems: 'flex-start', minWidth: 82 },
  moneyMoonAmount: { color: '#06b6d4', fontSize: 19, fontWeight: '900', textAlign: 'left' },
  moneyMoonCurrency: { marginTop: -2, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'left' },
  compactStatsRow: { marginTop: 10, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  compactStatBox: { flexGrow: 1, flexBasis: '47%', backgroundColor: '#f8fafc', borderRadius: 13, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#eef2f7' },
  compactStatLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  compactStatValue: { marginTop: 3, color: '#0f172a', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  iconActionsRow: { marginTop: 10, flexDirection: 'row-reverse', gap: 8, justifyContent: 'flex-start' },
  iconActionButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  receiveIconButton: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  editIconButton: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  deleteIconButton: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  iconActionText: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  deleteIconText: { color: '#be123c' },
});
