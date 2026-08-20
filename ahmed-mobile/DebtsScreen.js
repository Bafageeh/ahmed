import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CreditCardDebtsScreen from './CreditCardDebtsScreen';
import DebtsLoansScreen from './DebtsLoansScreen';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

export default function DebtsScreen({ onBack }) {
  const [showCreditCards, setShowCreditCards] = useState(false);
  const [creditCardSummary, setCreditCardSummary] = useState({});

  const loadCreditCardSummary = async () => {
    try {
      const response = await fetch(`${API_URL}/credit-card-debts`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) return;
      setCreditCardSummary(json.summary || {});
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
    return (
      <CreditCardDebtsScreen
        onBack={closeCreditCards}
        onChanged={loadCreditCardSummary}
      />
    );
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
