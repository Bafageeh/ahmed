import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';
import BankLogo from './BankLogo';
import { loadVaultCreditCardDebtData } from './VaultCreditCardDebtData';

const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) => `${numberValue(value).toLocaleString('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})} ر.س`;

const brandLabel = (card) => card.card_brand === 'mastercard' ? 'ماستركارد' : 'فيزا';

export default function CreditCardDebtsVaultScreen({ onBack }) {
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setMessage('');
    try {
      const data = await loadVaultCreditCardDebtData();
      setCards(data.cards || []);
      setSummary(data.summary || {});
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل بطاقات الخزنة الآمنة');
    } finally {
      if (refresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const highestCardLabel = useMemo(() => {
    const highest = summary.highest_card;
    return highest ? `${highest.bank_name} • ${highest.card_name}` : 'لا توجد بطاقات';
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
          <Text style={styles.topSubtitle}>تعرض تلقائيًا من حدود البطاقات في الخزنة الآمنة</Text>
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
                <View style={styles.summaryBadge}><Text style={styles.summaryBadgeText}>{numberValue(summary.cards_count)} بطاقة</Text></View>
                <Text style={styles.summaryLabel}>إجمالي حدود البطاقات</Text>
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

            <View style={styles.infoCard}>
              <UiIcon name="payments" size={22} color={ICON_COLOR} />
              <Text style={styles.infoText}>هذه الشاشة للعرض فقط. إضافة البطاقة أو تعديل حدها الائتماني يتم من الخزنة الآمنة ← البنك ← البطاقات.</Text>
            </View>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionCount}><Text style={styles.sectionCountText}>{cards.length}</Text></View>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>البطائق ذات الحد الائتماني</Text>
                <Text style={styles.sectionSubtitle}>لا تظهر هنا إلا البطاقة التي تم تسجيل حد لها في الخزنة الآمنة</Text>
              </View>
            </View>
          </>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyCard}>
            <UiIcon name="payments" size={28} color={ICON_COLOR} />
            <Text style={styles.emptyTitle}>لا توجد بطائق بحد ائتماني</Text>
            <Text style={styles.emptyText}>أدخل الحد من بطاقة البنك داخل الخزنة الآمنة وستظهر هنا تلقائيًا.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.creditCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardName} numberOfLines={1}>{item.card_name}</Text>
                <Text style={styles.bankName} numberOfLines={1}>{item.bank_name}</Text>
                <Text style={styles.brandName}>{brandLabel(item)}</Text>
              </View>
              <View style={styles.cardIcon}><BankLogo bankName={item.bank_name} size={31} /></View>
            </View>
            <View style={styles.cardBottomRow}>
              <View style={styles.amountBlock}>
                <Text style={styles.limitValue}>{money(item.credit_limit)}</Text>
                <Text style={styles.limitLabel}>الحد الائتماني</Text>
              </View>
              {item.card_last_four ? <Text style={styles.lastFour}>•••• {item.card_last_four}</Text> : null}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { minHeight: 86, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dbe3ea', backgroundColor: '#f8fafc' },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  topSubtitle: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  topBarSpacer: { width: 52 },
  content: { padding: 20, paddingBottom: 42 },
  summaryCard: { backgroundColor: '#101828', borderRadius: 28, padding: 20, marginBottom: 16 },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#253047' },
  summaryBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  summaryLabel: { color: '#cbd5e1', fontSize: 14, fontWeight: '800' },
  summaryAmount: { marginTop: 16, color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: '#334155', marginVertical: 18 },
  summaryBottomRow: { flexDirection: 'row', gap: 16 },
  summaryInfoBlock: { minWidth: 120, alignItems: 'flex-end' },
  summaryInfoBlockWide: { flex: 1, alignItems: 'flex-end' },
  summaryInfoValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
  summaryInfoName: { color: '#fff', fontSize: 13, fontWeight: '900', maxWidth: '100%' },
  summaryInfoLabel: { marginTop: 4, color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  loadingState: { paddingVertical: 22, alignItems: 'center', gap: 10 },
  loadingText: { color: '#64748b', fontWeight: '700' },
  message: { color: '#b91c1c', fontWeight: '800', textAlign: 'right', marginBottom: 12 },
  infoCard: { borderRadius: 20, borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 18 },
  infoText: { flex: 1, color: '#475569', fontSize: 12, lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionCount: { minWidth: 38, height: 38, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede9fe' },
  sectionCountText: { color: '#6d28d9', fontWeight: '900' },
  sectionTitleBlock: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  creditCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 24, padding: 18, marginBottom: 13 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTextBlock: { flex: 1, alignItems: 'flex-end' },
  cardName: { color: '#0f172a', fontSize: 19, fontWeight: '900', maxWidth: '100%' },
  bankName: { marginTop: 4, color: '#64748b', fontSize: 13, fontWeight: '800' },
  brandName: { marginTop: 3, color: '#7c3aed', fontSize: 12, fontWeight: '900' },
  cardIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  cardBottomRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#eef2f7', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amountBlock: { alignItems: 'flex-start' },
  limitValue: { color: '#0f172a', fontSize: 21, fontWeight: '900' },
  limitLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '700' },
  lastFour: { color: '#64748b', fontSize: 13, fontWeight: '900' },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 24, padding: 30, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#64748b', fontSize: 12, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
});
