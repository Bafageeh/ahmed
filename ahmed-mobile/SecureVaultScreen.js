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

export default function SecureVaultScreen({ onBack }) {
  const [locked, setLocked] = useState(false);
  const [pinExists, setPinExists] = useState(false);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [items, setItems] = useState([]);
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
  const visibleLogins = useMemo(() => filterLogins(vault.logins, vault.groups, search), [vault.logins, vault.groups, search]);

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
    setMenuOpen(false);
    setFormMode(mode); setEditingId(editId); setForm({ ...emptyForm, ...nextForm }); setFormOpen(true); setMessage('');
  };

  const startAddBank = () => openForm('bank', { category: 'banks', record_type: 'subscription' });
  const startAddLogin = () => openForm('login', { category: 'websites', record_type: 'login', owner_group: firstBankRef(vault.groups) });

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
    openForm(mode === 'bank' ? 'bank' : 'login', {
      ...emptyForm,
      owner_group: full.owner_group || '', category: mode === 'bank' ? 'banks' : 'websites', record_type: mode === 'bank' ? 'subscription' : 'login', is_favorite: false,
      title: full.title || '', username: full.username || '', password: full.password || '', url: full.url || '', notes: full.notes || '',
    }, item.id);
  };

  const saveItem = async () => {
    const prepared = preparePayload(form, formMode, vault.groups);
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

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (locked) return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity><View style={styles.lockCard}><Text style={styles.lockIcon}>🔐</Text><Text style={styles.title}>الخزنة الآمنة</Text><Text style={styles.subtitle}>بياناتك لا تظهر إلا بعد فتح القفل.</Text>{pinExists ? <><Text style={styles.inputLabel}>الرقم السري للخزنة</Text><TextInput value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" placeholder="••••" style={styles.input} /></> : <><Text style={styles.inputLabel}>أنشئ رقمًا سريًا للخزنة</Text><TextInput value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" placeholder="4 أرقام أو أكثر" style={styles.input} /></>}{!!pinMessage && <Text style={styles.message}>{pinMessage}</Text>}<TouchableOpacity style={styles.saveButton} onPress={unlockWithPin}><Text style={styles.saveText}>{pinExists ? 'فتح الخزنة' : 'إنشاء وفتح الخزنة'}</Text></TouchableOpacity>{pinExists ? <TouchableOpacity style={styles.secondaryButton} onPress={unlockWithBiometric}><Text style={styles.secondaryText}>فتح بالبصمة</Text></TouchableOpacity> : null}</View></ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><View style={styles.screen}>
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.topBackButton} onPress={onBack}><Text style={styles.topBackText}>رجوع</Text></TouchableOpacity>
      <Text style={styles.topTitle}>الخزنة الآمنة</Text>
      <TouchableOpacity style={styles.searchButton} onPress={() => setSearchOpen((v) => !v)}><Text style={styles.iconText}>🔍</Text></TouchableOpacity>
    </View>
    <TouchableOpacity style={styles.floatingMenuButton} onPress={() => setMenuOpen((v) => !v)}><Text style={styles.dotsText}>⋮</Text></TouchableOpacity>
    {menuOpen ? <View style={styles.dropdownMenu}><TouchableOpacity style={styles.dropdownItem} onPress={startAddBank}><Text style={styles.dropdownText}>بنك</Text></TouchableOpacity><TouchableOpacity style={styles.dropdownItem} onPress={startAddLogin}><Text style={styles.dropdownText}>دخول</Text></TouchableOpacity></View> : null}
    <ScrollView contentContainerStyle={styles.container}>
      {searchOpen ? <TextInput value={search} onChangeText={setSearch} placeholder="بحث" style={styles.searchInput} autoFocus /> : null}
      {formOpen ? <VaultForm form={form} formMode={formMode} setField={setField} editingId={editingId} saving={saving} message={message} saveItem={saveItem} cancel={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); }} groups={vault.groups} /> : null}
      {!!message && !formOpen ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.sectionTitle}>بنك</Text>
      {visibleBanks.length === 0 ? <EmptyCard text="لا توجد بنوك." /> : visibleBanks.map((group) => <BankRow key={group.key} group={group} onEdit={startEdit} onDelete={deleteItem} />)}
      <Text style={styles.sectionTitle}>دخول</Text>
      {visibleLogins.length === 0 ? <EmptyCard text="لا توجد بطائق دخول." /> : visibleLogins.map((item) => <LoginCard key={String(item.id)} item={item} groups={vault.groups} revealed={revealedId === item.id} onReveal={() => revealItem(item)} onEdit={() => startEdit(item)} onDelete={() => deleteItem(item)} onCopy={copyValue} />)}
    </ScrollView>
  </View></SafeAreaView>;
}

