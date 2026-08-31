import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import * as Notifications from './SafeNotifications';
import * as SecureStore from 'expo-secure-store';
import BankLogo from './BankLogo';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const NOTIFICATION_CHANNEL = 'card-statements';
const STATUS_TOP = Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 0) : 0;
const SITE_GROUP = 'sites';

if (Notifications.isAvailable) {
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
  title: '', username: '', password: '', url: '', email: '', phone: '', purpose: '', tags: '', iban: '', account_number: '',
  cardholder_name: '', card_brand: 'visa', card_number: '', expiry_month: '', expiry_year: '',
  card_type: 'credit', statement_day: '', credit_card_debt_id: '', sadad_number: '',
  security_question: '', security_answer: '', backup_codes: '', notes: '',
};

export default function SecureVaultScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [creditDebts, setCreditDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState('home');
  const [selectedBankKey, setSelectedBankKey] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('bank');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [revealedId, setRevealedId] = useState(null);

  const vault = useMemo(() => buildVault(items), [items]);
  const selectedGroup = useMemo(() => vault.groups.find((group) => group.key === selectedBankKey) || null, [vault.groups, selectedBankKey]);
  const bankGroups = useMemo(() => filterBankGroups(vault.groups, search), [vault.groups, search]);
  const siteItems = useMemo(() => filterSites(vault.siteLogins, search), [vault.siteLogins, search]);

  useEffect(() => { loadItems(); configureNotifications(); }, []);
  useEffect(() => {
    if (!revealedId) return undefined;
    const timer = setTimeout(() => setRevealedId(null), 30000);
    return () => clearTimeout(timer);
  }, [revealedId]);

  const loadItems = async () => {
    setLoading(true); setMessage('');
    try {
      const [vaultResponse, debtsResponse] = await Promise.all([
        fetch(`${API_URL}/secure-vault`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) }),
        fetch(`${API_URL}/credit-card-debts`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) }),
      ]);
      const vaultJson = await vaultResponse.json();
      const debtsJson = await debtsResponse.json();
      if (!vaultResponse.ok) throw new Error(vaultJson.message || 'load failed');
      const loaded = Array.isArray(vaultJson.data) ? vaultJson.data : [];
      setItems(loaded);
      setCreditDebts(debtsResponse.ok && Array.isArray(debtsJson.data) ? debtsJson.data : []);
      syncCardReminders(loaded);
    } catch (error) {
      setMessage('تعذر تحميل الخزنة. تأكد من الاتصال بالخادم.');
    } finally { setLoading(false); }
  };

  const configureNotifications = async () => {
    if (!Notifications.isAvailable || Platform.OS === 'web') return false;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
          name: 'مواعيد كشف البطاقات', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250],
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (error) { return false; }
  };

  const notificationKey = (id) => `ahmed_card_statement_notification_${id}`;
  const cancelCardReminder = async (id) => {
    if (!Notifications.isAvailable || Platform.OS === 'web' || !id) return;
    try {
      const key = notificationKey(id);
      const scheduledId = await SecureStore.getItemAsync(key);
      if (scheduledId) await Notifications.cancelScheduledNotificationAsync(scheduledId);
      await SecureStore.deleteItemAsync(key);
    } catch (error) {}
  };
  const scheduleCardReminder = async (card, sourceItems = items) => {
    if (!Notifications.isAvailable || Platform.OS === 'web' || !card?.id || !validStatementDay(card.statement_day)) return false;
    const allowed = await configureNotifications(); if (!allowed) return false;
    try {
      await cancelCardReminder(card.id);
      const bankName = resolveBankNameFromItems(card, sourceItems);
      const identifier = await Notifications.scheduleNotificationAsync({
        content: { title: 'موعد كشف البطاقة', body: `${bankName} • ${card.title || 'بطاقة'} — اليوم موعد كشف البطاقة.`, sound: 'default', data: { vaultCardId: String(card.id) } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: Number(card.statement_day), hour: 9, minute: 0, channelId: Platform.OS === 'android' ? NOTIFICATION_CHANNEL : undefined },
      });
      if (identifier) await SecureStore.setItemAsync(notificationKey(card.id), String(identifier));
      return Boolean(identifier);
    } catch (error) { return false; }
  };
  const syncCardReminders = async (sourceItems) => {
    if (!Notifications.isAvailable || Platform.OS === 'web') return;
    for (const card of sourceItems.filter((item) => getMode(item) === 'card')) if (validStatementDay(card.statement_day)) await scheduleCardReminder(card, sourceItems);
  };

  const revealItem = async (item) => {
    if (!item?.id) return;
    if (revealedId === item.id) { setRevealedId(null); return; }
    setMessage('جاري فك التشفير...');
    try {
      const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'reveal failed');
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...json.data } : entry)));
      setRevealedId(item.id); setMessage('تم فك التشفير للعرض لمدة 30 ثانية.');
    } catch (error) { setMessage('تعذر فك تشفير البيانات.'); }
  };

  const openForm = (mode, nextForm, id = null) => { setMenuOpen(false); setFormMode(mode); setEditingId(id); setForm({ ...emptyForm, ...nextForm }); setFormOpen(true); setMessage(''); };
  const startAddBank = () => openForm('bank', { category: 'banks', record_type: 'subscription' });
  const startAddSite = () => openForm('login', { category: 'websites', record_type: 'login', owner_group: SITE_GROUP });
  const startBankCredentials = async () => {
    if (!selectedGroup?.bank) return;
    let full = selectedGroup.bank;
    try {
      const response = await fetch(`${API_URL}/secure-vault/${selectedGroup.bank.id}`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (response.ok) full = json.data;
    } catch (error) {}
    openForm('bankLogin', {
      category: 'banks', record_type: 'subscription', owner_group: '',
      title: full.title || selectedGroup.displayName || 'بنك',
      username: full.username || '', password: full.password || '',
    }, selectedGroup.bank.id);
  };
  const startAddCard = () => selectedGroup && openForm('card', { category: 'cards', record_type: 'card', owner_group: groupRef(selectedGroup), card_type: 'credit', card_brand: 'visa' });
  const startAddAccount = () => selectedGroup && openForm('account', { category: 'accounts', record_type: 'subscription', owner_group: groupRef(selectedGroup), title: 'حساب بنكي', iban: '', account_number: '' });

  const startEdit = async (item) => {
    let full = item;
    try {
      const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json(); if (response.ok) full = json.data;
    } catch (error) {}
    const mode = getMode(full);
    openForm(mode, {
      owner_group: full.owner_group || '', category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'card' ? 'cards' : mode === 'account' ? 'accounts' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin' || mode === 'account') ? 'subscription' : mode === 'card' ? 'card' : 'login',
      title: full.title || '', username: full.username || '', password: full.password || '', url: full.url || '', notes: full.notes || '', iban: full.iban || full.username || '', account_number: full.account_number || full.purpose || '',
      cardholder_name: full.cardholder_name || '', card_brand: full.card_brand || (full.card_type === 'mada' ? 'mada' : 'visa'), card_number: full.card_number || '', expiry_month: full.expiry_month ? String(full.expiry_month) : '', expiry_year: full.expiry_year ? String(full.expiry_year) : '',
      card_type: full.card_type || 'credit', statement_day: full.statement_day ? String(full.statement_day) : '', credit_card_debt_id: full.credit_card_debt_id ? String(full.credit_card_debt_id) : '', sadad_number: full.sadad_number || '',
    }, item.id);
  };

  const saveItem = async () => {
    const prepared = preparePayload(form, formMode, creditDebts); if (prepared.error) { setMessage(prepared.error); return; }
    setSaving(true); setMessage('جاري الحفظ...');
    try {
      const response = await fetch(editingId ? `${API_URL}/secure-vault/${editingId}` : `${API_URL}/secure-vault`, {
        method: editingId ? 'PUT' : 'POST', headers: ahmedUserHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }), body: JSON.stringify(prepared.payload),
      });
      const json = await response.json(); if (!response.ok) throw new Error(firstValidationMessage(json.errors) || json.message || 'save failed');
      const saved = json.data; const mode = formMode;
      setFormOpen(false); setEditingId(null); setForm(emptyForm); await loadItems();
      if (mode === 'card' && saved) {
        const scheduled = await scheduleCardReminder(saved, [...items.filter((entry) => entry.id !== saved.id), saved]);
        setMessage(scheduled ? 'تم الحفظ وتفعيل تنبيه كشف البطاقة.' : 'تم حفظ البطاقة. الإشعار يعمل في نسخة التطبيق الداعمة للإشعارات.');
      } else setMessage('تم الحفظ بنجاح.');
    } catch (error) { setMessage(error.message || 'تعذر حفظ البيانات.'); }
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
        if (getMode(item) === 'bank' && selectedGroup?.bank?.id === item.id) { setView('banks'); setSelectedBankKey(''); }
      } catch (error) { setMessage('تعذر حذف السجل.'); }
    } },
  ]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const goBack = () => {
    setMenuOpen(false); setSearch(''); setSearchOpen(false);
    if (view === 'bank') { setView('banks'); setSelectedBankKey(''); return; }
    if (view === 'banks' || view === 'sites') { setView('home'); return; }
    onBack();
  };
  const openBank = (group) => { setSelectedBankKey(group.key); setView('bank'); setSearch(''); setSearchOpen(false); };
  const menuItems = getMenuItems(view, selectedGroup, startAddBank, startAddSite, startAddCard, startAddAccount, startBankCredentials, () => selectedGroup?.bank && startEdit(selectedGroup.bank));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBackButton} onPress={goBack}><Text style={styles.topBackText}>رجوع</Text></TouchableOpacity>
          <Text style={styles.topTitle}>الخزنة الآمنة</Text>
          <TouchableOpacity style={styles.searchButton} onPress={() => setSearchOpen((value) => !value)}><Text style={styles.searchIcon}>🔍</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.floatingMenuButton} onPress={() => setMenuOpen((value) => !value)}><Text style={styles.dotsText}>⋮</Text></TouchableOpacity>
        {menuOpen ? <View style={styles.dropdownMenu}>{menuItems.map((entry) => <TouchableOpacity key={entry.label} style={styles.dropdownItem} onPress={entry.onPress}><Text style={styles.dropdownText}>{entry.label}</Text></TouchableOpacity>)}</View> : null}
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {searchOpen && view !== 'home' ? <TextInput value={search} onChangeText={setSearch} placeholder="بحث" style={styles.searchInput} autoFocus /> : null}
          {!!message ? <Text style={styles.message}>{message}</Text> : null}
          {loading ? <Text style={styles.loadingText}>جاري تحميل الخزنة...</Text> : null}
          {view === 'home' ? <HomeView bankCount={vault.groups.length} siteCount={vault.siteLogins.length} onBanks={() => setView('banks')} onSites={() => setView('sites')} /> : null}
          {view === 'banks' ? <BanksView groups={bankGroups} onBank={openBank} /> : null}
          {view === 'bank' && selectedGroup ? <BankDetails group={selectedGroup} creditDebts={creditDebts} revealedId={revealedId} onReveal={revealItem} onEdit={startEdit} onDelete={deleteItem} onAddCard={startAddCard} onAddAccount={startAddAccount} onEditCredentials={startBankCredentials} /> : null}
          {view === 'sites' ? <SitesView items={siteItems} revealedId={revealedId} onReveal={revealItem} onEdit={startEdit} onDelete={deleteItem} /> : null}
        </ScrollView>
        <VaultFormModal open={formOpen} form={form} formMode={formMode} setField={setField} saving={saving} message={message} saveItem={saveItem} cancel={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); setMessage(''); }} selectedGroup={selectedGroup} groups={vault.groups} creditDebts={creditDebts} editingId={editingId} />
      </View>
    </SafeAreaView>
  );
}

