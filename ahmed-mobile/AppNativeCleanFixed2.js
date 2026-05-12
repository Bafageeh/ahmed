import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const n = (v) => Number(v || 0);
const money = (v, d = 0) => `${n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })} ر.س`;
const today = () => new Date().toISOString().slice(0, 10);

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { throw new Error(`رد غير JSON من ${path}`); }
  if (!res.ok) throw new Error(json.message || `خطأ ${res.status}`);
  return json;
}

function metaOf(item) { try { return typeof item?.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item?.metadata || {}; } catch { return {}; } }
function statusOf(item) {
  if (item?.status === 'received' || item?.status === 'completed') return { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' };
  if (item?.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', color: '#7c3aed', bg: '#f5f3ff' };
  if (item?.maturity_date && item.maturity_date < today()) return { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' };
  return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };
}

export default function AppNativeCleanFixed2() {
  const [tab, setTab] = useState('investments');
  return <View style={s.root}>
    <StatusBar style="dark" />
    <View style={s.screen}>{tab === 'investments' ? <Ta3meed /> : <Placeholder title={tab === 'home' ? 'الرئيسية' : tab === 'wallet' ? 'محفظتي' : 'مزيد'} />}</View>
    <View style={s.tabs}>{[['home','⌂','الرئيسية'],['investments','▦','استثماراتي'],['wallet','◈','محفظتي'],['more','☰','مزيد']].map(([k,i,l]) => <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tab, tab===k && s.tabOn]}><Text style={s.tabIcon}>{i}</Text><Text style={s.tabText}>{l}</Text></TouchableOpacity>)}</View>
  </View>;
}