function VaultForm({ form, formMode, setField, editingId, saving, message, saveItem, cancel, groups }) {
  const isBank = formMode === 'bank';
  const title = editingId ? 'تعديل' : isBank ? 'إضافة بنك' : 'إضافة دخول';
  return <View style={styles.formCard}><Text style={styles.formTitle}>{title}</Text>
    {isBank ? <><FormInput label="اسم البنك" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: الراجحي" /><FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : <><Text style={styles.inputLabel}>البنك</Text><PickerRow options={groups.map((group) => ({ value: groupRef(group), label: bankLabel(group.displayName) }))} value={form.owner_group} onChange={(value) => setField('owner_group', value)} /><FormInput label="اسم الدخول" value={form.title} onChangeText={(value) => setField('title', value)} /><FormInput label="اسم المستخدم" value={form.username} onChangeText={(value) => setField('username', value)} /><FormInput label="الرقم السري" value={form.password} onChangeText={(value) => setField('password', value)} /><FormInput label="رابط الدخول" value={form.url} onChangeText={(value) => setField('url', value)} autoCapitalize="none" /><FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></>}
    {!!message && <Text style={styles.message}>{message}</Text>}<TouchableOpacity style={styles.saveButton} onPress={saveItem} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={cancel}><Text style={styles.secondaryText}>إلغاء</Text></TouchableOpacity></View>;
}

function BankRow({ group, onEdit, onDelete }) {
  return <View style={styles.bankCard}><View style={styles.rowBetween}><View style={styles.rowActions}>{group.bank ? <><TouchableOpacity style={styles.smallEditButton} onPress={() => onEdit(group.bank)}><Text style={styles.smallEditText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.smallDeleteButton} onPress={() => onDelete(group.bank)}><Text style={styles.smallDeleteText}>حذف</Text></TouchableOpacity></> : null}</View><View style={styles.bankTitleBlock}><Text style={styles.bankName}>{bankLabel(group.displayName)}</Text>{group.bank?.notes ? <Text style={styles.platformText}>{group.bank.notes}</Text> : null}</View></View></View>;
}

function LoginCard({ item, groups, revealed, onReveal, onEdit, onDelete, onCopy }) {
  const passwordValue = revealed ? item.password : item.password || (item.has_password ? '••••••••' : '');
  return <View style={styles.vaultCard}><View style={styles.rowBetween}><View style={styles.loginBadge}><Text style={styles.loginBadgeText}>دخول</Text></View><View style={styles.cardTitleBlock}><Text style={styles.platformName}>{item.title || 'دخول'}</Text><Text style={styles.platformText}>{bankLabel(resolveBankName(item, groups))}</Text></View></View>
    <SecretRow label="اليوزر" value={item.username} onCopy={() => onCopy('اليوزر', item.username)} />
    <SecretRow label="الرقم السري" value={passwordValue} onCopy={() => onCopy('الرقم السري', item.password)} />
    {item.url ? <SecretRow label="الرابط" value={item.url} onCopy={() => onCopy('الرابط', item.url)} /> : null}
    {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
    <View style={styles.iconActionsRow}><TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'إظهار'}</Text></TouchableOpacity><TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.editText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity></View></View>;
}

function EmptyCard({ text }) { return <View style={styles.platformCard}><Text style={styles.platformText}>{text}</Text></View>; }
function SecretRow({ label, value, onCopy }) { if (!value) return null; return <View style={styles.secretRow}><TouchableOpacity style={styles.copyMini} onPress={onCopy}><Text style={styles.copyMiniText}>نسخ</Text></TouchableOpacity><Text style={styles.secretValue} numberOfLines={1}>{value}</Text><Text style={styles.secretLabel}>{label}</Text></View>; }
function FormInput({ label, value, onChangeText, multiline, ...props }) { return <><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={[styles.input, multiline && styles.notesInput]} textAlign="right" multiline={multiline} {...props} /></>; }
function PickerRow({ options, value, onChange }) { return <View style={styles.filterRowWrap}>{options.length ? options.map((option) => <Chip key={option.value || 'empty'} label={option.label} active={(value || '') === (option.value || '')} onPress={() => onChange(option.value)} />) : <Text style={styles.emptyText}>أضف بنكًا أولاً.</Text>}</View>; }
function Chip({ label, active, onPress }) { return <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></TouchableOpacity>; }

function buildVault(items) {
  const bankItems = items.filter((item) => getMode(item) === 'bank');
  const logins = items.filter((item) => getMode(item) === 'login');
  const groups = [];
  const byRef = new Map();
  const byName = new Map();
  bankItems.forEach((bank) => {
    const nameKey = normalizeText(bank.title || 'بنك بدون اسم');
    let group = byName.get(nameKey);
    if (!group) { group = { key: bankRef(bank), bank, displayName: bank.title || 'بنك بدون اسم', logins: [] }; groups.push(group); byName.set(nameKey, group); }
    byRef.set(bankRef(bank), group); byRef.set(String(bank.id || ''), group);
  });
  const resolveGroup = (item) => {
    const owner = item.owner_group || '';
    if (owner && byRef.has(owner)) return byRef.get(owner);
    const nameKey = normalizeText(owner || 'بدون بنك');
    if (nameKey && byName.has(nameKey)) return byName.get(nameKey);
    const key = `virtual:${nameKey || 'none'}`;
    let group = byRef.get(key);
    if (!group) { group = { key, bank: null, displayName: owner || 'بدون بنك', logins: [] }; groups.push(group); byRef.set(key, group); }
    return group;
  };
  logins.forEach((item) => resolveGroup(item).logins.push(item));
  return { groups, logins };
}

function filterBanks(groups, search) { const q = normalizeText(search); return groups.filter((group) => !q || normalizeText([group.displayName, group.bank?.notes].filter(Boolean).join(' ')).includes(q)); }
function filterLogins(logins, groups, search) { const q = normalizeText(search); return logins.filter((item) => !q || normalizeText([item.title, item.username, item.url, item.owner_group, item.notes, resolveBankName(item, groups)].filter(Boolean).join(' ')).includes(q)); }
function getMode(item) { if (item?.record_type === 'login' || item?.category === 'websites') return 'login'; if (item?.category === 'banks') return 'bank'; return item?.record_type === 'card' || item?.category === 'cards' ? 'card' : 'account'; }
function bankRef(bank) { return bank?.id ? `bank:${bank.id}` : (bank?.title || ''); }
function groupRef(group) { return group?.bank ? bankRef(group.bank) : (group?.displayName || ''); }
function firstBankRef(groups) { return groups[0] ? groupRef(groups[0]) : ''; }
function resolveBankName(item, groups) { const found = groups.find((group) => groupRef(group) === item.owner_group || normalizeText(group.displayName) === normalizeText(item.owner_group)); return found?.displayName || item.owner_group || 'بدون بنك'; }
function bankLabel(name) { const clean = name || 'بدون بنك'; return `${bankCode(clean)} ${clean}`.trim(); }
function bankCode(name) { const n = normalizeText(name); const match = bankSymbols.find((entry) => entry.keys.some((key) => n.includes(normalizeText(key)))); return match ? `🏦 ${match.code}` : '🏦'; }
function normalizeText(value) { return String(value || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/[ة]/g, 'ه').replace(/\s+/g, ' ').trim(); }

function preparePayload(form, mode, groups) {
  const payload = { ...emptyForm, ...form, is_favorite: false, category: mode === 'bank' ? 'banks' : 'websites', record_type: mode === 'bank' ? 'subscription' : 'login' };
  if (mode === 'bank') { if (!payload.title.trim()) return { error: 'اكتب اسم البنك أولاً.' }; payload.owner_group = ''; }
  if (mode === 'login') { if (!groups.length) return { error: 'أضف بنكًا أولاً.' }; if (!payload.owner_group) return { error: 'اختر البنك أولاً.' }; if (!payload.title.trim()) payload.title = payload.username || 'دخول البنك'; }
  return { payload };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' }, screen: { flex: 1 }, container: { padding: 18, paddingTop: 12, paddingBottom: 44 },
  topBar: { minHeight: 62, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 62 },
  topTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center' }, topBackButton: { position: 'absolute', right: 14, top: 12, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#e2e8f0' }, topBackText: { color: '#0f172a', fontWeight: '900', fontSize: 15 }, searchButton: { position: 'absolute', left: 62, top: 11, width: 42, height: 42, borderRadius: 15, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, iconText: { fontSize: 20 }, floatingMenuButton: { position: 'absolute', top: 73, left: 18, zIndex: 20, width: 48, height: 48, borderRadius: 18, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', elevation: 6 }, dotsText: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 32 }, dropdownMenu: { position: 'absolute', top: 126, left: 18, zIndex: 25, width: 138, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 8 }, dropdownItem: { paddingVertical: 15, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, dropdownText: { color: '#0f172a', textAlign: 'right', fontSize: 17, fontWeight: '900' },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' }, backText: { color: '#0f172a', fontWeight: '900', fontSize: 16 }, lockCard: { marginTop: 24, backgroundColor: '#fff', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }, lockIcon: { fontSize: 48, textAlign: 'center' }, title: { marginTop: 16, fontSize: 32, fontWeight: '900', color: '#0f172a', textAlign: 'right' }, subtitle: { marginTop: 8, color: '#475569', fontSize: 17, textAlign: 'right', lineHeight: 25 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 18, padding: 15, textAlign: 'right', color: '#0f172a', marginBottom: 14, fontSize: 17 }, inputLabel: { color: '#334155', fontWeight: '900', textAlign: 'right', marginTop: 10, marginBottom: 6, fontSize: 16 }, input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, textAlign: 'right', color: '#0f172a', marginTop: 8, fontSize: 16 }, notesInput: { minHeight: 78, textAlignVertical: 'top' }, filterRowWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 8 }, chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' }, chipText: { color: '#334155', fontWeight: '900', fontSize: 15 }, chipTextActive: { color: '#fff' },
  formCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' }, formTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right', marginBottom: 14 }, message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '900', fontSize: 15 }, saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' }, saveText: { color: '#fff', fontWeight: '900', fontSize: 17 }, secondaryButton: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, secondaryText: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  sectionTitle: { marginTop: 18, marginBottom: 10, color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right' }, platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }, platformName: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' }, platformText: { marginTop: 5, color: '#64748b', textAlign: 'right', fontSize: 15 },
  bankCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#dbeafe' }, rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, rowActions: { flexDirection: 'row', gap: 6 }, bankTitleBlock: { flex: 1 }, bankName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' }, smallEditButton: { backgroundColor: '#eef6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, smallEditText: { color: '#1d4ed8', fontWeight: '900', fontSize: 13 }, smallDeleteButton: { backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, smallDeleteText: { color: '#be123c', fontWeight: '900', fontSize: 13 },
  vaultCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }, cardTitleBlock: { flex: 1 }, loginBadge: { backgroundColor: '#ecfeff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#cffafe' }, loginBadgeText: { color: '#0e7490', fontWeight: '900', fontSize: 13 }, secretRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }, secretLabel: { color: '#64748b', fontWeight: '900', minWidth: 78, textAlign: 'right', fontSize: 14 }, secretValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 15 }, copyMini: { backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, copyMiniText: { color: '#075985', fontWeight: '900', fontSize: 12 }, iconActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 }, notesText: { marginTop: 8, color: '#475569', textAlign: 'right', fontSize: 14, lineHeight: 21 }, emptyText: { color: '#94a3b8', fontWeight: '800', textAlign: 'right', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12 },
  revealButton: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#cffafe' }, revealText: { color: '#0e7490', fontWeight: '900', fontSize: 15 }, editButton: { flex: 1, backgroundColor: '#eef6ff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' }, editText: { color: '#1d4ed8', fontWeight: '900', fontSize: 15 }, deleteButton: { flex: 1, backgroundColor: '#fff1f2', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3' }, deleteText: { color: '#be123c', fontWeight: '900', fontSize: 15 },
});
