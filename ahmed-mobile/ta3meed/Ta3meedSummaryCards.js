import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './ta3meedStyles';

export function SummaryCard({ icon, iconStyle, label, value, prefix, suffix, tint }) {
  return (
    <View style={[styles.summaryCard, tint]}>
      <View style={[styles.summaryIcon, iconStyle]}>
        <Text style={styles.summaryIconText}>{icon}</Text>
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.valueLine}>
        {prefix ? <Text style={styles.currencyText}>{prefix}</Text> : null}
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
      {suffix ? <Text style={styles.summarySuffix}>{suffix}</Text> : null}
    </View>
  );
}