function HomeView({ bankCount, siteCount, onBanks, onSites }) {
  return <View style={styles.homeWrap}>
    <TouchableOpacity style={styles.homeCard} activeOpacity={0.86} onPress={onBanks}><View style={styles.homeIconBox}><Text style={styles.homeEmoji}>🏦</Text></View><View style={styles.homeTextBlock}><Text style={styles.homeTitle}>البنوك</Text><Text style={styles.homeSubtitle}>حسابات الدخول والبطاقات البنكية</Text><Text style={styles.homeCount}>{bankCount} بنك</Text></View><Text style={styles.chevron}>‹</Text></TouchableOpacity>
    <TouchableOpacity style={styles.homeCard} activeOpacity={0.86} onPress={onSites}><View style={styles.homeIconBox}><Text style={styles.homeEmoji}>🌐</Text></View><View style={styles.homeTextBlock}><Text style={styles.homeTitle}>مواقع أو تطبيقات</Text><Text style={styles.homeSubtitle}>أسماء المستخدمين وكلمات المرور</Text><Text style={styles.homeCount}>{siteCount} حساب</Text></View><Text style={styles.chevron}>‹</Text></TouchableOpacity>
  </View>;
}
function BanksView({ groups, onBank }) {
  return <><Text style={styles.pageTitle}>البنوك</Text><Text style={styles.pageSubtitle}>اختر بنكًا لعرض حساب الدخول والبطاقات</Text>{groups.length ? <View style={styles.bankGrid}>{groups.map((group) => <TouchableOpacity key={group.key} style={styles.bankTile} activeOpacity={0.84} onPress={() => onBank(group)}><View style={styles.bankLogoBox}><BankLogo bankName={group.displayName} size={66} /></View><Text style={styles.bankTileName}>{cleanBankName(group.displayName)}</Text></TouchableOpacity>)}</View> : <EmptyCard text="لا توجد بنوك محفوظة." />}</>;
}
function BankDetails({ group, creditDebts, revealedId, onReveal, onEdit, onDelete, onAddCard, onAddAccount, onEditCredentials }) {
  const [accountsOpen, setAccountsOpen] = useState(false);
  const bank = group.bank;
  const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password));
  return <>
    <View style={styles.bankHero}><View style={styles.bankHeroLogo}><BankLogo bankName={group.displayName} size={62} /></View><View style={styles.bankHeroText}><Text style={styles.bankHeroName}>{cleanBankName(group.displayName)}</Text><Text style={styles.bankHeroSub}>حساب الدخول والبطاقات</Text></View>{bank ? <TouchableOpacity style={styles.editPill} onPress={() => onEdit(bank)}><Text style={styles.editPillText}>تعديل</Text></TouchableOpacity> : null}</View>
    <SectionHeader title="بيانات الدخول" action={bank ? (hasCredentials ? 'تعديل' : 'إضافة') : ''} onAction={bank ? onEditCredentials : undefined} />
    {bank ? <SecretCard item={bank} revealed={revealedId === bank.id} onReveal={() => onReveal(bank)} /> : <EmptyCard text="لا يوجد سجل أساسي لهذا البنك." />}
    <BankAccountsDropdown accounts={group.accounts} open={accountsOpen} onToggle={() => setAccountsOpen((value) => !value)} onAddAccount={onAddAccount} onEdit={onEdit} onDelete={onDelete} />
    <SectionHeader title="البطاقات" action="إضافة بطاقة" onAction={onAddCard} />
    {group.cards.length ? group.cards.map((card) => <BankCard key={card.id} item={card} creditDebts={creditDebts} revealed={revealedId === card.id} onReveal={() => onReveal(card)} onEdit={() => onEdit(card)} onDelete={() => onDelete(card)} />) : <EmptyCard text="لا توجد بطاقات محفوظة لهذا البنك." />}
    {bank ? <TouchableOpacity style={styles.deleteBankButton} onPress={() => onDelete(bank)}><Text style={styles.deleteBankText}>حذف البنك</Text></TouchableOpacity> : null}
  </>;
}
function BankAccountsDropdown({ accounts, open, onToggle, onAddAccount, onEdit, onDelete }) {
  const countLabel = accounts.length === 1 ? 'حساب واحد' : `${accounts.length} حسابات`;
  return <><SectionHeader title="الحسابات البنكية" action="إضافة حساب" onAction={onAddAccount} />{accounts.length ? <View style={styles.accountsDropdown}><TouchableOpacity style={styles.accountsDropdownHeader} activeOpacity={0.84} onPress={onToggle}><View style={styles.accountsDropdownIcon}><Text style={styles.accountsDropdownIconText}>🏦</Text></View><View style={styles.accountsDropdownText}><Text style={styles.accountsDropdownTitle}>الحسابات البنكية</Text><Text style={styles.accountsDropdownSubtitle}>{open ? 'اضغط لإخفاء الحسابات' : 'اضغط لعرض الحسابات'}</Text></View><View style={styles.accountsDropdownMeta}><View style={styles.accountsCountBadge}><Text style={styles.accountsCountText}>{countLabel}</Text></View><Text style={styles.accountsChevron}>{open ? '⌃' : '⌄'}</Text></View></TouchableOpacity>{open ? <View style={styles.accountsDropdownBody}>{accounts.map((account) => <BankAccountCard key={account.id} item={account} onEdit={() => onEdit(account)} onDelete={() => onDelete(account)} nested />)}</View> : null}</View> : <EmptyCard text="لا توجد حسابات بنكية محفوظة لهذا البنك." />}</>;
}
function BankAccountCard({ item, onEdit, onDelete, nested = false }) {
  const iban = String(item.iban || item.username || '').trim();
  const accountNumber = String(item.account_number || item.purpose || '').trim();
  return <View style={[styles.bankAccountCompactCard, nested && styles.bankAccountCompactNested]}>
    <View style={styles.siteActions}><TouchableOpacity style={styles.iconAction} onPress={onEdit}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.iconAction} onPress={onDelete}><Text>🗑️</Text></TouchableOpacity></View>
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountCompactValue} selectable>{iban || '—'}</Text><Text style={styles.bankAccountCompactLabel}>الآيبان</Text></View>
    <View style={styles.bankAccountCompactDivider} />
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountNumberValue} selectable>{accountNumber || '—'}</Text><Text style={styles.bankAccountCompactLabel}>رقم الحساب</Text></View>
  </View>;
}
function SitesView({ items, revealedId, onReveal, onEdit, onDelete }) {
  return <><Text style={styles.pageTitle}>مواقع أو تطبيقات</Text><Text style={styles.pageSubtitle}>حسابات المستخدمين وكلمات المرور</Text>{items.length ? items.map((item) => <SiteLoginCard key={item.id} item={item} revealed={revealedId === item.id} onReveal={() => onReveal(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />) : <EmptyCard text="لا توجد مواقع أو تطبيقات محفوظة." />}</>;
}
function SecretCard({ item, revealed, onReveal }) {
  const hasLogin = item.has_username || item.has_password || item.username || item.password;
  if (!hasLogin) return <View style={styles.secretCard}><Text style={styles.noLogin}>لا توجد بيانات دخول محفوظة لهذا البنك.</Text></View>;
  return <View style={styles.secretCard}><SecretRow label="اسم المستخدم" value={revealed ? (item.username || '—') : (item.has_username ? '••••••••' : '—')} /><SecretRow label="كلمة المرور" value={revealed ? (item.password || '—') : (item.has_password ? '••••••••••' : '—')} /><TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity></View>;
}
function SiteLoginCard({ item, revealed, onReveal, onEdit, onDelete, compact = false }) {
  return <View style={[styles.siteCard, compact && styles.siteCardCompact]}><View style={styles.siteHeader}><View style={styles.siteActions}><TouchableOpacity style={styles.iconAction} onPress={onEdit}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.iconAction} onPress={onDelete}><Text>🗑️</Text></TouchableOpacity></View><View style={styles.siteTitleBlock}><Text style={styles.siteTitle}>{item.title || 'حساب'}</Text>{item.url ? <Text style={styles.siteUrl}>{item.url}</Text> : null}</View><View style={styles.siteIcon}><Text style={styles.siteIconText}>🌐</Text></View></View><SecretRow label="اسم المستخدم" value={revealed ? (item.username || '—') : (item.has_username ? '••••••••' : '—')} /><SecretRow label="كلمة المرور" value={revealed ? (item.password || '—') : (item.has_password ? '••••••••••' : '—')} /><TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك'}</Text></TouchableOpacity></View>;
}
function BankCard({ item, creditDebts, revealed, onReveal, onEdit, onDelete }) {
  const debt = creditDebts.find((entry) => String(entry.id) === String(item.credit_card_debt_id));
  const credit = item.card_type === 'credit';
  const brand = item.card_type === 'mada' ? 'مدى' : item.card_brand === 'mastercard' ? 'ماستركارد' : 'فيزا';
  const hasRevealable = item.has_card_number || item.card_last_four || (credit && item.has_sadad_number);
  return <View style={styles.cardBox}>
    <View style={styles.cardHeader}><View style={styles.siteActions}><TouchableOpacity style={styles.iconAction} onPress={onEdit}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.iconAction} onPress={onDelete}><Text>🗑️</Text></TouchableOpacity></View><View style={styles.cardTitleBlock}><Text style={styles.cardName}>{item.title || 'بطاقة'}</Text><Text style={styles.cardBrand}>{credit ? `ائتمانية • ${brand}` : 'مدى'}</Text></View><NetworkBadge brand={credit ? item.card_brand : 'mada'} /></View>
    <View style={styles.specGrid}>
      <Spec label="نوع البطاقة" value={credit ? `ائتمانية - ${brand}` : 'مدى'} />
      <Spec label="تاريخ الكشف" value={item.statement_day ? `يوم ${item.statement_day}` : '—'} />
      {credit ? <Spec label="الحد الائتماني" value={debt ? money(debt.credit_limit) : 'غير مربوط'} /> : null}
      {credit ? <Spec label="رقم سداد" value={revealed ? (item.sadad_number || '—') : (item.has_sadad_number ? '••••••' : '—')} /> : null}
    </View>
    {hasRevealable ? <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء البيانات' : 'فك بيانات البطاقة'}</Text></TouchableOpacity> : null}
    {revealed && item.card_number ? <SecretRow label="رقم البطاقة" value={item.card_number} /> : item.card_last_four ? <Text style={styles.lastFour}>آخر 4 أرقام: {item.card_last_four}</Text> : null}
  </View>;
}
function NetworkBadge({ brand }) { if (brand === 'mastercard') return <View style={[styles.networkBadge, styles.mcBadge]}><Text style={styles.networkWhite}>MC</Text></View>; if (brand === 'mada') return <View style={[styles.networkBadge, styles.madaBadge]}><Text style={styles.networkWhite}>مدى</Text></View>; return <View style={[styles.networkBadge, styles.visaBadge]}><Text style={styles.networkWhite}>VISA</Text></View>; }
function SecretRow({ label, value }) { return <View style={styles.secretRow}><Text style={styles.secretValue} numberOfLines={1}>{String(value || '—')}</Text><Text style={styles.secretLabel}>{label}</Text></View>; }
function Spec({ label, value }) { return <View style={styles.spec}><Text style={styles.specLabel}>{label}</Text><Text style={styles.specValue}>{value}</Text></View>; }
function EmptyCard({ text }) { return <View style={styles.emptyCard}><Text style={styles.emptyText}>{text}</Text></View>; }
function SectionHeader({ title, action, onAction }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <TouchableOpacity style={styles.sectionAction} onPress={onAction}><Text style={styles.sectionActionText}>{action}</Text></TouchableOpacity> : <View />}</View>; }

