import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const today = () => new Date().toISOString().slice(0, 10);
const asNumber = (value) => Number(value || 0);

function readMeta(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch (error) { return {}; }
}

function isReceived(item) {
  return item.status === 'received' || item.status === 'completed';
}

function isOverdue(item) {
  const meta = readMeta(item.metadata);
  return !isReceived(item) && Boolean((item.maturity_date && item.maturity_date < today()) || meta.is_overdue || asNumber(meta.remaining_days) < 0);
}

export default function Ta3meedScreen({ onBack }) {
  const [tab, setTab] = useState('investments');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [receivingId, setReceivingId] = useState(null);

  const totalInvested = useMemo(() => items.reduce((sum, item) => sum + asNumber(item.principal_amount), 0), [items]);
  const totalProfit = useMemo(() => items.reduce((sum, item) => sum + asNumber(item.expected_profit_amount), 0), [items]);
  const overdueCount = useMemo(() => items.filter(isOverdue).length, [items]);

  const loadData = async () => {
    setMessage('جاري تحميل تعميد...');
    try {
      const investmentsResponse = await fetch(`${API_URL}/ta3meed/investments`);
      const investmentsJson = await investmentsResponse.json();
      setItems(Array.isArray(investmentsJson.data) ? investmentsJson.data : []);
      const summaryResponse = await fetch(`${API_URL}/ta3meed/summary`);
      const summaryJson = await summaryResponse.json();
      setSummary(summaryJson.data || null);
      setMessage('');
    } catch (error) {
      setMessage('تعذر تحميل بيانات تعميد');
    }
  };

  useEffect(() => { loadData(); }, []);

  const startEdit = (item) => {
    const meta = readMeta(item.metadata);
    setEditing({
      id: item.id,
      code: item.reference_number || '',
      total_amount: String(item.principal_amount || ''),
      profit: String(item.expected_profit_amount || ''),
      profit_rate: String(item.expected_rate || ''),
      category: meta.category || '',
      months: String(meta.months || ''),
      start_date: meta.withdrawal_date || item.start_date || '',
      maturity_date: item.maturity_date || '',
      returned_amount: String(meta.returned_amount || ''),
      notes: item.notes || '',
      allocationsText: (item.allocations || []).map((a) => `${a.investor_name}:${a.invested_amount}`).join('\n'),
    });
    setTab('edit');
    setMessage('تم فتح الاستثمار للتعديل');
  };

  const saveEdit = async () => {
    if (!editing?.code || !editing?.total_amount) {
      setMessage('أدخل الكود والمبلغ');
      return;
    }

    const allocations = editing.allocationsText.split('\n').map((line) => {
      const [investor, amount] = line.split(':');
      return { investor: (investor || '').trim(), amount: Number(amount || 0) };
    }).filter((item) => item.investor && item.amount > 0);

    setMessage('جاري حفظ التعديل...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          code: editing.code,
          total_amount: Number(editing.total_amount),
          profit: Number(editing.profit || 0),
          profit_rate: Number(editing.profit_rate || 0),
          category: editing.category || null,
          months: editing.months ? Number(editing.months) : null,
          start_date: editing.start_date || null,
          maturity_date: editing.maturity_date || null,
          returned_amount: editing.returned_amount ? Number(editing.returned_amount) : null,
          notes: editing.notes || null,
          allocations,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setEditing(null);
      setTab('investments');
      setMessage('تم حفظ تعديل تعميد');
      await loadData();
    } catch (error) {
      setMessage('تعذر حفظ تعديل تعميد');
    }
  };

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/${item.id}/receive`, { method: 'POST', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('receive failed');
      setMessage('تم اعتبار استثمار تعميد مستلمًا');
      await loadData();
    } catch (error) {
      setMessage('تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.badge}>تعميد</Text>
          <Text style={styles.title}>استثمارات تعميد</Text>
          <Text style={styles.subtitle}>إحصائيات، تعديل، واستلام فرص تعميد.</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.box}><Text style={styles.big}>{summary?.active_count ?? items.length}</Text><Text style={styles.label}>فرص</Text></View>
          <View style={styles.box}><Text style={styles.big}>{totalInvested.toFixed(2)}</Text><Text style={styles.label}>إجمالي الاستثمار</Text></View>
        </View>
        <View style={styles.row}>
          <View style={styles.box}><Text style={styles.big}>{totalProfit.toFixed(2)}</Text><Text style={styles.label}>الربح المتوقع</Text></View>
          <View style={[styles.box, overdueCount > 0 && styles.overdueCard]}><Text style={[styles.big, overdueCount > 0 && styles.overdueText]}>{overdueCount}</Text><Text style={[styles.label, overdueCount > 0 && styles.overdueText]}>متأخر</Text></View>
        </View>

        <View style={styles.tabs}>
          <TabButton label="الفرص" active={tab === 'investments'} onPress={() => setTab('investments')} />
          <TabButton label="إحصائيات المستثمرين" active={tab === 'investors'} onPress={() => setTab('investors')} />
          {editing ? <TabButton label="تعديل" active={tab === 'edit'} onPress={() => setTab('edit')} /> : null}
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}

        {tab === 'investors' ? <InvestorStats summary={summary} /> : null}
        {tab === 'edit' && editing ? <EditForm editing={editing} setEditing={setEditing} saveEdit={saveEdit} cancel={() => { setEditing(null); setTab('investments'); }} /> : null}
        {tab === 'investments' ? (
          <>
            <TouchableOpacity style={styles.refreshBox} onPress={loadData}><Text style={styles.refreshText}>تحديث البيانات</Text></TouchableOpacity>
            <Text style={styles.sectionTitle}>فرص تعميد</Text>
            {items.length === 0 ? <EmptyCard /> : items.map((item) => <Ta3meedCard key={String(item.id)} item={item} onEdit={() => startEdit(item)} onReceive={() => receiveInvestment(item)} receiving={receivingId === item.id} />)}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }) {
  return <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></TouchableOpacity>;
}

function InvestorStats({ summary }) {
  const investors = summary?.investors || [];
  if (!investors.length) return <EmptyCard title="لا توجد إحصائيات" text="لا توجد بيانات مستثمرين بعد." />;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>إحصائيات كل مستثمر</Text>
      {investors.map((investor) => (
        <View key={investor.name} style={styles.investorRow}>
          <Text style={styles.investorName}>{investor.name}</Text>
          <Text style={styles.investorText}>مجموع استثماراته: {asNumber(investor.invested).toFixed(2)} ر.س</Text>
          <Text style={styles.investorText}>مجموع أرباحه المتوقعة: {asNumber(investor.profit).toFixed(2)} ر.س</Text>
        </View>
      ))}
    </View>
  );
}

function EditForm({ editing, setEditing, saveEdit, cancel }) {
  const setField = (key, value) => setEditing((current) => ({ ...current, [key]: value }));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>تعديل استثمار تعميد</Text>
      <Field label="الكود" value={editing.code} onChangeText={(v) => setField('code', v)} />
      <Field label="المبلغ" value={editing.total_amount} onChangeText={(v) => setField('total_amount', v)} keyboardType="decimal-pad" />
      <Field label="الربح" value={editing.profit} onChangeText={(v) => setField('profit', v)} keyboardType="decimal-pad" />
      <Field label="نسبة الربح" value={editing.profit_rate} onChangeText={(v) => setField('profit_rate', v)} keyboardType="decimal-pad" />
      <Field label="التصنيف" value={editing.category} onChangeText={(v) => setField('category', v)} />
      <Field label="الشهور" value={editing.months} onChangeText={(v) => setField('months', v)} keyboardType="number-pad" />
      <Field label="تاريخ السحب" value={editing.start_date} onChangeText={(v) => setField('start_date', v)} />
      <Field label="تاريخ الاستحقاق" value={editing.maturity_date} onChangeText={(v) => setField('maturity_date', v)} />
      <Field label="المسترد" value={editing.returned_amount} onChangeText={(v) => setField('returned_amount', v)} keyboardType="decimal-pad" />
      <Text style={styles.inputLabel}>توزيع المستثمرين</Text>
      <TextInput value={editing.allocationsText} onChangeText={(v) => setField('allocationsText', v)} style={[styles.input, styles.multiInput]} multiline placeholder={'أحمد:10000\nأمل:5000'} />
      <Field label="ملاحظات" value={editing.notes} onChangeText={(v) => setField('notes', v)} />
      <TouchableOpacity style={styles.saveButton} onPress={saveEdit}><Text style={styles.saveText}>حفظ التعديل</Text></TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={cancel}><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType }) {
  return <><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.input} textAlign="right" /></>;
}

function Ta3meedCard({ item, onEdit, onReceive, receiving }) {
  const meta = readMeta(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const overdue = isOverdue(item);
  const received = isReceived(item);
  return (
    <View style={[styles.card, overdue && styles.overdueCard, received && styles.receivedCard]}>
      <Text style={[styles.cardTitle, overdue && styles.overdueText]}>{item.reference_number}</Text>
      {overdue ? <Text style={styles.overdueBadge}>متأخر ولم يتم الاستلام</Text> : null}
      {received ? <Text style={styles.receivedBadge}>تم الاستلام</Text> : null}
      <Text style={styles.cardText}>التصنيف: {meta.category || '-'}</Text>
      <Text style={styles.cardText}>المبلغ: {asNumber(item.principal_amount).toFixed(2)} ر.س</Text>
      <Text style={styles.cardText}>نسبة الربح: {asNumber(item.expected_rate).toFixed(3)}%</Text>
      <Text style={styles.cardText}>الربح: {asNumber(item.expected_profit_amount).toFixed(2)} ر.س</Text>
      <Text style={styles.cardText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
      <Text style={styles.cardText}>تاريخ الاستحقاق: {item.maturity_date || '-'}</Text>
      <Text style={styles.cardText}>مسترد: {asNumber(meta.returned_amount).toFixed(2)} ر.س</Text>
      <Text style={styles.cardText}>الحالة: {received ? 'مستلم' : item.status || '-'}</Text>
      {allocations.length ? <View style={styles.allocBox}><Text style={styles.allocTitle}>توزيع المستثمرين</Text>{allocations.map((a) => <Text key={a.id} style={styles.allocText}>{a.investor_name}: {asNumber(a.invested_amount).toFixed(2)} ر.س / ربح {asNumber(a.expected_profit_amount).toFixed(2)}</Text>)}</View> : null}
      <View style={styles.actions}>
        {!received ? <TouchableOpacity style={styles.receiveButton} onPress={onReceive} disabled={receiving}><Text style={styles.receiveText}>{receiving ? 'جاري التسجيل...' : 'تم الاستلام'}</Text></TouchableOpacity> : null}
        <TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyCard({ title = 'لا توجد بيانات', text = 'تأكد من تشغيل migrations وإدخال بيانات تعميد.' }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 16, fontSize: 34, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 16, textAlign: 'right', lineHeight: 25 },
  row: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 },
  box: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  big: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  label: { marginTop: 5, color: '#64748b', textAlign: 'right' },
  tabs: { marginTop: 14, flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  tab: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  tabText: { color: '#0f172a', fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  refreshBox: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 18, padding: 15, alignItems: 'center' },
  refreshText: { color: '#fff', fontWeight: '900' },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  cardText: { marginTop: 6, color: '#64748b', textAlign: 'right' },
  allocBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12 },
  allocTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  allocText: { color: '#475569', textAlign: 'right', marginTop: 4 },
  investorRow: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 10 },
  investorName: { color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  investorText: { color: '#64748b', textAlign: 'right', marginTop: 4 },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '800' },
  overdueCard: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  receivedCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  overdueText: { color: '#b91c1c' },
  overdueBadge: { marginTop: 8, color: '#991b1b', backgroundColor: '#fee2e2', borderRadius: 12, padding: 8, textAlign: 'right', fontWeight: '900' },
  receivedBadge: { marginTop: 8, color: '#166534', backgroundColor: '#dcfce7', borderRadius: 12, padding: 8, textAlign: 'right', fontWeight: '900' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
  inputLabel: { color: '#334155', fontWeight: '800', textAlign: 'right', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, color: '#0f172a' },
  multiInput: { minHeight: 100, textAlignVertical: 'top' },
  saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelButton: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelText: { color: '#0f172a', fontWeight: '900' },
  actions: { marginTop: 14, flexDirection: 'row-reverse', gap: 8 },
  receiveButton: { flex: 1, backgroundColor: '#166534', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  receiveText: { color: '#fff', fontWeight: '900' },
  editButton: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  editText: { color: '#0f172a', fontWeight: '900' },
});
