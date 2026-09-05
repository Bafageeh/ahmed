import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from './SafeNotifications';

function responsePrompt(response) {
  const notification = response?.notification;
  const content = notification?.request?.content || {};
  const data = content.data || {};
  const cardId = data.vaultCardId ? String(data.vaultCardId) : '';
  if (!cardId) return null;

  const explicitStatementDay = Number(data.statementDay || 0);
  const statementDay = Number.isInteger(explicitStatementDay) && explicitStatementDay >= 1 && explicitStatementDay <= 31
    ? explicitStatementDay
    : new Date().getDate();
  const body = String(data.cardStatementBaseBody || content.body || 'بطاقة ائتمانية')
    .replace(/\s*اضغط لتحديد هل تم السداد\.?\s*$/u, '')
    .replace(/\s*—\s*لم يتم تأكيد السداد بعد\.?(?:\s*اضغط لتحديد هل تم السداد\.?)?\s*$/u, '')
    .trim();

  return {
    cardId,
    statementDay,
    title: content.title || 'موعد كشف البطاقة',
    body,
    channelId: 'card-statements',
    responseKey: `${notification?.request?.identifier || cardId}:${notification?.date || Date.now()}`,
  };
}

export default function CardStatementNotificationGate({ children }) {
  const [prompt, setPrompt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const handledResponses = useRef(new Set());

  useEffect(() => {
    if (!Notifications.isAvailable) return undefined;

    const handleResponse = (response) => {
      const nextPrompt = responsePrompt(response);
      if (!nextPrompt || handledResponses.current.has(nextPrompt.responseKey)) return;
      handledResponses.current.add(nextPrompt.responseKey);
      setResult('');
      setPrompt(nextPrompt);
      Notifications.clearLastNotificationResponse?.();
    };

    const lastResponse = Notifications.getLastNotificationResponse?.();
    if (lastResponse) handleResponse(lastResponse);

    const subscription = Notifications.addNotificationResponseReceivedListener?.(handleResponse);
    return () => subscription?.remove?.();
  }, []);

  const answer = async (paid) => {
    if (!prompt || saving) return;
    setSaving(true);
    try {
      if (paid) {
        const stopped = await Notifications.markCardStatementPaid(prompt.cardId, prompt.statementDay);
        setResult(stopped
          ? 'تم تسجيل السداد وإيقاف التذكير اليومي لهذه البطاقة حتى دورة الكشف التالية.'
          : 'تم تسجيل الاختيار، لكن تعذر تحديث التنبيه على هذا الجهاز.');
      } else {
        const continued = await Notifications.continueCardStatementReminder({
          cardId: prompt.cardId,
          statementDay: prompt.statementDay,
          title: prompt.title,
          body: prompt.body,
          cardStatementBaseBody: prompt.body,
          channelId: prompt.channelId,
        });
        setResult(continued
          ? 'سيستمر تنبيه هذه البطاقة يوميًا حتى تأكيد السداد.'
          : 'تعذر تفعيل التذكير اليومي على هذا الجهاز.');
      }
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (saving) return;
    setPrompt(null);
    setResult('');
  };

  return (
    <View style={styles.root}>
      {children}
      <Modal visible={Boolean(prompt)} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.badge}><Text style={styles.badgeText}>تنبيه بطاقة ائتمانية</Text></View>
            <Text style={styles.title}>هل تم السداد؟</Text>
            <Text style={styles.cardName}>{prompt?.body || 'بطاقة ائتمانية'}</Text>
            <Text style={styles.hint}>سيستمر التنبيه يوميًا بعد موعد الكشف إلى أن تختار «نعم».</Text>

            {result ? (
              <>
                <View style={styles.resultBox}><Text style={styles.resultText}>{result}</Text></View>
                <TouchableOpacity style={styles.closeButton} onPress={close} activeOpacity={0.85}>
                  <Text style={styles.closeText}>إغلاق</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity disabled={saving} style={[styles.answerButton, styles.noButton]} onPress={() => answer(false)} activeOpacity={0.85}>
                  <Text style={styles.noText}>لا</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={saving} style={[styles.answerButton, styles.yesButton]} onPress={() => answer(true)} activeOpacity={0.85}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.yesText}>نعم</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 430, borderRadius: 28, backgroundColor: '#fff', padding: 22, borderWidth: 1, borderColor: '#e2e8f0' },
  badge: { alignSelf: 'flex-end', backgroundColor: '#eef2ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: '#4338ca', fontWeight: '900', fontSize: 12 },
  title: { marginTop: 16, color: '#0f172a', fontWeight: '900', fontSize: 28, textAlign: 'right' },
  cardName: { marginTop: 10, color: '#334155', fontWeight: '900', fontSize: 17, lineHeight: 26, textAlign: 'right' },
  hint: { marginTop: 8, color: '#64748b', fontWeight: '700', fontSize: 14, lineHeight: 22, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  answerButton: { flex: 1, minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  yesButton: { backgroundColor: '#0f766e' },
  noButton: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' },
  yesText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  noText: { color: '#334155', fontWeight: '900', fontSize: 17 },
  resultBox: { marginTop: 20, borderRadius: 17, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 14 },
  resultText: { color: '#166534', fontWeight: '900', lineHeight: 23, textAlign: 'right' },
  closeButton: { marginTop: 12, minHeight: 50, borderRadius: 17, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