function Ta3meed() {
  const [items, setItems] = useState([]), [message, setMessage] = useState(''), [loading, setLoading] = useState(false), [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [search, setSearch] = useState(false), [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(false), [receiptText, setReceiptText] = useState(''), [preview, setPreview] = useState(null), [saving, setSaving] = useState(false), [deletingId, setDeletingId] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); setMessage('');
    try {
      const investments = await apiJson('/ta3meed/investments');
      setItems(Array.isArray(investments.data) ? investments.data : []);
      try { await apiJson('/ta3meed/summary'); } catch (e) { /* summary is optional in UI */ }
    } catch (e) { setMessage(e.message || 'تعذر تحميل بيانات تعميد'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((it) => {
    const st = statusOf(it).key;
    if (filter !== 'all' && st !== filter) return false;
    if (!query.trim()) return true;
    const m = metaOf(it);
    const text = [it.reference_number, it.status, it.maturity_date, m.category, ...(it.allocations || []).map(a => a.investor_name)].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [items, filter, query]);

  const totals = useMemo(() => {
    const active = items.filter((it) => statusOf(it).key === 'active');
    return {
      invested: active.reduce((a, it) => a + n(it.principal_amount), 0),
      profit: active.reduce((a, it) => a + n(it.expected_profit_amount), 0),
      active: active.length,
      partial: items.filter((it) => statusOf(it).key === 'partial_received').length,
      received: items.reduce((a, it) => a + n(metaOf(it).ta3meed_received_total), 0),
    };
  }, [items]);

  const parse = async () => {
    if (!receiptText.trim()) return setMessage('الصق رسالة تعميد أولًا');
    try { const json = await apiJson('/ta3meed/receipts/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: receiptText }) }); setPreview(json.data); setMessage('تم تحليل الرسالة'); }
    catch (e) { setMessage(e.message); }
  };

  const apply = async () => {
    if (!receiptText.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setSaving(true);
    try { await apiJson('/ta3meed/receipts/apply-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: receiptText }) }); setReceiptText(''); setPreview(null); setModal(false); setMessage('تم اعتماد الدفعة وتوزيعها'); await load(true); }
    catch (e) { setMessage(e.message); }
    finally { setSaving(false); }
  };

  const deleteReceipt = async (receipt) => {
    const doDelete = async () => {
      setDeletingId(receipt.id);
      try { await apiJson(`/ta3meed/receipts/${receipt.id}`, { method: 'DELETE' }); setMessage('تم حذف الدفعة وإعادة الحساب'); await load(true); }
      catch (e) { setMessage(e.message || 'تعذر حذف الدفعة'); }
      finally { setDeletingId(null); }
    };
    if (Alert?.alert) {
      Alert.alert('حذف دفعة تعميد', `حذف دفعة ${money(receipt.amount, 2)}؟`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: doDelete }]);
    } else { doDelete(); }
  };

  return <SafeAreaView style={s.safe}>
    <View style={s.header}><TouchableOpacity style={s.hBtn} onPress={() => setSearch(!search)}><Text>🔍</Text></TouchableOpacity><Text style={s.title}>تعميد</Text><TouchableOpacity style={s.payBtn} onPress={() => setModal(true)}><Text style={s.payText}>سداد</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}>
      {search ? <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="ابحث بالكود أو المستثمر" textAlign="right" /> : null}
      <View style={s.hero}><Text style={s.heroTop}>نسخة React Native الجديدة</Text><Text style={s.heroTitle}>محفظة تعميد</Text><Text style={s.heroText}>بحث، فلاتر، سداد جزئي/كلي، وسجل دفعات لكل فرصة.</Text></View>
      <View style={s.grid}><Metric t="إجمالي الاستثمار النشط" v={money(totals.invested)} /><Metric t="الأرباح المتوقعة النشطة" v={money(totals.profit, 2)} /><Metric t="استثمارات نشطة" v={String(totals.active)} /><Metric t="مستلم جزئيًا" v={String(totals.partial)} /><Metric t="إجمالي المستلم" v={money(totals.received, 2)} wide /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{[['all','الكل'],['active','نشط'],['overdue','متأخر'],['partial_received','مستلم جزئيًا'],['received','مستلم']].map(([k,l]) => <TouchableOpacity key={k} onPress={() => setFilter(k)} style={[s.chip, filter===k && s.chipOn]}><Text style={[s.chipText, filter===k && s.chipTextOn]}>{l}</Text></TouchableOpacity>)}</ScrollView>
      {!!message && <Text style={s.msg}>{message}</Text>}
      {loading ? <ActivityIndicator color="#0f766e" /> : null}
      <View style={s.row}><Text style={s.count}>{filtered.length} من {items.length}</Text><Text style={s.section}>فرص تعميد</Text></View>
      {filtered.map((it) => <Card key={String(it.id)} item={it} open={expanded===it.id} onPress={() => setExpanded(expanded===it.id ? null : it.id)} onDeleteReceipt={deleteReceipt} deletingId={deletingId} />)}
      {!loading && filtered.length===0 ? <View style={s.empty}><Text style={s.emptyTitle}>لا توجد فرص مطابقة</Text></View> : null}
    </ScrollView>
    <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><TouchableOpacity onPress={() => setModal(false)}><Text style={s.close}>×</Text></TouchableOpacity><Text style={s.modalTitle}>لصق رسالة استلام تعميد</Text></View><TextInput style={s.receiptInput} multiline textAlign="right" textAlignVertical="top" value={receiptText} onChangeText={setReceiptText} placeholder="الصق رسالة تعميد هنا" />{preview ? <View style={s.preview}><Text style={s.previewText}>رقم الفرصة: {preview.reference_number || '-'}</Text><Text style={s.previewText}>المبلغ: {money(preview.amount,2)}</Text><Text style={s.previewText}>النوع: {preview.label}</Text></View> : null}<View style={s.actions}><TouchableOpacity style={s.secondary} onPress={parse}><Text style={s.secondaryText}>تحليل الرسالة</Text></TouchableOpacity><TouchableOpacity style={s.primary} onPress={apply} disabled={saving}><Text style={s.primaryText}>{saving ? 'جاري...' : 'اعتماد الدفعة'}</Text></TouchableOpacity></View></View></View></Modal>
  </SafeAreaView>;
}

function Metric({ t, v, wide }) { return <View style={[s.metric, wide && s.wide]}><Text style={s.metricT}>{t}</Text><Text style={s.metricV}>{v}</Text></View>; }
function Card({ item, open, onPress, onDeleteReceipt, deletingId }) { const m = metaOf(item), st = statusOf(item), receipts = item.receipts || [], allocs = item.allocations || []; return <View style={[s.card,{borderColor:st.color}]}><View style={s.cardTop}><View style={[s.pill,{backgroundColor:st.bg}]}><Text style={[s.pillText,{color:st.color}]}>{st.label}</Text></View><View style={{flex:1,alignItems:'flex-end'}}><Text style={s.code}>{item.reference_number}</Text><Text style={s.meta}>يستحق {item.maturity_date || '-'}</Text></View></View><View style={s.amounts}><Mini l="المبلغ" v={money(item.principal_amount)} /><Mini l="الربح" v={money(item.expected_profit_amount,2)} /><Mini l="المستلم" v={money(m.ta3meed_received_total,2)} /></View><TouchableOpacity style={s.details} onPress={onPress}><Text style={s.detailsText}>{open?'إخفاء':'تفاصيل وسجل الدفعات'}</Text></TouchableOpacity>{open ? <View style={s.detailsBox}><Text style={s.detail}>المتبقي: {money(m.ta3meed_remaining_amount,2)}</Text><Text style={s.sub}>سجل الدفعات</Text>{receipts.length?receipts.map(r=><View key={r.id} style={s.receiptLine}><View style={{flex:1,alignItems:'flex-end'}}><Text style={s.detail}>{r.receipt_date} · {r.receipt_type==='full'?'سداد كلي':'سداد جزئي'} · {money(r.amount,2)}</Text></View><TouchableOpacity disabled={deletingId===r.id} onPress={() => onDeleteReceipt(r)} style={s.deleteReceipt}><Text style={s.deleteReceiptText}>{deletingId===r.id?'...':'حذف'}</Text></TouchableOpacity></View>):<Text style={s.muted}>لا توجد دفعات</Text>}<Text style={s.sub}>المستثمرين</Text>{allocs.map(a=><Text key={a.id} style={s.detail}>{a.investor_name}: مستثمر {money(a.invested_amount,2)} · مستلم {money(a.received_amount,2)}</Text>)}</View>:null}</View>; }
function Mini({ l, v }) { return <View style={s.mini}><Text style={s.miniL}>{l}</Text><Text style={s.miniV}>{v}</Text></View>; }
function Placeholder({ title }) { return <SafeAreaView style={s.safe}><View style={s.placeholder}><Text style={s.title}>{title}</Text><Text style={s.muted}>سيتم إعادة بنائها بعد تعميد</Text></View></SafeAreaView>; }

const s = StyleSheet.create({ root:{flex:1,backgroundColor:'#eef2f7'},screen:{flex:1,paddingBottom:90},safe:{flex:1,backgroundColor:'#eef2f7'},header:{height:92,paddingTop:22,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},hBtn:{width:52,height:52,borderRadius:18,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#dbe3ef'},payBtn:{height:52,minWidth:72,borderRadius:18,backgroundColor:'#0f766e',alignItems:'center',justifyContent:'center'},payText:{color:'#fff',fontWeight:'900'},title:{fontSize:30,fontWeight:'900',color:'#0f172a'},content:{padding:16,paddingBottom:30},search:{backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#dbe3ef',padding:13,marginBottom:12,fontWeight:'800'},hero:{backgroundColor:'#0f766e',borderRadius:28,padding:20,marginBottom:12},heroTop:{color:'#ccfbf1',fontWeight:'900',textAlign:'right'},heroTitle:{color:'#fff',fontSize:29,fontWeight:'900',textAlign:'right',marginTop:8},heroText:{color:'#e6fffb',fontWeight:'700',textAlign:'right',marginTop:8},grid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:9},metric:{flexBasis:'48%',flexGrow:1,backgroundColor:'#fff',borderRadius:20,padding:14,borderWidth:1,borderColor:'#dbe3ef',alignItems:'flex-end'},wide:{flexBasis:'100%'},metricT:{color:'#64748b',fontWeight:'800'},metricV:{color:'#0f172a',fontWeight:'900',fontSize:21,marginTop:6},filters:{flexDirection:'row-reverse',gap:8,paddingVertical:12},chip:{backgroundColor:'#fff',borderRadius:999,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#dbe3ef'},chipOn:{backgroundColor:'#0f766e'},chipText:{color:'#334155',fontWeight:'900'},chipTextOn:{color:'#fff'},msg:{backgroundColor:'#eff6ff',color:'#075985',padding:12,borderRadius:16,textAlign:'right',fontWeight:'800',marginBottom:8},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginVertical:8},count:{backgroundColor:'#d1fae5',color:'#0f766e',fontWeight:'900',borderRadius:999,paddingHorizontal:10,paddingVertical:5,overflow:'hidden'},section:{fontSize:23,fontWeight:'900',color:'#0f172a'},card:{backgroundColor:'#fff',borderRadius:24,padding:14,borderWidth:1,marginBottom:10},cardTop:{flexDirection:'row',alignItems:'center',gap:10},pill:{borderRadius:999,paddingHorizontal:10,paddingVertical:6},pillText:{fontWeight:'900'},code:{fontSize:18,fontWeight:'900',color:'#0f172a'},meta:{color:'#64748b',fontWeight:'700',marginTop:3},amounts:{flexDirection:'row-reverse',gap:8,marginTop:12},mini:{flex:1,backgroundColor:'#f8fafc',borderRadius:16,padding:10,alignItems:'flex-end'},miniL:{color:'#64748b',fontWeight:'800',fontSize:11},miniV:{color:'#0f172a',fontWeight:'900',marginTop:4},details:{marginTop:12,backgroundColor:'#f0fdfa',borderRadius:16,paddingVertical:11,alignItems:'center',borderWidth:1,borderColor:'#ccfbf1'},detailsText:{color:'#0f766e',fontWeight:'900'},detailsBox:{marginTop:12,backgroundColor:'#f8fafc',borderRadius:18,padding:12,borderWidth:1,borderColor:'#e2e8f0'},detail:{color:'#334155',fontWeight:'800',textAlign:'right',marginTop:5},sub:{color:'#0f172a',fontWeight:'900',textAlign:'right',marginTop:12},muted:{color:'#94a3b8',fontWeight:'800',textAlign:'center'},empty:{backgroundColor:'#fff',borderRadius:22,padding:18,alignItems:'center'},emptyTitle:{fontWeight:'900',color:'#0f172a'},tabs:{position:'absolute',left:12,right:12,bottom:12,minHeight:72,borderRadius:28,backgroundColor:'#fff',borderWidth:1,borderColor:'#dbe3ef',flexDirection:'row-reverse',alignItems:'center',padding:6},tab:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:22,paddingVertical:8},tabOn:{backgroundColor:'#ecfdf5'},tabIcon:{color:'#64748b',fontSize:19,fontWeight:'900'},tabText:{color:'#64748b',fontSize:11,fontWeight:'900',marginTop:3},placeholder:{flex:1,alignItems:'center',justifyContent:'center'},backdrop:{flex:1,backgroundColor:'rgba(15,23,42,0.34)',justifyContent:'center',padding:18},modal:{backgroundColor:'#fff',borderRadius:26,padding:16},modalHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},close:{fontSize:28,fontWeight:'900',color:'#0f172a'},modalTitle:{fontSize:18,fontWeight:'900',color:'#0f172a',textAlign:'right'},receiptInput:{marginTop:12,minHeight:110,backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',borderRadius:18,padding:13,color:'#0f172a',fontWeight:'800'},preview:{marginTop:12,backgroundColor:'#f0fdfa',borderRadius:16,padding:12,borderWidth:1,borderColor:'#ccfbf1'},previewText:{color:'#0f172a',fontWeight:'800',textAlign:'right',marginTop:3},actions:{marginTop:12,flexDirection:'row-reverse',gap:8},primary:{flex:1,backgroundColor:'#0f766e',borderRadius:16,paddingVertical:13,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},secondary:{flex:1,backgroundColor:'#f8fafc',borderRadius:16,paddingVertical:13,alignItems:'center',borderWidth:1,borderColor:'#e2e8f0'},secondaryText:{color:'#0f172a',fontWeight:'900'},receiptLine:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#fff',borderRadius:12,paddingHorizontal:8,paddingVertical:7,marginTop:6},deleteReceipt:{backgroundColor:'#fee2e2',borderRadius:10,paddingHorizontal:10,paddingVertical:6},deleteReceiptText:{color:'#dc2626',fontWeight:'900',fontSize:12} });
