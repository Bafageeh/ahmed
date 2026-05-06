import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';

export const filters = [
  { key: 'all', label: 'الكل', dot: '#0f766e' },
  { key: 'active', label: 'نشط', dot: '#36a852' },
  { key: 'overdue', label: 'متأخر', dot: '#f97316' },
  { key: 'received', label: 'مستلم', dot: '#2f93df' },
];

export function FilterSegment({ filter, active, onPress }) {
  const all = filter.key === 'all';
  return (
    <TouchableOpacity style={[styles.filterSegment, all && styles.allFilterSegment, active && styles.filterSegmentActive]} onPress={onPress} activeOpacity={0.84}>
      {all ? <Text style={[styles.gridIcon, active && styles.gridIconActive]}>▦</Text> : <View style={[styles.filterDot, { backgroundColor: filter.dot }]} />}
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{filter.label}</Text>
    </TouchableOpacity>
  );
}
