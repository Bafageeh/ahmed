import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const USER_PATHS = ['/ahmed/users', '/users', '/accounts'];

async function userApi(method = 'GET', payload = null, id = null) {
  let lastMessage = '';
  for (const basePath of USER_PATHS) {
    const path = id ? `${basePath}/${id}` : basePath;
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const json = await response.json().catch(() => ({}));
      if (response.ok) return json;
      lastMessage = json.message || 'تعذر تحميل المستخدمين';
      if (response.status !== 404) break;
    } catch (error) {
      lastMessage = error.message || 'تعذر الاتصال بالسيرفر';
    }
  }
  throw new Error(lastMessage || 'تعذر تحميل المستخدمين');
}

export default function AhmedUsersManagerPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setEditingId(null);
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setName(user.name || '');
    setUsername(user.username || '');
    setPassword('');
    setMessage('اكتب الرقم السري فقط إذا أردت تغييره.');
  };

  const loadUsers = async () => {
    try {
      const json = await userApi('GET');
      setUsers(Array.isArray(json.data) ? json.data : []);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل المستخدمين');
    }
  };

  const saveUser = async () => {
    const cleanName = String(name || '').trim();
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();
    if (!cleanName) return setMessage('أدخل الاسم الظاهر.');
    if (!cleanUsername) return setMessage('أدخل اسم الدخول.');
    if (!editingId && !cleanPassword) return setMessage('أدخل الرقم السري.');
    try {
      const payload = { name: cleanName, username: cleanUsername };
      if (cleanPassword) payload.password = cleanPassword;
      await (editingId ? userApi('PUT', payload, editingId) : userApi('POST', payload));
      resetForm();
      await loadUsers();
      setMessage(editingId ? 'تم تعديل المستخدم. إذا تغير رقمه السري فسيحتاج لتسجيل دخول جديد.' : 'تم إنشاء المستخدم.');
    } catch (error) {
      setMessage(error.message || (editingId ? 'تعذر تعديل المستخدم' : 'تعذر إنشاء المستخدم'));
    }
  };

  useEffect(() => { loadUsers(); }, []);

  return (
    <View style={{ marginTop: 16, backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
      <View style={{ padding: 16, alignItems: 'flex-end', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 19, textAlign: 'right' }}>إدارة المستخدمين</Text>
        <Text style={{ marginTop: 5, color: '#64748b', fontWeight: '800', lineHeight: 21, textAlign: 'right' }}>هذه الشاشة للمدير فقط. لا يوجد تبديل حسابات؛ كل حساب يدخل بكلمة مروره وجلسة مستقلة.</Text>
      </View>

      <View style={{ padding: 14, alignItems: 'flex-end' }}>
        <View style={{ width: '100%', backgroundColor: '#ecfdf5', borderRadius: 18, borderWidth: 1, borderColor: '#99f6e4', padding: 12, marginBottom: 12, alignItems: 'flex-end' }}>
          <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right' }}>المدير الحالي: {currentUser?.name || '-'}</Text>
          <Text style={{ color: '#0f172a', fontWeight: '800', textAlign: 'right', marginTop: 4 }}>لا يمكن فتح بيانات مستخدم آخر من هنا.</Text>
        </View>

        <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right', marginBottom: 8 }}>{editingId ? `تعديل المستخدم رقم ${editingId}` : 'إضافة مستخدم جديد'}</Text>
        <TextInput value={name} onChangeText={setName} placeholder="الاسم الظاهر" placeholderTextColor="#94a3b8" style={inputStyle} />
        <TextInput value={username} onChangeText={setUsername} placeholder="اسم الدخول" placeholderTextColor="#94a3b8" autoCapitalize="none" style={[inputStyle, { marginTop: 8 }]} />
        <TextInput value={password} onChangeText={setPassword} placeholder={editingId ? 'رقم سري جديد اختياري' : 'الرقم السري'} placeholderTextColor="#94a3b8" secureTextEntry style={[inputStyle, { marginTop: 8 }]} />
        <TouchableOpacity onPress={saveUser} style={{ marginTop: 9, minHeight: 42, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', width: '100%' }}><Text style={{ color: '#ffffff', fontWeight: '900' }}>{editingId ? 'حفظ التعديل' : 'إنشاء المستخدم'}</Text></TouchableOpacity>
        {editingId ? <TouchableOpacity onPress={resetForm} style={{ marginTop: 8, minHeight: 38, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', width: '100%' }}><Text style={{ color: '#475569', fontWeight: '900' }}>إلغاء التعديل</Text></TouchableOpacity> : null}

        <Text style={{ color: '#0f172a', fontWeight: '900', textAlign: 'right', marginTop: 16, marginBottom: 8 }}>المستخدمون</Text>
        <ScrollView style={{ maxHeight: 240, width: '100%' }} showsVerticalScrollIndicator={false}>
          {users.map((user) => {
            const active = Number(user.id) === Number(currentUser?.id);
            return (
              <View key={user.id} style={{ marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: active ? '#ecfdf5' : '#f8fafc', borderWidth: 1, borderColor: active ? '#99f6e4' : '#e2e8f0', alignItems: 'flex-end' }}>
                <Text style={{ color: active ? '#0f766e' : '#0f172a', fontWeight: '900', textAlign: 'right' }}>{user.name}</Text>
                <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>اسم الدخول: {user.username || '-'}</Text>
                <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>رقم الحساب: {user.id}</Text>
                <Text style={{ color: user.is_admin ? '#0f766e' : '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>{user.is_admin ? 'مدير' : 'مستخدم'}</Text>
                <TouchableOpacity onPress={() => startEdit(user)} style={{ marginTop: 9, minHeight: 34, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
                  <Text style={{ color: '#1d4ed8', fontWeight: '900' }}>تعديل</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={loadUsers} style={{ minHeight: 38, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginTop: 8, width: '100%' }}><Text style={{ color: '#1d4ed8', fontWeight: '900' }}>تحديث القائمة</Text></TouchableOpacity>
        {!!message && <Text style={{ color: message.includes('تعذر') ? '#be123c' : '#0f766e', fontWeight: '900', textAlign: 'right', marginTop: 9 }}>{message}</Text>}
      </View>
    </View>
  );
}

const inputStyle = {
  minHeight: 42,
  borderRadius: 14,
  backgroundColor: '#f8fafc',
  borderWidth: 1,
  borderColor: '#e2e8f0',
  paddingHorizontal: 10,
  textAlign: 'right',
  color: '#0f172a',
  fontWeight: '800',
  width: '100%',
};
