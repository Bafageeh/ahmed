import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';
import { money, n } from './ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const todayText = () => new Date().toISOString().slice(0, 10);

const defaultInvestors = [
  { code: 'ahmed', name: 'أحمد' },
  { code: 'sara', name: 'سارة' },
  { code: 'amal', name: 'آمال' },
  { code: 'mother', name: 'أمي' },
  { code: 'father', name: 'الوالد' },
];

function accountInvestorsFrom(investors) {
  const map = new Map();

  defaultInvestors.forEach((investor) => {
    map.set(investor.code, investor);
  });

  (investors || []).forEach((investor) => {
    const code = investor.code || investor.name;
    const name = investor.name || investor.code;
    if (code && name) map.set(code, { code, name });
  });

  return Array.from(map.values());
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  const parts = text.split(/[-\/]/).map((part) => part.trim());
  if (parts.length !== 3) return text || todayText();
  const [day, month, year] = parts;
  if (year.length === 4) return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return text;
}

function parseBulkLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+(-?[\d,]+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  const amount = n(match[2].replace(/,/g, ''));
  if (!amount) return null;
  return {
    entry_date: normalizeDate(match[1]),
    amount: Math.abs(amount),
    type: amount < 0 ? 'withdrawal' : 'deposit',
    notes: match[3]?.trim() || null,
  };
}

