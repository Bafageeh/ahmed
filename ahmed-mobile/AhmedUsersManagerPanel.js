import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentAhmedUserId, setCurrentAhmedUserId } from './ahmedCurrentUser';

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

export default function AhmedUsersManagerPanel() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(getCurrentAhmedUserId() || '');
  const [message, setMessage] = useState('');

  const choose = (id) => {
    const cleanId = id ? String(id) : '';
    setCurrentAhmedUserId(cleanId || null);
    setSelectedId(cleanId);
    setMessage('تم اختيار الحساب.');
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setEditingId(null);
  };

  const logout = () => {
    setCurrentAhmedUserId(null);
    setSelectedId('');
    setMessage('تم تسجيل الخروج. اختر مستخدمًا للدخول مرة أخرى.');
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
      const list = Array.isArray(json.data) ? json.data : [];
      setUsers(list);
      const current = getCurrentAhmedUserId();
      const found = list.find((user) => String(user.id) === String(current));
      if (found) setSelectedId(String(found.id));
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
      const json = editingId
        ? await userApi('PUT', payload, editingId)
        : await userApi('POST', payload);
      if (json.data?.id) choose(json.data.id);
      resetForm();
      await loadUsers();
      setMessage(editingId ? 'تم تعديل المستخدم.' : 'تم إنشاء المستخدم واختياره.');
    } catch (error) {
      setMessage(error.message || (editingId ? 'تعذر تعديل المستخدم' : 'تعذر إنشاء المستخدم'));
    }
  };

  useEffect(() => { loadUsers(); }, []);

  return (
    <View style={{ marginTop: 16, backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
      <View style={{ padding: 16, alignItems: 'flex-end', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 19, textAlign: 'right' }}>إدارة المستخدمين</Text>
        <Text style={{ marginTop: 5, color: '#64748b', fontWeight: '800', lineHeight: 21, textAlign: 'right' }}>كل مستخدم مستقل تمامًا ويمكن تعديل اسمه واسم الدخول والرقم السري.</Text>
      </View>

      <View style={{ padding: 14, alignItems: 'flex-end' }}>
        <View style={{ width: '100%', backgroundColor: selectedId ? '#ecfdf5' : '#fff7ed', borderRadius: 18, borderWidth: 1, borderColor: selectedId ? '#99f6e4' : '#fed7aa', padding: 12, marginBottom: 12, alignItems: 'flex-end' }}>
          <Text style={{ color: selectedId ? '#0f766e' : '#c2410c', fontWeight: '900', textAlign: 'right' }}>{selectedId ? `الحساب الحالي رقم ${selectedId}` : 'لا يوجد حساب محدد حاليًا'}</Text>
          <TouchableOpacity onPress={logout} style={{ marginTop: 9, minHeight: 38, borderRadius: 14, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Text style={{ color: '#be123c', fontWeight: '900' }}>خروج</Text>
          </TouchableOpacity>
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
            const active = String(user.id) === String(selectedId);
            return (
              <View key={user.id} style={{ marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: active ? '#ecfdf5' : '#f8fafc', borderWidth: 1, borderColor: active ? '#99f6e4' : '#e2e8f0', alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={() => choose(user.id)} style={{ width: '100%', alignItems: 'flex-end' }}>
                  <Text style={{ color: active ? '#0f766e' : '#0f172a', fontWeight: '900', textAlign: 'right' }}>{user.name}</Text>
                  <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>اسم الدخول: {user.username || '-'}</Text>
                  <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>رقم الحساب: {user.id}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => startEdit(user)} style={{ marginTop: 9, minHeight: 34, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
                  <Text style={{ color: '#1d4ed8', fontWeight: '900' }}>تعديل</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={loadUsers} style={{ minHeight: 38, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginTop: 8, width: '100%' }}><Text style={{ color: '#1d4ed8', fontWeight: '900' }}>تحديث القائمة</Text></TouchableOpacity>
        {!!message && <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right', marginTop: 9 }}>{message}</Text>}
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
