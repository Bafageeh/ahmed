import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const PIN_KEY = 'ahmed_secure_vault_pin';
const categoryOptions = [
  { value: 'banks', label: 'بنوك' },
  { value: 'accounts', label: 'حسابات' },
  { value: 'websites', label: 'مواقع' },
  { value: 'cards', label: 'بطاقات' },
  { value: 'subscriptions', label: 'اشتراكات' },
  { value: 'other', label: 'أخرى' },
];
const typeOptions = [
  { value: 'login', label: 'دخول' },
  { value: 'card', label: 'بطاقة' },
  { value: 'subscription', label: 'اشتراك' },
  { value: 'note', label: 'ملاحظة' },
];
const importanceOptions = [
  { value: 'normal', label: 'عادي' },
  { value: 'important', label: 'مهم' },
  { value: 'very_sensitive', label: 'حساس جدًا' },
];
const emptyForm = {
  owner_group: '',
  category: 'accounts',
  record_type: 'login',
  importance: 'normal',
  is_favorite: false,
  title: '',
  username: '',
  password: '',
  url: '',
  email: '',
  phone: '',
  purpose: '',
  tags: '',
  cardholder_name: '',
  card_brand: '',
  card_number: '',
  card_cvv: '',
  expiry_month: '',
  expiry_year: '',
  security_question: '',
  security_answer: '',
  backup_codes: '',
  notes: '',
};

