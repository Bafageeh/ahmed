import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { investorsOf, metaOf, money, n, statusOf, titleOf, today } from './ta3meedUtils';

export function Ta3meedCard({ item, index, selectedInvestorCode, onEdit, onReceive, onDelete, receiving, expanded, onToggle }) {
  const meta = metaOf(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const investors = investorsOf(item);
  const status = statusOf(item, today);
  const received = status.key === 'received';
  const overdue = status.key === 'overdue';
  const date = received ? (meta.received_date || item.received_at || item.maturity_date || '-') : (item.maturity_date || '-');
  const dateText = received ? `تم الاستلام في ${date}` : overdue ? `كان يستحق في ${date}` : `يستحق في ${date}`;
  const selectedAllocation = selectedInvestorCode ? allocations.find((allocation) => (allocation.investor_code || allocation.investor_name) === selectedInvestorCode) : null;
  const months = Math.max(1, n(meta.months || 12));
  const investorRate = selectedAllocation && n(selectedAllocation.invested_amount) > 0
    ? (n(selectedAllocation.expected_profit_amount) / n(selectedAllocation.invested_amount)) * 100
    : null;
  const annualRate = investorRate !== null ? investorRate * (12 / months) : null;

  return (
    <View style={[styles.investmentCard, status.key === 'active' && styles.investmentCardActive, status.key === 'overdue' && styles.investmentCardOverdue, status.key === 'received' && styles.investmentCardReceived]}>
      <View style={styles.cardMainRow}>
        <View style={styles.itemCenter}>
          <Text style={styles.itemTitle} numberOfLines={1}>{titleOf(item, index)}</Text>
          <View style={styles.investorNamesRow}>
            {(investors.length ? investors : ['بدون مستثمر']).map((name) => (
              <View key={name} style={styles.investorNameChip}>
                <Text style={styles.investorNameText}>{name}</Text>
              </View>
            ))}
          </View>
          {selectedAllocation ? (
            <Text style={styles.investorRateText}>ربح المستثمر: {money(selectedAllocation.expected_profit_amount, 2)} ر.س · النسبة {investorRate.toFixed(2)}% لمدة {months} شهر · سنويًا {annualRate.toFixed(2)}%</Text>
          ) : null}
          <View style={styles.dateRow}>
            <Text style={styles.calendarIcon}>▣</Text>
            <Text style={styles.dateText} numberOfLines={1}>{dateText}</Text>
            {received ? <Text style={styles.inlineCheck}>✓</Text> : null}
          </View>
        </View>
        <View style={styles.itemLeft}>
          <View style={styles.amountLine}>
            <Text style={styles.currencySmall}>ر.س</Text>
            <Text style={styles.amountValue}>{money(selectedAllocation?.invested_amount || item.principal_amount)}</Text>
          </View>
          <Text style={[styles.profitText, overdue && styles.profitOverdue, received && styles.profitReceived]}>{received ? 'ربح متحقق' : 'ربح متوقع'} {money(selectedAllocation?.expected_profit_amount || item.expected_profit_amount, 2)} ر.س</Text>
          <View style={styles.actionsRow}>
            <CircleAction onPress={onDelete}>
              <Text style={[styles.cardActionSymbol, styles.cardActionDelete]}>🗑</Text>
            </CircleAction>
            <CircleAction onPress={received ? onToggle : onReceive} disabled={receiving}>
              <Text style={[styles.cardActionSymbol, styles.cardActionCheck]}>✓</Text>
            </CircleAction>
            <CircleAction onPress={onEdit}>
              <Text style={[styles.cardActionSymbol, styles.cardActionEdit]}>✎</Text>
            </CircleAction>
            <CircleAction onPress={onToggle}>
              <Text style={[styles.cardActionSymbol, styles.cardActionEye]}>◉</Text>
            </CircleAction>
          </View>
        </View>
      </View>
      {expanded ? <CardDetails item={item} meta={meta} allocations={allocations} /> : null}
    </View>
  );
}

function CardDetails({ item, meta, allocations }) {
  return (
    <View style={styles.expandedArea}>
      <Text style={styles.detailText}>الكود: {item.reference_number || '-'}</Text>
      <Text style={styles.detailText}>التصنيف: {meta.category || '-'}</Text>
      <Text style={styles.detailText}>نسبة الربح: {n(item.expected_rate).toFixed(3)}%</Text>
      <Text style={styles.detailText}>مدة الاستثمار: {meta.months || 12} شهر</Text>
      <Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>
      {allocations.length ? (
        <View style={styles.allocBox}>
          <Text style={styles.allocTitle}>توزيع المستثمرين</Text>
          {allocations.map((a) => (
            <Text key={a.id} style={styles.allocText}>{a.investor_name}: {money(a.invested_amount, 2)} ر.س / ربح {money(a.expected_profit_amount, 2)}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CircleAction({ children, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.circleAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>
      {children}
    </TouchableOpacity>
  );
}

export function EmptyCard({ title = 'لا توجد بيانات', text = 'لا توجد فرص مطابقة للفلتر الحالي.' }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>◇</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
