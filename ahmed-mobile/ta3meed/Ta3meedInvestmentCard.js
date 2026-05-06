import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { styles } from './ta3meedStyles';
import { metaOf, money, n, statusOf, themes, titleOf, today } from './ta3meedUtils';

export function Ta3meedCard({ item, index, onEdit, onReceive, onDelete, receiving, expanded, onToggle }) {
  const meta = metaOf(item.metadata);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  const status = statusOf(item, today);
  const received = status.key === 'received';
  const overdue = status.key === 'overdue';
  const theme = themes[index % themes.length];
  const date = received ? (meta.received_date || item.received_at || item.maturity_date || '-') : (item.maturity_date || '-');
  const dateText = received ? `تم الاستلام في ${date}` : overdue ? `كان يستحق في ${date}` : `يستحق في ${date}`;

  return (
    <View style={styles.investmentCard}>
      <View style={styles.cardMainRow}>
        <View style={styles.itemIconWrap}>
          <View style={[styles.itemIcon, { backgroundColor: theme.bg }]}> 
            <Text style={styles.itemIconText}>{theme.icon}</Text>
          </View>
        </View>
        <View style={styles.itemCenter}>
          <Text style={styles.itemTitle} numberOfLines={1}>{titleOf(item, index)}</Text>
          <Text style={[styles.statusPill, overdue && styles.statusOverdue, received && styles.statusReceived]}>{status.label}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.calendarIcon}>▣</Text>
            <Text style={styles.dateText} numberOfLines={1}>{dateText}</Text>
            {received ? <Text style={styles.inlineCheck}>✓</Text> : null}
          </View>
        </View>
        <View style={styles.itemLeft}>
          <View style={styles.amountLine}>
            <Text style={styles.currencySmall}>ر.س</Text>
            <Text style={styles.amountValue}>{money(item.principal_amount)}</Text>
          </View>
          <Text style={[styles.profitText, overdue && styles.profitOverdue, received && styles.profitReceived]}>{received ? 'ربح متحقق' : 'ربح متوقع'} {money(item.expected_profit_amount, 2)} ر.س</Text>
          <View style={styles.actionsRow}>
            <CircleAction tone="delete" onPress={onDelete}><Feather name="trash-2" size={14} color="#ef4444" /></CircleAction>
            {!received ? <CircleAction tone="receive" onPress={onReceive} disabled={receiving}><Feather name="check" size={16} color="#16a34a" /></CircleAction> : <CircleAction onPress={onToggle}><Feather name="check-circle" size={15} color="#16a34a" /></CircleAction>}
            <CircleAction tone="edit" onPress={onEdit}><Feather name="edit-2" size={14} color="#2563eb" /></CircleAction>
            <CircleAction onPress={onToggle}><Feather name="eye" size={14} color="#475569" /></CircleAction>
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
