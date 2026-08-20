import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';

const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) => `${numberValue(value).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} ر.س`;

export default function CreditCardsDebtSummaryCard({ summary = {}, onPress }) {
  const count = numberValue(summary.cards_count);
  const highest = summary.highest_card;
  const highestLabel = highest
    ? `${highest.bank_name} • ${highest.card_name}`
    : 'لا توجد بطاقات مضافة';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.84}>
      <View style={styles.topRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>ائتماني</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>بطائق الائتمان</Text>
          <Text style={styles.category}>دين بطاقات</Text>
        </View>

        <View style={styles.iconBox}>
          <UiIcon name="payments" size={25} color={ICON_COLOR} />
        </View>
      </View>

      <View style={styles.moneyRow}>
        <View style={styles.moneyBox}>
          <Text style={styles.moneyValue}>{money(summary.total_debt)}</Text>
          <Text style={styles.moneyLabel}>إجمالي الدين</Text>
        </View>
        <View style={styles.moneyBox}>
          <Text style={styles.countValue}>{String(count)}</Text>
          <Text style={styles.moneyLabel}>عدد البطاقات</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.highestLimit}>أعلى حد: {money(summary.highest_limit)}</Text>
          <Text style={styles.highestCard} numberOfLines={1}>{highestLabel}</Text>
        </View>
        <UiIcon name="back" size={20} color={ICON_COLOR_DARK} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    padding: 20,
    marginBottom: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  statusText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '900',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    color: '#0f172a',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'right',
  },
  category: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  moneyBox: {
    flex: 1,
    minHeight: 92,
    borderRadius: 21,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  moneyValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  countValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'right',
  },
  moneyLabel: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  summaryRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTextBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  highestLimit: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  highestCard: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: '92%',
  },
});
