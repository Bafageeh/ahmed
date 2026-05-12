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

function normalizedInvestorCode(value) {
  const text = String(value || '').trim();
  const aliases = {
    'أحمد': 'ahmed',
    'احمد': 'ahmed',
    'سارة': 'sara',
    'ساره': 'sara',
    'آمال': 'amal',
    'امال': 'amal',
    'أمال': 'amal',
    'أمي': 'mother',
    'امي': 'mother',
    'الوالد': 'father',
  };
  return aliases[text] || text;
}

function accountInvestorsFrom(investors) {
  const map = new Map();

  (investors || []).forEach((investor) => {
    const code = normalizedInvestorCode(investor.code || investor.name);
    const name = investor.name || investor.code;
    if (code && name) map.set(code, { code, name });
  });

  defaultInvestors.forEach((investor) => {
    if (!map.has(investor.code)) map.set(investor.code, investor);
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

function isEndedOpportunity(opportunity) {
  const status = String(opportunity?.opportunity_status || opportunity?.allocation_status || '').trim().toLowerCase();
  const closedStatuses = ['received', 'completed', 'closed', 'cancelled', 'canceled', 'finished', 'ended'];
  const maturityDate = String(opportunity?.maturity_date || '').slice(0, 10);
  const isOverdue = Boolean(maturityDate) && maturityDate < todayText();
  const remaining = n(opportunity?.remaining_amount);

  return closedStatuses.includes(status) || isOverdue || remaining <= 0;
}

function isActiveOpportunity(opportunity) {
  return !isEndedOpportunity(opportunity);
}

function isActivePartialOpportunity(opportunity) {
  const received = n(opportunity?.received_amount);
  const remaining = n(opportunity?.remaining_amount);

  return isActiveOpportunity(opportunity) && received > 0 && remaining > 0;
}

function activeInvestedOf(opportunities) {
  return (opportunities || [])
    .filter(isActiveOpportunity)
    .reduce((sum, opportunity) => sum + n(opportunity.invested_amount), 0);
}

function activePartialReceivedOf(opportunities) {
  return (opportunities || [])
    .filter(isActivePartialOpportunity)
    .reduce((sum, opportunity) => sum + n(opportunity.received_amount), 0);
}

function endedProfitAmountOf(opportunity) {
  const actualProfit = n(opportunity?.actual_profit_amount);
  if (actualProfit !== 0) return actualProfit;
  return Math.max(0, n(opportunity?.received_amount) - n(opportunity?.invested_amount));
}

function endedProfitOf(opportunities) {
  return (opportunities || [])
    .filter(isEndedOpportunity)
    .reduce((sum, opportunity) => sum + endedProfitAmountOf(opportunity), 0);
}

function normalizeAccount(raw, investor) {
  const summary = raw?.summary || {};
  const manualEntries = Array.isArray(raw?.manual_entries) ? raw.manual_entries : [];
  const mutationEntries = Array.isArray(raw?.entries) ? raw.entries : [];
  const entries = mutationEntries.length ? mutationEntries : manualEntries;
  const opportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : [];
  const activeInvested = activeInvestedOf(opportunities);
  const activePartialReceived = activePartialReceivedOf(opportunities);
  const endedProfit = endedProfitOf(opportunities);

  return {
    investor: raw?.investor || investor,
    balance: raw?.balance !== undefined ? n(raw.balance) : n(summary.manual_balance),
    netBalance: summary.net_balance !== undefined ? n(summary.net_balance) : undefined,
    invested: summary.invested !== undefined ? n(summary.invested) : undefined,
    activeInvested,
    received: summary.received !== undefined ? n(summary.received) : undefined,
    activePartialReceived,
    endedProfit,
    remaining: summary.remaining !== undefined ? n(summary.remaining) : undefined,
    expectedProfit: summary.expected_profit !== undefined ? n(summary.expected_profit) : undefined,
    actualProfit: summary.actual_profit !== undefined ? n(summary.actual_profit) : undefined,
    opportunitiesCount: summary.opportunities_count !== undefined ? n(summary.opportunities_count) : undefined,
    entries,
    timeline: Array.isArray(raw?.timeline) ? raw.timeline : [],
    opportunities,
    summary,
  };
}

function ta3meedInvestorAmount(account) {
  return Math.max(0, n(account?.activeInvested) - n(account?.activePartialReceived));
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

export function Ta3meedInvestorAccounts({ investors, backRequestVersion = 0, onExit }) {
  const accountInvestors = useMemo(() => accountInvestorsFrom(investors), [investors]);
  const [selected, setSelected] = useState(null);
  const [selectedScreen, setSelectedScreen] = useState('home');
  const [handledBackVersion, setHandledBackVersion] = useState(backRequestVersion);

  const selectInvestor = (investor) => {
    setSelected(investor);
    setSelectedScreen('home');
  };

  useEffect(() => {
    if (backRequestVersion === handledBackVersion) return;
    setHandledBackVersion(backRequestVersion);

    if (selected && selectedScreen !== 'home') {
      setSelectedScreen('home');
      return;
    }
    if (selected) {
      setSelected(null);
      setSelectedScreen('home');
      return;
    }
    onExit?.();
  }, [backRequestVersion, handledBackVersion, onExit, selected, selectedScreen]);

  if (selected) {
    return (
      <InvestorAccount
        investor={selected}
        screen={selectedScreen}
        setScreen={setSelectedScreen}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <View style={styles.investorScreen}>
      <Text style={styles.investorScreenTitle}>حسابات المستثمرين</Text>
      <Text style={styles.investorScreenSubtitle}>اختر المستثمر لفتح شاشة خاصة، ثم ادخل إلى شاشة الإحصائيات أو إدارة الحركات أو الحركات المالية.</Text>
      {accountInvestors.map((investor) => (
        <TouchableOpacity key={investor.code} style={styles.investorAccountButton} onPress={() => selectInvestor(investor)} activeOpacity={0.84}>
          <Text style={styles.investorAccountButtonText}>شاشة {investor.name}</Text>
          <Text style={styles.investorAccountButtonIcon}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function InvestorAccount({ investor, screen, setScreen, onBack }) {
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
  const timeline = account?.timeline || [];
  const opportunities = account?.opportunities || [];
  const balance = useMemo(() => n(account?.balance), [account]);
  const investorTa3meed = useMemo(() => ta3meedInvestorAmount(account), [account]);
  const isEditing = Boolean(editingEntryId);

  const emptyAccount = () => ({
    investor,
    balance: 0,
    entries: [],
    timeline: [],
    opportunities: [],
    activeInvested: 0,
    activePartialReceived: 0,
    endedProfit: 0,
    summary: {},
  });

  const loadAccount = async () => {
    setMessage('جاري تحميل الحساب...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors/${investor.code}/account`, {
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();
      if (!response.ok) {
        setAccount(emptyAccount());
        setMessage('لم يتم العثور على حساب مطابق لهذا المستثمر.');
        return;
      }
      setAccount(normalizeAccount(json.data, investor));
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
    setScreen('manage');
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
      setAccount(normalizeAccount(json.data || emptyAccount(), investor));
      setMessage(isEditing ? 'تم تعديل حركة الرصيد' : (entryType === 'withdrawal' ? 'تم تسجيل السحب من حساب المستثمر' : 'تمت إضافة الرصيد لحساب المستثمر'));
    } catch {
      setMessage('تعذر حفظ الحركة. تأكد أن المستثمر موجود ثم حاول مرة أخرى.');
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
        lastAccount = normalizeAccount(json.data, investor);
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
      setAccount(normalizeAccount(json.data || emptyAccount(), investor));
      setMessage('تم حذف حركة الرصيد');
    } catch {
      setMessage('تعذر حذف الحركة');
    }
  };

  const goHome = () => {
    setScreen('home');
    setMessage('');
  };

  const backButton = screen === 'home' ? onBack : goHome;
  const backLabel = screen === 'home' ? 'رجوع لحسابات المستثمرين' : `رجوع لشاشة ${investor.name}`;

  return (
    <View style={styles.investorScreen}>
      <TouchableOpacity style={styles.investorAccountBackButton} onPress={backButton} activeOpacity={0.84}>
        <Text style={styles.investorAccountBackText}>{backLabel}</Text>
      </TouchableOpacity>

      {screen === 'home' ? (
        <InvestorHome
          investor={investor}
          account={account}
          balance={balance}
          investorTa3meed={investorTa3meed}
          message={message}
          openManage={() => setScreen('manage')}
          openMovements={() => setScreen('movements')}
          openOpportunities={() => setScreen('opportunities')}
        />
      ) : null}

      {screen === 'manage' ? (
        <ManageBalanceScreen
          investor={investor}
          message={message}
          entries={entries}
          amount={amount}
          setAmount={setAmount}
          entryDate={entryDate}
          setEntryDate={setEntryDate}
          notes={notes}
          setNotes={setNotes}
          entryType={entryType}
          setEntryType={setEntryType}
          bulkText={bulkText}
          setBulkText={setBulkText}
          bulkBusy={bulkBusy}
          isEditing={isEditing}
          saveEntry={saveEntry}
          resetForm={resetForm}
          importBulkEntries={importBulkEntries}
          startEdit={startEdit}
          deleteEntry={deleteEntry}
        />
      ) : null}

      {screen === 'movements' ? <FinancialMovementsScreen investor={investor} timeline={timeline} /> : null}
      {screen === 'opportunities' ? <InvestorOpportunitiesScreen investor={investor} opportunities={opportunities} /> : null}
    </View>
  );
}

function InvestorHome({ investor, account, balance, investorTa3meed, message, openManage, openMovements, openOpportunities }) {
  return (
    <>
      <Text style={styles.investorScreenTitle}>#S-111 شاشة {investor.name}</Text>

      <View style={[styles.investorPaymentCard, { backgroundColor: '#ecfdf5', borderColor: '#99f6e4' }]}>
        <Text style={[styles.investorPaymentTitle, { color: '#0f766e' }]}>مستثمر تعميد</Text>
        <Text style={[styles.investorBalanceText, { marginTop: 6 }]}>{money(investorTa3meed, 2)} ر.س</Text>
        <Text style={styles.investorPaymentMeta}>إجمالي المستثمر النشط - نصيبه المستلم الجزئي للفرص النشطة فقط</Text>
      </View>

      <View style={[styles.investorEntryTypeRow, { marginTop: 10 }]}>
        <MiniStat title="إجمالي المستثمر" value={money(account?.activeInvested, 2)} />
        <MiniStat title="نصيبه المستلم" value={money(account?.activePartialReceived, 2)} />
      </View>
      <View style={[styles.investorEntryTypeRow, { marginTop: 8 }]}>
        <MiniStat title="ربح متوقع" value={money(account?.expectedProfit, 2)} />
        <MiniStat title="متبقي الفرص" value={money(account?.remaining, 2)} />
      </View>
      <View style={[styles.investorEntryTypeRow, { marginTop: 8 }]}>
        <MiniStat title="ربح تعميد المنتهية" value={money(account?.endedProfit, 2)} />
      </View>
      <View style={[styles.investorEntryTypeRow, { marginTop: 8 }]}>
        <MiniStat title="الرصيد اليدوي" value={money(balance, 2)} />
        <MiniStat title="عدد الفرص" value={`${n(account?.opportunitiesCount)}`} />
      </View>

      {account?.netBalance !== undefined ? <Text style={styles.investorPaymentMeta}>صافي الحساب مع الاستلامات: {money(account.netBalance, 2)} ر.س</Text> : null}
      {!!message && <Text style={styles.message}>{message}</Text>}

      <Text style={styles.panelTitle}>شاشات المستثمر</Text>
      <ScreenLink title="#S-112 إدارة حركات أرصدة المستثمر" text="إضافة رصيد، تسجيل سحب، استيراد جماعي، تعديل وحذف." onPress={openManage} />
      <ScreenLink title="#S-113 الحركات المالية لكل مستثمر" text="كل الاستلامات والإيداعات والسحوبات في شاشة مستقلة." onPress={openMovements} />
      <ScreenLink title="#S-114 تفصيل فرص المستثمر" text="مبلغ كل فرصة، المستلم، المتبقي، والربح المتوقع." onPress={openOpportunities} />
    </>
  );
}

function ManageBalanceScreen({
  investor,
  message,
  entries,
  amount,
  setAmount,
  entryDate,
  setEntryDate,
  notes,
  setNotes,
  entryType,
  setEntryType,
  bulkText,
  setBulkText,
  bulkBusy,
  isEditing,
  saveEntry,
  resetForm,
  importBulkEntries,
  startEdit,
  deleteEntry,
}) {
  return (
    <>
      <Text style={styles.investorScreenTitle}>#S-112 إدارة حركات أرصدة {investor.name}</Text>
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

      <Text style={styles.panelTitle}>الحركات القابلة للتعديل والحذف</Text>
      {entries.length === 0 ? (
        <Text style={styles.investorScreenSubtitle}>لا توجد حركات رصيد يدوية بعد.</Text>
      ) : entries.map((entry) => (
        <View key={entry.id} style={styles.investorPaymentCard}>
          <View style={styles.balanceEntryHeader}>
            <View style={[styles.balanceEntryActions, { gap: 8 }]}>
              <TouchableOpacity style={[styles.balanceEntryActionButton, { minWidth: 70, paddingHorizontal: 10 }]} onPress={() => startEdit(entry)} activeOpacity={0.84}>
                <Text style={[styles.balanceEntryActionIcon, styles.balanceEntryEditIcon, { fontSize: 13 }]}>تعديل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.balanceEntryActionButton, { minWidth: 62, paddingHorizontal: 10 }]} onPress={() => deleteEntry(entry)} activeOpacity={0.84}>
                <Text style={[styles.balanceEntryActionIcon, styles.balanceEntryDeleteIcon, { fontSize: 13 }]}>حذف</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.investorPaymentTitle, n(entry.amount) < 0 && styles.investorWithdrawText]}>{money(entry.amount, 2)} ر.س</Text>
          </View>
          <Text style={styles.investorPaymentMeta}>التاريخ: {entry.entry_date || '-'}</Text>
          {entry.notes ? <Text style={styles.investorPaymentMeta}>ملاحظات: {entry.notes}</Text> : null}
        </View>
      ))}
    </>
  );
}

function FinancialMovementsScreen({ investor, timeline }) {
  return (
    <>
      <Text style={styles.investorScreenTitle}>#S-113 الحركات المالية - {investor.name}</Text>
      <Text style={styles.investorScreenSubtitle}>تشمل استلامات تعميد والإيداعات والسحوبات اليدوية.</Text>
      {timeline.length === 0 ? (
        <Text style={styles.investorScreenSubtitle}>لا توجد حركات مالية لهذا المستثمر بعد.</Text>
      ) : timeline.map((movement, index) => (
        <View key={movement.id || `${movement.type}-${index}`} style={styles.investorPaymentCard}>
          <View style={styles.balanceEntryHeader}>
            <Text style={styles.investorPaymentMeta}>{movement.date || '-'}</Text>
            <Text style={[styles.investorPaymentTitle, n(movement.amount) < 0 && styles.investorWithdrawText]}>{money(movement.amount, 2)} ر.س</Text>
          </View>
          <Text style={styles.investorPaymentMeta}>النوع: {movement.label || (movement.type === 'receipt' ? 'استلام تعميد' : 'حركة يدوية')}</Text>
          {movement.reference_number ? <Text style={styles.investorPaymentMeta}>المرجع: {movement.reference_number}</Text> : null}
          {movement.description ? <Text style={styles.investorPaymentMeta}>الوصف: {movement.description}</Text> : null}
        </View>
      ))}
    </>
  );
}

function InvestorOpportunitiesScreen({ investor, opportunities }) {
  return (
    <>
      <Text style={styles.investorScreenTitle}>#S-114 فرص تعميد - {investor.name}</Text>
      {opportunities.length === 0 ? (
        <Text style={styles.investorScreenSubtitle}>لا توجد فرص تعميد مرتبطة بهذا المستثمر.</Text>
      ) : opportunities.map((opportunity) => (
        <View key={`${opportunity.opportunity_id}-${opportunity.allocation_id}`} style={styles.investorPaymentCard}>
          <View style={styles.balanceEntryHeader}>
            <Text style={styles.investorPaymentMeta}>يستحق: {opportunity.maturity_date || '-'}</Text>
            <Text style={styles.investorPaymentTitle}>{opportunity.reference_number || 'فرصة تعميد'}</Text>
          </View>
          <Text style={styles.investorPaymentMeta}>مبلغ المستثمر: {money(opportunity.invested_amount, 2)}</Text>
          <Text style={styles.investorPaymentMeta}>نصيبه المستلم: {money(opportunity.received_amount, 2)}</Text>
          <Text style={styles.investorPaymentMeta}>المتبقي لهذه الفرصة: {money(opportunity.remaining_amount, 2)}</Text>
          <Text style={styles.investorPaymentMeta}>ربحه المتوقع: {money(opportunity.expected_profit_amount, 2)}</Text>
        </View>
      ))}
    </>
  );
}

function ScreenLink({ title, text, onPress }) {
  return (
    <TouchableOpacity style={styles.investorAccountButton} onPress={onPress} activeOpacity={0.84}>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={styles.investorAccountButtonText}>{title}</Text>
        <Text style={styles.investorPaymentMeta}>{text}</Text>
      </View>
      <Text style={styles.investorAccountButtonIcon}>›</Text>
    </TouchableOpacity>
  );
}

function MiniStat({ title, value }) {
  return (
    <View style={[styles.investorPaymentCard, { flex: 1, marginTop: 0, paddingVertical: 12 }]}>
      <Text style={styles.investorPaymentMeta}>{title}</Text>
      <Text style={styles.investorPaymentTitle}>{value}</Text>
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
