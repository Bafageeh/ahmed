import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const PIN_KEY = 'ahmed_secure_vault_pin';

const emptyForm = {
  owner_group: '', category: 'banks', record_type: 'subscription', is_favorite: false,
  title: '', username: '', password: '', url: '', email: '', phone: '', purpose: '', tags: '',
  cardholder_name: '', card_brand: '', card_number: '', expiry_month: '', expiry_year: '',
  security_question: '', security_answer: '', backup_codes: '', notes: '',
};

const bankSymbols = [
  { keys: ['الراجحي', 'rajhi'], code: '80' }, { keys: ['الأهلي', 'الاهلي', 'snb'], code: '10' },
  { keys: ['الإنماء', 'الانماء', 'alinma'], code: '05' }, { keys: ['الرياض', 'riyad'], code: '20' },
  { keys: ['ساب', 'sabb'], code: '45' }, { keys: ['العربي', 'anb'], code: '30' },
  { keys: ['البلاد', 'albilad'], code: '15' }, { keys: ['الجزيرة', 'jazira', 'jazirah'], code: '60' },
  { keys: ['السعودي الفرنسي', 'fransi'], code: '55' }, { keys: ['الاستثمار', 'saib'], code: '65' },
  { keys: ['الخليج الدولي', 'gib'], code: '90' }, { keys: ['stc', 'اس تي سي'], code: 'STC' },
  { keys: ['urpay', 'يور باي'], code: 'UR' },
];

const categoryOptions = [
  { value: 'banks', label: 'البنوك' },
  { value: 'accounts', label: 'الحسابات' },
  { value: 'cards', label: 'البطاقات' },
  { value: 'websites', label: 'الدخول' },
];

