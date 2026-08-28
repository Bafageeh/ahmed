import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ar-SA', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch (error) {
    return String(value);
  }
}

function formatSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} بايت`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} ك.ب`;
  return `${(value / (1024 * 1024)).toFixed(1)} م.ب`;
}

function reasonLabel(reason) {
  if (reason === 'pre_restore') return 'تلقائية قبل الاسترجاع';
  return 'نسخة يدوية';
}

export default function Ta3meedBackupScreen({ onBack }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [message, setMessage] = useState('');

  const loadBackups = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/ta3meed/backups`, { headers: { Accept: 'application/json' } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل النسخ الاحتياطية');
      setBackups(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل النسخ الاحتياطية');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const createBackup = async () => {
    setCreating(true);
    setMessage('جاري إنشاء نسخة كاملة من بيانات تعميد...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/backups`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر إنشاء النسخة الاحتياطية');
      setMessage('تم إنشاء النسخة الاحتياطية بنجاح.');
      await loadBackups(true);
    } catch (error) {
      setMessage(error.message || 'تعذر إنشاء النسخة الاحتياطية');
    } finally {
      setCreating(false);
    }
  };

  const restore = async (backup) => {
    setRestoringId(backup.id);
    setMessage('جاري استرجاع النسخة والتحقق من البيانات...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/backups/${encodeURIComponent(backup.id)}/restore`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر استرجاع النسخة الاحتياطية');
      const counts = json?.data?.counts || {};
      setMessage('تم استرجاع بيانات تعميد بنجاح.');
      Alert.alert(
        'تم الاسترجاع',
        `تم استرجاع النسخة بنجاح.\nالفرص: ${counts.opportunities ?? '-'}\nالمستثمرون: ${counts.investors ?? '-'}\nوقد تم إنشاء نسخة تلقائية من البيانات قبل الاسترجاع.`,
        [{ text: 'موافق' }],
      );
      await loadBackups(true);
    } catch (error) {
      setMessage(error.message || 'تعذر استرجاع النسخة الاحتياطية');
      Alert.alert('تعذر الاسترجاع', error.message || 'لم يتم تغيير البيانات.');
    } finally {
      setRestoringId(null);
    }
  };

  const confirmRestore = (backup) => {
    Alert.alert(
      'استرجاع نسخة تعميد',
      `سيتم استبدال بيانات تعميد الحالية بالنسخة المؤرخة ${formatDate(backup.created_at)}.\n\nقبل الاسترجاع سيحفظ النظام نسخة تلقائية من الوضع الحالي حتى يمكن الرجوع إليها.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'استرجاع', style: 'destructive', onPress: () => restore(backup) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="رجوع" onPress={onBack} style={styles.backButton} activeOpacity={0.82}>
          <UiIcon name="back" size={28} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <View style={styles.topBarText}>
          <Text style={styles.title}>النسخ الاحتياطية</Text>
          <Text style={styles.subtitle}>حماية واسترجاع بيانات تعميد</Text>
        </View>
        <View style={styles.topIcon}><UiIcon name="save" size={24} color="#ffffff" /></View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBackups(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><UiIcon name="save" size={28} color="#0f766e" /></View>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>نسخة كاملة من تعميد</Text>
            <Text style={styles.infoText}>تشمل الفرص والمستثمرين وتوزيعاتهم ودفعات السداد وحسابات المستثمرين. يحتفظ النظام بآخر 30 نسخة.</Text>
          </View>
        </View>

        <TouchableOpacity disabled={creating || restoringId !== null} onPress={createBackup} activeOpacity={0.88} style={[styles.createButton, creating && styles.disabled]}>
          {creating ? <ActivityIndicator color="#ffffff" /> : <UiIcon name="save" size={22} color="#ffffff" />}
          <Text style={styles.createText}>{creating ? 'جاري إنشاء النسخة...' : 'إنشاء نسخة احتياطية الآن'}</Text>
        </TouchableOpacity>

        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.sectionHeader}>
          <Text style={styles.countBadge}>{backups.length}</Text>
          <Text style={styles.sectionTitle}>النسخ المحفوظة</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator /><Text style={styles.loadingText}>جاري تحميل النسخ...</Text></View>
        ) : backups.length === 0 ? (
          <View style={styles.emptyCard}>
            <UiIcon name="save" size={34} color="#94a3b8" />
            <Text style={styles.emptyTitle}>لا توجد نسخة احتياطية بعد</Text>
            <Text style={styles.emptyText}>اضغط زر إنشاء نسخة احتياطية لحفظ أول نسخة من بيانات تعميد.</Text>
          </View>
        ) : backups.map((backup) => {
          const counts = backup.counts || {};
          const restoring = restoringId === backup.id;
          return (
            <View key={backup.id} style={styles.backupCard}>
              <View style={styles.backupHeader}>
                <View style={[styles.reasonBadge, backup.reason === 'pre_restore' && styles.autoBadge]}>
                  <Text style={styles.reasonText}>{reasonLabel(backup.reason)}</Text>
                </View>
                <Text style={styles.backupDate}>{formatDate(backup.created_at)}</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={styles.statValue}>{counts.opportunities ?? 0}</Text><Text style={styles.statLabel}>فرصة</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{counts.investors ?? 0}</Text><Text style={styles.statLabel}>مستثمر</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{counts.receipts ?? 0}</Text><Text style={styles.statLabel}>سداد</Text></View>
              </View>

              <View style={styles.backupFooter}>
                <Text style={styles.sizeText}>{formatSize(backup.size_bytes)}</Text>
                <TouchableOpacity
                  disabled={restoringId !== null || creating}
                  onPress={() => confirmRestore(backup)}
                  activeOpacity={0.84}
                  style={[styles.restoreButton, restoring && styles.disabled]}
                >
                  {restoring ? <ActivityIndicator color="#ffffff" size="small" /> : <UiIcon name="refresh" size={18} color="#ffffff" />}
                  <Text style={styles.restoreText}>{restoring ? 'جاري الاسترجاع...' : 'استرجاع هذه النسخة'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { minHeight: 84, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, backgroundColor: '#f4f7fb' },
  backButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  topBarText: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  title: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 2, color: '#64748b', fontSize: 11.5, fontWeight: '800' },
  topIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 38 },
  infoCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 22, borderWidth: 1, borderColor: '#dbe4ee', padding: 16 },
  infoIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  infoTextWrap: { flex: 1, marginRight: 13 },
  infoTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  infoText: { marginTop: 5, color: '#64748b', fontSize: 12, fontWeight: '700', lineHeight: 19, textAlign: 'right' },
  createButton: { minHeight: 56, marginTop: 14, borderRadius: 18, backgroundColor: '#0f766e', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  createText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  message: { marginTop: 11, color: '#475569', fontWeight: '800', textAlign: 'right', lineHeight: 20 },
  sectionHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900' },
  countBadge: { minWidth: 36, textAlign: 'center', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, fontWeight: '900' },
  loadingBox: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '800' },
  emptyCard: { minHeight: 180, backgroundColor: '#ffffff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyTitle: { marginTop: 10, color: '#334155', fontSize: 16, fontWeight: '900' },
  emptyText: { marginTop: 5, color: '#94a3b8', fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  backupCard: { marginBottom: 12, backgroundColor: '#ffffff', borderRadius: 22, borderWidth: 1, borderColor: '#dbe4ee', padding: 15 },
  backupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backupDate: { color: '#0f172a', fontWeight: '900', fontSize: 14, textAlign: 'right' },
  reasonBadge: { backgroundColor: '#eff6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  autoBadge: { backgroundColor: '#fff7ed' },
  reasonText: { color: '#475569', fontSize: 10.5, fontWeight: '900' },
  statsRow: { marginTop: 13, flexDirection: 'row-reverse', gap: 8 },
  stat: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 15, paddingVertical: 10, alignItems: 'center' },
  statValue: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  statLabel: { marginTop: 2, color: '#64748b', fontSize: 10.5, fontWeight: '800' },
  backupFooter: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sizeText: { color: '#94a3b8', fontSize: 11, fontWeight: '800' },
  restoreButton: { minHeight: 42, borderRadius: 14, backgroundColor: '#312e81', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13 },
  restoreText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
});
