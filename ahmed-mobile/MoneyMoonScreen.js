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
const blankForm = () => ({
  orderNo: '',
  amount: '',
  category: 'A',
  investmentDate: today(),
  maturityDate: '',
  notes: '',
});

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

function formFromItem(item) {
  const meta = readMeta(item.metadata);
  return {
    orderNo: orderNumber(item, meta),
    amount: String(item.principal_amount || ''),
    category: meta.category || 'A',
    investmentDate: item.start_date || today(),
    maturityDate: item.maturity_date || '',
    notes: item.notes || '',
  };
}

function payloadFromForm(form) {
  return {
    amount: asNumber(form.amount),
    category: form.category,
    investment_date: form.investmentDate,
    maturity_date: form.maturityDate || null,
    order_no: String(form.orderNo || '').trim() || null,
    notes: form.notes || null,
  };
}

export default function MoneyMoonScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('list');
  const [filter, setFilter] = useState('all');
  const [addForm, setAddForm] = useState(blankForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const activeItems = useMemo(() => items.filter((item) => !isReceived(item)), [items]);
  const totalActive = useMemo(() => activeItems.reduce((sum, item) => sum + asNumber(item.principal_amount), 0), [activeItems]);
  const totalActiveProfit = useMemo(() => activeItems.reduce((sum, item) => sum + asNumber(item.expected_profit_amount), 0), [activeItems]);
  const overdueItems = useMemo(() => items.filter(isOverdue), [items]);
  const receivedItems = useMemo(() => items.filter(isReceived), [items]);

  const visibleItems = useMemo(() => {
    if (filter === 'active') return activeItems;
    if (filter === 'received') return receivedItems;
    if (filter === 'overdue') return overdueItems;
    return items;
  }, [activeItems, filter, items, overdueItems, receivedItems]);

  const loadItems = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/moneymoon/investments`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || 'تعذر تحميل استثمارات موني مون');
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل استثمارات موني مون');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const updateAddForm = (key, value) => setAddForm((current) => ({ ...current, [key]: value }));
  const updateEditForm = (key, value) => setEditForm((current) => ({ ...current, [key]: value }));

  const openAddScreen = () => {
    setAddForm(blankForm());
    setEditingId(null);
    setMode('add');
    setMessage('');
  };

  const closeAddScreen = () => {
    setMode('list');
    setAddForm(blankForm());
    setMessage('');
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm(formFromItem(item));
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(blankForm());
    setMessage('');
  };

  const saveForm = async ({ form, id }) => {
    if (!form.amount || asNumber(form.amount) <= 0) {
      setMessage('ادخل مبلغ الاستثمار بشكل صحيح');
      return;
    }

    setSaving(true);
    setMessage(id ? 'جاري حفظ التعديل...' : 'جاري حفظ الاستثمار...');

    try {
      const url = id ? `${API_URL}/moneymoon/investments/${id}` : `${API_URL}/moneymoon/investments`;
      const response = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payloadFromForm(form)),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.message || (id ? 'تعذر تعديل الاستثمار' : 'تعذر حفظ الاستثمار'));

      if (id) {
        cancelEdit();
        setMessage('تم تعديل استثمار موني مون');
      } else {
        setMode('list');
        setAddForm(blankForm());
        setMessage('تم حفظ استثمار موني مون');
      }
      await loadItems();
    } catch (error) {
      setMessage(error.message || (id ? 'تعذر تعديل الاستثمار' : 'تعذر حفظ الاستثمار'));
    } finally {
      setSaving(false);
    }
  };

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');
    try {
      const response = await fetch(`${API_URL}/moneymoon/investments/${item.id}/receive`, { method: 'POST', headers: { Accept: 'application/json' } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.message || 'تعذر تسجيل الاستلام');
      setMessage('تم اعتبار الاستثمار مستلمًا');
      await loadItems();
    } catch (error) {
      setMessage(error.message || 'تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
    }
  };

  const deleteInvestment = async (item) => {
    setDeletingId(item.id);
    setMessage('جاري حذف الاستثمار...');
    try {
      const response = await fetch(`${API_URL}/moneymoon/investments/${item.id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.message || 'تعذر حذف الاستثمار');
      if (editingId === item.id) cancelEdit();
      setMessage('تم حذف الاستثمار');
      await loadItems();
    } catch (error) {
      setMessage(error.message || 'تعذر حذف الاستثمار');
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

  if (mode === 'add') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topIcon} onPress={closeAddScreen} activeOpacity={0.82}><UiIcon name="back" size={24} /></TouchableOpacity>
            <View style={styles.topTitleBlock}>
              <Text style={styles.screenTitle}>إضافة موني مون</Text>
              <Text style={styles.screenSubtitle}>استثمار جديد مستقل عن القائمة</Text>
            </View>
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.addHero}>
            <View style={styles.addHeroIcon}><UiIcon name="add" size={30} color="#ffffff" /></View>
            <Text style={styles.addHeroTitle}>أدخل بيانات الاستثمار الجديد</Text>
            <Text style={styles.addHeroSubtitle}>يمكن ترك تاريخ الاستحقاق فارغًا ليتم احتسابه بعد شهر من تاريخ الاستثمار.</Text>
          </View>

          <InvestmentForm
            form={addForm}
            onChange={updateAddForm}
            onSave={() => saveForm({ form: addForm })}
            onCancel={closeAddScreen}
            saving={saving}
            saveLabel="حفظ الاستثمار"
            cancelLabel="رجوع"
          />
          {!!message && <Text style={styles.message}>{message}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIcon} onPress={onBack} activeOpacity={0.82}><UiIcon name="back" size={24} /></TouchableOpacity>
          <View style={styles.topTitleBlock}>
            <Text style={styles.screenTitle}>موني مون</Text>
            <Text style={styles.screenSubtitle}>إدارة الاستثمارات النشطة والمستلمة</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={[styles.topIcon, styles.primaryTopIcon]} onPress={openAddScreen} activeOpacity={0.82}>
              <UiIcon name="add" size={23} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topIcon} onPress={loadItems} activeOpacity={0.82}>
              <UiIcon name="refresh" size={23} />
            </TouchableOpacity>
          </View>
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
            <Metric label="استثمارات نشطة" value={String(activeItems.length)} />
            <Metric label="متأخرة" value={String(overdueItems.length)} danger={overdueItems.length > 0} />
          </View>
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>استثمارات موني مون</Text>
          <Text style={styles.sectionCounter}>{visibleItems.length}</Text>
        </View>

        <View style={styles.filterRow}>
          <FilterChip label="الكل" active={filter === 'all'} onPress={() => setFilter('all')} count={items.length} />
          <FilterChip label="نشطة" active={filter === 'active'} onPress={() => setFilter('active')} count={activeItems.length} />
          <FilterChip label="مستلمة" active={filter === 'received'} onPress={() => setFilter('received')} count={receivedItems.length} />
          <FilterChip label="متأخرة" active={filter === 'overdue'} onPress={() => setFilter('overdue')} count={overdueItems.length} danger={overdueItems.length > 0} />
        </View>

        {loading ? <StatusCard text="جاري تحميل موني مون..." loading /> : null}
        {!loading && visibleItems.length === 0 ? <StatusCard text="لا توجد استثمارات ضمن هذا الفلتر." /> : null}
        {!loading && visibleItems.map((item) => (
          <MoneyMoonCard
            key={String(item.id)}
            item={item}
            editing={editingId === item.id}
            editForm={editForm}
            onEditChange={updateEditForm}
            onEdit={() => startEdit(item)}
            onSaveEdit={() => saveForm({ form: editForm, id: item.id })}
            onCancelEdit={cancelEdit}
            onReceive={() => receiveInvestment(item)}
            onDelete={() => confirmDelete(item)}
            saving={saving && editingId === item.id}
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

function Field({ label, value, onChangeText, keyboardType, placeholder, multiline, compact }) {
  return (
    <View style={[styles.fieldBox, compact && styles.compactField]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={[styles.input, compact && styles.compactInput, multiline && styles.multiInput]}
        textAlign="right"
        multiline={multiline}
      />
    </View>
  );
}

function InvestmentForm({ form, onChange, onSave, onCancel, saving, saveLabel, cancelLabel, compact }) {
  const expectedProfit = calcProfit(form.amount, form.category);

  return (
    <View style={[styles.formCard, compact && styles.inlineFormCard]}>
      <Field label="رقم الطلب" value={form.orderNo} onChangeText={(text) => onChange('orderNo', text)} placeholder="مثال: L-12345" compact={compact} />
      <Field label="المبلغ المستثمر" value={form.amount} onChangeText={(text) => onChange('amount', text)} keyboardType="decimal-pad" placeholder="مثال: 1000" compact={compact} />
      <Text style={styles.inputLabel}>الفئة</Text>
      <View style={styles.categoryRow}>
        {['A', 'B', 'C', 'D'].map((item) => (
          <TouchableOpacity key={item} onPress={() => onChange('category', item)} style={[styles.categoryButton, compact && styles.compactCategoryButton, form.category === item && styles.categoryActive]} activeOpacity={0.82}>
            <Text style={[styles.categoryText, form.category === item && styles.categoryTextActive]}>{item}</Text>
            <Text style={[styles.categoryRate, form.category === item && styles.categoryTextActive]}>{categoryRate(item)}%</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.profitBox, compact && styles.compactProfitBox]}>
        <Text style={styles.profitLabel}>الربح المتوقع</Text>
        <Text style={styles.profitValue}>{money(expectedProfit)}</Text>
      </View>
      <Field label="تاريخ الاستثمار" value={form.investmentDate} onChangeText={(text) => onChange('investmentDate', text)} placeholder="YYYY-MM-DD" compact={compact} />
      <Field label="تاريخ الاستحقاق" value={form.maturityDate} onChangeText={(text) => onChange('maturityDate', text)} placeholder="فارغ = بعد شهر" compact={compact} />
      <Field label="ملاحظات" value={form.notes} onChangeText={(text) => onChange('notes', text)} placeholder="اختياري" multiline compact={compact} />
      <View style={styles.formActions}>
        <TouchableOpacity style={[styles.saveButton, compact && styles.compactSaveButton]} onPress={onSave} disabled={saving} activeOpacity={0.85}>
          <UiIcon name="save" size={18} color="#ffffff" />
          <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : saveLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MoneyMoonCard({
  item,
  editing,
  editForm,
  onEditChange,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onReceive,
  onDelete,
  saving,
  receiving,
  deleting,
}) {
  const meta = readMeta(item.metadata);
  const category = meta.category || '-';
  const rate = asNumber(item.expected_rate || meta.profit_rate || categoryRate(category));
  const profit = asNumber(item.expected_profit_amount || calcProfit(item.principal_amount, category));
  const received = isReceived(item);
  const overdue = isOverdue(item);
  const statusText = received ? 'مستلم' : overdue ? 'متأخر' : 'نشط';

  return (
    <View style={[styles.investmentCard, overdue && styles.overdueCard, received && styles.receivedCard, editing && styles.editingCard]}>
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

      {editing ? (
        <InvestmentForm
          form={editForm}
          onChange={onEditChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          saving={saving}
          saveLabel="حفظ التعديل"
          cancelLabel="إلغاء"
          compact
        />
      ) : (
        <>
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
        </>
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress, count, danger }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive, danger && styles.filterChipDanger]} onPress={onPress} activeOpacity={0.82}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive, danger && !active && styles.filterChipDangerText]}>{label}</Text>
      <Text style={[styles.filterCount, active && styles.filterChipTextActive, danger && !active && styles.filterChipDangerText]}>{count}</Text>
    </TouchableOpacity>
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
  topSpacer: { width: 43, height: 43 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryTopIcon: { backgroundColor: ICON_COLOR, borderColor: ICON_COLOR },
  topTitleBlock: { flex: 1, alignItems: 'center' },
  screenTitle: { color: '#0f172a', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  screenSubtitle: { marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  addHero: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 28, padding: 18, alignItems: 'center' },
  addHeroIcon: { width: 56, height: 56, borderRadius: 21, backgroundColor: ICON_COLOR, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  addHeroTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  addHeroSubtitle: { marginTop: 6, color: '#cbd5e1', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
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
  inlineFormCard: { marginTop: 12, borderRadius: 18, padding: 12, backgroundColor: '#f8fafc', borderColor: '#dbe7e5' },
  fieldBox: { marginTop: 8 },
  compactField: { marginTop: 7 },
  inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 13, color: '#0f172a', fontWeight: '700' },
  compactInput: { backgroundColor: '#ffffff', borderRadius: 13, padding: 10 },
  multiInput: { minHeight: 72, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  compactCategoryButton: { backgroundColor: '#ffffff', borderRadius: 13, paddingVertical: 8 },
  categoryActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  categoryText: { color: '#0f172a', fontWeight: '900' },
  categoryRate: { marginTop: 3, color: '#64748b', fontSize: 12, fontWeight: '900' },
  categoryTextActive: { color: '#ffffff' },
  profitBox: { marginTop: 12, backgroundColor: '#ecfeff', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#cffafe', alignItems: 'flex-end' },
  compactProfitBox: { padding: 10, borderRadius: 13 },
  profitLabel: { color: '#0e7490', fontWeight: '900' },
  profitValue: { marginTop: 4, color: '#0f172a', fontSize: 20, fontWeight: '900' },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', backgroundColor: '#eff6ff', borderRadius: 16, padding: 12, overflow: 'hidden' },
  formActions: { marginTop: 15, flexDirection: 'row-reverse', gap: 8 },
  saveButton: { flex: 1, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7 },
  compactSaveButton: { borderRadius: 14, paddingVertical: 12 },
  saveText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  cancelButton: { minWidth: 88, backgroundColor: '#f1f5f9', borderRadius: 18, paddingVertical: 15, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelButtonText: { color: '#334155', fontWeight: '900' },
  sectionHeader: { marginTop: 22, marginBottom: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sectionCounter: { color: ICON_COLOR_DARK, fontSize: 12, fontWeight: '900', backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  filterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  filterChipDanger: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  filterChipText: { color: '#334155', fontWeight: '900', fontSize: 12 },
  filterChipTextActive: { color: '#ffffff' },
  filterChipDangerText: { color: '#b91c1c' },
  filterCount: { color: '#64748b', fontWeight: '900', fontSize: 11 },
  statusCard: { marginTop: 10, backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  statusText: { marginTop: 7, color: '#64748b', fontWeight: '900', textAlign: 'center' },
  investmentCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#dbe7e5' },
  overdueCard: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  receivedCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  editingCard: { borderColor: ICON_COLOR, borderWidth: 1.5 },
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