function VaultFormModal({ open, form, formMode, setField, saving, message, saveItem, cancel, selectedGroup, groups, creditDebts, editingId }) {
  const isBank = formMode === 'bank'; const isBankLogin = formMode === 'bankLogin'; const isAccount = formMode === 'account'; const isCard = formMode === 'card'; const isLogin = formMode === 'login';
  const ownerGroup = groups.find((group) => groupRef(group) === form.owner_group) || selectedGroup;
  const matchingDebts = creditDebts.filter((debt) => bankNamesMatch(ownerGroup?.displayName, debt.bank_name));
  let debtOptions = matchingDebts.length ? matchingDebts : creditDebts;
  const selectedDebt = creditDebts.find((debt) => String(debt.id) === String(form.credit_card_debt_id));
  if (selectedDebt && !debtOptions.some((debt) => debt.id === selectedDebt.id)) debtOptions = [selectedDebt, ...debtOptions];
  const siteMode = isLogin && form.owner_group === SITE_GROUP;
  const title = isBankLogin ? 'بيانات دخول البنك' : editingId ? (isAccount ? 'تعديل حساب بنكي' : 'تعديل السجل') : isBank ? 'إضافة بنك' : isAccount ? 'إضافة حساب بنكي' : isCard ? 'إضافة بطاقة' : 'إضافة موقع أو تطبيق';
  return <Modal visible={open} transparent animationType="slide" onRequestClose={cancel}><KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modalSheet}><View style={styles.modalHandle} /><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}><Text style={styles.formTitle}>{title}</Text>
    {isBank ? <><FormInput label="اسم البنك" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: بنك الجزيرة" /><Text style={styles.securityHint}>بيانات الدخول تُدار من داخل صفحة البنك، ويسمح بسجل دخول واحد فقط لكل بنك.</Text></> : null}
    {isBankLogin ? <>{ownerGroup ? <View style={styles.fixedBankBox}><BankLogo bankName={ownerGroup.displayName} size={34} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}<FormInput label="اسم المستخدم" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize="none" /><FormInput label="كلمة المرور" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize="none" /><Text style={styles.securityHint}>اسم المستخدم وكلمة المرور فقط، وتُحفظ البيانات مشفرة. لا يمكن إضافة دخول ثانٍ لنفس البنك.</Text></> : null}
    {isLogin ? <><FormInput label="اسم الموقع أو التطبيق" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: Gmail" /><FormInput label="اسم المستخدم" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize="none" /><FormInput label="كلمة المرور" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize="none" /></> : null}
    {isAccount ? <>{ownerGroup ? <View style={styles.fixedBankBox}><BankLogo bankName={ownerGroup.displayName} size={34} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}<FormInput label="اسم الحساب" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: الحساب الجاري" /><FormInput label="رقم الآيبان" value={form.iban} onChangeText={(value) => setField('iban', String(value || '').replace(/\s+/g, '').toUpperCase())} autoCapitalize="characters" placeholder="SA..." /><FormInput label="رقم الحساب" value={form.account_number} onChangeText={(value) => setField('account_number', digitsOnly(value, 34))} keyboardType="number-pad" /><Text style={styles.securityHint}>يمكن حفظ رقم الآيبان ورقم الحساب، وسيظهران مباشرة داخل صفحة البنك.</Text></> : null}
    {isCard ? <View style={styles.cardFormCompact}>
      {ownerGroup ? <View style={[styles.fixedBankBox, styles.fixedBankBoxCompact]}><BankLogo bankName={ownerGroup.displayName} size={32} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}
      <FormInput label="اسم البطاقة" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: أجواء إنفينيت" />
      <View style={styles.compactChoiceRow}>
        <View style={styles.compactChoiceBlock}><Text style={styles.inputLabel}>نوع البطاقة</Text><SegmentedRow options={[{ value: 'mada', label: 'مدى' }, { value: 'credit', label: 'ائتمانية' }]} value={form.card_type} onChange={(value) => { setField('card_type', value); if (value === 'mada') { setField('card_brand', 'mada'); setField('credit_card_debt_id', ''); setField('sadad_number', ''); } else if (form.card_brand === 'mada') setField('card_brand', 'visa'); }} /></View>
        {form.card_type === 'credit' ? <View style={styles.compactChoiceBlock}><Text style={styles.inputLabel}>الشبكة</Text><SegmentedRow options={[{ value: 'visa', label: 'Visa' }, { value: 'mastercard', label: 'Mastercard' }]} value={form.card_brand} onChange={(value) => setField('card_brand', value)} /></View> : null}
      </View>
      {form.card_type === 'credit' ? <View style={styles.compactPanel}><Text style={styles.compactPanelTitle}>الحد الائتماني من شاشة المديونية</Text>{debtOptions.length ? <PickerRow options={debtOptions.map((debt) => ({ value: String(debt.id), label: `${debt.card_name || 'بطاقة'} • ${money(debt.credit_limit)}` }))} value={String(form.credit_card_debt_id || '')} onChange={(value) => setField('credit_card_debt_id', value)} /> : <Text style={styles.securityHint}>لا توجد بطاقة في شاشة مديونية بطائق الائتمان لربط الحد.</Text>}{selectedDebt ? <View style={styles.readOnlyBox}><Text style={styles.readOnlyLabel}>الحد الائتماني</Text><Text style={styles.readOnlyValue}>{money(selectedDebt.credit_limit)}</Text></View> : null}</View> : null}
      <FormInput label="رقم البطاقة (اختياري)" value={form.card_number} onChangeText={(value) => setField('card_number', digitsOnly(value, 19))} keyboardType="number-pad" />
      <View style={styles.twoColumns}><View style={styles.half}><FormInput label="سنة الانتهاء" value={String(form.expiry_year || '')} onChangeText={(value) => setField('expiry_year', digitsOnly(value, 4))} keyboardType="number-pad" placeholder="YYYY" /></View><View style={styles.half}><FormInput label="شهر الانتهاء" value={String(form.expiry_month || '')} onChangeText={(value) => setField('expiry_month', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="MM" /></View></View>
      {form.card_type === 'credit' ? <View style={styles.twoColumns}><View style={styles.half}><FormInput label="رقم سداد" value={form.sadad_number} onChangeText={(value) => setField('sadad_number', value)} keyboardType="number-pad" /></View><View style={styles.half}><FormInput label="تاريخ الكشف" value={String(form.statement_day || '')} onChangeText={(value) => setField('statement_day', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="يوم الشهر" /></View></View> : <FormInput label="تاريخ الكشف (يوم الشهر)" value={String(form.statement_day || '')} onChangeText={(value) => setField('statement_day', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="مثال: 25" />}
      <Text style={styles.securityHint}>{form.card_type === 'credit' ? 'رقم البطاقة ورقم سداد يحفظان مشفرين. وسيتم تنبيهك في يوم الكشف.' : 'بطاقة مدى لا تحتوي على رقم سداد. رقم البطاقة فقط يحفظ مشفرًا.'}</Text>
      <FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline />
    </View> : null}
    {!!message ? <Text style={styles.message}>{message}</Text> : null}<TouchableOpacity style={styles.saveButton} onPress={saveItem} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Text></TouchableOpacity><TouchableOpacity style={styles.cancelButton} onPress={cancel}><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
function FormInput({ label, multiline, ...props }) { return <View style={styles.formInputWrap}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} multiline={multiline} style={[styles.input, multiline && styles.multilineInput]} textAlign="right" /></View>; }
function PickerRow({ options, value, onChange }) { return <View style={styles.pickerWrap}>{options.map((option) => <TouchableOpacity key={String(option.value)} style={[styles.pickerChip, String(value) === String(option.value) && styles.pickerChipActive]} onPress={() => onChange(option.value)}><Text style={[styles.pickerText, String(value) === String(option.value) && styles.pickerTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>; }
function SegmentedRow({ options, value, onChange }) { return <View style={styles.segmentedWrap}>{options.map((option) => <TouchableOpacity key={String(option.value)} style={[styles.segmentedChip, String(value) === String(option.value) && styles.segmentedChipActive]} onPress={() => onChange(option.value)}><Text style={[styles.segmentedText, String(value) === String(option.value) && styles.segmentedTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>; }

function buildVault(items) {
  const banks = items.filter((item) => getMode(item) === 'bank'); const cards = items.filter((item) => getMode(item) === 'card'); const logins = items.filter((item) => getMode(item) === 'login'); const accounts = items.filter((item) => getMode(item) === 'account');
  const groups = banks.map((bank) => ({ key: bankRef(bank), bank, displayName: bank.title || 'بنك', cards: [], accounts: [], logins: [] })); const byKey = new Map(groups.map((group) => [group.key, group]));
  const findGroup = (item) => { const owner = String(item.owner_group || '').trim(); if (owner && byKey.has(owner)) return byKey.get(owner); const normalized = normalizeText(owner.replace(/^bank:/, '')); return groups.find((group) => String(group.bank?.id) === owner.replace(/^bank:/, '') || normalizeText(group.displayName) === normalized || normalizeText(cleanBankName(group.displayName)) === normalizeText(cleanBankName(owner))) || null; };
  cards.forEach((item) => { const group = findGroup(item); if (group) group.cards.push(item); }); accounts.forEach((item) => { const group = findGroup(item); if (group) group.accounts.push(item); }); const siteLogins = [];
  logins.forEach((item) => { const group = findGroup(item); if (group && item.owner_group !== SITE_GROUP) group.logins.push(item); else siteLogins.push(item); }); groups.sort((a, b) => bankRank(a.displayName) - bankRank(b.displayName)); return { groups, siteLogins };
}
function filterBankGroups(groups, search) { const q = normalizeText(search); return groups.filter((group) => !q || normalizeText(group.displayName).includes(q)); }
function filterSites(items, search) { const q = normalizeText(search); return items.filter((item) => !q || normalizeText([item.title, item.url].filter(Boolean).join(' ')).includes(q)); }
function getMode(item) { if (item?.record_type === 'card' || item?.category === 'cards') return 'card'; if (item?.category === 'banks') return 'bank'; if (isKnownBankRecord(item)) return 'bank'; if (item?.category === 'accounts') return 'account'; if (item?.record_type === 'login' || item?.category === 'websites') return 'login'; return 'other'; }
function isKnownBankRecord(item) { const owner = String(item?.owner_group || '').trim(); if (owner) return false; const n = normalizeText(cleanBankName(item?.title || '')); const known = ['الجزيره','الجزيرة','الانماء','الإنماء','البلاد','d360','د360','الرياض','الاهلي','الأهلي','الراجحي']; return known.some((name) => n === normalizeText(name)); }
function bankRef(bank) { return bank?.id ? `bank:${bank.id}` : String(bank?.title || ''); }
function groupRef(group) { return group?.bank ? bankRef(group.bank) : ''; }
function cleanBankName(value) { const raw = String(value || '').trim().replace(/\s+\d+\s*$/, '').trim(); return raw.replace(/^بنك\s+/, '').replace(/^البنك\s+/, '') || raw; }
function bankRank(name) { const n = normalizeText(cleanBankName(name)); const order = ['الجزيره', 'الانماء', 'البلاد', 'd360', 'د360', 'الرياض', 'الاهلي', 'الراجحي']; const index = order.findIndex((value) => n.includes(normalizeText(value))); return index === -1 ? 999 : index; }
function normalizeText(value) { return String(value || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim(); }
function bankNamesMatch(a, b) { const x = normalizeText(cleanBankName(a)); const y = normalizeText(cleanBankName(b)); return Boolean(x && y && (x.includes(y) || y.includes(x))); }
function resolveBankNameFromItems(item, sourceItems) { const owner = String(item.owner_group || ''); const id = owner.replace(/^bank:/, ''); const bank = sourceItems.find((entry) => getMode(entry) === 'bank' && (String(entry.id) === id || normalizeText(entry.title) === normalizeText(owner))); return cleanBankName(bank?.title || owner || 'البنك'); }
function digitsOnly(value, max) { return String(value || '').replace(/\D/g, '').slice(0, max); }
function validStatementDay(value) { const day = Number(value); return Number.isInteger(day) && day >= 1 && day <= 31; }
function money(value) { const number = Number(String(value ?? 0).replace(/,/g, '')); return `${(Number.isFinite(number) ? number : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.س`; }
function firstValidationMessage(errors) { if (!errors || typeof errors !== 'object') return ''; const first = Object.values(errors)[0]; return Array.isArray(first) ? String(first[0] || '') : String(first || ''); }
function preparePayload(form, mode, creditDebts) {
  const payload = { ...emptyForm, ...form, is_favorite: false, category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'account' ? 'accounts' : mode === 'card' ? 'cards' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin' || mode === 'account') ? 'subscription' : mode === 'card' ? 'card' : 'login', expiry_month: form.expiry_month ? Number(form.expiry_month) : null, expiry_year: form.expiry_year ? Number(form.expiry_year) : null, statement_day: form.statement_day ? Number(form.statement_day) : null, credit_card_debt_id: form.credit_card_debt_id ? Number(form.credit_card_debt_id) : null };
  if (!String(payload.title || '').trim()) return { error: mode === 'bank' ? 'اكتب اسم البنك.' : mode === 'account' ? 'اكتب اسم الحساب.' : mode === 'card' ? 'اكتب اسم البطاقة.' : 'اكتب اسم الموقع أو الدخول.' };
  if (mode === 'bank') { payload.owner_group = null; payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }
  if (mode === 'bankLogin') { if (!String(payload.username || '').trim()) return { error: 'اكتب اسم المستخدم.' }; if (!String(payload.password || '').trim()) return { error: 'اكتب كلمة المرور.' }; payload.owner_group = null; payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; payload.url = ''; payload.notes = ''; }
  if (mode === 'login') { payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }
  if (mode === 'account') { const iban = String(form.iban || form.username || '').replace(/\s+/g, '').toUpperCase(); const accountNumber = String(form.account_number || form.purpose || '').replace(/\s+/g, ''); if (!payload.owner_group) return { error: 'تعذر تحديد البنك.' }; if (!iban && !accountNumber) return { error: 'أدخل رقم الآيبان أو رقم الحساب.' }; payload.username = iban; payload.purpose = accountNumber; payload.password = ''; payload.url = ''; payload.email = ''; payload.phone = ''; payload.tags = ''; payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }
  if (mode === 'card') {
    if (!payload.owner_group) return { error: 'تعذر تحديد البنك.' }; if (!['mada', 'credit'].includes(payload.card_type)) return { error: 'حدد نوع البطاقة.' }; if (!validStatementDay(payload.statement_day)) return { error: 'حدد يوم الكشف من 1 إلى 31.' };
    if (payload.expiry_month && (payload.expiry_month < 1 || payload.expiry_month > 12)) return { error: 'شهر الانتهاء غير صحيح.' }; if (payload.expiry_year && (payload.expiry_year < new Date().getFullYear() || payload.expiry_year > 2100)) return { error: 'سنة الانتهاء غير صحيحة.' };
    if (payload.card_type === 'credit') { if (!['visa', 'mastercard'].includes(payload.card_brand)) return { error: 'حدد Visa أو Mastercard.' }; const debt = creditDebts.find((entry) => String(entry.id) === String(payload.credit_card_debt_id)); if (!debt) return { error: 'اربط البطاقة بسجلها في مديونية بطائق الائتمان.' }; } else { payload.card_brand = 'mada'; payload.credit_card_debt_id = null; payload.sadad_number = ''; }
  }
  return { payload };
}
function getMenuItems(view, selectedGroup, addBank, addSite, addCard, addAccount, editCredentials, editBank) { if (view === 'home') return [{ label: 'إضافة بنك', onPress: addBank }, { label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'banks') return [{ label: 'إضافة بنك', onPress: addBank }]; if (view === 'sites') return [{ label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'bank' && selectedGroup) { const bank = selectedGroup.bank; const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password)); return [{ label: 'إضافة حساب بنكي', onPress: addAccount }, { label: 'إضافة بطاقة', onPress: addCard }, ...(bank ? [{ label: hasCredentials ? 'تعديل بيانات الدخول' : 'إضافة بيانات الدخول', onPress: editCredentials }, { label: 'تعديل البنك', onPress: editBank }] : [])]; } return []; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb', paddingTop: STATUS_TOP }, screen: { flex: 1, backgroundColor: '#f4f7fb' },
  topBar: { height: 72, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 82 }, topTitle: { color: '#0f172a', fontSize: 25, fontWeight: '900', textAlign: 'center' },
  topBackButton: { position: 'absolute', right: 16, top: 11, height: 50, justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 17, paddingHorizontal: 16, borderWidth: 1, borderColor: '#dbe3ee' }, topBackText: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  searchButton: { position: 'absolute', left: 16, top: 11, width: 50, height: 50, borderRadius: 17, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dbe3ee' }, searchIcon: { fontSize: 21 },
  floatingMenuButton: { position: 'absolute', top: 92, left: 18, zIndex: 30, width: 54, height: 54, borderRadius: 20, backgroundColor: '#071326', alignItems: 'center', justifyContent: 'center', elevation: 8 }, dotsText: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '900' },
  dropdownMenu: { position: 'absolute', top: 152, left: 18, zIndex: 40, width: 185, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 10 }, dropdownItem: { paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, dropdownText: { color: '#0f172a', textAlign: 'right', fontWeight: '900', fontSize: 15 },
  container: { paddingHorizontal: 18, paddingTop: 34, paddingBottom: 70 }, searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ee', borderRadius: 18, padding: 14, textAlign: 'right', fontSize: 16, color: '#0f172a', marginBottom: 12 }, message: { color: '#075985', textAlign: 'right', fontWeight: '800', lineHeight: 20, marginBottom: 10 }, loadingText: { color: '#64748b', textAlign: 'center', marginVertical: 12 },
  homeWrap: { paddingTop: 88, gap: 22 }, homeCard: { minHeight: 150, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 30, padding: 22, gap: 16, borderWidth: 1, borderColor: '#edf2f7', elevation: 3 }, homeIconBox: { width: 92, height: 92, borderRadius: 26, backgroundColor: '#eef5ff', alignItems: 'center', justifyContent: 'center' }, homeEmoji: { fontSize: 48 }, homeTextBlock: { flex: 1 }, homeTitle: { color: '#0f172a', fontSize: 25, fontWeight: '900', textAlign: 'right' }, homeSubtitle: { color: '#64748b', fontSize: 14, textAlign: 'right', marginTop: 7, lineHeight: 22 }, homeCount: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 8, fontWeight: '800' }, chevron: { color: '#315b8a', fontSize: 38 },
  pageTitle: { color: '#0f172a', fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 70 }, pageSubtitle: { color: '#7c8ca3', fontSize: 15, textAlign: 'center', marginTop: 9, marginBottom: 24 },
  bankGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, bankTile: { width: '48%', minHeight: 150, backgroundColor: '#fff', borderRadius: 27, alignItems: 'center', justifyContent: 'center', padding: 14, borderWidth: 1, borderColor: '#edf2f7', elevation: 2 }, bankLogoBox: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#f6f9fd', alignItems: 'center', justifyContent: 'center' }, bankTileName: { color: '#0f172a', fontSize: 18, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  bankHero: { marginTop: 44, backgroundColor: '#fff', borderRadius: 28, padding: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#edf2f7' }, bankHeroLogo: { width: 78, height: 78, borderRadius: 22, backgroundColor: '#f4f7fb', alignItems: 'center', justifyContent: 'center' }, bankHeroText: { flex: 1 }, bankHeroName: { color: '#0f172a', fontSize: 25, fontWeight: '900', textAlign: 'right' }, bankHeroSub: { color: '#94a3b8', fontSize: 13, textAlign: 'right', marginTop: 5 }, editPill: { backgroundColor: '#eef6ff', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }, editPillText: { color: '#1d4ed8', fontWeight: '900' },
  sectionHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' }, sectionAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ee', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }, sectionActionText: { color: '#315b8a', fontWeight: '900', fontSize: 13 },
  secretCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#edf2f7' }, secretRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, marginTop: 8, gap: 12 }, secretLabel: { color: '#64748b', fontSize: 13, fontWeight: '800', textAlign: 'right' }, secretValue: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '800', textAlign: 'left' }, revealButton: { alignSelf: 'flex-start', backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#cffafe', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 }, revealText: { color: '#0e7490', fontWeight: '900', fontSize: 12 }, noLogin: { color: '#94a3b8', textAlign: 'center', paddingVertical: 12 },
  accountsDropdown: { backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e6edf5', overflow: 'hidden', elevation: 2 }, accountsDropdownHeader: { minHeight: 94, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }, accountsDropdownIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#eef5ff', alignItems: 'center', justifyContent: 'center' }, accountsDropdownIconText: { fontSize: 27 }, accountsDropdownText: { flex: 1 }, accountsDropdownTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' }, accountsDropdownSubtitle: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 5 }, accountsDropdownMeta: { alignItems: 'center', gap: 7 }, accountsCountBadge: { backgroundColor: '#eef6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, accountsCountText: { color: '#315b8a', fontSize: 12, fontWeight: '900' }, accountsChevron: { color: '#0f172a', fontSize: 23, fontWeight: '900', lineHeight: 24 }, accountsDropdownBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  bankAccountCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#edf2f7' }, bankAccountNestedCard: { backgroundColor: '#fbfdff', borderColor: '#e2e8f0', borderRadius: 20, elevation: 0 }, bankAccountHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 6 }, bankAccountIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }, bankAccountIconText: { fontSize: 22 }, bankAccountTitleBlock: { flex: 1 }, bankAccountTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' }, bankAccountSubtitle: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 3 }, bankAccountPurpose: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 8 },
  bankAccountCompactCard: { backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 9, borderWidth: 1, borderColor: '#e7edf5' }, bankAccountCompactNested: { marginBottom: 9 }, bankAccountCompactRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, bankAccountCompactLabel: { color: '#64748b', fontSize: 13, fontWeight: '800', textAlign: 'right', minWidth: 78 }, bankAccountCompactValue: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '800', textAlign: 'left' }, bankAccountNumberValue: { flex: 1, color: '#334155', fontSize: 15, fontWeight: '700', textAlign: 'left' }, bankAccountCompactDivider: { height: 1, backgroundColor: '#e8eef5', marginVertical: 3 }, accountRevealButton: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#cffafe', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }, accountRevealText: { color: '#0e7490', fontWeight: '900', fontSize: 12 },
  siteCard: { backgroundColor: '#fff', borderRadius: 26, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: '#edf2f7', elevation: 2 }, siteCardCompact: { elevation: 0, marginBottom: 10 }, siteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, siteActions: { flexDirection: 'row', gap: 6 }, iconAction: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, siteTitleBlock: { flex: 1 }, siteTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' }, siteUrl: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 4 }, siteIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#eef5ff', alignItems: 'center', justifyContent: 'center' }, siteIconText: { fontSize: 25 },
  cardBox: { backgroundColor: '#fff', borderRadius: 25, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#edf2f7' }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitleBlock: { flex: 1 }, cardName: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' }, cardBrand: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 4 }, networkBadge: { minWidth: 54, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, visaBadge: { backgroundColor: '#153b8c' }, mcBadge: { backgroundColor: '#ef4444' }, madaBadge: { backgroundColor: '#0f766e' }, networkWhite: { color: '#fff', fontWeight: '900', fontSize: 12 }, specGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12, gap: 8 }, spec: { width: '48%', backgroundColor: '#f8fafc', borderRadius: 14, padding: 11, borderWidth: 1, borderColor: '#edf2f7' }, specLabel: { color: '#94a3b8', fontSize: 11, textAlign: 'right' }, specValue: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right', marginTop: 5 }, lastFour: { color: '#64748b', textAlign: 'right', marginTop: 10, fontSize: 12 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#edf2f7' }, emptyText: { color: '#94a3b8', textAlign: 'center', lineHeight: 22 }, deleteBankButton: { marginTop: 28, alignSelf: 'center', backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 }, deleteBankText: { color: '#be123c', fontWeight: '900' },
  cardFormCompact: { gap: 2 }, fixedBankBoxCompact: { paddingVertical: 8, marginBottom: 4 }, compactChoiceRow: { flexDirection: 'row-reverse', gap: 10, alignItems: 'flex-start' }, compactChoiceBlock: { flex: 1 }, segmentedWrap: { flexDirection: 'row-reverse', backgroundColor: '#eef2f7', borderRadius: 15, padding: 3, gap: 3 }, segmentedChip: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, segmentedChipActive: { backgroundColor: '#0f172a' }, segmentedText: { color: '#334155', fontWeight: '900', fontSize: 13 }, segmentedTextActive: { color: '#fff' }, compactPanel: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 11, marginTop: 8 }, compactPanelTitle: { color: '#334155', fontWeight: '900', fontSize: 13, textAlign: 'right', marginBottom: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'flex-end' }, modalSheet: { maxHeight: '90%', backgroundColor: '#f8fafc', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 8 }, modalHandle: { width: 46, height: 5, borderRadius: 999, backgroundColor: '#cbd5e1', alignSelf: 'center', marginTop: 4 }, modalContent: { padding: 20, paddingBottom: 40 }, formTitle: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right', marginBottom: 12 }, formInputWrap: { marginTop: 8 }, inputLabel: { color: '#334155', fontWeight: '900', fontSize: 14, textAlign: 'right', marginBottom: 6, marginTop: 4 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ee', borderRadius: 16, padding: 13, color: '#0f172a', fontSize: 15 }, multilineInput: { minHeight: 82, textAlignVertical: 'top' }, securityHint: { color: '#64748b', fontSize: 12, textAlign: 'right', lineHeight: 19, marginTop: 7 }, pickerWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 4 }, pickerChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe3ee', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, pickerChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' }, pickerText: { color: '#334155', fontWeight: '900', fontSize: 13 }, pickerTextActive: { color: '#fff' }, fixedBankBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 17, padding: 11, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }, fixedBankText: { color: '#0f172a', fontWeight: '900', fontSize: 16 }, readOnlyBox: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eef6ff', borderRadius: 15, padding: 12, marginTop: 8 }, readOnlyLabel: { color: '#64748b', fontSize: 12 }, readOnlyValue: { color: '#0f172a', fontWeight: '900' }, twoColumns: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, saveButton: { marginTop: 18, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' }, saveText: { color: '#fff', fontWeight: '900', fontSize: 16 }, cancelButton: { marginTop: 10, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#dbe3ee' }, cancelText: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
});
