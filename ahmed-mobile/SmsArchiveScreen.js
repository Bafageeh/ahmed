import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';
import { disableSmsCapture, enableSmsCapture, fetchSmsArchive, getSmsCaptureStatus, syncSmsCapture } from './smsCapture';

const date = (value) => value ? new Date(Number(value)).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short', calendar: 'gregory' }) : '—';

export default function SmsArchiveScreen({ onBack }) {
  const [status, setStatus] = useState({ supported: false, enabled: false, pendingCount: 0 });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const mounted = useRef(true);

  const refreshStatus = async () => {
    const next = await getSmsCaptureStatus();
    if (mounted.current) setStatus(next);
  };
  const load = async (append = false) => {
    try {
      const result = await fetchSmsArchive(append ? rows[rows.length - 1]?.id : null);
      if (!mounted.current) return;
      setRows((current) => append ? [...current, ...result.data.filter((item) => !current.some((old) => old.id === item.id))] : [...result.data, ...current.filter((item) => !result.data.some((fresh) => fresh.id === item.id))]);
      setTotal(result.total); setHasMore(result.hasMore);
    } catch (error) { if (mounted.current) setMessage(error.message); }
  };
  useEffect(() => {
    mounted.current = true;
    refreshStatus().catch(() => {}); load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') refreshStatus().catch(() => {}); }, 4000);
    const archiveTimer = setInterval(() => { if (AppState.currentState === 'active') load(); }, 20000);
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') { refreshStatus().catch(() => {}); load(); } });
    return () => { mounted.current = false; clearInterval(timer); clearInterval(archiveTimer); sub.remove(); };
  }, []);

  const toggle = async (enabled) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const next = await (enabled ? enableSmsCapture() : disableSmsCapture());
      if (mounted.current) {
        setStatus(next);
        setMessage(enabled ? 'تم التفعيل. ستُحفظ الرسائل الجديدة مع المرسل من الآن.' : 'تم إيقاف استقبال الرسائل الجديدة.');
      }
    } catch (error) { if (mounted.current) setMessage(error.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const refresh = async () => {
    setRefreshing(true); setMessage('');
    try { await syncSmsCapture(); await refreshStatus(); await load(); }
    catch (error) { setMessage(error.message); }
    finally { if (mounted.current) setRefreshing(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bar}>
        <TouchableOpacity accessibilityLabel="رجوع" onPress={onBack} style={styles.iconButton}><UiIcon name="back" size={23} color={ICON_COLOR_DARK} /></TouchableOpacity>
        <Text style={styles.title}>رسائل SMS</Text>
        <TouchableOpacity accessibilityLabel="تحديث ومزامنة الرسائل" onPress={refresh} style={styles.iconButton}>{refreshing ? <ActivityIndicator /> : <UiIcon name="refresh" size={21} color={ICON_COLOR_DARK} />}</TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.captureCard}>
          <View style={styles.captureRow}>
            {busy ? <ActivityIndicator color="#6d28d9" /> : <Switch accessibilityLabel="استقبال الرسائل الجديدة تلقائيًا" value={Boolean(status.enabled && status.permissionGranted)} disabled={!status.supported} onValueChange={toggle} trackColor={{ false: '#cbd5e1', true: '#7c3aed' }} thumbColor="#fff" />}
            <View style={styles.captureText}><Text style={styles.captureTitle}>استقبال الرسائل الجديدة تلقائيًا</Text><Text style={styles.secondary}>{status.enabled && status.permissionGranted ? 'مفعّل · الحفظ مع المرسل ووقت الوصول' : 'متوقف'}</Text></View>
          </View>
          <Text style={styles.explanation}>عند التفعيل تُحفظ الرسائل الجديدة ومرسلها في حسابك على السيرفر للتحليل. يبدأ الحفظ من وقت التفعيل فقط.</Text>
          {!status.supported ? <Text style={styles.note}>{Platform.OS === 'android' ? 'ثبّت نسخة APK المحدثة لتفعيل الاستقبال التلقائي.' : 'الاستقبال التلقائي متاح على أندرويد. يمكنك تصفح الأرشيف من هنا.'}</Text> : null}
          {status.supported && !status.permissionGranted ? <TouchableOpacity onPress={() => Linking.openSettings()}><Text style={styles.link}>إعدادات صلاحية الرسائل</Text></TouchableOpacity> : null}
          {status.enabled ? <Text style={styles.note}>يعمل الاستقبال بالخلفية. إيقاف التطبيق إجباريًا يوقفه حتى فتحه مجددًا. وقد يحجب النظام بعض رسائل التحقق.</Text> : null}
        </View>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{total.toLocaleString('en-US')}</Text><Text style={styles.secondary}>محفوظة على السيرفر</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{Number(status.pendingCount || 0).toLocaleString('en-US')}</Text><Text style={styles.secondary}>بانتظار المزامنة</Text></View>
        </View>
        {status.lastUploadedAt ? <Text style={styles.syncTime}>آخر مزامنة: {date(status.lastUploadedAt)}</Text> : null}
        {!!(message || status.lastError) && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{message || status.lastError}</Text>}
        <View style={styles.listHeading}><Text style={styles.listTitle}>الرسائل المحفوظة</Text><Text style={styles.secondary}>الأحدث أولًا</Text></View>
        {!rows.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>لا توجد رسائل محفوظة بعد</Text><Text style={styles.secondary}>ستظهر الرسائل الجديدة هنا بعد التفعيل والمزامنة.</Text></View> : rows.map((item) => (
          <TouchableOpacity key={String(item.id)} onPress={() => setSelected(item)} style={styles.messageRow} accessibilityLabel={`رسالة من ${item.sender || 'مرسل غير معروف'}، ${date(item.received_at_ms)}`}>
            <View style={styles.rowHeader}><Text style={styles.time}>{date(item.received_at_ms)}</Text><Text style={styles.sender} numberOfLines={1}>{item.sender || 'مرسل غير معروف'}</Text></View>
            <Text numberOfLines={2} style={styles.preview}>{item.body || 'رسالة فارغة'}</Text>
          </TouchableOpacity>
        ))}
        {hasMore ? <TouchableOpacity onPress={() => load(true)} style={styles.more}><Text style={styles.link}>عرض رسائل أقدم</Text></TouchableOpacity> : null}
      </ScrollView>
      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}><View style={styles.dialog}>
          <View style={styles.rowHeader}><TouchableOpacity accessibilityLabel="إغلاق تفاصيل الرسالة" onPress={() => setSelected(null)} style={styles.iconButton}><UiIcon name="close" size={23} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.dialogTitle}>تفاصيل الرسالة</Text></View>
          <Text style={styles.fieldLabel}>المرسل</Text><Text selectable style={styles.detailSender}>{selected?.sender || 'مرسل غير معروف'}</Text>
          <Text style={styles.fieldLabel}>وقت الوصول</Text><Text style={styles.detailTime}>{date(selected?.received_at_ms)}</Text>
          {selected?.sim_slot != null ? <Text style={styles.detailTime}>الشريحة: {Number(selected.sim_slot) + 1}</Text> : null}
          <ScrollView style={styles.bodyScroll}><Text selectable style={styles.body}>{selected?.body || 'رسالة فارغة'}</Text></ScrollView>
          <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(`${selected?.sender || ''}\n${selected?.body || ''}`); setMessage('تم نسخ الرسالة مع المرسل.'); setSelected(null); }} style={styles.copy}><Text style={styles.copyText}>نسخ الرسالة مع المرسل</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' }, page: { padding: 16, paddingBottom: 32 },
  bar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e9eaf0' },
  title: { color: '#172033', fontWeight: '800', fontSize: 20 }, iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  captureCard: { backgroundColor: '#fff', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#e9eaf0' }, captureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, captureText: { flex: 1, alignItems: 'flex-end' },
  captureTitle: { fontSize: 15, color: '#172033', fontWeight: '800', textAlign: 'right' }, secondary: { marginTop: 4, color: '#6b7280', fontSize: 12, textAlign: 'right' }, explanation: { marginTop: 12, color: '#475569', lineHeight: 21, fontSize: 12, textAlign: 'right' },
  note: { color: '#64748b', fontSize: 11, lineHeight: 19, textAlign: 'right', marginTop: 10 }, link: { color: '#6d28d9', fontSize: 13, fontWeight: '700', textAlign: 'right', paddingVertical: 7 },
  metrics: { flexDirection: 'row-reverse', gap: 10, marginTop: 12 }, metric: { flex: 1, borderRadius: 16, backgroundColor: '#fff', padding: 13, alignItems: 'flex-end', borderWidth: 1, borderColor: '#e9eaf0' }, metricValue: { color: '#5b21b6', fontSize: 23, fontWeight: '800' },
  syncTime: { color: '#64748b', fontSize: 11, marginTop: 9, textAlign: 'right' }, feedback: { color: '#5b21b6', backgroundColor: '#ede9fe', borderRadius: 12, overflow: 'hidden', padding: 11, marginTop: 12, textAlign: 'right', fontSize: 12, lineHeight: 21 },
  listHeading: { marginTop: 22, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, listTitle: { fontSize: 16, color: '#172033', fontWeight: '800' },
  messageRow: { backgroundColor: '#fff', padding: 13, borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: '#e9eaf0' }, rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sender: { flex: 1, fontSize: 14, fontWeight: '800', color: '#172033', textAlign: 'right' }, time: { fontSize: 10, color: '#64748b' }, preview: { fontSize: 13, lineHeight: 21, color: '#475569', textAlign: 'right', marginTop: 7 },
  empty: { backgroundColor: '#fff', borderRadius: 15, padding: 22, alignItems: 'center' }, emptyTitle: { color: '#334155', fontWeight: '700', marginBottom: 4 }, more: { alignItems: 'center', padding: 8 },
  overlay: { flex: 1, backgroundColor: '#0f172a66', alignItems: 'center', justifyContent: 'center', padding: 20 }, dialog: { width: '100%', maxWidth: 500, maxHeight: '80%', backgroundColor: '#fff', borderRadius: 22, padding: 18 }, dialogTitle: { fontSize: 18, fontWeight: '800', color: '#172033' },
  fieldLabel: { marginTop: 10, fontSize: 11, color: '#64748b', textAlign: 'right' }, detailSender: { color: '#5b21b6', fontSize: 17, fontWeight: '800', textAlign: 'right', marginTop: 4 }, detailTime: { color: '#475569', fontSize: 12, textAlign: 'right', marginTop: 4 }, bodyScroll: { marginTop: 16, flexShrink: 1 }, body: { color: '#172033', fontSize: 15, lineHeight: 26, textAlign: 'right' }, copy: { borderRadius: 13, backgroundColor: '#6d28d9', alignItems: 'center', padding: 13, marginTop: 18 }, copyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
