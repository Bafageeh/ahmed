import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) => `${numberValue(value).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} ر.س`;

export default function CreditCardDebtsScreen({ onBack, onChanged }) {
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [bankName, setBankName] = useState('');
  const [cardName, setCardName] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/credit-card-debts`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل بطائق الائتمان');
      setCards(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary || {});
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل بطائق الائتمان');
    } finally {
      if (showRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cleanLimit = (value) => {
    const cleaned = String(value || '').replace(/[^0-9.]/g, '');
    const pieces = cleaned.split('.');
    setCreditLimit(pieces.length > 2 ? `${pieces.shift()}.${pieces.join('')}` : cleaned);
  };

  const openAdd = () => {
    setEditingCard(null);
    setBankName('');
    setCardName('');
    setCreditLimit('');
    setMessage('');
    setModalVisible(true);
  };

  const openEdit = (card) => {
    setEditingCard(card);
    setBankName(card.bank_name || '');
    setCardName(card.card_name || '');
    setCreditLimit(String(numberValue(card.credit_limit)));
    setMessage('');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingCard(null);
  };

  const save = async () => {
    const bank = bankName.trim();
    const name = cardName.trim();
    const limit = numberValue(creditLimit);

    if (!bank || !name || limit <= 0) {
      setMessage('أدخل اسم البنك واسم البطاقة والحد الائتماني بصورة صحيحة.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const endpoint = editingCard
        ? `${API_URL}/credit-card-debts/${editingCard.id}`
        : `${API_URL}/credit-card-debts`;
      const response = await fetch(endpoint, {
        method: editingCard ? 'PUT' : 'POST',
        headers: ahmedUserHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          bank_name: bank,
          card_name: name,
          credit_limit: limit,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر حفظ البطاقة');

      setModalVisible(false);
      setEditingCard(null);
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setMessage(error.message || 'تعذر حفظ البطاقة');
    } finally {
      setSaving(false);
    }
  };

  const remove = (card) => {
    Alert.alert(
      'حذف البطاقة',
      `هل تريد حذف بطاقة ${card.card_name} من ${card.bank_name}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            setMessage('');
            try {
              const response = await fetch(`${API_URL}/credit-card-debts/${card.id}`, {
                method: 'DELETE',
                headers: ahmedUserHeaders({ Accept: 'application/json' }),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.message || 'تعذر حذف البطاقة');
              await load();
              if (onChanged) onChanged();
            } catch (error) {
              setMessage(error.message || 'تعذر حذف البطاقة');
            }
          },
        },
      ],
    );
  };

  const highestCardLabel = useMemo(() => {
    const highest = summary.highest_card;
    if (!highest) return 'لا توجد بطاقات';
    return `${highest.bank_name} • ${highest.card_name}`;
  }, [summary.highest_card]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#f4f7fb" />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.82}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>ديون بطائق الائتمان</Text>
          <Text style={styles.topSubtitle}>إدارة الحدود الائتمانية</Text>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={ICON_COLOR}
            colors={[ICON_COLOR]}
          />
        )}
        ListHeaderComponent={(
          <>
            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <UiIcon name="payments" size={18} color="#ddd6fe" />
                  <Text style={styles.heroBadgeText}>بطائق الائتمان</Text>
                </View>
                <Text style={styles.heroCount}>{numberValue(summary.cards_count)} بطاقة</Text>
              </View>
              <Text style={styles.heroAmount}>{money(summary.total_debt)}</Text>
              <Text style={styles.heroLabel}>إجمالي دين البطاقات</Text>
              <Text style={styles.heroNote}>يُحتسب الحد الائتماني كاملًا كدين لكل بطاقة.</Text>
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={ICON_COLOR} />
                <Text style={styles.loadingText}>جاري تحميل البطاقات...</Text>
              </View>
            ) : null}

            {!!message ? <Text style={styles.message}>{message}</Text> : null}

            {!loading ? (
              <View style={styles.insightRow}>
                <View style={styles.insightBox}>
                  <Text style={styles.insightValue}>{money(summary.highest_limit)}</Text>
                  <Text style={styles.insightLabel}>أعلى حد ائتماني</Text>
                </View>
                <View style={[styles.insightBox, styles.insightBoxWide]}>
                  <Text style={styles.insightCardName} numberOfLines={1}>{highestCardLabel}</Text>
                  <Text style={styles.insightLabel}>صاحبة أعلى حد</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <View style={styles.sectionCount}><Text style={styles.sectionCountText}>{cards.length}</Text></View>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>البطائق المسجلة</Text>
                <Text style={styles.sectionSubtitle}>اضغط تعديل لتحديث بيانات أي بطاقة</Text>
              </View>
            </View>
          </>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><UiIcon name="payments" size={30} color={ICON_COLOR} /></View>
            <Text style={styles.emptyTitle}>لا توجد بطائق مضافة</Text>
            <Text style={styles.emptyText}>استخدم زر الإضافة لإدخال أول بطاقة ائتمانية.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.creditCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardName}>{item.card_name}</Text>
                <Text style={styles.bankName}>{item.bank_name}</Text>
              </View>
              <View style={styles.cardIcon}>
                <UiIcon name="payments" size={24} color={ICON_COLOR} />
              </View>
            </View>

            <View style={styles.limitRow}>
              <View style={styles.limitTextBlock}>
                <Text style={styles.limitValue}>{money(item.credit_limit)}</Text>
                <Text style={styles.limitLabel}>الحد المحتسب كدين</Text>
              </View>
              <View style={styles.limitPill}><Text style={styles.limitPillText}>حد ائتماني</Text></View>
            </View>

            <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEdit(item)} activeOpacity={0.82}>
                <UiIcon name="edit" size={18} color="#475569" />
                <Text style={styles.actionText}>تعديل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => remove(item)} activeOpacity={0.82}>
                <UiIcon name="delete" size={18} color="#b91c1c" />
                <Text style={styles.deleteText}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.floatingAdd} onPress={openAdd} activeOpacity={0.88}>
        <UiIcon name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingCard ? 'تعديل البطاقة' : 'إضافة بطاقة'}</Text>
            </View>

            <Text style={styles.inputLabel}>اسم البنك</Text>
            <TextInput
              value={bankName}
              onChangeText={setBankName}
              placeholder="مثال: مصرف الراجحي"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              textAlign="right"
              maxLength={120}
            />

            <Text style={styles.inputLabel}>اسم البطاقة</Text>
            <TextInput
              value={cardName}
              onChangeText={setCardName}
              placeholder="مثال: سيجنتشر"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              textAlign="right"
              maxLength={120}
            />

            <Text style={styles.inputLabel}>الحد الائتماني</Text>
            <TextInput
              value={creditLimit}
              onChangeText={cleanLimit}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              keyboardType="decimal-pad"
              textAlign="right"
            />
            <Text style={styles.inputHint}>سيُضاف الحد كاملًا إلى إجمالي الديون.</Text>

            <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <UiIcon name="save" size={20} color="#ffffff" />
                  <Text style={styles.saveText}>حفظ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const androidTopInset = Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 24) : 0;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: androidTopInset + 6,
    paddingBottom: 12,
    minHeight: 68 + androidTopInset,
    backgroundColor: '#f4f7fb',
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { width: 50, height: 50 },
  topTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  topTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  topSubtitle: { marginTop: 2, color: '#94a3b8', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 124 },

  hero: { backgroundColor: '#0f172a', borderRadius: 28, padding: 20, overflow: 'hidden', marginBottom: 14 },
  heroGlow: { position: 'absolute', width: 185, height: 185, borderRadius: 999, backgroundColor: '#7c3aed', opacity: 0.22, top: -75, left: -46 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  heroBadgeText: { color: '#ddd6fe', fontSize: 12, fontWeight: '900' },
  heroCount: { color: '#94a3b8', fontSize: 12, fontWeight: '900' },
  heroAmount: { marginTop: 18, color: '#ffffff', fontSize: 32, fontWeight: '900', textAlign: 'right' },
  heroLabel: { marginTop: 4, color: '#cbd5e1', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  heroNote: { marginTop: 8, color: '#94a3b8', fontSize: 11, fontWeight: '700', textAlign: 'right' },

  loadingState: { paddingVertical: 18, alignItems: 'center' },
  loadingText: { marginTop: 7, color: '#64748b', fontWeight: '800' },
  message: { marginBottom: 12, backgroundColor: '#fff1f2', color: '#b91c1c', borderRadius: 15, padding: 12, fontWeight: '900', textAlign: 'right' },

  insightRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  insightBox: { flex: 0.9, minHeight: 88, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 14, alignItems: 'flex-end', justifyContent: 'center' },
  insightBoxWide: { flex: 1.1 },
  insightValue: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  insightCardName: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right', maxWidth: '100%' },
  insightLabel: { marginTop: 5, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },

  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, gap: 10 },
  sectionCount: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#efe9ff', alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { color: '#6d28d9', fontSize: 15, fontWeight: '900' },
  sectionTitleBlock: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right' },
  sectionSubtitle: { marginTop: 2, color: '#94a3b8', fontSize: 10, fontWeight: '800', textAlign: 'right' },

  creditCard: { backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#dbe3ea', padding: 16, marginBottom: 13 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  cardTextBlock: { flex: 1, alignItems: 'flex-end' },
  cardName: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right' },
  bankName: { marginTop: 3, color: '#64748b', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  cardIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },

  limitRow: { marginTop: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13 },
  limitTextBlock: { flex: 1, alignItems: 'flex-end' },
  limitValue: { color: '#312e81', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  limitLabel: { marginTop: 3, color: '#64748b', fontSize: 10, fontWeight: '800', textAlign: 'right' },
  limitPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#ede9fe' },
  limitPillText: { color: '#6d28d9', fontSize: 10, fontWeight: '900' },

  cardFooter: { marginTop: 12, flexDirection: 'row-reverse', gap: 9 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionText: { color: '#475569', fontSize: 13, fontWeight: '900' },
  deleteButton: { backgroundColor: '#fff7f7', borderColor: '#fecaca' },
  deleteText: { color: '#b91c1c', fontSize: 13, fontWeight: '900' },

  emptyCard: { backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#dbe3ea', padding: 24, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 7, color: '#64748b', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  floatingAdd: { position: 'absolute', left: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#312e81', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 24, lineHeight: 24, color: '#64748b', fontWeight: '900' },
  modalTitle: { flex: 1, color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  inputLabel: { marginTop: 10, marginBottom: 7, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', paddingHorizontal: 14, color: '#0f172a', fontSize: 16, fontWeight: '700' },
  inputHint: { marginTop: 7, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  saveButton: { marginTop: 18, minHeight: 52, borderRadius: 17, backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabledButton: { opacity: 0.7 },
  saveText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
});
