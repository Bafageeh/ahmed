import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CreditCardDebtsVaultScreen from './CreditCardDebtsVaultScreen';
import DebtsLoansScreen from './DebtsLoansScreen';
import { loadVaultCreditCardDebtData } from './VaultCreditCardDebtData';

export default function DebtsScreen({ onBack }) {
  const [showCreditCards, setShowCreditCards] = useState(false);
  const [creditCardSummary, setCreditCardSummary] = useState({});

  const loadCreditCardSummary = async () => {
    try {
      const data = await loadVaultCreditCardDebtData();
      setCreditCardSummary(data.summary || {});
    } catch {
      // The main debts screen should remain usable if this compact summary fails.
    }
  };

  useEffect(() => {
    loadCreditCardSummary();
  }, []);

  const closeCreditCards = () => {
    setShowCreditCards(false);
    loadCreditCardSummary();
  };

  if (showCreditCards) {
    return <CreditCardDebtsVaultScreen onBack={closeCreditCards} />;
  }

  return (
    <View style={styles.container}>
      <DebtsLoansScreen
        onBack={onBack}
        creditCardSummary={creditCardSummary}
        onOpenCreditCards={() => setShowCreditCards(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
