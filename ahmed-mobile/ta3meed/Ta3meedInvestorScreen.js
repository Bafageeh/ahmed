import React, { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { investorCodesOf, money, n, titleOf } from './ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

export function Ta3meedInvestorScreen({ investor, items, onSaved }) {
  const [amounts, setAmounts] = useState({});
  const [message, setMessage] = useState('');

  const investorItems = useMemo(() => {
    if (!investor) return [];
    return items.filter((item) => investorCodesOf(item).includes(investor.code));
  }, [items, investor]);

  const totals = useMemo(() => {
    return investorItems.reduce((sum, item) => {
      const allocation = (item.allocations || []).find((entry) => (entry.investor_code || entry.investor_name) === investor?.code);
      return {
        invested: sum.invested + n(allocation?.invested_amount),
        received: sum.received + n(allocation?.received_amount),
        profit: sum.profit + n(allocation?.expected_profit_amount),
      };
    }, { invested: 0, received: 0, profit: 0 });
  }, [investorItems, investor]);

  const savePayment = async (item) => {
    const value = n(amounts[item.id]);
    if (!value) {
      setMessage('أدخل مبلغ الدفع أولًا');
      return;
    }
    setMessage('جاري تسجيل المبلغ...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ opportunity_id: item.id, amount: value }),
      });
      if (!response.ok) throw new Error('payment failed');
      setAmounts((current) => ({ ...current, [item.id]: '' }));
      setMessage('تم تسجيل مبلغ المستثمر في تعميد');
      onSaved?.();
    } catch {
      setMessage('تعذر تسجيل المبلغ');
    }
  };

  if (!investor) return null;

  return (
    <View style={styles.investorScreen}>
      <Text style={styles.investorScreenTitle}>{investor.name}</Text>
      <Text style={styles.investorScreenSubtitle}>استثمارات تعميد الخاصة بهذا المستثمر</Text>
      <Text style={styles.investorPaymentMeta}>إجمالي المستثمر: {money(totals.invested, 2)} ر.س · الربح المتوقع: {money(totals.profit, 2)} ر.س · المسدد: {money(totals.received, 2)} ر.س</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {investorItems.map((item) => {
        const allocation = (item.allocations || []).find((entry) => (entry.investor_code || entry.investor_name) === investor.code);
        return (
          <View key={item.id} style={styles.investorPaymentCard}>
            <Text style={styles.investorPaymentTitle}>{titleOf(item)}</Text>
            <Text style={styles.investorPaymentMeta}>حصته: {money(allocation?.invested_amount, 2)} ر.س · مستلم/مدفوع: {money(allocation?.received_amount, 2)} ر.س</Text>
            <TextInput
              value={amounts[item.id] || ''}
              onChangeText={(value) => setAmounts((current) => ({ ...current, [item.id]: value }))}
              placeholder="مبلغ دفعه المستثمر"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              style={styles.investorPaymentInput}
            />
            <TouchableOpacity style={styles.investorPaymentButton} onPress={() => savePayment(item)} activeOpacity={0.84}>
              <Text style={styles.investorPaymentButtonText}>تسجيل المبلغ</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}
