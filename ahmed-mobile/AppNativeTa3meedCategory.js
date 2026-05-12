import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const n = (v) => Number(v || 0);
const money = (v, d = 0) => `${n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })} ر.س`;
const pct = (v) => `${n(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
const today = () => new Date().toISOString().slice(0, 10);

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: `رد غير JSON من ${path}` }; }
  if (!response.ok) {
    const error = new Error(json.message || `خطأ ${response.status}`);
    error.status = response.status;
    error.data = json.data;
    throw error;
  }
  return json;
}

function metaOf(item) {
  try { return typeof item?.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item?.metadata || {}; } catch { return {}; }
}
function categoryOf(item) {
  const meta = metaOf(item);
  return String(meta.category || item.category || '-').trim().toUpperCase() || '-';
}
function statusOf(item) {
  if (item?.status === 'received' || item?.status === 'completed') return { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' };
  if (item?.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', color: '#7c3aed', bg: '#f5f3ff' };
  if (item?.maturity_date && item.maturity_date < today()) return { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' };
  return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };
}
function categoryStyle(cat) {
  if (cat === 'A') return { bg: '#ecfdf5', color: '#0f766e', label: 'تصنيف A' };
  if (cat === 'B') return { bg: '#eff6ff', color: '#2563eb', label: 'تصنيف B' };
  if (cat === 'C') return { bg: '#fff7ed', color: '#c2410c', label: 'تصنيف C' };
  return { bg: '#f1f5f9', color: '#475569', label: 'بدون تصنيف' };
}

export default function AppNativeTa3meedCategory() {
  const [screen, setScreen] = useState('ta3meed');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setMessage('');
    try {
      const investments = await apiJson('/ta3meed/investments');
      setItems(Array.isArray(investments.data) ? investments.data : []);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل بيانات تعميد');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (screen === 'investors') {
    return <InvestorsScreen items={items} loading={loading} message={message} onBack={() => setScreen('ta3meed')} onRefresh={() => { setRefreshing(true); load(true); }} refreshing={refreshing} />;
  }

  return <Ta3meedScreen items={items} message={message} setMessage={setMessage} loading={loading} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} reload={() => load(true)} onOpenInvestors={() => setScreen('investors')} />;
}

function Ta3meedScreen({ items, message, setMessage, loading, refreshing, onRefresh, reload, onOpenInvestors }) {
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => items.filter((item) => {
    const status = statusOf(item).key;
    const cat = categoryOf(item);
    if (filter !== 'all' && status !== filter) return false;
    if (category !== 'all' && cat !== category) return false;
    if (!query.trim()) return true;
    const meta = metaOf(item);
    const text = [item.reference_number, item.status, item.maturity_date, meta.category, ...(item.allocations || []).map((a) => a.investor_name)].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [items, filter, category, query]);

  const totals = useMemo(() => {
    const source = filtered;
    const active = source.filter((item) => statusOf(item).key === 'active');
    return {
      invested: active.reduce((sum, item) => sum + n(item.principal_amount), 0),
      profit: active.reduce((sum, item) => sum + n(item.expected_profit_amount), 0),
      active: active.length,
      partial: source.filter((item) => statusOf(item).key === 'partial_received').length,
      received: source.reduce((sum, item) => sum + n(metaOf(item).ta3meed_received_total), 0),
    };
  }, [filtered]);

  const parse = async () => {
    if (!receiptText.trim()) return setMessage('الصق رسالة تعميد أولًا');
    try {
      const json = await apiJson('/ta3meed/receipts/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: receiptText }) });
      setPreview(json.data);
      setMessage('تم تحليل الرسالة');
    } catch (error) { setMessage(error.message || 'تعذر تحليل الرسالة'); }
  };

  const submitReceipt = async (confirmed = false) => {
    const path = confirmed ? '/ta3meed/receipts/apply-message-confirmed' : '/ta3meed/receipts/apply-message';
    await apiJson(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: receiptText }) });
    setReceiptText(''); setPreview(null); setModal(false); setMessage(confirmed ? 'تمت إضافة الدفعة المكررة بعد التأكيد' : 'تم اعتماد الدفعة وتوزيعها'); await reload();
  };
  const apply = async () => {
    if (!receiptText.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setSaving(true);
    try { await submitReceipt(false); }
    catch (error) {
      if (error.status === 409 && error.data?.needs_confirmation) {
        const parsed = error.data?.parsed;
        Alert.alert('دفعة مكررة', `هذه الدفعة مسجلة سابقًا${parsed?.reference_number ? ` للفرصة ${parsed.reference_number}` : ''}${parsed?.amount ? ` بمبلغ ${money(parsed.amount, 2)}` : ''}. هل تريد إضافتها مرة أخرى؟`, [
          { text: 'لا', style: 'cancel', onPress: () => setMessage('لم تتم إضافة الدفعة المكررة') },
          { text: 'نعم، أضفها', onPress: async () => { setSaving(true); try { await submitReceipt(true); } catch (e) { setMessage(e.message || 'تعذر إضافة الدفعة المكررة'); } finally { setSaving(false); } } },
        ]);
      } else setMessage(error.message || 'تعذر اعتماد الدفعة');
    } finally { setSaving(false); }
  };
  const deleteReceipt = async (receipt) => {
    const doDelete = async () => { setDeletingId(receipt.id); try { await apiJson(`/ta3meed/receipts/${receipt.id}`, { method: 'DELETE' }); setMessage('تم حذف الدفعة وإعادة الحساب'); await reload(); } catch (error) { setMessage(error.message || 'تعذر حذف الدفعة'); } finally { setDeletingId(null); } };
    Alert.alert('حذف دفعة تعميد', `حذف دفعة ${money(receipt.amount, 2)}؟`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: doDelete }]);
  };

  return <SafeAreaView style={s.safe}>
    <StatusBar style="dark" />
    <View style={s.header}>
      <TouchableOpacity style={s.hBtn} onPress={() => setSearch(!search)}><Text style={s.iconText}>🔍</Text></TouchableOpacity>
      <Text style={s.title}>تعميد</Text>
      <View style={s.headerActions}>
        <TouchableOpacity style={s.iconBtn} onPress={onOpenInvestors}><Text style={s.iconText}>👥</Text></TouchableOpacity>
        <TouchableOpacity style={s.payBtn} onPress={() => setModal(true)}><Text style={s.payText}>سداد</Text></TouchableOpacity>
      </View>
    </View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {search ? <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="ابحث بالكود أو المستثمر أو التصنيف" textAlign="right" /> : null}
      <View style={s.hero}><Text style={s.heroTop}>شاشة تعميد</Text><Text style={s.heroTitle}>محفظة تعميد</Text><Text style={s.heroText}>التصنيف A / B / C ظاهر الآن داخل البطاقات وله فلتر مستقل.</Text></View>
      <View style={s.grid}><Metric t="إجمالي الاستثمار النشط" v={money(totals.invested)} /><Metric t="الأرباح المتوقعة النشطة" v={money(totals.profit, 2)} /><Metric t="استثمارات نشطة" v={String(totals.active)} /><Metric t="مستلم جزئيًا" v={String(totals.partial)} /><Metric t="إجمالي المستلم" v={money(totals.received, 2)} wide /></View>
      <Text style={s.filterTitle}>فلتر التصنيف</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{[['all','كل التصنيفات'],['A','A'],['B','B'],['C','C']].map(([k,l]) => <TouchableOpacity key={k} onPress={() => setCategory(k)} style={[s.chip, category === k && s.chipOn]}><Text style={[s.chipText, category === k && s.chipTextOn]}>{l}</Text></TouchableOpacity>)}</ScrollView>
      <Text style={s.filterTitle}>فلتر الحالة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{[['all','الكل'],['active','نشط'],['overdue','متأخر'],['partial_received','مستلم جزئيًا'],['received','مستلم']].map(([k,l]) => <TouchableOpacity key={k} onPress={() => setFilter(k)} style={[s.chip, filter === k && s.chipOn]}><Text style={[s.chipText, filter === k && s.chipTextOn]}>{l}</Text></TouchableOpacity>)}</ScrollView>
      {!!message && <Text style={s.msg}>{message}</Text>}{loading ? <ActivityIndicator color="#0f766e" /> : null}
      <View style={s.row}><Text style={s.count}>{filtered.length} من {items.length}</Text><Text style={s.section}>فرص تعميد</Text></View>
      {filtered.map((item) => <Card key={String(item.id)} item={item} open={expanded === item.id} onPress={() => setExpanded(expanded === item.id ? null : item.id)} onDeleteReceipt={deleteReceipt} deletingId={deletingId} />)}
      {!loading && filtered.length === 0 ? <View style={s.empty}><Text style={s.emptyTitle}>لا توجد فرص مطابقة</Text></View> : null}
    </ScrollView>
    <ReceiptModal visible={modal} onClose={() => setModal(false)} receiptText={receiptText} setReceiptText={setReceiptText} preview={preview} parse={parse} apply={apply} saving={saving} />
  </SafeAreaView>;
}

function InvestorsScreen({ items, loading, message, onBack, onRefresh, refreshing }) {
  const [query, setQuery] = useState('');
  const investors = useMemo(() => {
    const map = new Map();
    items.forEach((item) => (item.allocations || []).forEach((a) => {
      const key = a.investor_code || a.investor_name;
      if (!key) return;
      const current = map.get(key) || { code: key, name: a.investor_name || key, invested: 0, received: 0, expectedProfit: 0, actualProfit: 0, opportunities: 0 };
      current.invested += n(a.invested_amount);
      current.received += n(a.received_amount);
      current.expectedProfit += n(a.expected_profit_amount);
      current.actualProfit += n(a.actual_profit_amount);
      current.opportunities += 1;
      map.set(key, current);
    }));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [items]);
  const filtered = useMemo(() => investors.filter((investor) => investor.name.includes(query.trim()) || investor.code.includes(query.trim())), [investors, query]);
  const totals = useMemo(() => investors.reduce((acc, investor) => { acc.invested += investor.invested; acc.received += investor.received; acc.expectedProfit += investor.expectedProfit; acc.actualProfit += investor.actualProfit; return acc; }, { invested: 0, received: 0, expectedProfit: 0, actualProfit: 0 }), [investors]);

  return <SafeAreaView style={s.safe}>
    <StatusBar style="dark" />
    <View style={s.header}><TouchableOpacity style={s.hBtn} onPress={onBack}><Text style={s.iconText}>→</Text></TouchableOpacity><Text style={s.title}>المستثمرين</Text><View style={s.iconBtn}><Text style={s.iconText}>👥</Text></View></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={s.hero}><Text style={s.heroTop}>حسابات تعميد</Text><Text style={s.heroTitle}>أرصدة المستثمرين</Text><Text style={s.heroText}>تصنيفات الفرص تظهر داخل تفاصيل كل فرصة في شاشة تعميد.</Text></View>
      <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="ابحث باسم المستثمر" textAlign="right" />
      <View style={s.grid}><Metric t="إجمالي المستثمر" v={money(totals.invested,2)} /><Metric t="المستلم" v={money(totals.received,2)} /><Metric t="الربح المتوقع" v={money(totals.expectedProfit,2)} /><Metric t="الربح الفعلي" v={money(totals.actualProfit,2)} /><Metric t="عدد المستثمرين" v={String(investors.length)} wide /></View>
      {!!message && <Text style={s.msg}>{message}</Text>}{loading ? <ActivityIndicator color="#0f766e" /> : null}
      <Text style={s.section}>قائمة المستثمرين</Text>
      {filtered.map((investor) => <View key={investor.code} style={s.investorCard}><Text style={s.investorName}>{investor.name}</Text><Text style={s.investorLine}>الرصيد المتوقع: {money(investor.invested + investor.expectedProfit - investor.received, 2)}</Text><Text style={s.investorLine}>مستثمر {money(investor.invested, 2)} · مستلم {money(investor.received, 2)} · فرص {investor.opportunities}</Text></View>)}
    </ScrollView>
  </SafeAreaView>;
}

function ReceiptModal({ visible, onClose, receiptText, setReceiptText, preview, parse, apply, saving }) { return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><TouchableOpacity onPress={onClose}><Text style={s.close}>×</Text></TouchableOpacity><Text style={s.modalTitle}>لصق رسالة استلام تعميد</Text></View><TextInput style={s.receiptInput} multiline textAlign="right" textAlignVertical="top" value={receiptText} onChangeText={setReceiptText} placeholder="الصق رسالة تعميد هنا" />{preview ? <View style={s.preview}><Text style={s.previewText}>رقم الفرصة: {preview.reference_number || '-'}</Text><Text style={s.previewText}>المبلغ: {money(preview.amount,2)}</Text><Text style={s.previewText}>النوع: {preview.label}</Text></View> : null}<View style={s.actions}><TouchableOpacity style={s.secondary} onPress={parse}><Text style={s.secondaryText}>تحليل الرسالة</Text></TouchableOpacity><TouchableOpacity style={s.primary} onPress={apply} disabled={saving}><Text style={s.primaryText}>{saving ? 'جاري...' : 'اعتماد الدفعة'}</Text></TouchableOpacity></View></View></View></Modal>; }
function Metric({ t, v, wide }) { return <View style={[s.metric, wide && s.wide]}><Text style={s.metricT}>{t}</Text><Text style={s.metricV}>{v}</Text></View>; }
function Mini({ l, v }) { return <View style={s.mini}><Text style={s.miniL}>{l}</Text><Text style={s.miniV}>{v}</Text></View>; }

function Card({ item, open, onPress, onDeleteReceipt, deletingId }) {
  const meta = metaOf(item), status = statusOf(item), receipts = item.receipts || [], allocations = item.allocations || [];
  const cat = categoryOf(item), catStyle = categoryStyle(cat);
  const expectedTotal = n(item.principal_amount) + n(item.expected_profit_amount);
  const receivedTotal = n(meta.ta3meed_received_total);
  const progress = expectedTotal > 0 ? Math.min(100, Math.max(0, (receivedTotal / expectedTotal) * 100)) : 0;
  const partialCount = receipts.filter((r) => r.receipt_type !== 'full').length;
  const fullCount = receipts.filter((r) => r.receipt_type === 'full').length;
  const lastReceipt = receipts[0];
  return <View style={[s.card, { borderColor: status.color }]}>
    <View style={s.cardTop}><View style={[s.pill,{backgroundColor:status.bg}]}><Text style={[s.pillText,{color:status.color}]}>{status.label}</Text></View><View style={[s.categoryPill,{backgroundColor:catStyle.bg}]}><Text style={[s.categoryText,{color:catStyle.color}]}>{catStyle.label}</Text></View><View style={{flex:1,alignItems:'flex-end'}}><Text style={s.code}>{item.reference_number}</Text><Text style={s.meta}>يستحق {item.maturity_date || '-'}</Text></View></View>
    <View style={s.amounts}><Mini l="المبلغ" v={money(item.principal_amount)} /><Mini l="الربح" v={money(item.expected_profit_amount,2)} /><Mini l="المستلم" v={money(receivedTotal,2)} /></View>
    <View style={s.progressBox}><View style={s.progressHeader}><Text style={s.progressText}>{pct(progress)}</Text><Text style={s.progressTitle}>نسبة الاستلام</Text></View><View style={s.progressTrack}><View style={[s.progressFill,{width:`${progress}%`}]} /></View><Text style={s.progressMeta}>التصنيف {cat} · المتبقي {money(meta.ta3meed_remaining_amount,2)} · الدفعات {receipts.length} · الجزئية {partialCount}{fullCount ? ` · كلي ${fullCount}` : ''}</Text>{lastReceipt ? <Text style={s.progressMeta}>آخر دفعة: {lastReceipt.receipt_date || '-'} · {money(lastReceipt.amount,2)}</Text> : null}{meta.ta3meed_settlement_note ? <Text style={s.settlementNote}>{meta.ta3meed_settlement_note}</Text> : null}</View>
    <TouchableOpacity style={s.details} onPress={onPress}><Text style={s.detailsText}>{open ? 'إخفاء' : 'تفاصيل وسجل الدفعات'}</Text></TouchableOpacity>
    {open ? <View style={s.detailsBox}><Text style={s.detail}>تصنيف الفرصة: {catStyle.label}</Text><Text style={s.sub}>سجل الدفعات</Text>{receipts.length ? receipts.map((receipt) => <View key={receipt.id} style={[s.receiptLine, receipt.receipt_type === 'full' && s.fullReceiptLine]}><View style={{flex:1,alignItems:'flex-end'}}><Text style={s.detail}>{receipt.receipt_date} · {receipt.receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي'} · {money(receipt.amount,2)}</Text></View><TouchableOpacity disabled={deletingId === receipt.id} onPress={() => onDeleteReceipt(receipt)} style={s.deleteReceipt}><Text style={s.deleteReceiptText}>{deletingId === receipt.id ? '...' : 'حذف'}</Text></TouchableOpacity></View>) : <Text style={s.muted}>لا توجد دفعات</Text>}<Text style={s.sub}>المستثمرين</Text>{allocations.map((a) => { const share = n(item.principal_amount) > 0 ? (n(a.invested_amount) / n(item.principal_amount)) * 100 : 0; const expected = n(a.invested_amount) + n(a.expected_profit_amount); const remaining = Math.max(0, expected - n(a.received_amount)); const actualProfit = n(a.received_amount) - n(a.invested_amount); return <Text key={a.id} style={s.detail}>{a.investor_name}: نسبة {pct(share)} · مستثمر {money(a.invested_amount,2)} · مستلم {money(a.received_amount,2)} · ربح فعلي {money(actualProfit,2)} · متبقي {money(remaining,2)}</Text>; })}</View> : null}
  </View>;
}

const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#eef2f7'},header:{height:92,paddingTop:22,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},hBtn:{width:48,height:48,borderRadius:18,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#dbe3ef'},headerActions:{flexDirection:'row',gap:8,alignItems:'center'},iconBtn:{width:48,height:48,borderRadius:18,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#dbe3ef'},iconText:{fontSize:20,fontWeight:'900'},payBtn:{height:48,minWidth:66,borderRadius:18,backgroundColor:'#0f766e',alignItems:'center',justifyContent:'center'},payText:{color:'#fff',fontWeight:'900'},title:{fontSize:30,fontWeight:'900',color:'#0f172a'},content:{padding:16,paddingBottom:30},search:{backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#dbe3ef',padding:13,marginBottom:12,fontWeight:'800'},hero:{backgroundColor:'#0f766e',borderRadius:28,padding:20,marginBottom:12},heroTop:{color:'#ccfbf1',fontWeight:'900',textAlign:'right'},heroTitle:{color:'#fff',fontSize:29,fontWeight:'900',textAlign:'right',marginTop:8},heroText:{color:'#e6fffb',fontWeight:'700',textAlign:'right',marginTop:8},grid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:9},metric:{flexBasis:'48%',flexGrow:1,backgroundColor:'#fff',borderRadius:20,padding:14,borderWidth:1,borderColor:'#dbe3ef',alignItems:'flex-end'},wide:{flexBasis:'100%'},metricT:{color:'#64748b',fontWeight:'800'},metricV:{color:'#0f172a',fontWeight:'900',fontSize:21,marginTop:6},filterTitle:{color:'#0f172a',fontWeight:'900',textAlign:'right',fontSize:16,marginTop:12},filters:{flexDirection:'row-reverse',gap:8,paddingVertical:10},chip:{backgroundColor:'#fff',borderRadius:999,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#dbe3ef'},chipOn:{backgroundColor:'#0f766e'},chipText:{color:'#334155',fontWeight:'900'},chipTextOn:{color:'#fff'},investorCard:{backgroundColor:'#fff',borderRadius:18,padding:14,borderWidth:1,borderColor:'#dbe3ef',alignItems:'flex-end',marginTop:8},investorName:{color:'#0f172a',fontWeight:'900',fontSize:16},investorLine:{color:'#64748b',fontWeight:'800',marginTop:4,textAlign:'right'},msg:{backgroundColor:'#eff6ff',color:'#075985',padding:12,borderRadius:16,textAlign:'right',fontWeight:'800',marginBottom:8},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginVertical:8},count:{backgroundColor:'#d1fae5',color:'#0f766e',fontWeight:'900',borderRadius:999,paddingHorizontal:10,paddingVertical:5,overflow:'hidden'},section:{fontSize:23,fontWeight:'900',color:'#0f172a',textAlign:'right',marginTop:12},card:{backgroundColor:'#fff',borderRadius:24,padding:14,borderWidth:1,marginBottom:10},cardTop:{flexDirection:'row',alignItems:'center',gap:8},pill:{borderRadius:999,paddingHorizontal:10,paddingVertical:6},pillText:{fontWeight:'900'},categoryPill:{borderRadius:999,paddingHorizontal:10,paddingVertical:6},categoryText:{fontWeight:'900'},code:{fontSize:18,fontWeight:'900',color:'#0f172a'},meta:{color:'#64748b',fontWeight:'700',marginTop:3},amounts:{flexDirection:'row-reverse',gap:8,marginTop:12},mini:{flex:1,backgroundColor:'#f8fafc',borderRadius:16,padding:10,alignItems:'flex-end'},miniL:{color:'#64748b',fontWeight:'800',fontSize:11},miniV:{color:'#0f172a',fontWeight:'900',marginTop:4},progressBox:{marginTop:12,backgroundColor:'#f8fafc',borderRadius:16,padding:11,borderWidth:1,borderColor:'#e2e8f0'},progressHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},progressTitle:{color:'#0f172a',fontWeight:'900'},progressText:{color:'#0f766e',fontWeight:'900'},progressTrack:{height:8,backgroundColor:'#e2e8f0',borderRadius:999,overflow:'hidden',marginTop:8},progressFill:{height:8,backgroundColor:'#0f766e',borderRadius:999},progressMeta:{color:'#64748b',fontWeight:'800',textAlign:'right',marginTop:7},settlementNote:{color:'#b45309',backgroundColor:'#fffbeb',borderRadius:10,padding:7,textAlign:'right',fontWeight:'900',marginTop:7},details:{marginTop:12,backgroundColor:'#f0fdfa',borderRadius:16,paddingVertical:11,alignItems:'center',borderWidth:1,borderColor:'#ccfbf1'},detailsText:{color:'#0f766e',fontWeight:'900'},detailsBox:{marginTop:12,backgroundColor:'#f8fafc',borderRadius:18,padding:12,borderWidth:1,borderColor:'#e2e8f0'},detail:{color:'#334155',fontWeight:'800',textAlign:'right',marginTop:5},sub:{color:'#0f172a',fontWeight:'900',textAlign:'right',marginTop:12},muted:{color:'#94a3b8',fontWeight:'800',textAlign:'center'},empty:{backgroundColor:'#fff',borderRadius:22,padding:18,alignItems:'center'},emptyTitle:{fontWeight:'900',color:'#0f172a'},backdrop:{flex:1,backgroundColor:'rgba(15,23,42,0.34)',justifyContent:'center',padding:18},modal:{backgroundColor:'#fff',borderRadius:26,padding:16},modalHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},close:{fontSize:28,fontWeight:'900',color:'#0f172a'},modalTitle:{fontSize:18,fontWeight:'900',color:'#0f172a',textAlign:'right'},receiptInput:{marginTop:12,minHeight:110,backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',borderRadius:18,padding:13,color:'#0f172a',fontWeight:'800'},preview:{marginTop:12,backgroundColor:'#f0fdfa',borderRadius:16,padding:12,borderWidth:1,borderColor:'#ccfbf1'},previewText:{color:'#0f172a',fontWeight:'800',textAlign:'right',marginTop:3},actions:{marginTop:12,flexDirection:'row-reverse',gap:8},primary:{flex:1,backgroundColor:'#0f766e',borderRadius:16,paddingVertical:13,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},secondary:{flex:1,backgroundColor:'#f8fafc',borderRadius:16,paddingVertical:13,alignItems:'center',borderWidth:1,borderColor:'#e2e8f0'},secondaryText:{color:'#0f172a',fontWeight:'900'},receiptLine:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#fff',borderRadius:12,paddingHorizontal:8,paddingVertical:7,marginTop:6},fullReceiptLine:{backgroundColor:'#eff6ff',borderWidth:1,borderColor:'#bfdbfe'},deleteReceipt:{backgroundColor:'#fee2e2',borderRadius:10,paddingHorizontal:10,paddingVertical:6},deleteReceiptText:{color:'#dc2626',fontWeight:'900',fontSize:12} });
