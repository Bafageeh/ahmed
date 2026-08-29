import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import BankLogo from './BankLogo';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const PIN_KEY = 'ahmed_secure_vault_pin';
const NOTIFICATION_CHANNEL = 'card-statements';
const STATUS_TOP = Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 0) : 0;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const emptyForm = {
  owner_group: '', category: 'banks', record_type: 'subscription', is_favorite: false,
  title: '', username: '', password: '', url: '', email: '', phone: '', purpose: '', tags: '',
  cardholder_name: '', card_brand: 'visa', card_number: '', expiry_month: '', expiry_year: '',
  card_type: 'credit', statement_day: '', credit_card_debt_id: '', sadad_number: '',
  security_question: '', security_answer: '', backup_codes: '', notes: '',
};

export default function SecureVaultScreen({ onBack }) {
  const [locked, setLocked] = useState(false);
  const [pinExists, setPinExists] = useState(false);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [items, setItems] = useState([]);
  const [creditDebts, setCreditDebts] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('bank');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [revealedId, setRevealedId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const vault = useMemo(() => buildVault(items), [items]);
  const visibleBanks = useMemo(() => filterBanks(vault.groups, search), [vault.groups, search]);
  const visibleCards = useMemo(() => filterCards(vault.cards, vault.groups, search), [vault.cards, vault.groups, search]);
  const visibleLogins = useMemo(() => filterLogins(vault.logins, vault.groups, search), [vault.logins, vault.groups, search]);

  useEffect(() => { checkPin(); configureNotifications(); }, []);
  useEffect(() => { if (!locked) loadItems(); }, [locked]);
  useEffect(() => {
    if (!locked && revealedId) {
      const timer = setTimeout(() => setRevealedId(null), 30000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [locked, revealedId]);

  const checkPin = async () => {
    const saved = await SecureStore.getItemAsync(PIN_KEY);
    setPinExists(Boolean(saved));
    if (!saved) setPinMessage('أنشئ رقمًا سريًا للخزنة أول مرة.');
  };

  const configureNotifications = async () => {
    if (Platform.OS === 'web') return false;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
          name: 'مواعيد كشف البطاقات',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (error) {
      return false;
    }
  };

  const notificationKey = (id) => `ahmed_card_statement_notification_${id}`;

  const cancelCardReminder = async (id) => {
    if (Platform.OS === 'web' || !id) return;
    try {
      const key = notificationKey(id);
      const scheduledId = await SecureStore.getItemAsync(key);
      if (scheduledId) await Notifications.cancelScheduledNotificationAsync(scheduledId);
      await SecureStore.deleteItemAsync(key);
    } catch (error) {}
  };

  const scheduleCardReminder = async (card, sourceItems = items) => {
    if (Platform.OS === 'web' || !card?.id || !validStatementDay(card.statement_day)) return false;
    const allowed = await configureNotifications();
    if (!allowed) return false;
    try {
      await cancelCardReminder(card.id);
      const bankName = resolveBankNameFromItems(card, sourceItems);
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'موعد كشف البطاقة',
          body: `${bankName} • ${card.title || 'بطاقة'} — اليوم تاريخ كشف البطاقة.`,
          sound: 'default',
          data: { vaultCardId: String(card.id) },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: Number(card.statement_day),
          hour: 9,
          minute: 0,
          channelId: Platform.OS === 'android' ? NOTIFICATION_CHANNEL : undefined,
        },
      });
      await SecureStore.setItemAsync(notificationKey(card.id), identifier);
      return true;
    } catch (error) {
      return false;
    }
  };

  const syncCardReminders = async (sourceItems) => {
    if (Platform.OS === 'web') return;
    const cards = sourceItems.filter((item) => getMode(item) === 'card');
    for (const card of cards) {
      if (validStatementDay(card.statement_day)) await scheduleCardReminder(card, sourceItems);
    }
  };

  const unlockWithPin = async () => {
    const saved = await SecureStore.getItemAsync(PIN_KEY);
    if (!saved) {
      if (newPin.trim().length < 4) return setPinMessage('الرقم السري يجب أن يكون 4 أرقام أو أكثر.');
      await SecureStore.setItemAsync(PIN_KEY, newPin.trim());
      setPinExists(true); setLocked(false); setPinMessage('تم إنشاء قفل الخزنة.'); return;
    }
    if (pin.trim() === saved) { setLocked(false); setPin(''); setPinMessage(''); } else setPinMessage('الرقم السري غير صحيح.');
  };

  const unlockWithBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) return setPinMessage('البصمة أو التعرف الحيوي غير مفعّل على هذا الجهاز.');
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'فتح الخزنة الآمنة' });
      if (result.success) setLocked(false); else setPinMessage('لم يتم فتح الخزنة بالبصمة.');
    } catch (error) { setPinMessage('تعذر استخدام البصمة الآن.'); }
  };

  const loadItems = async () => {
    setMessage('جاري تحميل الخزنة...');
    try {
      const [vaultResponse, debtsResponse] = await Promise.all([
        fetch(`${API_URL}/secure-vault`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) }),
        fetch(`${API_URL}/credit-card-debts`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) }),
      ]);
      const vaultJson = await vaultResponse.json();
      const debtsJson = await debtsResponse.json();
      if (!vaultResponse.ok) throw new Error(vaultJson.message || 'load failed');
      const loadedItems = Array.isArray(vaultJson.data) ? vaultJson.data : [];
      setItems(loadedItems);
      setCreditDebts(debtsResponse.ok && Array.isArray(debtsJson.data) ? debtsJson.data : []);
      setMessage('');
      syncCardReminders(loadedItems);
    } catch (error) {
      setMessage('تعذر تحميل الخزنة. تأكد من تسجيل الدخول واتصال التطبيق بالخادم.');
    }
  };

  const revealItem = async (item) => {
    if (revealedId === item.id) return setRevealedId(null);
    setMessage('جاري فك تشفير البيانات...');
    try {
      const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'reveal failed');
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...json.data } : entry)));
      setRevealedId(item.id);
      setMessage('تم فك التشفير للعرض فقط، وسيتم إخفاء البيانات بعد 30 ثانية.');
    } catch (error) { setMessage('تعذر فك تشفير البيانات.'); }
  };

  const openForm = (mode, nextForm, editId = null) => {
    setMenuOpen(false);
    setFormMode(mode); setEditingId(editId); setForm({ ...emptyForm, ...nextForm }); setFormOpen(true); setMessage('');
  };

  const startAddBank = () => openForm('bank', { category: 'banks', record_type: 'subscription' });
  const startAddCard = () => openForm('card', { category: 'cards', record_type: 'card', owner_group: firstBankRef(vault.groups), card_type: 'credit', card_brand: 'visa' });
  const startAddLogin = () => openForm('login', { category: 'websites', record_type: 'login', owner_group: firstBankRef(vault.groups) });

  const startEdit = async (item) => {
    let full = item;
    try {
      const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (response.ok) full = json.data;
    } catch (error) {}
    const mode = getMode(full);
    openForm(mode, {
      ...emptyForm,
      owner_group: full.owner_group || '',
      category: mode === 'bank' ? 'banks' : mode === 'card' ? 'cards' : 'websites',
      record_type: mode === 'bank' ? 'subscription' : mode === 'card' ? 'card' : 'login',
      title: full.title || '', username: full.username || '', password: full.password || '', url: full.url || '', notes: full.notes || '',
      cardholder_name: full.cardholder_name || '', card_brand: full.card_brand || (full.card_type === 'mada' ? 'mada' : 'visa'),
      card_number: full.card_number || '', expiry_month: full.expiry_month ? String(full.expiry_month) : '', expiry_year: full.expiry_year ? String(full.expiry_year) : '',
      card_type: full.card_type || 'credit', statement_day: full.statement_day ? String(full.statement_day) : '',
      credit_card_debt_id: full.credit_card_debt_id ? String(full.credit_card_debt_id) : '', sadad_number: full.sadad_number || '',
    }, item.id);
  };

  const saveItem = async () => {
    const prepared = preparePayload(form, formMode, vault.groups, creditDebts);
    if (prepared.error) return setMessage(prepared.error);
    setSaving(true); setMessage(editingId ? 'جاري حفظ التعديل...' : 'جاري حفظ السجل...');
    try {
      const response = await fetch(editingId ? `${API_URL}/secure-vault/${editingId}` : `${API_URL}/secure-vault`, {
        method: editingId ? 'PUT' : 'POST',
        headers: ahmedUserHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(prepared.payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || firstValidationMessage(json.errors) || 'save failed');
      const saved = json.data;
      const wasEditing = Boolean(editingId);
      const modeBeingSaved = formMode;
      setFormOpen(false); setEditingId(null); setForm(emptyForm);
      await loadItems();
      if (modeBeingSaved === 'card' && saved) {
        const scheduled = await scheduleCardReminder(saved, [...items.filter((entry) => entry.id !== saved.id), saved]);
        setMessage(scheduled ? 'تم حفظ البطاقة وتفعيل تنبيه كشف الحساب الشهري.' : 'تم حفظ البطاقة. فعّل إذن الإشعارات لاستلام تنبيه يوم الكشف.');
      } else {
        setMessage(wasEditing ? 'تم تعديل السجل.' : 'تم حفظ السجل.');
      }
    } catch (error) { setMessage(error.message || 'تعذر حفظ السجل. راجع البيانات أو اتصال الخادم.'); }
    finally { setSaving(false); }
  };

  const deleteItem = (item) => Alert.alert('حذف من الخزنة', 'هل تريد حذف هذا السجل نهائيًا؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => {
      try {
        const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { method: 'DELETE', headers: ahmedUserHeaders({ Accept: 'application/json' }) });
        if (!response.ok) throw new Error('delete failed');
        if (getMode(item) === 'card') await cancelCardReminder(item.id);
        setItems((current) => current.filter((entry) => entry.id !== item.id)); setMessage('تم حذف السجل.');
      } catch (error) { setMessage('تعذر حذف السجل.'); }
    } },
  ]);

  const copyValue = async (label, value) => {
    if (!value) return setMessage(`لا توجد قيمة لنسخ ${label}.`);
    try {
      if (Platform.OS === 'web' && globalThis?.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(String(value)); setMessage(`تم نسخ ${label}.`);
      } else setMessage(`القيمة ظاهرة الآن ويمكن نسخ ${label} يدويًا.`);
    } catch (error) { setMessage(`تعذر نسخ ${label}.`); }
  };

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (locked) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#f4f7fb" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.lockCard}>
          <Text style={styles.lockIcon}>🔐</Text><Text style={styles.title}>الخزنة الآمنة</Text><Text style={styles.subtitle}>بياناتك لا تظهر إلا بعد فتح القفل.</Text>
          {pinExists ? <><Text style={styles.inputLabel}>الرقم السري للخزنة</Text><TextInput value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" placeholder="••••" style={styles.input} /></> : <><Text style={styles.inputLabel}>أنشئ رقمًا سريًا للخزنة</Text><TextInput value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" placeholder="4 أرقام أو أكثر" style={styles.input} /></>}
          {!!pinMessage && <Text style={styles.message}>{pinMessage}</Text>}
          <TouchableOpacity style={styles.saveButton} onPress={unlockWithPin}><Text style={styles.saveText}>{pinExists ? 'فتح الخزنة' : 'إنشاء وفتح الخزنة'}</Text></TouchableOpacity>
          {pinExists ? <TouchableOpacity style={styles.secondaryButton} onPress={unlockWithBiometric}><Text style={styles.secondaryText}>فتح بالبصمة</Text></TouchableOpacity> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBackButton} onPress={onBack}><Text style={styles.topBackText}>رجوع</Text></TouchableOpacity>
          <Text style={styles.topTitle}>الخزنة الآمنة</Text>
          <TouchableOpacity style={styles.searchButton} onPress={() => setSearchOpen((v) => !v)}><Text style={styles.iconText}>🔍</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.floatingMenuButton} onPress={() => setMenuOpen((v) => !v)}><Text style={styles.dotsText}>⋮</Text></TouchableOpacity>
        {menuOpen ? (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={startAddBank}><Text style={styles.dropdownText}>إضافة بنك</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={startAddCard}><Text style={styles.dropdownText}>إضافة بطاقة</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={startAddLogin}><Text style={styles.dropdownText}>دخول إضافي</Text></TouchableOpacity>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {searchOpen ? <TextInput value={search} onChangeText={setSearch} placeholder="بحث في الخزنة" style={styles.searchInput} autoFocus /> : null}
          {formOpen ? <VaultForm form={form} formMode={formMode} setField={setField} editingId={editingId} saving={saving} message={message} saveItem={saveItem} cancel={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); }} groups={vault.groups} creditDebts={creditDebts} /> : null}
          {!!message && !formOpen ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>البنوك</Text>
          {visibleBanks.length === 0 ? <EmptyCard text="لا توجد بنوك." /> : visibleBanks.map((group) => (
            <BankRow key={group.key} group={group} revealed={revealedId === group.bank?.id} onReveal={() => group.bank && revealItem(group.bank)} onEdit={startEdit} onDelete={deleteItem} onCopy={copyValue} />
          ))}

          <Text style={styles.sectionTitle}>البطائق</Text>
          {visibleCards.length === 0 ? <EmptyCard text="لا توجد بطائق محفوظة." /> : visibleCards.map((item) => (
            <CardRow key={String(item.id)} item={item} groups={vault.groups} creditDebts={creditDebts} revealed={revealedId === item.id} onReveal={() => revealItem(item)} onEdit={() => startEdit(item)} onDelete={() => deleteItem(item)} onCopy={copyValue} />
          ))}

          <Text style={styles.sectionTitle}>دخول إضافي</Text>
          {visibleLogins.length === 0 ? <EmptyCard text="لا توجد بيانات دخول إضافية." /> : visibleLogins.map((item) => (
            <LoginCard key={String(item.id)} item={item} groups={vault.groups} revealed={revealedId === item.id} onReveal={() => revealItem(item)} onEdit={() => startEdit(item)} onDelete={() => deleteItem(item)} onCopy={copyValue} />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function VaultForm({ form, formMode, setField, editingId, saving, message, saveItem, cancel, groups, creditDebts }) {
  const isBank = formMode === 'bank';
  const isCard = formMode === 'card';
  const selectedBank = groups.find((group) => groupRef(group) === form.owner_group);
  const selectedBankName = selectedBank?.displayName || '';
  const matchingDebts = creditDebts.filter((debt) => bankNamesMatch(selectedBankName, debt.bank_name));
  let debtOptions = matchingDebts.length ? matchingDebts : creditDebts;
  const selectedDebt = creditDebts.find((debt) => String(debt.id) === String(form.credit_card_debt_id));
  if (selectedDebt && !debtOptions.some((debt) => debt.id === selectedDebt.id)) debtOptions = [selectedDebt, ...debtOptions];
  const title = editingId ? 'تعديل السجل' : isBank ? 'إضافة بنك' : isCard ? 'إضافة بطاقة' : 'إضافة دخول إضافي';

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>{title}</Text>
      {isBank ? (
        <>
          <FormInput label="اسم البنك" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: بنك الجزيرة" />
          <FormInput label="اسم المستخدم للبنك" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize="none" />
          <FormInput label="كلمة المرور" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize="none" />
          <Text style={styles.securityHint}>يتم تشفير اسم المستخدم وكلمة المرور في الخادم، ولا يتم فكهما إلا عند الضغط على إظهار.</Text>
          <FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline />
        </>
      ) : isCard ? (
        <>
          <Text style={styles.inputLabel}>البنك</Text>
          <PickerRow options={groups.map((group) => ({ value: groupRef(group), label: group.displayName }))} value={form.owner_group} onChange={(value) => { setField('owner_group', value); setField('credit_card_debt_id', ''); }} />
          <FormInput label="اسم البطاقة" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: أجواء إنفينيت" />
          <Text style={styles.inputLabel}>نوع البطاقة</Text>
          <PickerRow options={[{ value: 'mada', label: 'مدى' }, { value: 'credit', label: 'ائتمانية' }]} value={form.card_type} onChange={(value) => { setField('card_type', value); if (value === 'mada') { setField('card_brand', 'mada'); setField('credit_card_debt_id', ''); } else if (form.card_brand === 'mada') setField('card_brand', 'visa'); }} />
          {form.card_type === 'credit' ? (
            <>
              <Text style={styles.inputLabel}>الشبكة</Text>
              <PickerRow options={[{ value: 'visa', label: 'Visa' }, { value: 'mastercard', label: 'Mastercard' }]} value={form.card_brand} onChange={(value) => setField('card_brand', value)} />
              <Text style={styles.inputLabel}>ربط الحد الائتماني من المديونية</Text>
              {debtOptions.length ? (
                <PickerRow options={debtOptions.map((debt) => ({ value: String(debt.id), label: `${debt.card_name} • ${money(debt.credit_limit)}` }))} value={String(form.credit_card_debt_id || '')} onChange={(value) => setField('credit_card_debt_id', value)} />
              ) : <Text style={styles.emptyText}>لا توجد بطاقة ائتمانية في شاشة المديونية. أضفها هناك أولًا لتحديد الحد.</Text>}
              {selectedDebt ? <View style={styles.readOnlyBox}><Text style={styles.readOnlyValue}>{money(selectedDebt.credit_limit)}</Text><Text style={styles.readOnlyLabel}>الحد الائتماني من المديونية</Text></View> : null}
            </>
          ) : null}
          <FormInput label="رقم البطاقة (اختياري)" value={form.card_number} onChangeText={(value) => setField('card_number', digitsOnly(value, 19))} keyboardType="number-pad" placeholder="يمكن حفظه مشفرًا" />
          <View style={styles.twoColumns}>
            <View style={styles.half}><FormInput label="سنة الانتهاء" value={String(form.expiry_year || '')} onChangeText={(value) => setField('expiry_year', digitsOnly(value, 4))} keyboardType="number-pad" placeholder="2030" /></View>
            <View style={styles.half}><FormInput label="شهر الانتهاء" value={String(form.expiry_month || '')} onChangeText={(value) => setField('expiry_month', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="12" /></View>
          </View>
          <FormInput label="تاريخ كشف البطاقة (يوم الشهر)" value={String(form.statement_day || '')} onChangeText={(value) => setField('statement_day', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="مثال: 25" />
          <Text style={styles.securityHint}>سيصل تنبيه محلي على الجوال الساعة 9:00 صباحًا في يوم الكشف من كل شهر بعد السماح بالإشعارات.</Text>
          <FormInput label="رقم سداد" value={form.sadad_number} onChangeText={(value) => setField('sadad_number', value)} keyboardType="number-pad" placeholder="رقم سداد للبطاقة" />
          <Text style={styles.securityHint}>رقم سداد ورقم البطاقة يحفظان مشفرين.</Text>
          <FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline />
        </>
      ) : (
        <>
          <Text style={styles.inputLabel}>البنك</Text>
          <PickerRow options={groups.map((group) => ({ value: groupRef(group), label: group.displayName }))} value={form.owner_group} onChange={(value) => setField('owner_group', value)} />
          <FormInput label="اسم الدخول" value={form.title} onChangeText={(value) => setField('title', value)} />
          <FormInput label="اسم المستخدم" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize="none" />
          <FormInput label="كلمة المرور" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize="none" />
          <FormInput label="رابط الدخول" value={form.url} onChangeText={(value) => setField('url', value)} autoCapitalize="none" />
          <FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline />
        </>
      )}
      {!!message && <Text style={styles.message}>{message}</Text>}
      <TouchableOpacity style={styles.saveButton} onPress={saveItem} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={cancel}><Text style={styles.secondaryText}>إلغاء</Text></TouchableOpacity>
    </View>
  );
}

function BankRow({ group, revealed, onReveal, onEdit, onDelete, onCopy }) {
  const bank = group.bank;
  return (
    <View style={styles.bankCard}>
      <View style={styles.entityHeader}>
        <View style={styles.rowActions}>
          {bank ? <><TouchableOpacity style={styles.smallEditButton} onPress={() => onEdit(bank)}><Text style={styles.smallEditText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.smallDeleteButton} onPress={() => onDelete(bank)}><Text style={styles.smallDeleteText}>حذف</Text></TouchableOpacity></> : null}
        </View>
        <View style={styles.bankIdentity}><View style={styles.bankTitleBlock}><Text style={styles.bankName}>{group.displayName}</Text>{bank?.notes ? <Text style={styles.platformText}>{bank.notes}</Text> : null}</View><BankLogo bankName={group.displayName} size={48} /></View>
      </View>
      {bank && (bank.has_username || bank.has_password || bank.username || bank.password) ? (
        <>
          <View style={styles.loginInlineHeader}><Text style={styles.loginInlineTitle}>بيانات دخول البنك</Text><TouchableOpacity style={styles.revealMini} onPress={onReveal}><Text style={styles.revealMiniText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity></View>
          <SecretRow label="المستخدم" value={revealed ? bank.username : (bank.has_username ? '••••••••' : '')} onCopy={() => onCopy('اسم المستخدم', bank.username)} />
          <SecretRow label="كلمة المرور" value={revealed ? bank.password : (bank.has_password ? '••••••••' : '')} onCopy={() => onCopy('كلمة المرور', bank.password)} />
        </>
      ) : <Text style={styles.noLoginText}>لا توجد بيانات دخول محفوظة لهذا البنك.</Text>}
    </View>
  );
}

function CardRow({ item, groups, creditDebts, revealed, onReveal, onEdit, onDelete, onCopy }) {
  const bankName = resolveBankName(item, groups);
  const debt = creditDebts.find((entry) => String(entry.id) === String(item.credit_card_debt_id));
  const typeLabel = item.card_type === 'mada' ? 'مدى' : 'ائتمانية';
  const network = item.card_type === 'credit' ? (normalizeText(item.card_brand) === 'mastercard' ? 'Mastercard' : 'Visa') : 'مدى';
  const cardNumber = revealed ? item.card_number : (item.card_last_four ? `•••• •••• •••• ${item.card_last_four}` : '');
  const sadad = revealed ? item.sadad_number : (item.has_sadad_number ? '••••••••' : '');
  return (
    <View style={styles.vaultCard}>
      <View style={styles.entityHeader}>
        <View style={styles.cardTypeBadge}><Text style={styles.cardTypeBadgeText}>{typeLabel}</Text></View>
        <View style={styles.bankIdentity}><View style={styles.cardTitleBlock}><Text style={styles.platformName}>{item.title || 'بطاقة'}</Text><Text style={styles.platformText}>{bankName} • {network}</Text></View><BankLogo bankName={bankName} size={44} /></View>
      </View>
      {item.card_type === 'credit' ? <InfoRow label="الحد الائتماني" value={debt ? money(debt.credit_limit) : 'غير مربوط بالمديونية'} /> : null}
      <InfoRow label="تاريخ الكشف" value={validStatementDay(item.statement_day) ? `يوم ${item.statement_day} من كل شهر • تنبيه 9:00 ص` : 'غير محدد'} />
      {cardNumber ? <SecretRow label="رقم البطاقة" value={cardNumber} onCopy={() => onCopy('رقم البطاقة', item.card_number)} /> : null}
      {sadad ? <SecretRow label="رقم سداد" value={sadad} onCopy={() => onCopy('رقم سداد', item.sadad_number)} /> : null}
      {item.expiry_month && item.expiry_year ? <InfoRow label="الانتهاء" value={`${String(item.expiry_month).padStart(2, '0')}/${item.expiry_year}`} /> : null}
      {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
      <View style={styles.iconActionsRow}><TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity><TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.editText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity></View>
    </View>
  );
}

function LoginCard({ item, groups, revealed, onReveal, onEdit, onDelete, onCopy }) {
  const usernameValue = revealed ? item.username : (item.has_username ? '••••••••' : '');
  const passwordValue = revealed ? item.password : (item.has_password ? '••••••••' : '');
  const bankName = resolveBankName(item, groups);
  return (
    <View style={styles.vaultCard}>
      <View style={styles.entityHeader}><View style={styles.loginBadge}><Text style={styles.loginBadgeText}>دخول</Text></View><View style={styles.bankIdentity}><View style={styles.cardTitleBlock}><Text style={styles.platformName}>{item.title || 'دخول'}</Text><Text style={styles.platformText}>{bankName}</Text></View><BankLogo bankName={bankName} size={40} /></View></View>
      <SecretRow label="المستخدم" value={usernameValue} onCopy={() => onCopy('اسم المستخدم', item.username)} />
      <SecretRow label="كلمة المرور" value={passwordValue} onCopy={() => onCopy('كلمة المرور', item.password)} />
      {item.url ? <SecretRow label="الرابط" value={item.url} onCopy={() => onCopy('الرابط', item.url)} /> : null}
      {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
      <View style={styles.iconActionsRow}><TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity><TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.editText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity></View>
    </View>
  );
}

function EmptyCard({ text }) { return <View style={styles.platformCard}><Text style={styles.platformText}>{text}</Text></View>; }
function InfoRow({ label, value }) { return <View style={styles.infoRow}><Text style={styles.infoValue}>{value}</Text><Text style={styles.infoLabel}>{label}</Text></View>; }
function SecretRow({ label, value, onCopy }) { if (!value) return null; return <View style={styles.secretRow}><TouchableOpacity style={styles.copyMini} onPress={onCopy}><Text style={styles.copyMiniText}>نسخ</Text></TouchableOpacity><Text style={styles.secretValue} numberOfLines={1}>{value}</Text><Text style={styles.secretLabel}>{label}</Text></View>; }
function FormInput({ label, value, onChangeText, multiline, ...props }) { return <><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={[styles.input, multiline && styles.notesInput]} textAlign="right" multiline={multiline} {...props} /></>; }
function PickerRow({ options, value, onChange }) { return <View style={styles.filterRowWrap}>{options.length ? options.map((option) => <Chip key={option.value || 'empty'} label={option.label} active={String(value || '') === String(option.value || '')} onPress={() => onChange(option.value)} />) : <Text style={styles.emptyText}>لا توجد خيارات.</Text>}</View>; }
function Chip({ label, active, onPress }) { return <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></TouchableOpacity>; }

function buildVault(items) {
  const bankItems = items.filter((item) => getMode(item) === 'bank');
  const logins = items.filter((item) => getMode(item) === 'login');
  const cards = items.filter((item) => getMode(item) === 'card');
  const groups = [];
  const byRef = new Map();
  const byName = new Map();
  bankItems.forEach((bank) => {
    const nameKey = normalizeText(bank.title || 'بنك بدون اسم');
    let group = byName.get(nameKey);
    if (!group) { group = { key: bankRef(bank), bank, displayName: bank.title || 'بنك بدون اسم', logins: [], cards: [] }; groups.push(group); byName.set(nameKey, group); }
    byRef.set(bankRef(bank), group); byRef.set(String(bank.id || ''), group);
  });
  const resolveGroup = (item) => {
    const owner = item.owner_group || '';
    if (owner && byRef.has(owner)) return byRef.get(owner);
    const nameKey = normalizeText(owner || 'بدون بنك');
    if (nameKey && byName.has(nameKey)) return byName.get(nameKey);
    const key = `virtual:${nameKey || 'none'}`;
    let group = byRef.get(key);
    if (!group) { group = { key, bank: null, displayName: owner || 'بدون بنك', logins: [], cards: [] }; groups.push(group); byRef.set(key, group); }
    return group;
  };
  logins.forEach((item) => resolveGroup(item).logins.push(item));
  cards.forEach((item) => resolveGroup(item).cards.push(item));
  return { groups, logins, cards };
}

function filterBanks(groups, search) { const q = normalizeText(search); return groups.filter((group) => !q || normalizeText([group.displayName, group.bank?.notes].filter(Boolean).join(' ')).includes(q)); }
function filterCards(cards, groups, search) { const q = normalizeText(search); return cards.filter((item) => !q || normalizeText([item.title, item.card_brand, item.card_type, item.card_last_four, item.owner_group, resolveBankName(item, groups)].filter(Boolean).join(' ')).includes(q)); }
function filterLogins(logins, groups, search) { const q = normalizeText(search); return logins.filter((item) => !q || normalizeText([item.title, item.url, item.owner_group, resolveBankName(item, groups)].filter(Boolean).join(' ')).includes(q)); }
function getMode(item) { if (item?.record_type === 'card' || item?.category === 'cards') return 'card'; if (item?.record_type === 'login' || item?.category === 'websites') return 'login'; if (item?.category === 'banks') return 'bank'; return 'account'; }
function bankRef(bank) { return bank?.id ? `bank:${bank.id}` : (bank?.title || ''); }
function groupRef(group) { return group?.bank ? bankRef(group.bank) : (group?.displayName || ''); }
function firstBankRef(groups) { return groups[0] ? groupRef(groups[0]) : ''; }
function resolveBankName(item, groups) { const found = groups.find((group) => groupRef(group) === item.owner_group || normalizeText(group.displayName) === normalizeText(item.owner_group)); return found?.displayName || item.owner_group || 'بدون بنك'; }
function resolveBankNameFromItems(item, sourceItems) { const bankId = String(item.owner_group || '').replace(/^bank:/, ''); const bank = sourceItems.find((entry) => getMode(entry) === 'bank' && (String(entry.id) === bankId || normalizeText(entry.title) === normalizeText(item.owner_group))); return bank?.title || item.owner_group || 'البنك'; }
function normalizeText(value) { return String(value || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/[ة]/g, 'ه').replace(/\s+/g, ' ').trim(); }
function bankNamesMatch(a, b) { const x = normalizeText(a).replace(/^بنك /, '').replace(/^البنك /, ''); const y = normalizeText(b).replace(/^بنك /, '').replace(/^البنك /, ''); return Boolean(x && y && (x.includes(y) || y.includes(x))); }
function money(value) { const n = Number(String(value ?? 0).replace(/,/g, '')); return `${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.س`; }
function digitsOnly(value, max) { return String(value || '').replace(/\D/g, '').slice(0, max); }
function validStatementDay(value) { const day = Number(value); return Number.isInteger(day) && day >= 1 && day <= 31; }
function firstValidationMessage(errors) { if (!errors || typeof errors !== 'object') return ''; const first = Object.values(errors)[0]; return Array.isArray(first) ? first[0] : String(first || ''); }

function preparePayload(form, mode, groups, creditDebts) {
  const payload = {
    ...emptyForm,
    ...form,
    is_favorite: false,
    category: mode === 'bank' ? 'banks' : mode === 'card' ? 'cards' : 'websites',
    record_type: mode === 'bank' ? 'subscription' : mode === 'card' ? 'card' : 'login',
    expiry_month: form.expiry_month ? Number(form.expiry_month) : null,
    expiry_year: form.expiry_year ? Number(form.expiry_year) : null,
    statement_day: form.statement_day ? Number(form.statement_day) : null,
    credit_card_debt_id: form.credit_card_debt_id ? Number(form.credit_card_debt_id) : null,
  };
  if (mode === 'bank') {
    if (!payload.title.trim()) return { error: 'اكتب اسم البنك أولاً.' };
    payload.owner_group = '';
    payload.card_type = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = '';
  }
  if (mode === 'login') {
    if (!groups.length) return { error: 'أضف بنكًا أولاً.' };
    if (!payload.owner_group) return { error: 'اختر البنك أولاً.' };
    if (!payload.title.trim()) payload.title = payload.username || 'دخول البنك';
    payload.card_type = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = '';
  }
  if (mode === 'card') {
    if (!groups.length) return { error: 'أضف بنكًا أولاً.' };
    if (!payload.owner_group) return { error: 'اختر البنك أولاً.' };
    if (!payload.title.trim()) return { error: 'اكتب اسم البطاقة.' };
    if (!['mada', 'credit'].includes(payload.card_type)) return { error: 'اختر نوع البطاقة.' };
    if (!validStatementDay(payload.statement_day)) return { error: 'حدد يوم كشف البطاقة من 1 إلى 31.' };
    if (payload.expiry_month && (payload.expiry_month < 1 || payload.expiry_month > 12)) return { error: 'شهر الانتهاء يجب أن يكون من 1 إلى 12.' };
    if (payload.expiry_year && (payload.expiry_year < new Date().getFullYear() || payload.expiry_year > 2100)) return { error: 'سنة انتهاء البطاقة غير صحيحة.' };
    if (payload.card_type === 'credit') {
      if (!['visa', 'mastercard'].includes(payload.card_brand)) return { error: 'حدد Visa أو Mastercard.' };
      const debt = creditDebts.find((entry) => String(entry.id) === String(payload.credit_card_debt_id));
      if (!debt) return { error: 'اربط البطاقة بسجلها في مديونية بطائق الائتمان حتى يظهر الحد الصحيح.' };
    } else {
      payload.card_brand = 'mada';
      payload.credit_card_debt_id = null;
    }
  }
  return { payload };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb', paddingTop: STATUS_TOP },
  screen: { flex: 1 },
  container: { padding: 18, paddingTop: 12, paddingBottom: 54 },
  topBar: { minHeight: 64, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 76 },
  topTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  topBackButton: { position: 'absolute', right: 14, top: 11, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  topBackText: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  searchButton: { position: 'absolute', left: 14, top: 11, width: 44, height: 44, borderRadius: 15, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  iconText: { fontSize: 20 },
  floatingMenuButton: { position: 'absolute', top: 76, left: 18, zIndex: 20, width: 50, height: 50, borderRadius: 18, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', elevation: 6 },
  dotsText: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 32 },
  dropdownMenu: { position: 'absolute', top: 132, left: 18, zIndex: 25, width: 164, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 8 },
  dropdownItem: { paddingVertical: 15, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownText: { color: '#0f172a', textAlign: 'right', fontSize: 16, fontWeight: '900' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  lockCard: { marginTop: 24, backgroundColor: '#fff', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  lockIcon: { fontSize: 48, textAlign: 'center' },
  title: { marginTop: 16, fontSize: 32, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 17, textAlign: 'right', lineHeight: 25 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 18, padding: 15, textAlign: 'right', color: '#0f172a', marginBottom: 14, fontSize: 17 },
  inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginTop: 10, marginBottom: 6, fontSize: 16 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, textAlign: 'right', color: '#0f172a', marginTop: 2, fontSize: 16 },
  notesInput: { minHeight: 78, textAlignVertical: 'top' },
  securityHint: { color: '#64748b', textAlign: 'right', fontSize: 13, lineHeight: 20, marginTop: 7 },
  filterRowWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ee', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#334155', fontWeight: '900', fontSize: 14 },
  chipTextActive: { color: '#fff' },
  formCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right', marginBottom: 14 },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', fontSize: 14, lineHeight: 21 },
  saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  secondaryButton: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryText: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  sectionTitle: { marginTop: 20, marginBottom: 10, color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right' },
  platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  platformName: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  platformText: { marginTop: 4, color: '#64748b', textAlign: 'right', fontSize: 14 },
  bankCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#dbeafe' },
  vaultCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  entityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bankIdentity: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  bankTitleBlock: { flex: 1 },
  bankName: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  cardTitleBlock: { flex: 1 },
  rowActions: { flexDirection: 'row', gap: 6 },
  smallEditButton: { backgroundColor: '#eef6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  smallEditText: { color: '#1d4ed8', fontWeight: '900', fontSize: 13 },
  smallDeleteButton: { backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  smallDeleteText: { color: '#be123c', fontWeight: '900', fontSize: 13 },
  loginInlineHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loginInlineTitle: { color: '#334155', fontWeight: '900', fontSize: 14 },
  revealMini: { backgroundColor: '#ecfeff', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: '#cffafe' },
  revealMiniText: { color: '#0e7490', fontWeight: '900', fontSize: 12 },
  noLoginText: { marginTop: 12, color: '#94a3b8', textAlign: 'right', fontSize: 13 },
  cardTypeBadge: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  cardTypeBadgeText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  loginBadge: { backgroundColor: '#ecfeff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#cffafe' },
  loginBadgeText: { color: '#0e7490', fontWeight: '900', fontSize: 13 },
  infoRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#f8fafc', borderRadius: 14, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  infoLabel: { color: '#64748b', fontWeight: '900', textAlign: 'right', fontSize: 13 },
  infoValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 14 },
  secretRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  secretLabel: { color: '#64748b', fontWeight: '900', minWidth: 76, textAlign: 'right', fontSize: 13 },
  secretValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 14 },
  copyMini: { backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  copyMiniText: { color: '#075985', fontWeight: '900', fontSize: 12 },
  iconActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  notesText: { marginTop: 8, color: '#475569', textAlign: 'right', fontSize: 14, lineHeight: 21 },
  emptyText: { color: '#94a3b8', fontWeight: '800', textAlign: 'right', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12 },
  revealButton: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#cffafe' },
  revealText: { color: '#0e7490', fontWeight: '900', fontSize: 14 },
  editButton: { flex: 1, backgroundColor: '#eef6ff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  editText: { color: '#1d4ed8', fontWeight: '900', fontSize: 14 },
  deleteButton: { flex: 1, backgroundColor: '#fff1f2', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3' },
  deleteText: { color: '#be123c', fontWeight: '900', fontSize: 14 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  readOnlyBox: { marginTop: 3, marginBottom: 8, backgroundColor: '#eff6ff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#bfdbfe', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readOnlyValue: { color: '#1d4ed8', fontWeight: '900', fontSize: 16 },
  readOnlyLabel: { color: '#475569', fontWeight: '800', fontSize: 13 },
});
