import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';

export function investorOptionsFrom(items) {
  const map = new Map();
  items.forEach((item) => {
    (item.allocations || []).forEach((allocation) => {
      const code = allocation.investor_code || allocation.investor_name;
      const name = allocation.investor_name || allocation.investor_code;
      if (code && name) map.set(code, name);
    });
  });
  return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
}

export function Ta3meedInvestorFilter({ investors, selected, onSelect }) {
  if (!investors.length) return null;

  return (
    <View style={styles.investorFilterRow}>
      <InvestorChip label="كل المستثمرين" active={selected === 'all'} onPress={() => onSelect('all')} />
      {investors.map((investor) => (
        <InvestorChip key={investor.code} label={investor.name} active={selected === investor.code} onPress={() => onSelect(investor.code)} />
      ))}
    </View>
  );
}

function InvestorChip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.investorFilterChip, active && styles.investorFilterChipActive]} onPress={onPress} activeOpacity={0.84}>
      <Text style={[styles.investorFilterText, active && styles.investorFilterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
