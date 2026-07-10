import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
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
    if (!highest) return '-';
    return `${highest.bank_name} • ${highest.card_name}`;
  }, [summary.highest_card]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>ديون بطائق الائتمان</Text>
        <View style={styles.backButtonPlaceholder} />
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
              <View style={styles.heroBadge}>
                <UiIcon name="payments" size={19} color="#ddd6fe" />
                <Text style={styles.heroBadgeText}>بطائق الائتمان</Text>
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

            <View style={styles.summaryGrid}>
              <SummaryCard label="عدد البطاقات" value={String(numberValue(summary.cards_count))} icon="payments" />
              <SummaryCard label="متوسط الحد" value={money(summary.average_limit)} icon="wallet" />
              <SummaryCard label="أعلى حد ائتماني" value={money(summary.highest_limit)} icon="stats" wide />
            </View>

            <View style={styles.highestCardBox}>
              <Text style={styles.highestCardValue}>{highestCardLabel}</Text>
              <Text style={styles.highestCardLabel}>صاحبة أعلى حد</Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCount}>{cards.length}</Text>
              <Text style={styles.sectionTitle}>البطائق المسجلة</Text>
            </View>
          </>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyCard}>
            <UiIcon name="payments" size={34} color={ICON_COLOR} />
            <Text style={styles.emptyTitle}>لا توجد بطائق مضافة</Text>
            <Text style={styles.emptyText}>استخدم زر الإضافة لإدخال أول بطاقة ائتمانية.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEdit(item)}>
                <UiIcon name="edit" size={19} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => remove(item)}>
                <UiIcon name="delete" size={19} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardNameRow}>
                <Text style={styles.cardName}>{item.card_name}</Text>
                <View style={styles.cardIcon}>
                  <UiIcon name="payments" size={22} color={ICON_COLOR} />
                </View>
              </View>
              <Text style={styles.bankName}>{item.bank_name}</Text>
              <View style={styles.limitBox}>
                <Text style={styles.limitValue}>{money(item.credit_limit)}</Text>
                <Text style={styles.limitLabel}>الحد الائتماني المحتسب كدين</Text>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.floatingAdd} onPress={openAdd} activeOpacity={0.85}>
        <UiIcon name="add" size={30} color="#ffffff" />
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

function SummaryCard({ label, value, icon, wide }) {
  return (
    <View style={[styles.summaryCard, wide && styles.summaryCardWide]}>
      <View style={styles.summaryIcon}>
        <UiIcon name={icon} size={21} color={ICON_COLOR} />
      </View>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  backButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  backButtonPlaceholder: { width: 52, height: 52 },
  topTitle: { flex: 1, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  content: { padding: 18, paddingTop: 2, paddingBottom: 110 },
  hero: { backgroundColor: '#0f172a', borderRadius: 30, padding: 22, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 999, backgroundColor: '#7c3aed', opacity: 0.2, top: -82, left: -48 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  heroBadgeText: { color: '#ddd6fe', fontWeight: '900' },
  heroAmount: { marginTop: 24, color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  heroLabel: { marginTop: 5, color: '#cbd5e1', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  heroNote: { marginTop: 12, color: '#94a3b8', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  loadingState: { paddingVertical: 22, alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b', fontWeight: '800' },
  message: { marginTop: 12, backgroundColor: '#fff1f2', color: '#b91c1c', borderRadius: 16, padding: 12, fontWeight: '900', textAlign: 'center', overflow: 'hidden' },
  summaryGrid: { marginTop: 12, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  summaryCard: { flexBasis: '47.5%', flexGrow: 1, minHeight: 125, backgroundColor: '#ffffff', borderRadius: 21, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, alignItems: 'flex-end' },
  summaryCardWide: { flexBasis: '100%' },
  summaryIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },
  summaryValue: { marginTop: 12, color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 5, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  highestCardBox: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 13 },
  highestCardValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'left' },
  highestCardLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  sectionHeader: { marginTop: 18, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  sectionCount: { minWidth: 34, backgroundColor: '#ede9fe', color: '#5b21b6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontWeight: '900', textAlign: 'center', overflow: 'hidden' },
  cardRow: { flexDirection: 'row', gap: 9, backgroundColor: '#ffffff', borderRadius: 23, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10 },
  cardActions: { justifyContent: 'center', gap: 8 },
  actionButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, alignItems: 'flex-end' },
  cardNameRow: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  cardIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },
  cardName: { flex: 1, color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  bankName: { marginTop: 6, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  limitBox: { marginTop: 12, width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#eef2f7', padding: 11, alignItems: 'flex-end' },
  limitValue: { color: '#312e81', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  limitLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', padding: 24, alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: '#0f172a', fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 5, color: '#64748b', fontWeight: '700', textAlign: 'center' },
  floatingAdd: { position: 'absolute', left: 22, bottom: 24, width: 62, height: 62, borderRadius: 31, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#312e81', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.54)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 27, borderWidth: 1, borderColor: '#e2e8f0', padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#475569', fontSize: 26, lineHeight: 28, fontWeight: '700' },
  modalTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  inputLabel: { marginTop: 12, marginBottom: 6, color: '#334155', fontWeight: '900', textAlign: 'right' },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#dbe3ea', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: '800', paddingHorizontal: 14 },
  inputHint: { marginTop: 6, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  saveButton: { marginTop: 18, minHeight: 52, borderRadius: 17, backgroundColor: '#7c3aed', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabledButton: { opacity: 0.6 },
  saveText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
});
