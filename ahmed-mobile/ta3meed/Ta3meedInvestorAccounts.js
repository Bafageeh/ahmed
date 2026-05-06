import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { money, n } from './ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const todayText = () => new Date().toISOString().slice(0, 10);

export function Ta3meedInvestorAccounts({ investors }) {
  const [selected, setSelected] = useState(null);

  if (!investors.length) {
    return (
      <View style={styles.investorScreen}>
        <Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text>
        <Text style={styles.investorScreenSubtitle}>لا يوجد مستثمرون في تعميد حتى الآن.</Text>
      </View>
    );
  }

  if (selected) {
    return <InvestorAccount investor={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={styles.investorScreen}>
      <Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text>
      <Text style={styles.investorScreenSubtitle}>اختر حساب المستثمر لإضافة رصيد أو مراجعة الرصيد داخل تعميد.</Text>
      {investors.map((investor) => (
        <TouchableOpacity key={investor.code} style={styles.investorAccountButton} onPress={() => setSelected(investor)} activeOpacity={0.84}>
          <Text style={styles.investorAccountButtonText}>حساب {investor.name}</Text>
          <Text style={styles.investorAccountButtonIcon}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function InvestorAccount({ investor, onBack }) {
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayText());
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const entries = account?.entries || [];
  const balance = useMemo(() => n(account?.balance), [account]);

  const loadAccount = async () => {
    setMessage('جاري تحميل الحساب...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'account failed');
      setAccount(json.data || null);
      setMessage('');
    } catch {
      setMessage('تعذر تحميل حساب المستثمر');
    }
  };

  useEffect(() => {
    loadAccount();
  }, [investor.code]);

  const saveEntry = async () => {
    const value = n(amount);
    if (!value) {
      setMessage('أدخل المبلغ أولًا');
      return;
    }
    setMessage('جاري إضافة الرصيد...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ amount: value, entry_date: entryDate || todayText(), notes: notes || null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'entry failed');
      setAmount('');
      setNotes('');
      setEntryDate(todayText());
      setAccount(json.data || null);
      setMessage('تمت إضافة الرصيد لحساب المستثمر');
    } catch {
      setMessage('تعذر إضافة الرصيد');
    }
  };

  return (
    <View style={styles.investorScreen}>
      <TouchableOpacity style={styles.investorAccountBackButton} onPress={onBack} activeOpacity={0.84}>
        <Text style={styles.investorAccountBackText}>رجوع للحسابات</Text>
      </TouchableOpacity>
      <Text style={styles.investorScreenTitle}>حساب {investor.name}</Text>
      <Text style={styles.investorBalanceText}>الرصيد: {money(balance, 2)} ر.س</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}

      <View style={styles.investorPaymentCard}>
        <Text style={styles.investorPaymentTitle}>إضافة رصيد جديد</Text>
        <TextInput value={amount} onChangeText={setAmount} placeholder="المبلغ" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.investorPaymentInput} />
        <TextInput value={entryDate} onChangeText={setEntryDate} placeholder="تاريخ الإضافة YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} />
        <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} />
        <TouchableOpacity style={styles.investorPaymentButton} onPress={saveEntry} activeOpacity={0.84}>
          <Text style={styles.investorPaymentButtonText}>إضافة مبلغ</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.panelTitle}>حركات الرصيد</Text>
      {entries.length === 0 ? (
        <Text style={styles.investorScreenSubtitle}>لا توجد حركات رصيد بعد.</Text>
      ) : entries.map((entry) => (
        <View key={entry.id} style={styles.investorPaymentCard}>
          <Text style={styles.investorPaymentTitle}>{money(entry.amount, 2)} ر.س</Text>
          <Text style={styles.investorPaymentMeta}>التاريخ: {entry.entry_date || '-'}</Text>
          {entry.notes ? <Text style={styles.investorPaymentMeta}>ملاحظات: {entry.notes}</Text> : null}
        </View>
      ))}
    </View>
  );
}
