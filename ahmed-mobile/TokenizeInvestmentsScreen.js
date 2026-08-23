import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const money = (value, digits = 2) => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;
const num = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const pct = (value) => `${num(value).toFixed(2)}%`;
const statusLabel = (status) => status === 'completed' ? 'منتهية' : status === 'paused' ? 'موقوفة' : 'قائمة';
const emptyInvestment = () => ({ external_key: '', title: '', sector: '', investment_amount: '', units: '', duration_months: '', roi: '', apr: '', irr: '', platform_fee_rate: '1', platform_fee_vat_rate: '15', distribution_type: 'ربع سنوي', start_date: '', end_date: '', status: 'active', notes: '' });
const emptyPayment = () => ({ due_date: '', profit_amount: '', principal_amount: '', is_paid: false, notes: '' });

export default function TokenizeInvestmentsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyInvestment());
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(emptyPayment());

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/tokenize/investments`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل ترميز');
      const data = Array.isArray(json.data) ? json.data : [];
      setItems(data);
      setSummary(json.summary || {});
      setSelectedId((id) => id && data.some((x) => x.id === id) ? id : null);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل ترميز');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyInvestment()); setFormOpen(true); };
  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      external_key: item.external_key || '', title: item.title || '', sector: item.sector || '', investment_amount: String(item.investment_amount ?? ''),
      units: String(item.units ?? ''), duration_months: String(item.duration_months ?? ''), roi: String(item.roi ?? ''), apr: String(item.apr ?? ''), irr: String(item.irr ?? ''),
      platform_fee_rate: String(item.platform_fee_rate ?? 1), platform_fee_vat_rate: String(item.platform_fee_vat_rate ?? 15), distribution_type: item.distribution_type || '', start_date: item.start_date || '', end_date: item.end_date || '', status: item.status || 'active', notes: item.notes || '',
    });
    setFormOpen(true);
  };

  const saveInvestment = async () => {
    if (!form.external_key.trim() || !form.title.trim()) return setMessage('أدخل رقم الفرصة واسمها.');
    if (num(form.investment_amount) <= 0 || num(form.duration_months) <= 0) return setMessage('أدخل مبلغ الاستثمار والمدة بشكل صحيح.');
    try {
      const url = editingId ? `${API_URL}/tokenize/investments/${editingId}` : `${API_URL}/tokenize/investments`;
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: ahmedUserHeaders({ Accept: 'application/json', 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...form,
          investment_amount: num(form.investment_amount), units: Math.round(num(form.units)), duration_months: Math.round(num(form.duration_months)),
          roi: num(form.roi), apr: num(form.apr), irr: num(form.irr), platform_fee_rate: num(form.platform_fee_rate), platform_fee_vat_rate: num(form.platform_fee_vat_rate), start_date: form.start_date || null, end_date: form.end_date || null,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ الفرصة');
      setFormOpen(false);
      setMessage(editingId ? 'تم تعديل الفرصة.' : 'تمت إضافة الفرصة.');
      await load();
      if (editingId) setSelectedId(editingId);
    } catch (error) { setMessage(error.message || 'تعذر حفظ الفرصة'); }
  };

  const deleteInvestment = (item) => Alert.alert('حذف الفرصة', `هل تريد حذف ${item.title} وجميع توزيعاتها؟`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => {
      try {
        const response = await fetch(`${API_URL}/tokenize/investments/${item.id}`, { method: 'DELETE', headers: ahmedUserHeaders({ Accept: 'application/json' }) });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.message || 'تعذر الحذف');
        setSelectedId(null); setMessage('تم حذف الفرصة.'); await load();
      } catch (error) { setMessage(error.message || 'تعذر الحذف'); }
    }},
  ]);

  const openAddPayment = () => { setEditingPaymentId(null); setPaymentForm(emptyPayment()); setPaymentOpen(true); };
  const openEditPayment = (payment) => {
    setEditingPaymentId(payment.id);
    setPaymentForm({ due_date: payment.due_date || '', profit_amount: String(payment.profit_amount ?? ''), principal_amount: String(payment.principal_amount ?? ''), is_paid: Boolean(Number(payment.is_paid)), notes: payment.notes || '' });
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    if (!selected || !paymentForm.due_date) return setMessage('أدخل تاريخ التوزيع.');
    try {
      const url = editingPaymentId ? `${API_URL}/tokenize/investments/${selected.id}/payments/${editingPaymentId}` : `${API_URL}/tokenize/investments/${selected.id}/payments`;
      const response = await fetch(url, {
        method: editingPaymentId ? 'PUT' : 'POST',
        headers: ahmedUserHeaders({ Accept: 'application/json', 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...paymentForm, profit_amount: num(paymentForm.profit_amount), principal_amount: num(paymentForm.principal_amount) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ التوزيع');
      setPaymentOpen(false); setMessage(editingPaymentId ? 'تم تعديل التوزيع.' : 'تمت إضافة التوزيع.'); await load(); setSelectedId(selected.id);
    } catch (error) { setMessage(error.message || 'تعذر حفظ التوزيع'); }
  };

  const togglePayment = async (payment) => {
    try {
      const response = await fetch(`${API_URL}/tokenize/payments/${payment.id}/toggle-paid`, {
        method: 'POST', headers: ahmedUserHeaders({ Accept: 'application/json', 'Content-Type': 'application/json' }), body: JSON.stringify({ is_paid: !Boolean(Number(payment.is_paid)) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحديث الاستلام');
      await load(); setSelectedId(selected?.id || null);
    } catch (error) { setMessage(error.message || 'تعذر تحديث الاستلام'); }
  };

  const deletePayment = (payment) => Alert.alert('حذف التوزيع', 'هل تريد حذف هذا التوزيع؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => {
      if (!selected) return;
      try {
        const response = await fetch(`${API_URL}/tokenize/investments/${selected.id}/payments/${payment.id}`, { method: 'DELETE', headers: ahmedUserHeaders({ Accept: 'application/json' }) });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.message || 'تعذر حذف التوزيع');
        await load(); setSelectedId(selected.id);
      } catch (error) { setMessage(error.message || 'تعذر حذف التوزيع'); }
    }},
  ]);

  if (selected) {
    const payments = selected.payments || [];
    const received = payments.filter((p) => Boolean(Number(p.is_paid))).reduce((s, p) => s + num(p.profit_amount), 0);
    const scheduledProfit = payments.reduce((s, p) => s + num(p.profit_amount), 0);
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
      <View style={styles.topBar}><TouchableOpacity style={styles.backButton} onPress={() => setSelectedId(null)}><UiIcon name="back" size={24} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.topTitle} numberOfLines={1}>{selected.external_key}</Text><TouchableOpacity style={styles.editTop} onPress={() => openEdit(selected)}><Text style={styles.editTopText}>تعديل</Text></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#7c3aed" />}>
        <View style={styles.detailHero}><Text style={styles.heroBadge}>ترميز</Text><Text style={styles.detailTitle}>{selected.title}</Text><Text style={styles.detailSub}>{selected.sector || 'بدون قطاع'}</Text></View>
        {!!message && <Text style={styles.message}>{message}</Text>}
        <View style={styles.statsGrid}><Stat title="الاستثمار" value={money(selected.investment_amount, 0)} /><Stat title="ROI" value={pct(selected.roi)} /><Stat title="APR" value={pct(selected.apr)} /><Stat title="IRR" value={pct(selected.irr)} /></View>
        <View style={styles.infoCard}><Info label="المدة" value={`${selected.duration_months} شهر`} /><Info label="عدد الصكوك" value={String(selected.units || 0)} /><Info label="التوزيع" value={selected.distribution_type || '-'} /><Info label="الحالة" value={statusLabel(selected.status)} /><Info label="عمولة ترميز السنوية" value={pct(selected.platform_fee_rate)} /><Info label="ضريبة العمولة" value={pct(selected.platform_fee_vat_rate)} /><Info label="بداية التوزيع" value={selected.start_date || '-'} /><Info label="نهاية التوزيع" value={selected.end_date || '-'} /></View>
        <View style={styles.profitCard}><Text style={styles.profitLabel}>صافي الربح بعد عمولة ترميز</Text><Text style={styles.profitValue}>{money(scheduledProfit, 2)}</Text><Text style={styles.profitSub}>قبل العمولة {money(selected.gross_profit, 2)} · العمولة والضريبة {money(selected.platform_fee_total, 2)}</Text><Text style={styles.profitSub}>عمولة {money(selected.platform_fee_before_vat, 2)} + ضريبة {money(selected.platform_fee_vat, 2)} · المستلم {money(received, 2)} · المتبقي {money(Math.max(0, scheduledProfit - received), 2)}</Text></View>
        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>جدول التوزيعات</Text><TouchableOpacity style={styles.smallAdd} onPress={openAddPayment}><Text style={styles.smallAddText}>+ إضافة توزيع</Text></TouchableOpacity></View>
        {payments.length === 0 ? <Text style={styles.empty}>لا توجد توزيعات مسجلة.</Text> : payments.map((payment) => <View key={payment.id} style={[styles.paymentCard, Boolean(Number(payment.is_paid)) && styles.paymentPaid]}>
          <View style={styles.paymentHeader}><Text style={styles.paymentDate}>{payment.due_date}</Text><Text style={styles.paymentNo}>دفعة {payment.installment_no}</Text></View>
          <View style={styles.paymentAmounts}><Text style={styles.paymentValue}>عائد {money(payment.profit_amount, 2)}</Text><Text style={styles.paymentValue}>رأس مال {money(payment.principal_amount, 2)}</Text></View>
          <View style={styles.actionsRow}><TouchableOpacity style={[styles.actionButton, Boolean(Number(payment.is_paid)) && styles.receivedButton]} onPress={() => togglePayment(payment)}><Text style={[styles.actionText, Boolean(Number(payment.is_paid)) && styles.receivedText]}>{Boolean(Number(payment.is_paid)) ? 'تم الاستلام ✓' : 'تسجيل مستلم'}</Text></TouchableOpacity><TouchableOpacity style={styles.actionButton} onPress={() => openEditPayment(payment)}><Text style={styles.actionText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={() => deletePayment(payment)}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity></View>
        </View>)}
        <TouchableOpacity style={styles.deleteOpportunity} onPress={() => deleteInvestment(selected)}><Text style={styles.deleteOpportunityText}>حذف الفرصة</Text></TouchableOpacity>
      </ScrollView>
      <InvestmentModal visible={formOpen} form={form} setForm={setForm} editing={Boolean(editingId)} onClose={() => setFormOpen(false)} onSave={saveInvestment} />
      <PaymentModal visible={paymentOpen} form={paymentForm} setForm={setPaymentForm} editing={Boolean(editingPaymentId)} onClose={() => setPaymentOpen(false)} onSave={savePayment} />
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
    <View style={styles.topBar}><TouchableOpacity style={styles.backButton} onPress={onBack}><UiIcon name="back" size={24} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.topTitle}>#S-144 استثمار ترميز</Text><TouchableOpacity style={styles.addTop} onPress={openAdd}><Text style={styles.addTopText}>+</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#7c3aed" />}>
      <View style={styles.hero}><Text style={styles.heroBadge}>ترميز</Text><Text style={styles.heroTitle}>صكوك وفرص الاستثمار</Text><Text style={styles.heroText}>إضافة الفرص وإدارتها ومتابعة العوائد والتوزيعات ورأس المال.</Text></View>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {loading && !items.length ? <ActivityIndicator color="#7c3aed" style={{ marginTop: 14 }} /> : null}
      <View style={styles.statsGrid}><Stat title="إجمالي الاستثمار" value={money(summary.total_investment, 0)} /><Stat title="الفرص القائمة" value={String(summary.active_count || 0)} /><Stat title="الربح قبل العمولة" value={money(summary.gross_expected_profit, 2)} /><Stat title="عمولة ترميز + الضريبة" value={money(summary.platform_fee_total, 2)} /><Stat title="صافي الربح" value={money(summary.expected_profit, 2)} /><Stat title="متوسط APR" value={pct(summary.weighted_apr)} /></View>
      <TouchableOpacity style={styles.primaryAdd} onPress={openAdd}><Text style={styles.primaryAddText}>+ إضافة فرصة ترميز</Text></TouchableOpacity>
      <Text style={styles.sectionTitle}>الفرص</Text>
      {items.length === 0 && !loading ? <Text style={styles.empty}>لا توجد فرص مسجلة.</Text> : null}
      {items.map((item) => <TouchableOpacity key={item.id} activeOpacity={0.86} style={styles.card} onPress={() => setSelectedId(item.id)}>
        <View style={styles.cardHeader}><View style={styles.tokenIcon}><UiIcon name="tokenize" size={25} color="#7c3aed" /></View><View style={styles.cardTitleBlock}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardSub}>{item.sector || 'بدون قطاع'} · {statusLabel(item.status)}</Text></View></View>
        <View style={styles.metrics}><Metric label="الاستثمار" value={money(item.investment_amount, 0)} /><Metric label="المدة" value={`${item.duration_months} شهر`} /><Metric label="ROI" value={pct(item.roi)} /><Metric label="APR" value={pct(item.apr)} /></View>
        <View style={styles.cardBottom}><Text style={styles.cardBottomText}>{item.distribution_type || 'بدون توزيع محدد'}</Text><Text style={styles.cardBottomText}>{item.start_date || '-'} ← {item.end_date || '-'}</Text></View>
        <Text style={styles.openText}>فتح التفاصيل والتحكم</Text>
      </TouchableOpacity>)}
    </ScrollView>
    <InvestmentModal visible={formOpen} form={form} setForm={setForm} editing={Boolean(editingId)} onClose={() => setFormOpen(false)} onSave={saveInvestment} />
  </SafeAreaView>;
}

function InvestmentModal({ visible, form, setForm, editing, onClose, onSave }) {
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalCard}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing ? 'تعديل فرصة ترميز' : 'إضافة فرصة ترميز'}</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeText}>إغلاق</Text></TouchableOpacity></View>
    <Label text="رقم الفرصة" /><TextInput style={styles.input} value={form.external_key} onChangeText={(v) => field('external_key', v)} placeholder="مثال: 1171-09" />
    <Label text="اسم الفرصة" /><TextInput style={styles.input} value={form.title} onChangeText={(v) => field('title', v)} placeholder="صكوك المرابحة ..." />
    <Label text="القطاع" /><TextInput style={styles.input} value={form.sector} onChangeText={(v) => field('sector', v)} placeholder="الصناعات" />
    <View style={styles.twoCols}><Field label="مبلغ الاستثمار" value={form.investment_amount} onChange={(v) => field('investment_amount', v)} numeric /><Field label="عدد الصكوك" value={form.units} onChange={(v) => field('units', v)} numeric /></View>
    <View style={styles.twoCols}><Field label="المدة بالشهور" value={form.duration_months} onChange={(v) => field('duration_months', v)} numeric /><Field label="ROI %" value={form.roi} onChange={(v) => field('roi', v)} numeric /></View>
    <View style={styles.twoCols}><Field label="APR %" value={form.apr} onChange={(v) => field('apr', v)} numeric /><Field label="IRR %" value={form.irr} onChange={(v) => field('irr', v)} numeric /></View>
    <View style={styles.twoCols}><Field label="عمولة ترميز السنوية %" value={form.platform_fee_rate} onChange={(v) => field('platform_fee_rate', v)} numeric /><Field label="ضريبة العمولة %" value={form.platform_fee_vat_rate} onChange={(v) => field('platform_fee_vat_rate', v)} numeric /></View>
    <Label text="نوع التوزيع" /><TextInput style={styles.input} value={form.distribution_type} onChangeText={(v) => field('distribution_type', v)} placeholder="ربع سنوي" />
    <View style={styles.twoCols}><Field label="تاريخ البداية" value={form.start_date} onChange={(v) => field('start_date', v)} placeholder="2026-11-24" /><Field label="تاريخ النهاية" value={form.end_date} onChange={(v) => field('end_date', v)} placeholder="2027-08-24" /></View>
    <Label text="الحالة" /><View style={styles.choiceRow}>{[['active','قائمة'],['completed','منتهية'],['paused','موقوفة']].map(([key,label]) => <TouchableOpacity key={key} style={[styles.choice, form.status === key && styles.choiceActive]} onPress={() => field('status', key)}><Text style={[styles.choiceText, form.status === key && styles.choiceTextActive]}>{label}</Text></TouchableOpacity>)}</View>
    <Label text="ملاحظات" /><TextInput style={[styles.input, styles.notesInput]} multiline value={form.notes} onChangeText={(v) => field('notes', v)} placeholder="اختياري" />
    <TouchableOpacity style={styles.saveButton} onPress={onSave}><Text style={styles.saveButtonText}>{editing ? 'حفظ التعديلات' : 'إضافة الفرصة'}</Text></TouchableOpacity>
  </ScrollView></View></View></Modal>;
}

function PaymentModal({ visible, form, setForm, editing, onClose, onSave }) {
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.paymentModalCard}>
    <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing ? 'تعديل توزيع' : 'إضافة توزيع'}</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeText}>إغلاق</Text></TouchableOpacity></View>
    <Label text="تاريخ الاستحقاق" /><TextInput style={styles.input} value={form.due_date} onChangeText={(v) => field('due_date', v)} placeholder="2027-02-24" />
    <View style={styles.twoCols}><Field label="العائد" value={form.profit_amount} onChange={(v) => field('profit_amount', v)} numeric /><Field label="رأس المال" value={form.principal_amount} onChange={(v) => field('principal_amount', v)} numeric /></View>
    <Label text="ملاحظات" /><TextInput style={styles.input} value={form.notes} onChangeText={(v) => field('notes', v)} placeholder="اختياري" />
    <TouchableOpacity style={styles.saveButton} onPress={onSave}><Text style={styles.saveButtonText}>{editing ? 'حفظ التعديل' : 'إضافة التوزيع'}</Text></TouchableOpacity>
  </View></View></Modal>;
}

function Label({ text }) { return <Text style={styles.label}>{text}</Text>; }
function Field({ label, value, onChange, numeric, placeholder }) { return <View style={styles.fieldHalf}><Label text={label} /><TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={placeholder || ''} /></View>; }
function Stat({ title, value }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{title}</Text></View>; }
function Metric({ label, value }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Info({ label, value }) { return <View style={styles.infoRow}><Text style={styles.infoValue}>{value}</Text><Text style={styles.infoLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' }, topBar: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }, backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, topTitle: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#111827', fontSize: 17 }, addTop: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed' }, addTopText: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: -2 }, editTop: { minWidth: 52, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede9fe' }, editTopText: { color: '#6d28d9', fontWeight: '900' }, content: { padding: 18, paddingBottom: 44 },
  hero: { backgroundColor: '#111827', borderRadius: 28, padding: 22, marginBottom: 16 }, detailHero: { backgroundColor: '#111827', borderRadius: 26, padding: 20, marginBottom: 14 }, heroBadge: { alignSelf: 'flex-start', color: '#7c3aed', backgroundColor: '#f3e8ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, fontWeight: '900' }, heroTitle: { color: '#fff', fontSize: 27, fontWeight: '900', textAlign: 'right', marginTop: 18 }, heroText: { color: '#cbd5e1', textAlign: 'right', marginTop: 8, lineHeight: 22, fontWeight: '700' }, detailTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 14 }, detailSub: { color: '#cbd5e1', fontWeight: '800', textAlign: 'right', marginTop: 6 },
  message: { color: '#be123c', fontWeight: '900', textAlign: 'right', marginBottom: 12 }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 16 }, stat: { width: '48%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 18, padding: 14 }, statValue: { color: '#111827', fontWeight: '900', fontSize: 18, textAlign: 'right' }, statLabel: { color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 6 }, primaryAdd: { backgroundColor: '#7c3aed', borderRadius: 17, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, primaryAddText: { color: '#fff', fontWeight: '900', fontSize: 16 }, sectionTitle: { color: '#111827', fontSize: 19, fontWeight: '900', textAlign: 'right', marginVertical: 10 }, empty: { color: '#64748b', fontWeight: '800', textAlign: 'center', paddingVertical: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 22, padding: 16, marginBottom: 13 }, cardHeader: { flexDirection: 'row-reverse', alignItems: 'center' }, tokenIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }, cardTitleBlock: { flex: 1 }, cardTitle: { color: '#111827', fontWeight: '900', fontSize: 18, textAlign: 'right' }, cardSub: { color: '#64748b', fontWeight: '700', textAlign: 'right', marginTop: 5 }, metrics: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, gap: 8 }, metric: { width: '23%', backgroundColor: '#f8fafc', borderRadius: 13, paddingVertical: 10, paddingHorizontal: 6 }, metricValue: { color: '#111827', fontWeight: '900', textAlign: 'center', fontSize: 13 }, metricLabel: { color: '#64748b', textAlign: 'center', fontSize: 11, marginTop: 4, fontWeight: '800' }, cardBottom: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eef2f7' }, cardBottomText: { color: '#64748b', fontWeight: '700', textAlign: 'right', marginTop: 3 }, openText: { color: '#6d28d9', fontWeight: '900', textAlign: 'right', marginTop: 12 },
  infoCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, padding: 14, marginBottom: 14 }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' }, infoLabel: { color: '#64748b', fontWeight: '800' }, infoValue: { color: '#111827', fontWeight: '900' }, profitCard: { backgroundColor: '#f5f3ff', borderRadius: 20, padding: 16, marginBottom: 15 }, profitLabel: { color: '#6d28d9', fontWeight: '800', textAlign: 'right' }, profitValue: { color: '#4c1d95', fontWeight: '900', fontSize: 23, textAlign: 'right', marginTop: 5 }, profitSub: { color: '#6b7280', fontWeight: '700', textAlign: 'right', marginTop: 5 }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, smallAdd: { backgroundColor: '#ede9fe', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, smallAddText: { color: '#6d28d9', fontWeight: '900' },
  paymentCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 18, padding: 14, marginBottom: 10 }, paymentPaid: { borderColor: '#86efac', backgroundColor: '#f0fdf4' }, paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, paymentDate: { color: '#111827', fontWeight: '900' }, paymentNo: { color: '#64748b', fontWeight: '800' }, paymentAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }, paymentValue: { color: '#334155', fontWeight: '800' }, actionsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 }, actionButton: { flex: 1, borderRadius: 11, paddingVertical: 9, alignItems: 'center', backgroundColor: '#f1f5f9' }, actionText: { color: '#475569', fontWeight: '900', fontSize: 12 }, receivedButton: { backgroundColor: '#dcfce7' }, receivedText: { color: '#15803d' }, deleteButton: { borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff1f2' }, deleteText: { color: '#be123c', fontWeight: '900', fontSize: 12 }, deleteOpportunity: { borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', borderRadius: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, deleteOpportunityText: { color: '#be123c', fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', justifyContent: 'flex-end' }, modalCard: { maxHeight: '90%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 }, paymentModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, modalTitle: { color: '#111827', fontSize: 20, fontWeight: '900' }, closeText: { color: '#6d28d9', fontWeight: '900' }, label: { color: '#475569', fontWeight: '800', textAlign: 'right', marginTop: 10, marginBottom: 5 }, input: { minHeight: 48, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, color: '#111827', textAlign: 'right', fontWeight: '800' }, notesInput: { minHeight: 76, textAlignVertical: 'top', paddingTop: 12 }, twoCols: { flexDirection: 'row', gap: 10 }, fieldHalf: { flex: 1 }, choiceRow: { flexDirection: 'row-reverse', gap: 8 }, choice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f1f5f9' }, choiceActive: { backgroundColor: '#7c3aed' }, choiceText: { color: '#475569', fontWeight: '900' }, choiceTextActive: { color: '#fff' }, saveButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 }, saveButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