export default function SecureVaultScreen({ onBack }) {
  const [locked, setLocked] = useState(true);
  const [pinExists, setPinExists] = useState(false);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [revealedId, setRevealedId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const sameCategory = category === 'all' || item.category === category;
      const text = [item.title, item.username, item.url, item.email, item.phone, item.owner_group, item.card_brand, item.card_last_four, item.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return sameCategory && (!q || text.includes(q));
    });
  }, [items, category, search]);

  useEffect(() => {
    checkPin();
  }, []);

  useEffect(() => {
    if (!locked) loadItems();
  }, [locked]);

  useEffect(() => {
    if (!locked && revealedId) {
      const timer = setTimeout(() => setRevealedId(null), 30000);
      return () => clearTimeout(timer);
    }
  }, [locked, revealedId]);

  const checkPin = async () => {
    const saved = await SecureStore.getItemAsync(PIN_KEY);
    setPinExists(Boolean(saved));
    if (!saved) {
      setPinMessage('أنشئ رقمًا سريًا للخزنة أول مرة.');
    }
  };

  const unlockWithPin = async () => {
    const saved = await SecureStore.getItemAsync(PIN_KEY);
    if (!saved) {
      if (newPin.trim().length < 4) return setPinMessage('الرقم السري يجب أن يكون 4 أرقام أو أكثر.');
      await SecureStore.setItemAsync(PIN_KEY, newPin.trim());
      setPinExists(true);
      setLocked(false);
      setPinMessage('تم إنشاء قفل الخزنة.');
      return;
    }
    if (pin.trim() === saved) {
      setLocked(false);
      setPin('');
      setPinMessage('');
    } else {
      setPinMessage('الرقم السري غير صحيح.');
    }
  };

  const unlockWithBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) return setPinMessage('البصمة أو التعرف الحيوي غير مفعّل على هذا الجهاز.');
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'فتح الخزنة الآمنة' });
      if (result.success) setLocked(false);
      else setPinMessage('لم يتم فتح الخزنة بالبصمة.');
    } catch (error) {
      setPinMessage('تعذر استخدام البصمة الآن.');
    }
  };

  const loadItems = async () => {
    setMessage('جاري تحميل الخزنة...');
    try {
      const response = await fetch(`${API_URL}/secure-vault`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'load failed');
      setItems(Array.isArray(json.data) ? json.data : []);
      setMessage('');
    } catch (error) {
      setMessage('تعذر تحميل الخزنة. تأكد من تسجيل الدخول وتشغيل التحديث على السيرفر.');
    }
  };

  const revealItem = async (item) => {
    if (revealedId === item.id) return setRevealedId(null);
    setMessage('جاري إظهار البيانات الحساسة...');
    try {
      const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'reveal failed');
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...json.data } : entry)));
      setRevealedId(item.id);
      setMessage('سيتم إخفاء البيانات الحساسة تلقائيًا بعد 30 ثانية.');
    } catch (error) {
      setMessage('تعذر إظهار البيانات الحساسة.');
    }
  };

  const startAdd = (recordType = 'login') => {
    setEditingId(null);
    setForm({ ...emptyForm, record_type: recordType, category: recordType === 'card' ? 'cards' : 'accounts' });
    setFormOpen(true);
    setMessage('');
  };

  const startEdit = async (item) => {
    let full = item;
    if (revealedId !== item.id) {
      try {
        const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { headers: { Accept: 'application/json' } });
        const json = await response.json();
        if (response.ok) full = json.data;
      } catch (error) {}
    }
    setEditingId(item.id);
    setForm({
      ...emptyForm,
      owner_group: full.owner_group || '',
      category: full.category || 'accounts',
      record_type: full.record_type || 'login',
      importance: full.importance || 'normal',
      is_favorite: Boolean(full.is_favorite),
      title: full.title || '',
      username: full.username || '',
      password: full.password || '',
      url: full.url || '',
      email: full.email || '',
      phone: full.phone || '',
      purpose: full.purpose || '',
      tags: full.tags || '',
      cardholder_name: full.cardholder_name || '',
      card_brand: full.card_brand || '',
      card_number: full.card_number || '',
      card_cvv: full.card_cvv || '',
      expiry_month: full.expiry_month ? String(full.expiry_month) : '',
      expiry_year: full.expiry_year ? String(full.expiry_year) : '',
      security_question: full.security_question || '',
      security_answer: full.security_answer || '',
      backup_codes: full.backup_codes || '',
      notes: full.notes || '',
    });
    setFormOpen(true);
  };

  const saveItem = async () => {
    if (!form.title.trim()) return setMessage('اكتب اسم السجل أولاً.');
    setSaving(true);
    setMessage(editingId ? 'جاري حفظ التعديل...' : 'جاري حفظ السجل...');
    try {
      const payload = {
        ...form,
        is_favorite: Boolean(form.is_favorite),
        expiry_month: form.expiry_month ? Number(form.expiry_month) : null,
        expiry_year: form.expiry_year ? Number(form.expiry_year) : null,
      };
      const response = await fetch(editingId ? `${API_URL}/secure-vault/${editingId}` : `${API_URL}/secure-vault`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'save failed');
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setMessage(editingId ? 'تم تعديل السجل.' : 'تم حفظ السجل.');
      await loadItems();
    } catch (error) {
      setMessage('تعذر حفظ السجل. راجع البيانات أو تأكد من تحديث السيرفر.');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (item) => {
    Alert.alert('حذف من الخزنة', 'هل تريد حذف هذا السجل نهائيًا؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_URL}/secure-vault/${item.id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('delete failed');
            setItems((current) => current.filter((entry) => entry.id !== item.id));
            setMessage('تم حذف السجل.');
          } catch (error) {
            setMessage('تعذر حذف السجل.');
          }
        },
      },
    ]);
  };

  const copyValue = async (label, value) => {
    if (!value) return setMessage(`لا توجد قيمة لنسخ ${label}.`);
    try {
      if (Platform.OS === 'web' && globalThis?.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(String(value));
        setMessage(`تم نسخ ${label}.`);
      } else {
        setMessage(`انسخ ${label} يدويًا من القيمة الظاهرة.`);
      }
    } catch (error) {
      setMessage(`تعذر نسخ ${label}.`);
    }
  };

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (locked) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
          <View style={styles.lockCard}>
            <Text style={styles.lockIcon}>🔐</Text>
            <Text style={styles.title}>الخزنة الآمنة</Text>
            <Text style={styles.subtitle}>بياناتك الحساسة لا تظهر إلا بعد فتح القفل.</Text>
            {pinExists ? (
              <>
                <Text style={styles.inputLabel}>الرقم السري للخزنة</Text>
                <TextInput value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" placeholder="••••" style={styles.input} />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>أنشئ رقمًا سريًا للخزنة</Text>
                <TextInput value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" placeholder="4 أرقام أو أكثر" style={styles.input} />
              </>
            )}
            {!!pinMessage && <Text style={styles.message}>{pinMessage}</Text>}
            <TouchableOpacity style={styles.saveButton} onPress={unlockWithPin}><Text style={styles.saveText}>{pinExists ? 'فتح الخزنة' : 'إنشاء وفتح الخزنة'}</Text></TouchableOpacity>
            {pinExists ? <TouchableOpacity style={styles.secondaryButton} onPress={unlockWithBiometric}><Text style={styles.secondaryText}>فتح بالبصمة</Text></TouchableOpacity> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>رجوع</Text></TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.badge}>🔐 الخزنة</Text>
          <Text style={styles.title}>الخزنة الآمنة</Text>
          <Text style={styles.subtitle}>حسابات، مواقع، بطاقات، CVV، وبيانات حساسة مشفرة.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>إجمالي السجلات</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{items.filter((i) => i.is_favorite).length}</Text><Text style={styles.summaryLabel}>مفضلة</Text></View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => startAdd('login')}><Text style={styles.quickText}>+ حساب</Text></TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => startAdd('card')}><Text style={styles.quickText}>+ بطاقة</Text></TouchableOpacity>
          <TouchableOpacity style={styles.lockSmallButton} onPress={() => { setLocked(true); setRevealedId(null); }}><Text style={styles.lockSmallText}>قفل</Text></TouchableOpacity>
        </View>

        <TextInput value={search} onChangeText={setSearch} placeholder="بحث داخل الخزنة" style={styles.input} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Chip label="الكل" active={category === 'all'} onPress={() => setCategory('all')} />
          {categoryOptions.map((option) => <Chip key={option.value} label={option.label} active={category === option.value} onPress={() => setCategory(option.value)} />)}
        </ScrollView>

        {formOpen ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل سجل' : 'إضافة سجل جديد'}</Text>
            <PickerRow options={typeOptions} value={form.record_type} onChange={(value) => setField('record_type', value)} />
            <PickerRow options={categoryOptions} value={form.category} onChange={(value) => setField('category', value)} />
            <PickerRow options={importanceOptions} value={form.importance} onChange={(value) => setField('importance', value)} />
            <TouchableOpacity style={[styles.favoriteButton, form.is_favorite && styles.favoriteActive]} onPress={() => setField('is_favorite', !form.is_favorite)}><Text style={styles.favoriteText}>{form.is_favorite ? '⭐ مفضل' : '☆ جعله مفضل'}</Text></TouchableOpacity>

            <FormInput label="اسم السجل" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: بطاقة الراجحي / حساب أبشر" />
            <FormInput label="تابع لمن" value={form.owner_group} onChangeText={(value) => setField('owner_group', value)} placeholder="أحمد، سارة، عمل، عائلة" />
            <FormInput label="اسم المستخدم" value={form.username} onChangeText={(value) => setField('username', value)} />
            <FormInput label="كلمة المرور" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry />
            <FormInput label="الرابط" value={form.url} onChangeText={(value) => setField('url', value)} />
            <FormInput label="الإيميل المرتبط" value={form.email} onChangeText={(value) => setField('email', value)} />
            <FormInput label="الجوال المرتبط" value={form.phone} onChangeText={(value) => setField('phone', value)} />
            <FormInput label="الغرض" value={form.purpose} onChangeText={(value) => setField('purpose', value)} placeholder="اشتراكات، سفر، مشتريات" />
            <FormInput label="وسوم" value={form.tags} onChangeText={(value) => setField('tags', value)} placeholder="بنكي، حكومي، استثمار" />

            <Text style={styles.subFormTitle}>بيانات البطاقة</Text>
            <FormInput label="اسم حامل البطاقة" value={form.cardholder_name} onChangeText={(value) => setField('cardholder_name', value)} />
            <FormInput label="البنك / نوع البطاقة" value={form.card_brand} onChangeText={(value) => setField('card_brand', value)} placeholder="مدى، Visa، الراجحي" />
            <FormInput label="رقم البطاقة كامل" value={form.card_number} onChangeText={(value) => setField('card_number', value)} keyboardType="number-pad" secureTextEntry />
            <View style={styles.twoCols}>
              <View style={styles.col}><FormInput label="CVV" value={form.card_cvv} onChangeText={(value) => setField('card_cvv', value)} keyboardType="number-pad" secureTextEntry /></View>
              <View style={styles.col}><FormInput label="شهر الانتهاء" value={form.expiry_month} onChangeText={(value) => setField('expiry_month', value)} keyboardType="number-pad" placeholder="MM" /></View>
              <View style={styles.col}><FormInput label="سنة الانتهاء" value={form.expiry_year} onChangeText={(value) => setField('expiry_year', value)} keyboardType="number-pad" placeholder="YYYY" /></View>
            </View>

            <Text style={styles.subFormTitle}>بيانات استرداد</Text>
            <FormInput label="سؤال الأمان" value={form.security_question} onChangeText={(value) => setField('security_question', value)} />
            <FormInput label="إجابة الأمان" value={form.security_answer} onChangeText={(value) => setField('security_answer', value)} secureTextEntry />
            <FormInput label="Backup Codes" value={form.backup_codes} onChangeText={(value) => setField('backup_codes', value)} multiline />
            <FormInput label="ملاحظات" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline />

            {!!message && <Text style={styles.message}>{message}</Text>}
            <TouchableOpacity style={styles.saveButton} onPress={saveItem} disabled={saving}><Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); }}><Text style={styles.secondaryText}>إلغاء</Text></TouchableOpacity>
          </View>
        ) : null}

        {!!message && !formOpen ? <Text style={styles.message}>{message}</Text> : null}
        <Text style={styles.sectionTitle}>السجلات</Text>
        {filtered.length === 0 ? (
          <View style={styles.platformCard}><Text style={styles.platformName}>لا توجد سجلات</Text><Text style={styles.platformText}>أضف حسابًا أو بطاقة من الأعلى.</Text></View>
        ) : filtered.map((item) => (
          <VaultCard
            key={String(item.id)}
            item={item}
            revealed={revealedId === item.id}
            onReveal={() => revealItem(item)}
            onEdit={() => startEdit(item)}
            onDelete={() => deleteItem(item)}
            onCopy={copyValue}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function VaultCard({ item, revealed, onReveal, onEdit, onDelete, onCopy }) {
  const cardNumber = revealed ? item.card_number : maskCard(item.card_last_four);
  const password = revealed ? item.password : item.has_password ? '••••••••' : '';
  const cvv = revealed ? item.card_cvv : item.has_card_cvv ? '•••' : '';
  return (
    <View style={[styles.vaultCard, item.importance === 'very_sensitive' && styles.sensitiveCard]}>
      <View style={styles.cardTopRow}>
        <Text style={styles.star}>{item.is_favorite ? '⭐' : ' '}</Text>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.platformName}>{item.title}</Text>
          <Text style={styles.platformText}>{item.category_label} • {item.record_type_label} • {item.importance_label}</Text>
          {item.owner_group ? <Text style={styles.platformText}>تابع: {item.owner_group}</Text> : null}
        </View>
      </View>

      <SecretRow label="اليوزر" value={item.username} onCopy={() => onCopy('اليوزر', item.username)} />
      <SecretRow label="كلمة المرور" value={password} onCopy={() => onCopy('كلمة المرور', item.password)} />
      <SecretRow label="رقم البطاقة" value={cardNumber} onCopy={() => onCopy('رقم البطاقة', item.card_number)} />
      <SecretRow label="CVV" value={cvv} onCopy={() => onCopy('CVV', item.card_cvv)} />
      {item.card_brand || item.expiry_month || item.expiry_year ? <Text style={styles.platformText}>البطاقة: {item.card_brand || '-'} • الانتهاء: {item.expiry_month || '--'}/{item.expiry_year || '----'}</Text> : null}
      {revealed && item.notes ? <Text style={styles.notesText}>ملاحظات: {item.notes}</Text> : null}

      <View style={styles.iconActionsRow}>
        <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'إظهار'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function SecretRow({ label, value, onCopy }) {
  if (!value) return null;
  return (
    <View style={styles.secretRow}>
      <TouchableOpacity style={styles.copyMini} onPress={onCopy}><Text style={styles.copyMiniText}>نسخ</Text></TouchableOpacity>
      <Text style={styles.secretValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.secretLabel}>{label}</Text>
    </View>
  );
}

function FormInput({ label, value, onChangeText, multiline, ...props }) {
  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.notesInput]}
        textAlign="right"
        multiline={multiline}
        {...props}
      />
    </>
  );
}

function PickerRow({ options, value, onChange }) {
  return (
    <View style={styles.filterRowWrap}>
      {options.map((option) => <Chip key={option.value} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />)}
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function maskCard(lastFour) {
  return lastFour ? `•••• •••• •••• ${lastFour}` : '';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  container: { padding: 18, paddingBottom: 36 },
  backButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  backText: { color: '#0f172a', fontWeight: '900' },
  header: { marginTop: 18, backgroundColor: '#fff', borderRadius: 28, padding: 24 },
  lockCard: { marginTop: 24, backgroundColor: '#fff', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  lockIcon: { fontSize: 48, textAlign: 'center' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#eef6ff', color: '#075985', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '800' },
  title: { marginTop: 16, fontSize: 32, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  subtitle: { marginTop: 8, color: '#475569', fontSize: 16, textAlign: 'right' },
  summaryRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryValue: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  summaryLabel: { marginTop: 5, color: '#64748b', textAlign: 'right' },
  actionsRow: { marginTop: 14, flexDirection: 'row-reverse', gap: 8 },
  quickButton: { flex: 1, backgroundColor: '#0f172a', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  quickText: { color: '#fff', fontWeight: '900' },
  lockSmallButton: { backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13 },
  lockSmallText: { color: '#be123c', fontWeight: '900' },
  inputLabel: { color: '#334155', fontWeight: '800', textAlign: 'right', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, textAlign: 'right', color: '#0f172a', marginTop: 8 },
  notesInput: { minHeight: 78, textAlignVertical: 'top' },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 12 },
  filterRowWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#334155', fontWeight: '900' },
  chipTextActive: { color: '#fff' },
  formCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 14 },
  subFormTitle: { marginTop: 18, color: '#075985', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  favoriteButton: { marginVertical: 8, alignSelf: 'flex-end', backgroundColor: '#f8fafc', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  favoriteActive: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  favoriteText: { color: '#0f172a', fontWeight: '900' },
  twoCols: { flexDirection: 'row-reverse', gap: 8 },
  col: { flex: 1 },
  message: { marginTop: 12, color: '#075985', textAlign: 'right', fontWeight: '800' },
  saveButton: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryButton: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  sectionTitle: { marginTop: 20, marginBottom: 10, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  platformCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  platformName: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  platformText: { marginTop: 5, color: '#64748b', textAlign: 'right' },
  vaultCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  sensitiveCard: { borderColor: '#fecaca', backgroundColor: '#fffafa' },
  cardTopRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
  star: { fontSize: 18 },
  cardTitleBlock: { flex: 1 },
  secretRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10 },
  secretLabel: { color: '#64748b', fontWeight: '900', minWidth: 78, textAlign: 'right' },
  secretValue: { flex: 1, color: '#0f172a', fontWeight: '900', textAlign: 'right' },
  copyMini: { backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  copyMiniText: { color: '#075985', fontWeight: '900', fontSize: 12 },
  notesText: { marginTop: 10, color: '#334155', textAlign: 'right', lineHeight: 22 },
  iconActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  revealButton: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#cffafe' },
  revealText: { color: '#0e7490', fontWeight: '900' },
  editButton: { flex: 1, backgroundColor: '#eef6ff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  editText: { color: '#1d4ed8', fontWeight: '900' },
  deleteButton: { flex: 1, backgroundColor: '#fff1f2', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3' },
  deleteText: { color: '#be123c', fontWeight: '900' },
});
