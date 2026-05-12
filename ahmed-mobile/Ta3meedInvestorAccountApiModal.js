import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const n = (v) => Number(v || 0);
const money = (v, d = 2) => `${n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })} ر.س`;

async function apiJson(path) {
  const response = await fetch(`${API_URL}${path}`, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: `رد غير JSON من ${path}` }; }
  if (!response.ok) throw new Error(json.message || `خطأ ${response.status}`);
  return json;
}

export default function Ta3meedInvestorAccountApiModal({ investor, visible, onClose }) {
  const [tab, setTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [account, setAccount] = useState(null);

  const code = investor?.code || investor?.investor_code || investor?.name;

  const load = async () => {
    if (!code) return;
    setLoading(true);
    setMessage('');
    try {
      const json = await apiJson(`/ta3meed/investors/${encodeURIComponent(code)}/account`);
      setAccount(json.data);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل حساب المستثمر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && code) load();
  }, [visible, code]);

  const summary = account?.summary || {};
  const investorName = account?.investor?.name || investor?.name || 'المستثمر';

  const timeline = useMemo(() => account?.timeline || [], [account]);
  const opportunities = useMemo(() => account?.opportunities || [], [account]);
  const receipts = useMemo(() => account?.receipt_entries || [], [account]);
  const manualEntries = useMemo(() => account?.manual_entries || [], [account]);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.close}><Text style={s.closeText}>إغلاق</Text></TouchableOpacity>
          <Text style={s.title}>حساب {investorName}</Text>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <View style={s.hero}>
            <Text style={s.heroLabel}>صافي الرصيد</Text>
            <Text style={s.heroValue}>{money(summary.net_balance)}</Text>
            <Text style={s.heroMeta}>المتبقي المتوقع: {money(summary.remaining)}</Text>
          </View>

          <View style={s.tabs}>
            {[
              ['summary', 'الملخص'],
              ['timeline', 'كشف الحساب'],
              ['opportunities', 'الفرص'],
              ['receipts', 'الدفعات'],
            ].map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]}>
                <Text style={[s.tabText, tab === key && s.tabTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? <ActivityIndicator color="#0f766e" /> : null}
          {!!message && <Text style={s.message}>{message}</Text>}

          {tab === 'summary' ? <Summary summary={summary} /> : null}
          {tab === 'timeline' ? <Timeline rows={timeline} /> : null}
          {tab === 'opportunities' ? <Opportunities rows={opportunities} /> : null}
          {tab === 'receipts' ? <Receipts rows={receipts} manualEntries={manualEntries} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Summary({ summary }) {
  return <View style={s.grid}>
    <Metric title="إجمالي الاستثمار" value={money(summary.invested)} />
    <Metric title="الربح المتوقع" value={money(summary.expected_profit)} />
    <Metric title="الإجمالي المتوقع" value={money(summary.expected_total)} />
    <Metric title="المستلم" value={money(summary.received)} />
    <Metric title="الربح الفعلي" value={money(summary.actual_profit)} />
    <Metric title="الرصيد اليدوي" value={money(summary.manual_balance)} />
    <Metric title="عدد الفرص" value={String(summary.opportunities_count || 0)} />
    <Metric title="عدد الحركات" value={String(summary.timeline_count || 0)} />
  </View>;
}

function Timeline({ rows }) {
  if (!rows.length) return <Empty label="لا توجد حركات" />;
  return <View>{rows.map((row) => <View key={row.id} style={s.rowCard}>
    <Text style={s.rowTitle}>{row.label}</Text>
    <Text style={s.rowAmount}>{money(row.amount)}</Text>
    <Text style={s.rowText}>{row.date || '-'} · {row.reference_number || 'بدون رقم فرصة'}</Text>
    <Text style={s.rowText}>{row.description || '-'}</Text>
  </View>)}</View>;
}

function Opportunities({ rows }) {
  if (!rows.length) return <Empty label="لا توجد فرص" />;
  return <View>{rows.map((row) => <View key={row.allocation_id} style={s.rowCard}>
    <Text style={s.rowTitle}>{row.reference_number}</Text>
    <Text style={s.rowText}>الحالة: {row.opportunity_status}</Text>
    <Text style={s.rowText}>النسبة: {n(row.share_percent).toLocaleString('en-US', { maximumFractionDigits: 2 })}%</Text>
    <Text style={s.rowText}>مستثمر: {money(row.invested_amount)} · متوقع: {money(row.expected_profit_amount)}</Text>
    <Text style={s.rowText}>مستلم: {money(row.received_amount)} · متبقي: {money(row.remaining_amount)}</Text>
  </View>)}</View>;
}

function Receipts({ rows, manualEntries }) {
  const hasRows = rows.length || manualEntries.length;
  if (!hasRows) return <Empty label="لا توجد دفعات أو حركات يدوية" />;
  return <View>
    {rows.map((row) => <View key={`r-${row.receipt_id}`} style={s.rowCard}>
      <Text style={s.rowTitle}>{row.receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي'}</Text>
      <Text style={s.rowAmount}>{money(row.received_amount)}</Text>
      <Text style={s.rowText}>{row.receipt_date} · {row.opportunity_reference}</Text>
      <Text style={s.rowText}>نسبة المستثمر: {n(row.share_percent).toLocaleString('en-US', { maximumFractionDigits: 2 })}%</Text>
    </View>)}
    {manualEntries.map((row) => <View key={`m-${row.id}`} style={s.rowCard}>
      <Text style={s.rowTitle}>{n(row.amount) >= 0 ? 'إيداع يدوي' : 'سحب يدوي'}</Text>
      <Text style={s.rowAmount}>{money(row.amount)}</Text>
      <Text style={s.rowText}>{row.entry_date || '-'}</Text>
      <Text style={s.rowText}>{row.notes || '-'}</Text>
    </View>)}
  </View>;
}

function Metric({ title, value }) {
  return <View style={s.metric}><Text style={s.metricTitle}>{title}</Text><Text style={s.metricValue}>{value}</Text></View>;
}

function Empty({ label }) {
  return <View style={s.empty}><Text style={s.emptyText}>{label}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef2f7' },
  header: { height: 86, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#dbe3ef' },
  closeText: { color: '#0f172a', fontWeight: '900' },
  title: { color: '#0f172a', fontWeight: '900', fontSize: 22 },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: '#0f766e', borderRadius: 26, padding: 20, alignItems: 'flex-end', marginBottom: 12 },
  heroLabel: { color: '#ccfbf1', fontWeight: '900' },
  heroValue: { color: '#fff', fontWeight: '900', fontSize: 30, marginTop: 8 },
  heroMeta: { color: '#e6fffb', fontWeight: '800', marginTop: 6 },
  tabs: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  tab: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#dbe3ef' },
  tabOn: { backgroundColor: '#0f766e' },
  tabText: { color: '#334155', fontWeight: '900', fontSize: 12 },
  tabTextOn: { color: '#fff' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  metric: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'flex-end' },
  metricTitle: { color: '#64748b', fontWeight: '800' },
  metricValue: { color: '#0f172a', fontWeight: '900', fontSize: 18, marginTop: 6 },
  rowCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#dbe3ef', alignItems: 'flex-end', marginBottom: 8 },
  rowTitle: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  rowAmount: { color: '#0f766e', fontWeight: '900', fontSize: 18, marginTop: 5 },
  rowText: { color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 4 },
  message: { backgroundColor: '#eff6ff', color: '#075985', padding: 12, borderRadius: 16, textAlign: 'right', fontWeight: '800', marginBottom: 8 },
  empty: { backgroundColor: '#fff', borderRadius: 20, padding: 18, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontWeight: '900' },
});