export default function SecureVaultScreen({ onBack }) {
  const [locked, setLocked] = useState(false);
  const [pinExists, setPinExists] = useState(false);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('bank');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [revealedId, setRevealedId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const vault = useMemo(() => buildVault(items), [items]);
  const visibleGroups = useMemo(() => filterGroups(vault.groups, search, category), [vault.groups, search, category]);

  useEffect(() => { checkPin(); }, []);
  useEffect(() => { if (!locked) loadItems(); }, [locked]);
  useEffect(() => {
    if (!locked && revealedId) {
      const timer = setTimeout(() => setRevealedId(null), 30000);
      return () => clearTimeout(timer);
    }
  }, [locked, revealedId]);

  const checkPin = async () => {
    const saved = await SecureStore.getItemAsync(PIN_KEY);
    setPinExists(Boolean(saved));
    if (!saved) setPinMessage('أنشئ رقمًا سريًا للخزنة أول مرة.');
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
      const response = await fetch(`${API_URL}/secure-vault`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'load failed');
      setItems(Array.isArray(json.data) ? json.data : []); setMessage('');
    } catch (error) { setMessage('تعذر تحميل الخزنة. تأكد من تسجيل الدخول وتشغيل التحديث على السيرفر.'); }
  };

  const revealItem = async (item) => {
    if (revealedId === item.id) return setRevealedId(null);
    setMessage('جاري إظهار البيانات...');
    try {
      const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'reveal failed');
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...json.data } : entry)));
      setRevealedId(item.id); setMessage('سيتم إخفاء البيانات تلقائيًا بعد 30 ثانية.');
    } catch (error) { setMessage('تعذر إظهار البيانات.'); }
  };

  const openForm = (mode, nextForm, editId = null) => {
    setFormMode(mode); setEditingId(editId); setForm({ ...emptyForm, ...nextForm }); setFormOpen(true); setMessage('');
  };

  const startAddBank = () => openForm('bank', { category: 'banks', record_type: 'subscription' });
  const startAddAccount = (group) => openForm('account', { category: 'accounts', record_type: 'subscription', owner_group: groupRef(group) });
  const startAddCard = (group) => openForm('card', { category: 'cards', record_type: 'card', owner_group: groupRef(group), card_brand: group.displayName || '' });
  const startAddLogin = (group) => openForm('login', { category: 'websites', record_type: 'login', owner_group: groupRef(group), title: group.displayName ? `دخول ${group.displayName}` : '' });

  const startEdit = async (item) => {
    let full = item;
    if (revealedId !== item.id) {
      try {
        const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: { Accept: 'application/json' } });
        const json = await response.json();
        if (response.ok) full = json.data;
      } catch (error) {}
    }
    const mode = getMode(full);
    openForm(mode, {
      ...emptyForm,
      owner_group: full.owner_group || '', category: full.category || categoryByMode(mode), record_type: full.record_type || recordTypeByMode(mode), is_favorite: false,
      title: full.title || '', username: full.username || '', password: full.password || '', url: full.url || '', email: full.email || '', phone: full.phone || '', purpose: full.purpose || '', tags: full.tags || '',
      cardholder_name: full.cardholder_name || '', card_brand: full.card_brand || '', card_number: full.card_number || '', expiry_month: full.expiry_month ? String(full.expiry_month) : '', expiry_year: full.expiry_year ? String(full.expiry_year) : '',
      security_question: full.security_question || '', security_answer: full.security_answer || '', backup_codes: full.backup_codes || '', notes: full.notes || '',
    }, item.id);
  };

  const saveItem = async () => {
    const prepared = preparePayload(form, formMode);
    if (prepared.error) return setMessage(prepared.error);
    setSaving(true); setMessage(editingId ? 'جاري حفظ التعديل...' : 'جاري حفظ السجل...');
    try {
      const response = await fetch(editingId ? `${API_URL}/secure-vault/${editingId}` : `${API_URL}/secure-vault`, {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(prepared.payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'save failed');
      setFormOpen(false); setEditingId(null); setForm(emptyForm); setMessage(editingId ? 'تم تعديل السجل.' : 'تم حفظ السجل.'); await loadItems();
    } catch (error) { setMessage('تعذر حفظ السجل. راجع البيانات أو تأكد من تحديث السيرفر.'); }
    finally { setSaving(false); }
  };

  const deleteItem = (item) => Alert.alert('حذف من الخزنة', 'هل تريد حذف هذا السجل نهائيًا؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => {
      try { const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { method: 'DELETE', headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error('delete failed'); setItems((current) => current.filter((entry) => entry.id !== item.id)); setMessage('تم حذف السجل.'); }
      catch (error) { setMessage('تعذر حذف السجل.'); }
    }},
  ]);

  const copyValue = async (label, value) => {
    if (!value) return setMessage(`لا توجد قيمة لنسخ ${label}.`);
    try {
      if (Platform.OS === 'web' && globalThis?.navigator?.clipboard) { await globalThis.navigator.clipboard.writeText(String(value)); setMessage(`تم نسخ ${label}.`); }
      else setMessage(`انسخ ${label} يدويًا من القيمة الظاهرة.`);
    } catch (error) { setMessage(`تعذر نسخ ${label}.`); }
  };

  const setField = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === 'owner_group' && current.owner_group !== value && formMode === 'card') next.purpose = '';
    return next;
  });

  if (locked) return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity><View style={styles.lockCard}><Text style={styles.lockIcon}>🔐</Text><Text style={styles.title}>الخزنة الآمنة</Text><Text style={styles.subtitle}>بياناتك لا تظهر إلا بعد فتح القفل.</Text>{pinExists ? <><Text style={styles.inputLabel}>الرقم السري للخزنة</Text><TextInput value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" placeholder="••••" style={styles.input} /></> : <><Text style={styles.inputLabel}>أنشئ رقمًا سريًا للخزنة</Text><TextInput value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" placeholder="4 أرقام أو أكثر" style={styles.input} /></>}{!!pinMessage && <Text style={styles.message}>{pinMessage}</Text>}<TouchableOpacity style={styles.saveButton} onPress={unlockWithPin}><Text style={styles.saveText}>{pinExists ? 'فتح الخزنة' : 'إنشاء وفتح الخزنة'}</Text></TouchableOpacity>{pinExists ? <TouchableOpacity style={styles.secondaryButton} onPress={unlockWithBiometric}><Text style={styles.secondaryText}>فتح بالبصمة</Text></TouchableOpacity> : null}</View></ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
    <View style={styles.header}><Text style={styles.badge}>🔐 الخزنة</Text><Text style={styles.title}>الخزنة الآمنة</Text><Text style={styles.subtitle}>البنوك مستقلة، وتحت كل بنك يمكن إضافة أكثر من حساب وبطاقة مع ربط البطاقة بحساب اختياريًا.</Text></View>
    <View style={styles.summaryRow}><View style={styles.summaryCard}><Text style={styles.summaryValue}>{vault.groups.filter((g) => g.bank).length}</Text><Text style={styles.summaryLabel}>بنوك</Text></View><View style={styles.summaryCard}><Text style={styles.summaryValue}>{vault.accounts.length}</Text><Text style={styles.summaryLabel}>حسابات</Text></View><View style={styles.summaryCard}><Text style={styles.summaryValue}>{vault.cards.length}</Text><Text style={styles.summaryLabel}>بطاقات</Text></View></View>
    <View style={styles.actionsRow}><TouchableOpacity style={styles.quickButtonWide} onPress={startAddBank}><Text style={styles.quickText}>+ إضافة بنك</Text></TouchableOpacity></View>
    <TextInput value={search} onChangeText={setSearch} placeholder="بحث داخل الخزنة" style={styles.input} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}><Chip label="الكل" active={category === 'all'} onPress={() => setCategory('all')} />{categoryOptions.map((option) => <Chip key={option.value} label={option.label} active={category === option.value} onPress={() => setCategory(option.value)} />)}</ScrollView>
    {formOpen ? <VaultForm form={form} formMode={formMode} setField={setField} editingId={editingId} saving={saving} message={message} saveItem={saveItem} cancel={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); }} groups={vault.groups} accounts={vault.accounts} /> : null}
    {!!message && !formOpen ? <Text style={styles.message}>{message}</Text> : null}<Text style={styles.sectionTitle}>البنوك</Text>
    {visibleGroups.length === 0 ? <View style={styles.platformCard}><Text style={styles.platformName}>لا توجد سجلات</Text><Text style={styles.platformText}>أضف بنكًا ثم أضف تحته الحسابات والبطاقات.</Text></View> : visibleGroups.map((group) => <BankGroupCard key={group.key} group={group} category={category} revealedId={revealedId} onReveal={revealItem} onEdit={startEdit} onDelete={deleteItem} onCopy={copyValue} onAddAccount={() => startAddAccount(group)} onAddCard={() => startAddCard(group)} onAddLogin={() => startAddLogin(group)} allAccounts={vault.accounts} />)}
  </ScrollView></SafeAreaView>;
}

