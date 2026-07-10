import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CreditCardDebtsScreen from './CreditCardDebtsScreen';
import DebtsLoansScreen from './DebtsLoansScreen';
import UiIcon from './UiIcon';

export default function DebtsScreen({ onBack }) {
  const [showCreditCards, setShowCreditCards] = useState(false);

  if (showCreditCards) {
    return <CreditCardDebtsScreen onBack={() => setShowCreditCards(false)} />;
  }

  return (
    <View style={styles.container}>
      <DebtsLoansScreen onBack={onBack} />
      <TouchableOpacity
        style={styles.creditCardsButton}
        onPress={() => setShowCreditCards(true)}
        activeOpacity={0.86}
      >
        <UiIcon name="payments" size={23} color="#ffffff" />
        <View style={styles.textBlock}>
          <Text style={styles.title}>بطائق الائتمان</Text>
          <Text style={styles.subtitle}>إضافة البطاقات واحتساب حدودها كدين</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  creditCardsButton: {
    position: 'absolute',
    left: 20,
    bottom: 24,
    minWidth: 220,
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 10,
    shadowColor: '#312e81',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  textBlock: { flex: 1, alignItems: 'flex-end' },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 3, color: '#ede9fe', fontSize: 10, fontWeight: '700', textAlign: 'right' },
});