export function Ta3meedInvestorAccounts({ investors }) {
  const accountInvestors = useMemo(() => accountInvestorsFrom(investors), [investors]);
  const [selected, setSelected] = useState(null);

  if (selected) {
    return <InvestorAccount investor={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={styles.investorScreen}>
      <Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text>
      <Text style={styles.investorScreenSubtitle}>هذه هي شاشة إدخال الأرصدة: اختر المستثمر ثم أضف رصيدًا أو سجل سحبًا أو عدّل الحركات السابقة.</Text>
      {accountInvestors.map((investor) => (
        <TouchableOpacity key={investor.code} style={styles.investorAccountButton} onPress={() => setSelected(investor)} activeOpacity={0.84}>
          <Text style={styles.investorAccountButtonText}>حساب {investor.name} - إضافة رصيد / تعديل</Text>
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
  const [entryType, setEntryType] = useState('deposit');
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [message, setMessage] = useState('');

  const entries = account?.entries || [];
  const balance = useMemo(() => n(account?.balance), [account]);
  const isEditing = Boolean(editingEntryId);

  const emptyAccount = () => ({
    investor,
    balance: 0,
    entries: [],
  });

  const loadAccount = async () => {
    setMessage('جاري تحميل الحساب...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account`);
      const json = await response.json();
      if (!response.ok) {
        setAccount(emptyAccount());
        setMessage('الحساب جاهز. أضف أول رصيد لهذا المستثمر.');
        return;
      }
      setAccount(json.data || emptyAccount());
      setMessage('');
    } catch {
      setAccount(emptyAccount());
      setMessage('تعذر تحميل الحساب، يمكنك المحاولة بعد تحديث الاتصال.');
    }
  };

  useEffect(() => {
    loadAccount();
  }, [investor.code]);

  const resetForm = () => {
    setAmount('');
    setNotes('');
    setEntryDate(todayText());
    setEntryType('deposit');
    setEditingEntryId(null);
  };

  const startEdit = (entry) => {
    const value = n(entry.amount);
    setEditingEntryId(entry.id);
    setAmount(String(Math.abs(value)));
    setEntryType(value < 0 ? 'withdrawal' : 'deposit');
    setEntryDate(entry.entry_date || todayText());
    setNotes(entry.notes || '');
    setMessage('تم فتح حركة الرصيد للتعديل');
  };

  const saveEntry = async () => {
    const value = n(amount);
    if (!value) {
      setMessage('أدخل المبلغ أولًا');
      return;
    }
    setMessage(isEditing ? 'جاري حفظ التعديل...' : (entryType === 'withdrawal' ? 'جاري تسجيل السحب...' : 'جاري إضافة الرصيد...'));
    try {
      const url = isEditing
        ? `${API_URL}/ta3meed/investors/${investor.code}/account/entries/${editingEntryId}`
        : `${API_URL}/ta3meed/investors/${investor.code}/account/entries`;
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ amount: value, type: entryType, entry_date: entryDate || todayText(), notes: notes || null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'entry failed');
      resetForm();
      setAccount(json.data || emptyAccount());
      setMessage(isEditing ? 'تم تعديل حركة الرصيد' : (entryType === 'withdrawal' ? 'تم تسجيل السحب من حساب المستثمر' : 'تمت إضافة الرصيد لحساب المستثمر'));
    } catch {
      setMessage('تعذر حفظ الحركة. إذا كان الحساب جديدًا حدّث التطبيق ثم حاول مرة أخرى.');
    }
  };

  const importBulkEntries = async () => {
    const parsed = bulkText.split(/\n+/).map(parseBulkLine).filter(Boolean);
    if (!parsed.length) {
      setMessage('لم يتم التعرف على أي سطر. الصيغة: 05-10-2024 10,000 ملاحظة');
      return;
    }
    setBulkBusy(true);
    setMessage(`جاري استيراد ${parsed.length} حركة...`);
    try {
      let lastAccount = null;
      for (const entry of parsed) {
        const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(entry),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || 'bulk failed');
        lastAccount = json.data || lastAccount;
      }
      setAccount(lastAccount || account || emptyAccount());
      setBulkText('');
      setMessage(`تم استيراد ${parsed.length} حركة بنجاح`);
    } catch {
      setMessage('تعذر استيراد بعض الحركات. راجع الصيغة ثم حاول مرة أخرى.');
      await loadAccount();
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteEntry = async (entry) => {
    setMessage('جاري حذف الحركة...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account/entries/${entry.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'delete failed');
      if (editingEntryId === entry.id) resetForm();
      setAccount(json.data || emptyAccount());
      setMessage('تم حذف حركة الرصيد');
    } catch {
      setMessage('تعذر حذف الحركة');
    }
  };

  return (
    <View style={styles.investorScreen}>
      <TouchableOpacity style={styles.investorAccountBackButton} onPress={onBack} activeOpacity={0.84}>
        <Text style={styles.investorAccountBackText}>رجوع لحسابات المستثمرين</Text>
      </TouchableOpacity>
      <Text style={styles.investorScreenTitle}>حساب {investor.name}</Text>
      <Text style={styles.investorBalanceText}>الرصيد: {money(balance, 2)} ر.س</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}

      <View style={styles.investorPaymentCard}>
        <Text style={styles.investorPaymentTitle}>{isEditing ? 'تعديل حركة رصيد' : (entryType === 'withdrawal' ? 'تسجيل سحب من الرصيد' : 'إضافة رصيد جديد')}</Text>
        <View style={styles.investorEntryTypeRow}>
          <EntryTypeButton label="إضافة" active={entryType === 'deposit'} onPress={() => setEntryType('deposit')} />
          <EntryTypeButton label="سحب" active={entryType === 'withdrawal'} onPress={() => setEntryType('withdrawal')} danger />
        </View>
        <TextInput value={amount} onChangeText={setAmount} placeholder="المبلغ" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.investorPaymentInput} />
        <TextInput value={entryDate} onChangeText={setEntryDate} placeholder="تاريخ الحركة YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.investorPaymentInput} />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="ملاحظات"
          placeholderTextColor="#94a3b8"
          style={[styles.investorPaymentInput, styles.investorNotesInput]}
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity style={[styles.investorPaymentButton, entryType === 'withdrawal' && styles.investorWithdrawButton]} onPress={saveEntry} activeOpacity={0.84}>
          <Text style={styles.investorPaymentButtonText}>{isEditing ? 'حفظ التعديل' : (entryType === 'withdrawal' ? 'تسجيل سحب' : 'إضافة مبلغ')}</Text>
        </TouchableOpacity>
        {isEditing ? (
          <TouchableOpacity style={styles.investorCancelEditButton} onPress={resetForm} activeOpacity={0.84}>
            <Text style={styles.investorCancelEditText}>إلغاء التعديل</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.investorPaymentCard}>
        <Text style={styles.investorPaymentTitle}>استيراد جماعي</Text>
        <Text style={styles.investorPaymentMeta}>الصيغة لكل سطر: التاريخ المبلغ الملاحظة. مثال: 05-10-2024 10,000 استثمار</Text>
        <TextInput
          value={bulkText}
          onChangeText={setBulkText}
          placeholder={'05-10-2024 10,000\n11-11-2024 15,000\n18-04-2025 -1,000 ملاحظة'}
          placeholderTextColor="#94a3b8"
          style={[styles.investorPaymentInput, styles.investorBulkInput]}
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.investorPaymentButton} onPress={importBulkEntries} disabled={bulkBusy} activeOpacity={0.84}>
          <Text style={styles.investorPaymentButtonText}>{bulkBusy ? 'جاري الاستيراد...' : 'استيراد الحركات'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.panelTitle}>حركات الرصيد</Text>
      {entries.length === 0 ? (
        <Text style={styles.investorScreenSubtitle}>لا توجد حركات رصيد بعد.</Text>
      ) : entries.map((entry) => (
        <View key={entry.id} style={styles.investorPaymentCard}>
          <View style={styles.balanceEntryHeader}>
            <View style={styles.balanceEntryActions}>
              <TouchableOpacity style={styles.balanceEntryActionButton} onPress={() => startEdit(entry)} activeOpacity={0.84}>
                <Text style={[styles.balanceEntryActionIcon, styles.balanceEntryEditIcon]}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.balanceEntryActionButton} onPress={() => deleteEntry(entry)} activeOpacity={0.84}>
                <Text style={[styles.balanceEntryActionIcon, styles.balanceEntryDeleteIcon]}>🗑</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.investorPaymentTitle, n(entry.amount) < 0 && styles.investorWithdrawText]}>{money(entry.amount, 2)} ر.س</Text>
          </View>
          <Text style={styles.investorPaymentMeta}>التاريخ: {entry.entry_date || '-'}</Text>
          {entry.notes ? <Text style={styles.investorPaymentMeta}>ملاحظات: {entry.notes}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function EntryTypeButton({ label, active, onPress, danger }) {
  return (
    <TouchableOpacity style={[styles.investorEntryTypeButton, active && styles.investorEntryTypeButtonActive, danger && active && styles.investorEntryTypeButtonDanger]} onPress={onPress} activeOpacity={0.84}>
      <Text style={[styles.investorEntryTypeText, active && styles.investorEntryTypeTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