function VaultForm({ form, formMode, setField, editingId, saving, message, saveItem, cancel, groups, accounts }) {
  const isBank = formMode === 'bank';
  const isAccount = formMode === 'account';
  const isCard = formMode === 'card';
  const isLogin = formMode === 'login';
  const accountsForBank = accounts.filter((account) => sameBankRef(account.owner_group, form.owner_group));
  const title = editingId ? 'تعديل سجل' : isBank ? 'إضافة بنك' : isAccount ? 'إضافة حساب بنكي' : isCard ? 'إضافة بطاقة' : 'إضافة دخول';
  return <View style={styles.formCard}><Text style={styles.formTitle}>{title}</Text>
    {!isBank ? <><Text style={styles.inputLabel}>البنك</Text><PickerRow options={groups.map((group) => ({ value: groupRef(group), label: bankLabel(group.displayName) }))} value={form.owner_group} onChange={(value) => setField('owner_group', value)} /></> : null}
    {isBank ? <><FormInput label="اسم البنك" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: الراجحي" /><FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : null}
    {isAccount ? <><FormInput label="اسم الحساب" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="اختياري" /><FormInput label="الآيبان" value={form.username} onChangeText={(value) => setField('username', value)} placeholder="SA..." autoCapitalize="characters" /><FormInput label="رقم الحساب" value={form.purpose} onChangeText={(value) => setField('purpose', value)} keyboardType="number-pad" /><FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : null}
    {isLogin ? <><FormInput label="اسم الدخول" value={form.title} onChangeText={(value) => setField('title', value)} /><FormInput label="اسم المستخدم" value={form.username} onChangeText={(value) => setField('username', value)} /><FormInput label="الرقم السري" value={form.password} onChangeText={(value) => setField('password', value)} /><FormInput label="رابط الدخول" value={form.url} onChangeText={(value) => setField('url', value)} autoCapitalize="none" /><FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : null}
    {isCard ? <><FormInput label="اسم البطاقة" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="اختياري: إذا تركته فارغًا يصبح رقمها هو الاسم" /><FormInput label="اسم حامل البطاقة" value={form.cardholder_name} onChangeText={(value) => setField('cardholder_name', value)} /><FormInput label="نوع البطاقة" value={form.card_brand} onChangeText={(value) => setField('card_brand', value)} placeholder="مدى، Visa" /><FormInput label="رقم البطاقة" value={form.card_number} onChangeText={(value) => setField('card_number', onlyDigits(value))} keyboardType="number-pad" maxLength={19} /><View style={styles.twoCols}><View style={styles.col}><FormInput label="شهر الانتهاء" value={form.expiry_month} onChangeText={(value) => setField('expiry_month', onlyDigits(value).slice(0, 2))} keyboardType="number-pad" placeholder="MM" maxLength={2} /></View><View style={styles.col}><FormInput label="سنة الانتهاء" value={form.expiry_year} onChangeText={(value) => setField('expiry_year', onlyDigits(value).slice(0, 4))} keyboardType="number-pad" placeholder="YY أو YYYY" maxLength={4} /></View></View><Text style={styles.inputLabel}>ربط البطاقة بحساب</Text><PickerRow options={[{ value: '', label: 'بدون ربط' }, ...accountsForBank.map((account) => ({ value: accountRef(account), label: accountLabel(account) }))]} value={form.purpose || ''} onChange={(value) => setField('purpose', value)} /><FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : null}
    {!!message && <Text style={styles.message}>{message}</Text>}<TouchableOpacity style={styles.saveButton} onPress={saveItem} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={cancel}><Text style={styles.secondaryText}>إلغاء</Text></TouchableOpacity></View>;
}

function BankGroupCard({ group, category, revealedId, onReveal, onEdit, onDelete, onCopy, onAddAccount, onAddCard, onAddLogin, allAccounts }) {
  const showAccounts = ['all', 'banks', 'accounts'].includes(category);
  const showCards = ['all', 'banks', 'cards'].includes(category);
  const showLogins = ['all', 'banks', 'websites'].includes(category);
  return <View style={styles.bankCard}><View style={styles.bankHeaderRow}><View style={styles.bankTitleBlock}><Text style={styles.bankName}>{bankLabel(group.displayName)}</Text><Text style={styles.platformText}>{group.accounts.length} حساب • {group.cards.length} بطاقة • {group.logins.length} دخول</Text></View>{group.bank ? <View style={styles.bankMiniActions}><TouchableOpacity style={styles.smallEditButton} onPress={() => onEdit(group.bank)}><Text style={styles.smallEditText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.smallDeleteButton} onPress={() => onDelete(group.bank)}><Text style={styles.smallDeleteText}>حذف</Text></TouchableOpacity></View> : null}</View>
    <View style={styles.bankActionsRow}><TouchableOpacity style={styles.bankActionButton} onPress={onAddAccount}><Text style={styles.bankActionText}>+ حساب</Text></TouchableOpacity><TouchableOpacity style={styles.bankActionButton} onPress={onAddCard}><Text style={styles.bankActionText}>+ بطاقة</Text></TouchableOpacity><TouchableOpacity style={styles.bankActionButton} onPress={onAddLogin}><Text style={styles.bankActionText}>+ دخول</Text></TouchableOpacity></View>
    {showAccounts ? <RecordSection title="الحسابات" emptyText="لا توجد حسابات لهذا البنك بعد.">{group.accounts.map((item) => <VaultCard key={String(item.id)} item={item} revealed={revealedId === item.id} onReveal={() => onReveal(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} onCopy={onCopy} allAccounts={allAccounts} />)}</RecordSection> : null}
    {showCards ? <RecordSection title="البطاقات" emptyText="لا توجد بطاقات لهذا البنك بعد.">{group.cards.map((item) => <VaultCard key={String(item.id)} item={item} revealed={revealedId === item.id} onReveal={() => onReveal(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} onCopy={onCopy} allAccounts={allAccounts} />)}</RecordSection> : null}
    {showLogins ? <RecordSection title="الدخول" emptyText="لا توجد بيانات دخول لهذا البنك بعد.">{group.logins.map((item) => <VaultCard key={String(item.id)} item={item} revealed={revealedId === item.id} onReveal={() => onReveal(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} onCopy={onCopy} allAccounts={allAccounts} />)}</RecordSection> : null}</View>;
}

function RecordSection({ title, emptyText, children }) { const rows = React.Children.toArray(children); return <View style={styles.recordSection}><Text style={styles.recordSectionTitle}>{title}</Text>{rows.length ? rows : <Text style={styles.emptyText}>{emptyText}</Text>}</View>; }

function VaultCard({ item, revealed, onReveal, onEdit, onDelete, onCopy, allAccounts }) {
  const mode = getMode(item);
  const typeLabel = mode === 'account' ? 'حساب بنكي' : mode === 'card' ? 'بطاقة' : mode === 'login' ? 'دخول' : 'بنك';
  const cardNumber = revealed ? item.card_number : item.card_number || maskCard(item.card_last_four);
  const passwordValue = revealed ? item.password : item.password || (item.has_password ? '••••••••' : '');
  const linkedAccount = mode === 'card' ? linkedAccountLabel(item.purpose, allAccounts) : '';
  return <View style={styles.vaultCard}><View style={styles.cardTopRow}><View style={styles.cardTitleBlock}><Text style={styles.platformName}>{item.title}</Text><Text style={styles.platformText}>{typeLabel}</Text></View></View>
    {mode === 'account' ? <><SecretRow label="الآيبان" value={item.username} onCopy={() => onCopy('الآيبان', item.username)} /><SecretRow label="رقم الحساب" value={item.purpose} onCopy={() => onCopy('رقم الحساب', item.purpose)} /></> : null}
    {mode === 'login' ? <><SecretRow label="اليوزر" value={item.username} onCopy={() => onCopy('اليوزر', item.username)} /><SecretRow label="الرقم السري" value={passwordValue} onCopy={() => onCopy('الرقم السري', item.password)} />{item.url ? <SecretRow label="الرابط" value={item.url} onCopy={() => onCopy('الرابط', item.url)} /> : null}</> : null}
    {mode === 'card' ? <><SecretRow label="رقم البطاقة" value={cardNumber} onCopy={() => onCopy('رقم البطاقة', item.card_number)} />{linkedAccount ? <Text style={styles.linkedText}>الحساب المرتبط: {linkedAccount}</Text> : null}{item.card_brand || item.expiry_month || item.expiry_year ? <Text style={styles.platformText}>البطاقة: {item.card_brand || '-'} • الانتهاء: {item.expiry_month || '--'}/{item.expiry_year || '----'}</Text> : null}</> : null}
    {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}<View style={styles.iconActionsRow}><TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'إظهار'}</Text></TouchableOpacity><TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.editText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity></View></View>;
}

function SecretRow({ label, value, onCopy }) { if (!value) return null; return <View style={styles.secretRow}><TouchableOpacity style={styles.copyMini} onPress={onCopy}><Text style={styles.copyMiniText}>نسخ</Text></TouchableOpacity><Text style={styles.secretValue} numberOfLines={1}>{value}</Text><Text style={styles.secretLabel}>{label}</Text></View>; }
function FormInput({ label, value, onChangeText, multiline, ...props }) { return <><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={[styles.input, multiline && styles.notesInput]} textAlign="right" multiline={multiline} {...props} /></>; }
function PickerRow({ options, value, onChange }) { return <View style={styles.filterRowWrap}>{options.map((option) => <Chip key={option.value || 'empty'} label={option.label} active={(value || '') === (option.value || '')} onPress={() => onChange(option.value)} />)}</View>; }
function Chip({ label, active, onPress }) { return <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></TouchableOpacity>; }

function buildVault(items) {
  const bankItems = items.filter((item) => getMode(item) === 'bank');
  const accounts = items.filter((item) => getMode(item) === 'account');
  const cards = items.filter((item) => getMode(item) === 'card');
  const logins = items.filter((item) => getMode(item) === 'login');
  const groups = [];
  const byRef = new Map();
  const byName = new Map();
  bankItems.forEach((bank) => {
    const nameKey = normalizeText(bank.title || 'بنك بدون اسم');
    let group = byName.get(nameKey);
    if (!group) { group = { key: bankRef(bank), bank, displayName: bank.title || 'بنك بدون اسم', accounts: [], cards: [], logins: [] }; groups.push(group); byName.set(nameKey, group); }
    byRef.set(bankRef(bank), group); byRef.set(String(bank.id || ''), group);
  });
  const resolveGroup = (item) => {
    const owner = item.owner_group || '';
    if (owner && byRef.has(owner)) return byRef.get(owner);
    const nameKey = normalizeText(owner || item.card_brand || 'بدون بنك');
    if (nameKey && byName.has(nameKey)) return byName.get(nameKey);
    const key = `virtual:${nameKey || 'none'}`;
    let group = byRef.get(key);
    if (!group) { group = { key, bank: null, displayName: owner || item.card_brand || 'بدون بنك', accounts: [], cards: [], logins: [] }; groups.push(group); byRef.set(key, group); }
    return group;
  };
  accounts.forEach((item) => resolveGroup(item).accounts.push(item)); cards.forEach((item) => resolveGroup(item).cards.push(item)); logins.forEach((item) => resolveGroup(item).logins.push(item));
  return { groups, accounts, cards, logins };
}

function filterGroups(groups, search, category) {
  const q = normalizeText(search);
  return groups.map((group) => {
    const bankMatch = !q || normalizeText([group.displayName, group.bank?.notes].filter(Boolean).join(' ')).includes(q);
    const accounts = filterItems(group.accounts, q, bankMatch);
    const cards = filterItems(group.cards, q, bankMatch);
    const logins = filterItems(group.logins, q, bankMatch);
    return { ...group, accounts, cards, logins, bankMatch };
  }).filter((group) => {
    if (category === 'accounts') return group.accounts.length > 0;
    if (category === 'cards') return group.cards.length > 0;
    if (category === 'websites') return group.logins.length > 0;
    return group.bankMatch || group.accounts.length || group.cards.length || group.logins.length;
  });
}

function filterItems(items, q, includeAll) { if (!q || includeAll) return items; return items.filter((item) => normalizeText([item.title, item.username, item.url, item.owner_group, item.card_brand, item.card_number, item.card_last_four, item.purpose, item.notes].filter(Boolean).join(' ')).includes(q)); }
function getMode(item) { if (item?.record_type === 'card' || item?.category === 'cards') return 'card'; if (item?.record_type === 'login' || item?.category === 'websites') return 'login'; if (item?.category === 'banks') return 'bank'; return 'account'; }
function categoryByMode(mode) { return mode === 'bank' ? 'banks' : mode === 'card' ? 'cards' : mode === 'login' ? 'websites' : 'accounts'; }
function recordTypeByMode(mode) { return mode === 'card' ? 'card' : mode === 'login' ? 'login' : 'subscription'; }
function bankRef(bank) { return bank?.id ? `bank:${bank.id}` : (bank?.title || ''); }
function accountRef(account) { return account?.id ? `account:${account.id}` : accountLabel(account); }
function groupRef(group) { return group?.bank ? bankRef(group.bank) : (group?.displayName || ''); }
function sameBankRef(left, right) { return (left || '') === (right || '') || normalizeText(left || '') === normalizeText(right || ''); }
function accountLabel(account) { return account?.title || account?.purpose || lastDigits(account?.username, 6) || 'حساب بدون اسم'; }
function linkedAccountLabel(value, accounts) { if (!value) return ''; const found = accounts.find((account) => accountRef(account) === value || accountLabel(account) === value); return found ? accountLabel(found) : value; }
function bankLabel(name) { const clean = name || 'بدون بنك'; return `${bankCode(clean)} ${clean}`.trim(); }
function bankCode(name) { const n = normalizeText(name); const match = bankSymbols.find((entry) => entry.keys.some((key) => n.includes(normalizeText(key)))); return match ? `🏦 ${match.code}` : '🏦'; }
function normalizeText(value) { return String(value || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/[ة]/g, 'ه').replace(/\s+/g, ' ').trim(); }
function onlyDigits(value) { return String(value || '').replace(/\D/g, ''); }
function normalizeYear(value) { const digits = onlyDigits(value); if (!digits) return null; if (digits.length === 2) return 2000 + Number(digits); return Number(digits); }
function lastDigits(value, count = 4) { const digits = onlyDigits(value); return digits ? digits.slice(-count) : ''; }
function maskCard(lastFour) { return lastFour ? `•••• •••• •••• ${lastFour}` : ''; }

function preparePayload(form, mode) {
  const payload = { ...form, is_favorite: false, category: categoryByMode(mode), record_type: recordTypeByMode(mode), expiry_month: form.expiry_month ? Number(form.expiry_month) : null, expiry_year: normalizeYear(form.expiry_year) };
  if (mode === 'bank') { if (!form.title.trim()) return { error: 'اكتب اسم البنك أولاً.' }; payload.owner_group = ''; }
  if (mode === 'account') { if (!form.owner_group) return { error: 'اختر البنك أولاً.' }; if (!form.title.trim()) payload.title = form.purpose || lastDigits(form.username, 8) || 'حساب بنكي'; }
  if (mode === 'login') { if (!form.owner_group) return { error: 'اختر البنك أولاً.' }; if (!form.title.trim()) payload.title = form.username || 'دخول البنك'; }
  if (mode === 'card') { if (!form.owner_group) return { error: 'اختر البنك أولاً.' }; const cleanCardNumber = onlyDigits(form.card_number); payload.card_number = cleanCardNumber; if (!payload.title.trim()) payload.title = cleanCardNumber || 'بطاقة بنكية'; }
  return { payload };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' }, container: { padding: 18, paddingBottom: 36 }, backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' }, backText: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 }, lockCard: { marginTop: 24, backgroundColor: '#fff', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }, lockIcon: { fontSize: 48, textAlign: 'center' }, badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800', fontSize: 15 },
  title: { marginTop: 16, fontSize: 32, fontWeight: '900', color: '#0f172a', textAlign: 'right' }, subtitle: { marginTop: 8, color: '#475569', fontSize: 17, textAlign: 'right', lineHeight: 25 }, summaryRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 }, summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' }, summaryValue: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right' }, summaryLabel: { marginTop: 5, color: '#64748b', textAlign: 'right', fontSize: 15 },
  actionsRow: { marginTop: 14, flexDirection: 'row-reverse', gap: 8 }, quickButtonWide: { flex: 1, backgroundColor: '#0f172a', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }, quickText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginTop: 10, marginBottom: 6, fontSize: 16 }, input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, textAlign: 'right', color: '#0f172a', marginTop: 8, fontSize: 16 }, notesInput: { minHeight: 78, textAlignVertical: 'top' }, filterRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 12 }, filterRowWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 8 }, chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' }, chipText: { color: '#334155', fontWeight: '900', fontSize: 15 }, chipTextActive: { color: '#fff' },
  formCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' }, formTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right', marginBottom: 14 }, twoCols: { flexDirection: 'row-reverse', gap: 8 }, col: { flex: 1 },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', fontSize: 15 }, saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' }, saveText: { color: '#fff', fontWeight: '900', fontSize: 17 }, secondaryButton: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, secondaryText: { color: '#0f172a', fontWeight: '900', fontSize: 16 }, sectionTitle: { marginTop: 20, marginBottom: 10, color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right' },
  platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }, platformName: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' }, platformText: { marginTop: 5, color: '#64748b', textAlign: 'right', fontSize: 15 },
  bankCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#dbeafe' }, bankHeaderRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 }, bankTitleBlock: { flex: 1 }, bankName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' }, bankMiniActions: { flexDirection: 'row-reverse', gap: 6 }, smallEditButton: { backgroundColor: '#eef6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, smallEditText: { color: '#1d4ed8', fontWeight: '900', fontSize: 13 }, smallDeleteButton: { backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, smallDeleteText: { color: '#be123c', fontWeight: '900', fontSize: 13 }, bankActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 }, bankActionButton: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#cffafe' }, bankActionText: { color: '#0e7490', fontWeight: '900', fontSize: 15 },
  recordSection: { marginTop: 14 }, recordSectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right', marginBottom: 8 }, emptyText: { color: '#94a3b8', fontWeight: '800', textAlign: 'right', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12 },
  vaultCard: { backgroundColor: '#f8fafc', borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }, cardTopRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 }, cardTitleBlock: { flex: 1 },
  secretRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }, secretLabel: { color: '#64748b', fontWeight: '900', minWidth: 78, textAlign: 'right', fontSize: 14 }, secretValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 15 }, copyMini: { backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, copyMiniText: { color: '#075985', fontWeight: '900', fontSize: 12 }, iconActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  linkedText: { marginTop: 8, color: '#166534', textAlign: 'right', fontWeight: '900', fontSize: 14 }, notesText: { marginTop: 8, color: '#475569', textAlign: 'right', fontSize: 14, lineHeight: 21 },
  revealButton: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#cffafe' }, revealText: { color: '#0e7490', fontWeight: '900', fontSize: 15 }, editButton: { flex: 1, backgroundColor: '#eef6ff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' }, editText: { color: '#1d4ed8', fontWeight: '900', fontSize: 15 }, deleteButton: { flex: 1, backgroundColor: '#fff1f2', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3' }, deleteText: { color: '#be123c', fontWeight: '900', fontSize: 15 },
});
