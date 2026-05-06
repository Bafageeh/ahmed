import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const asNumber = (value) => Number(value || 0);
const money = (value, digits = 2) => `${asNumber(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;
const rates = { A: 2, B: 2, C: 3, D: 4 };
const categoryRate = (category) => rates[category] || 0;
const calcProfit = (amount, category) => Math.round(asNumber(amount) * categoryRate(category)) / 100;

function readMeta(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch (error) {
    return {};
  }
}

function isReceived(item) {
  return item.status === 'received' || item.status === 'completed';
}

function isOverdue(item) {
  return Boolean(item.maturity_date && item.maturity_date < today() && !isReceived(item));
}

function orderNumber(item, meta) {
  if (meta?.external_order_no) return String(meta.external_order_no);
  if (meta?.order_no) return String(meta.order_no);
  const titleMatch = String(item.title || '').match(/L-[A-Za-z0-9-]+/);
  if (titleMatch) return titleMatch[0];
  const notesMatch = String(item.notes || '').match(/L-[A-Za-z0-9-]+/);
  return notesMatch ? notesMatch[0] : '';
}

export default function MoneyMoonScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('A');
  const [investmentDate, setInvestmentDate] = useState(today());
  const [maturityDate, setMaturityDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const activeItems = useMemo(() => items.filter((item) => !isReceived(item)), [items]);
  const totalActive = useMemo(() => activeItems.reduce((sum, item) => sum + asNumber(item.principal_amount), 0), [activeItems]);
  const totalActiveProfit = useMemo(() => activeItems.reduce((sum, item) => sum + asNumber(item.expected_profit_amount), 0), [activeItems]);
  const overdueCount = useMemo(() => items.filter(isOverdue).length, [items]);
  const expectedProfit = calcProfit(amount, category);

  const loadItems = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/moneymoon/investments`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error('load failed');
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage('تعذر تحميل استثمارات موني مون');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setCategory('A');
    setInvestmentDate(today());
    setMaturityDate('');
    setNotes('');
  };

  const startEdit = (item) => {
    const meta = readMeta(item.metadata);
    setEditingId(item.id);
    setAmount(String(item.principal_amount || ''));
    setCategory(meta.category || 'A');
    setInvestmentDate(item.start_date || today());
    setMaturityDate(item.maturity_date || '');
    setNotes(item.notes || '');
    setMessage('تم فتح الاستثمار للتعديل');
  };

  const saveInvestment = async () => {
    if (!amount || asNumber(amount) <= 0) {
      setMessage('ادخل مبلغ الاستثمار بشكل صحيح');
      return;
    }

    setSaving(true);
    setMessage(editingId ? 'جاري حفظ التعديل...' : 'جاري حفظ الاستثمار...');

    try {
      const url = editingId ? `${API_URL}/moneymoon/investments/${editingId}` : `${API_URL}/moneymoon/investments`;
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          amount: asNumber(amount),
          category,
          investment_date: investmentDate,
          maturity_date: maturityDate || null,
          notes: notes || null,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      resetForm();
      setMessage(editingId ? 'تم تعديل استثمار موني مون' : 'تم حفظ استثمار موني مون');
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
      setMessage('تم حذف الاستثمار');
      await loadItems();
    } catch (error) {
      setMessage('تعذر حذف الاستثمار');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (item) => {
    Alert.alert('حذف استثمار موني مون', 'هل تريد حذف هذا الاستثمار؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => deleteInvestment(item) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIcon} onPress={onBack} activeOpacity={0.82}><UiIcon name="back" size={24} /></TouchableOpacity>
          <View style={styles.topTitleBlock}>
            <Text style={styles.screenTitle}>موني مون</Text>
            <Text style={styles.screenSubtitle}>إدارة الاستثمارات النشطة والمستلمة</Text>
          </View>
          <TouchableOpacity style={[styles.topIcon, styles.primaryTopIcon]} onPress={loadItems} activeOpacity={0.82}>
            <Text style={styles.primaryTopIconText}>↻</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}><UiIcon name="moneymoon" size={28} color="#ffffff" /></View>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroKicker}>محفظة موني مون</Text>
              <Text style={styles.heroTitle}>إجماليات نشطة فقط</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <Metric label="موني مون النشطة" value={money(totalActive)} />
            <Metric label="أرباح موني مون النشطة" value={money(totalActiveProfit)} />
            <Metric label="عدد الاستثمارات" value={String(items.length)} />
            <Metric label="متأخرة" value={String(overdueCount)} danger={overdueCount > 0} />
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.sectionHeaderInline}>
            <Text style={styles.cardTitle}>{editingId ? 'تعديل استثمار' : 'إضافة استثمار'}</Text>
            {editingId ? <TouchableOpacity onPress={resetForm}><Text style={styles.cancelLink}>إلغاء</Text></TouchableOpacity> : null}
          </View>
          <Field label="المبلغ المستثمر" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="مثال: 1000" />
          <Text style={styles.inputLabel}>الفئة</Text>
          <View style={styles.categoryRow}>
            {['A', 'B', 'C', 'D'].map((item) => (
              <TouchableOpacity key={item} onPress={() => setCategory(item)} style={[styles.categoryButton, category === item && styles.categoryActive]} activeOpacity={0.82}>
                <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
                <Text style={[styles.categoryRate, category === item && styles.categoryTextActive]}>{categoryRate(item)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.profitBox}>
            <Text style={styles.profitLabel}>الربح المتوقع</Text>
            <Text style={styles.profitValue}>{money(expectedProfit)}</Text>
          </View>
          <Field label="تاريخ الاستثمار" value={investmentDate} onChangeText={setInvestmentDate} placeholder="YYYY-MM-DD" />
          <Field label="تاريخ الاستحقاق" value={maturityDate} onChangeText={setMaturityDate} placeholder="فارغ = بعد شهر" />
          <Field label="ملاحظات" value={notes} onChangeText={setNotes} placeholder="اختياري" multiline />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <TouchableOpacity style={styles.saveButton} onPress={saveInvestment} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديل' : 'حفظ الاستثمار'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>استثمارات موني مون</Text>
          <Text style={styles.sectionCounter}>{items.length}</Text>
        </View>
        {loading ? <StatusCard text="جاري تحميل موني مون..." loading /> : null}
        {!loading && items.length === 0 ? <StatusCard text="لا توجد استثمارات موني مون بعد." /> : null}
        {!loading && items.map((item) => (
          <MoneyMoonCard
            key={String(item.id)}
            item={item}
            onEdit={() => startEdit(item)}
            onReceive={() => receiveInvestment(item)}
            onDelete={() => confirmDelete(item)}
            receiving={receivingId === item.id}
            deleting={deletingId === item.id}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, danger }) {
  return (
    <View style={[styles.metricCard, danger && styles.metricDanger]}>
      <Text style={[styles.metricLabel, danger && styles.dangerText]}>{label}</Text>
      <Text style={[styles.metricValue, danger && styles.dangerText]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType, placeholder, multiline }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={[styles.input, multiline && styles.multiInput]}
        textAlign="right"
        multiline={multiline}
      />
    </View>
  );
}

function MoneyMoonCard({ item, onEdit, onReceive, onDelete, receiving, deleting }) {
  const meta = readMeta(item.metadata);
  const category = meta.category || '-';
  const rate = asNumber(item.expected_rate || meta.profit_rate || categoryRate(category));
  const profit = asNumber(item.expected_profit_amount || calcProfit(item.principal_amount, category));
  const received = isReceived(item);
  const overdue = isOverdue(item);
  const statusText = received ? 'مستلم' : overdue ? 'متأخر' : 'نشط';

  return (
    <View style={[styles.investmentCard, overdue && styles.overdueCard, received && styles.receivedCard]}>
      <View style={styles.cardTopRow}>
        <View style={[styles.cardIcon, overdue && styles.cardIconDanger, received && styles.cardIconReceived]}>
          <UiIcon name="moneymoon" size={23} color="#ffffff" />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.badgeRow}>
            <Text style={styles.categoryBadge}>{category}</Text>
            <Text style={[styles.statusBadge, overdue && styles.statusDanger, received && styles.statusReceived]}>{statusText}</Text>
          </View>
          <Text style={styles.orderLabel}>رقم الطلب</Text>
          <Text style={styles.orderText} numberOfLines={1}>{orderNumber(item, meta) || item.title || 'استثمار موني مون'}</Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={styles.amountValue}>{money(item.principal_amount, 0)}</Text>
          <Text style={styles.amountLabel}>المبلغ</Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <SmallStat label="الربح" value={money(profit)} />
        <SmallStat label="النسبة" value={`${rate}%`} />
        <SmallStat label="الاستثمار" value={item.start_date || '-'} />
        <SmallStat label="الاستحقاق" value={item.maturity_date || '-'} />
      </View>
      {item.notes ? <Text style={styles.notesText}>ملاحظات: {item.notes}</Text> : null}
      <View style={styles.actionsRow}>
        {!received ? <IconButton icon="receive" label={receiving ? '...' : 'استلام'} onPress={onReceive} disabled={receiving || deleting} /> : null}
        <IconButton icon="edit" label="تعديل" onPress={onEdit} disabled={deleting} />
        <IconButton icon="delete" label={deleting ? '...' : 'حذف'} onPress={onDelete} danger disabled={deleting} />
      </View>
    </View>
  );
}

function SmallStat({ label, value }) {
  return <View style={styles.smallStat}><Text style={styles.smallLabel}>{label}</Text><Text style={styles.smallValue} numberOfLines={1}>{value}</Text></View>;
}

function IconButton({ icon, label, onPress, danger, disabled }) {
  return (
    <TouchableOpacity style={[styles.actionButton, danger && styles.deleteButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>
      <UiIcon name={icon} size={18} color={danger ? '#b91c1c' : ICON_COLOR_DARK} />
      <Text style={[styles.actionText, danger && styles.deleteText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusCard({ text, loading }) {
  return (
    <View style={styles.statusCard}>
      {loading ? <ActivityIndicator /> : null}
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 16, paddingBottom: 34 },
  topBar: { marginTop: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  topIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  primaryTopIcon: { backgroundColor: ICON_COLOR, borderColor: ICON_COLOR },
  primaryTopIconText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  topTitleBlock: { flex: 1, alignItems: 'center' },
  screenTitle: { color: '#0f172a', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  screenSubtitle: { marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  heroCard: { marginTop: 16, backgroundColor: '#ffffff', borderRadius: 28, padding: 16, borderWidth: 1, borderColor: '#dbe7e5' },
  heroHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 52, height: 52, borderRadius: 19, backgroundColor: ICON_COLOR, alignItems: 'center', justifyContent: 'center' },
  heroTextBlock: { flex: 1, alignItems: 'flex-end' },
  heroKicker: { color: ICON_COLOR_DARK, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  heroTitle: { marginTop: 2, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  metricCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 20, padding: 12, minHeight: 92, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  metricDanger: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  metricLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  metricValue: { marginTop: 6, color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  dangerText: { color: '#b91c1c' },
  formCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 24, padding: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHeaderInline: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  cancelLink: { color: '#b91c1c', fontWeight: '900' },
  fieldBox: { marginTop: 8 },
  inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 13, color: '#0f172a', fontWeight: '700' },
  multiInput: { minHeight: 72, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  categoryActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  categoryText: { color: '#0f172a', fontWeight: '900' },
  categoryRate: { marginTop: 3, color: '#64748b', fontSize: 12, fontWeight: '900' },
  categoryTextActive: { color: '#ffffff' },
  profitBox: { marginTop: 12, backgroundColor: '#ecfeff', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#cffafe', alignItems: 'flex-end' },
  profitLabel: { color: '#0e7490', fontWeight: '900' },
  profitValue: { marginTop: 4, color: '#0f172a', fontSize: 20, fontWeight: '900' },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', backgroundColor: '#eff6ff', borderRadius: 16, padding: 12, overflow: 'hidden' },
  saveButton: { marginTop: 15, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  sectionHeader: { marginTop: 22, marginBottom: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sectionCounter: { color: ICON_COLOR_DARK, fontSize: 12, fontWeight: '900', backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  statusCard: { marginTop: 10, backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  statusText: { marginTop: 7, color: '#64748b', fontWeight: '900', textAlign: 'center' },
  investmentCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#dbe7e5' },
  overdueCard: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  receivedCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cardTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  cardIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: ICON_COLOR, alignItems: 'center', justifyContent: 'center' },
  cardIconDanger: { backgroundColor: '#f97316' },
  cardIconReceived: { backgroundColor: '#16a34a' },
  cardInfo: { flex: 1, alignItems: 'flex-end' },
  badgeRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 5 },
  categoryBadge: { backgroundColor: '#ecfeff', color: '#0891b2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontWeight: '900', fontSize: 12 },
  statusBadge: { backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden', fontWeight: '900', fontSize: 12 },
  statusDanger: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  statusReceived: { backgroundColor: '#dcfce7', color: '#166534' },
  orderLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  orderText: { marginTop: 2, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  amountBlock: { alignItems: 'flex-start', minWidth: 84 },
  amountValue: { color: ICON_COLOR_DARK, fontSize: 17, fontWeight: '900', textAlign: 'left' },
  amountLabel: { marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'left' },
  detailsGrid: { marginTop: 10, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  smallStat: { flexGrow: 1, flexBasis: '47%', backgroundColor: '#f8fafc', borderRadius: 13, paddingVertical: 9, paddingHorizontal: 10, alignItems: 'flex-end' },
  smallLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  smallValue: { marginTop: 3, color: '#0f172a', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  notesText: { marginTop: 9, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  actionsRow: { marginTop: 11, flexDirection: 'row-reverse', gap: 8, justifyContent: 'flex-start' },
  actionButton: { minWidth: 76, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10 },
  deleteButton: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  disabledButton: { opacity: 0.55 },
  actionText: { color: ICON_COLOR_DARK, fontWeight: '900', fontSize: 12 },
  deleteText: { color: '#b91c1c' },
});
