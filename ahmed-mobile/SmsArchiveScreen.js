import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';
import { disableSmsCapture, enableSmsCapture, fetchSmsArchive, getSmsCaptureStatus, syncSmsCapture } from './smsCapture';

const date = (value) => value ? new Date(Number(value)).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short', calendar: 'gregory' }) : '—';
const analysisLabel = (item) => ({ applied: item?.analysis?.action_type === 'deposit' ? 'تم تسجيل الإيداع بالمحفظة' : item?.analysis?.action_type === 'withdrawal' ? 'تم تسجيل السحب من المحفظة' : 'تم تسجيل السداد', duplicate: 'مسجلة سابقًا · دون تكرار', needs_review: 'تحتاج مراجعة', non_payment: 'محفوظة · لا توجد حركة مكتملة', archived: 'محفوظة', pending: 'جارٍ التحليل' }[item?.analysis?.status] || 'محفوظة');
const reasonLabel = (reason) => ({ wallet_reference_conflict: 'مرجع العملية مسجل بمبلغ مختلف؛ راجع الحركة.', possible_duplicate_wallet_transfer: 'توجد حركة بنفس القيمة والتاريخ؛ راجع السجل لتجنب التكرار.', wallet_fee_needs_review: 'الرسالة تتضمن رسومًا وتحتاج مراجعة قيمة الخصم.', ambiguous_wallet_direction: 'لم تتضح جهة الإيداع أو السحب.', ambiguous_wallet_reference: 'تتضمن الرسالة أكثر من مرجع للعملية.', wallet_transfer_not_confirmed: 'الرسالة لا تؤكد اكتمال الإيداع أو السحب.', opportunity_not_found: 'لم توجد فرصة مطابقة في حسابك.', ambiguous_opportunity: 'يوجد أكثر من تطابق لرقم الفرصة.', missing_or_ambiguous_reference: 'رقم الفرصة ناقص أو غير واضح.', missing_or_ambiguous_amount: 'مبلغ السداد ناقص أو يحتمل أكثر من قيمة.', possible_duplicate_receipt: 'توجد دفعة بالقيمة والتاريخ نفسيهما؛ راجعها قبل الإضافة.', opportunity_already_closed: 'الفرصة مغلقة أو مسددة سابقًا.', amount_exceeds_remaining: 'المبلغ يتجاوز المتبقي في سجل الفرصة.', final_amount_below_remaining_principal: 'مبلغ السداد النهائي أقل من رأس المال المتبقي.', receipt_balance_mismatch: 'رصيد الفرصة يحتاج مطابقة مع سجل الدفعات.', invalid_payment_date: 'تاريخ السداد غير صحيح.', ambiguous_payment_date: 'تاريخ السداد غير واضح.', conflicting_payment_type: 'نوع السداد غير واضح.', payment_not_confirmed: 'الرسالة لا تؤكد إتمام السداد.', processing_failed: 'حُفظت الرسالة وتعذر إكمال التسجيل؛ راجع سجل الدفعات.' }[reason] || '');

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
        setMessage(enabled ? 'تم التفعيل: Ta3meed فقط. يُسجل السداد والإيداع والسحب الواضح تلقائيًا مع تنبيه عند إتمامه.' : 'تم إيقاف استقبال الرسائل الجديدة.');
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
            <View style={styles.captureText}><Text style={styles.captureTitle}>رسائل Ta3meed والحركات التلقائية</Text><Text style={styles.secondary}>{status.enabled && status.permissionGranted ? 'مفعّل · Ta3meed فقط' : 'متوقف'}</Text></View>
          </View>
          <Text style={styles.explanation}>يُحفظ المرسل والنص ووقت الوصول لرسائل Ta3meed الجديدة فقط، ثم يُسجل السداد الواضح في الفرصة وحصص المستثمرين والمحفظة، وتُضاف الإيداعات والسحوبات المؤكدة إلى محفظة تعميد ويصلك تنبيه بالإتمام. تُمنع الدفعات المكررة، والرسالة غير الواضحة تُحفظ للمراجعة.</Text>
          {status.requiresUpdate ? <Text style={styles.note}>ثبّت تحديث أندرويد لتطبيق فلتر Ta3meed قبل الحفظ والتنبيه في الخلفية.</Text> : null}
          {status.enabled && status.notificationPermissionGranted === false ? <TouchableOpacity onPress={() => Linking.openSettings()}><Text style={styles.link}>فعّل إذن الإشعارات لاستلام تنبيه الإتمام</Text></TouchableOpacity> : null}
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
            <Text style={[styles.analysis, item.analysis?.status === 'applied' ? styles.applied : item.analysis?.status === 'needs_review' ? styles.review : null]}>{analysisLabel(item)}</Text>
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
          <Text style={styles.fieldLabel}>نتيجة التحليل</Text><Text style={styles.analysis}>{analysisLabel(selected)}</Text>
          {selected?.analysis?.reference_number ? <Text selectable style={styles.detailTime}>{selected.analysis.action_type === 'repayment' ? 'الفرصة' : 'مرجع العملية'}: {selected.analysis.reference_number}</Text> : null}
          {selected?.analysis?.amount != null ? <Text style={styles.detailTime}>المبلغ: {Number(selected.analysis.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</Text> : null}
          {reasonLabel(selected?.analysis?.reason) ? <Text style={styles.note}>{reasonLabel(selected.analysis.reason)}</Text> : null}
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
  analysis: { color: '#64748b', fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 8 }, applied: { color: '#15803d' }, review: { color: '#b45309' },
  metrics: { flexDirection: 'row-reverse', gap: 10, marginTop: 12 }, metric: { flex: 1, borderRadius: 16, backgroundColor: '#fff', padding: 13, alignItems: 'flex-end', borderWidth: 1, borderColor: '#e9eaf0' }, metricValue: { color: '#5b21b6', fontSize: 23, fontWeight: '800' },
  syncTime: { color: '#64748b', fontSize: 11, marginTop: 9, textAlign: 'right' }, feedback: { color: '#5b21b6', backgroundColor: '#ede9fe', borderRadius: 12, overflow: 'hidden', padding: 11, marginTop: 12, textAlign: 'right', fontSize: 12, lineHeight: 21 },
  listHeading: { marginTop: 22, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, listTitle: { fontSize: 16, color: '#172033', fontWeight: '800' },
  messageRow: { backgroundColor: '#fff', padding: 13, borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: '#e9eaf0' }, rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sender: { flex: 1, fontSize: 14, fontWeight: '800', color: '#172033', textAlign: 'right' }, time: { fontSize: 10, color: '#64748b' }, preview: { fontSize: 13, lineHeight: 21, color: '#475569', textAlign: 'right', marginTop: 7 },
  empty: { backgroundColor: '#fff', borderRadius: 15, padding: 22, alignItems: 'center' }, emptyTitle: { color: '#334155', fontWeight: '700', marginBottom: 4 }, more: { alignItems: 'center', padding: 8 },
  overlay: { flex: 1, backgroundColor: '#0f172a66', alignItems: 'center', justifyContent: 'center', padding: 20 }, dialog: { width: '100%', maxWidth: 500, maxHeight: '80%', backgroundColor: '#fff', borderRadius: 22, padding: 18 }, dialogTitle: { fontSize: 18, fontWeight: '800', color: '#172033' },
  fieldLabel: { marginTop: 10, fontSize: 11, color: '#64748b', textAlign: 'right' }, detailSender: { color: '#5b21b6', fontSize: 17, fontWeight: '800', textAlign: 'right', marginTop: 4 }, detailTime: { color: '#475569', fontSize: 12, textAlign: 'right', marginTop: 4 }, bodyScroll: { marginTop: 16, flexShrink: 1 }, body: { color: '#172033', fontSize: 15, lineHeight: 26, textAlign: 'right' }, copy: { borderRadius: 13, backgroundColor: '#6d28d9', alignItems: 'center', padding: 13, marginTop: 18 }, copyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
