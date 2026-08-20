import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';
import BankLogo from './BankLogo';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

const SAUDI_BANKS = [
  'البنك الأهلي',
  'البنك العربي',
  'البنك الفرنسي',
  'بنك الراجحي',
  'بنك الرياض',
  'بنك البلاد',
  'بنك الإنماء',
  'البنك السعودي الأول',
  'البنك السعودي للاستثمار',
  'بنك الجزيرة',
  'بنك الخليج الدولي - السعودية',
  'بنك إس تي سي',
  'بنك فيجن',
  'بنك D360',
  'آيزي بنك',
];

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
  const [bankMenuOpen, setBankMenuOpen] = useState(false);
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
    setBankMenuOpen(false);
    setCardName('');
    setCreditLimit('');
    setMessage('');
    setModalVisible(true);
  };

  const openEdit = (card) => {
    setEditingCard(card);
    setBankName(card.bank_name || '');
    setBankMenuOpen(false);
    setCardName(card.card_name || '');
    setCreditLimit(String(numberValue(card.credit_limit)));
    setMessage('');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setBankMenuOpen(false);
    setModalVisible(false);
    setEditingCard(null);
  };

  const chooseBank = (bank) => {
    setBankName(bank);
    setBankMenuOpen(false);
  };

  const save = async () => {
    const bank = bankName.trim();
    const name = cardName.trim();
    const limit = numberValue(creditLimit);

    if (!bank || !name || limit <= 0) {
      setMessage('اختر البنك وأدخل اسم البطاقة والحد الائتماني بصورة صحيحة.');
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

      setBankMenuOpen(false);
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
          <UiIcon name="back" size={23} color={ICON_COLOR_DARK} />
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
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>{numberValue(summary.cards_count)} بطاقة</Text>
                </View>
                <Text style={styles.summaryLabel}>إجمالي دين البطاقات</Text>
              </View>
              <Text style={styles.summaryAmount}>{money(summary.total_debt)}</Text>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryBottomRow}>
                <View style={styles.summaryInfoBlock}>
                  <Text style={styles.summaryInfoValue}>{money(summary.highest_limit)}</Text>
                  <Text style={styles.summaryInfoLabel}>أعلى حد</Text>
                </View>
                <View style={styles.summaryInfoBlockWide}>
                  <Text style={styles.summaryInfoName} numberOfLines={1}>{highestCardLabel}</Text>
                  <Text style={styles.summaryInfoLabel}>صاحبة أعلى حد</Text>
                </View>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={ICON_COLOR} />
                <Text style={styles.loadingText}>جاري تحميل البطاقات...</Text>
              </View>
            ) : null}

            {!!message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={styles.sectionHeader}>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{cards.length}</Text>
              </View>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>البطائق المسجلة</Text>
                <Text style={styles.sectionSubtitle}>عرض مختصر وسريع للبطاقات</Text>
              </View>
            </View>
          </>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyCard}>
            <UiIcon name="payments" size={28} color={ICON_COLOR} />
            <Text style={styles.emptyTitle}>لا توجد بطائق مضافة</Text>
            <Text style={styles.emptyText}>استخدم زر الإضافة لإدخال أول بطاقة ائتمانية.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.creditCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardName} numberOfLines={1}>{item.card_name}</Text>
                <Text style={styles.bankName} numberOfLines={1}>{item.bank_name}</Text>
              </View>
              <View style={styles.cardIcon}>
                <BankLogo bankName={item.bank_name} size={29} />
              </View>
            </View>

            <View style={styles.cardBottomRow}>
              <View style={styles.amountBlock}>
                <Text style={styles.limitValue}>{money(item.credit_limit)}</Text>
                <Text style={styles.limitLabel}>الحد المحتسب كدين</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.iconAction}
                  onPress={() => openEdit(item)}
                  activeOpacity={0.82}
                  accessibilityLabel="تعديل البطاقة"
                >
                  <UiIcon name="edit" size={17} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconAction, styles.deleteAction]}
                  onPress={() => remove(item)}
                  activeOpacity={0.82}
                  accessibilityLabel="حذف البطاقة"
                >
                  <UiIcon name="delete" size={17} color="#b91c1c" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.floatingAdd} onPress={openAdd} activeOpacity={0.88}>
        <UiIcon name="add" size={25} color="#ffffff" />
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
            <TouchableOpacity
              style={[styles.bankSelector, bankMenuOpen && styles.bankSelectorOpen]}
              onPress={() => setBankMenuOpen((value) => !value)}
              activeOpacity={0.82}
            >
              <Text style={[styles.bankSelectorText, !bankName && styles.bankSelectorPlaceholder]} numberOfLines={1}>
                {bankName || 'اختر البنك'}
              </Text>
              <Text style={styles.bankSelectorArrow}>{bankMenuOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {bankMenuOpen ? (
              <View style={styles.bankMenu}>
                <ScrollView
                  style={styles.bankMenuScroll}
                  contentContainerStyle={styles.bankMenuContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {SAUDI_BANKS.map((bank) => {
                    const selected = bank === bankName;
                    return (
                      <TouchableOpacity
                        key={bank}
                        style={[styles.bankOption, selected && styles.bankOptionSelected]}
                        onPress={() => chooseBank(bank)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.bankOptionLogo}>
                          <BankLogo bankName={bank} size={27} />
                        </View>
                        <Text style={[styles.bankOptionText, selected && styles.bankOptionTextSelected]}>{bank}</Text>
                        {selected ? <Text style={styles.bankOptionCheck}>✓</Text> : <View style={styles.bankOptionCheckSpace} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

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
                  <UiIcon name="save" size={19} color="#ffffff" />
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
    paddingHorizontal: 16,
    paddingTop: androidTopInset + 4,
    paddingBottom: 8,
    minHeight: 62 + androidTopInset,
    backgroundColor: '#f4f7fb',
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { width: 46, height: 46 },
  topTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  topTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  topSubtitle: { marginTop: 1, color: '#94a3b8', fontSize: 9, fontWeight: '800', textAlign: 'center' },

  content: { paddingHorizontal: 15, paddingTop: 2, paddingBottom: 94 },

  summaryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryBadge: { backgroundColor: 'rgba(167,139,250,0.18)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  summaryBadgeText: { color: '#ddd6fe', fontSize: 10, fontWeight: '900' },
  summaryLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  summaryAmount: { marginTop: 8, color: '#ffffff', fontSize: 27, fontWeight: '900', textAlign: 'right' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.25)', marginVertical: 10 },
  summaryBottomRow: { flexDirection: 'row', gap: 14 },
  summaryInfoBlock: { flex: 0.85, alignItems: 'flex-end' },
  summaryInfoBlockWide: { flex: 1.15, alignItems: 'flex-end' },
  summaryInfoValue: { color: '#f8fafc', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  summaryInfoName: { color: '#f8fafc', fontSize: 12, fontWeight: '900', textAlign: 'right', maxWidth: '100%' },
  summaryInfoLabel: { marginTop: 2, color: '#94a3b8', fontSize: 8, fontWeight: '800', textAlign: 'right' },

  loadingState: { paddingVertical: 14, alignItems: 'center' },
  loadingText: { marginTop: 6, color: '#64748b', fontSize: 11, fontWeight: '800' },
  message: { marginBottom: 10, backgroundColor: '#fff1f2', color: '#b91c1c', borderRadius: 13, padding: 10, fontSize: 11, fontWeight: '900', textAlign: 'right' },

  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8, gap: 8 },
  sectionCount: { minWidth: 31, height: 31, paddingHorizontal: 7, borderRadius: 16, backgroundColor: '#efe9ff', alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { color: '#6d28d9', fontSize: 12, fontWeight: '900' },
  sectionTitleBlock: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sectionSubtitle: { marginTop: 1, color: '#94a3b8', fontSize: 9, fontWeight: '800', textAlign: 'right' },

  creditCard: {
    backgroundColor: '#ffffff',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  cardTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  cardTextBlock: { flex: 1, alignItems: 'flex-end' },
  cardName: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  bankName: { marginTop: 1, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  cardIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBottomRow: {
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef2f7',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  amountBlock: { flex: 1, alignItems: 'flex-end' },
  limitValue: { color: '#312e81', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  limitLabel: { marginTop: 1, color: '#64748b', fontSize: 8, fontWeight: '800', textAlign: 'right' },
  cardActions: { flexDirection: 'row-reverse', gap: 6 },
  iconAction: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: { backgroundColor: '#fff7f7', borderColor: '#fecaca' },

  emptyCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe3ea', padding: 20, alignItems: 'center' },
  emptyTitle: { marginTop: 9, color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 18 },

  floatingAdd: {
    position: 'absolute',
    left: 18,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#312e81',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 18, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 23, lineHeight: 23, color: '#64748b', fontWeight: '900' },
  modalTitle: { flex: 1, color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  inputLabel: { marginTop: 9, marginBottom: 6, color: '#0f172a', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  input: { minHeight: 50, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', paddingHorizontal: 13, color: '#0f172a', fontSize: 15, fontWeight: '700' },
  inputHint: { marginTop: 6, color: '#64748b', fontSize: 10, fontWeight: '700', textAlign: 'right' },

  bankSelector: { minHeight: 50, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', paddingHorizontal: 13, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  bankSelectorOpen: { borderColor: '#8b5cf6', backgroundColor: '#faf9ff' },
  bankSelectorText: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  bankSelectorPlaceholder: { color: '#94a3b8', fontWeight: '700' },
  bankSelectorArrow: { color: '#6d28d9', fontSize: 11, fontWeight: '900' },
  bankMenu: { marginTop: 7, borderRadius: 15, borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#ffffff', overflow: 'hidden' },
  bankMenuScroll: { maxHeight: 245 },
  bankMenuContent: { paddingVertical: 4 },
  bankOption: { minHeight: 47, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eef2f7' },
  bankOptionSelected: { backgroundColor: '#f5f3ff' },
  bankOptionLogo: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bankOptionText: { flex: 1, color: '#334155', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  bankOptionTextSelected: { color: '#6d28d9', fontWeight: '900' },
  bankOptionCheck: { width: 20, color: '#6d28d9', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  bankOptionCheckSpace: { width: 20 },

  saveButton: { marginTop: 16, minHeight: 50, borderRadius: 16, backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabledButton: { opacity: 0.7 },
  saveText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
