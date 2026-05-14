import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentAhmedUserId, setCurrentAhmedUserId } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const USER_PATHS = ['/ahmed/users', '/users', '/accounts'];

async function userApi(method = 'GET', payload = null) {
  let lastMessage = '';
  for (const path of USER_PATHS) {
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
  const [selectedId, setSelectedId] = useState(getCurrentAhmedUserId() || '');
  const [message, setMessage] = useState('');

  const choose = (id) => {
    const cleanId = id ? String(id) : '';
    setCurrentAhmedUserId(cleanId || null);
    setSelectedId(cleanId);
    setMessage('تم اختيار الحساب.');
  };

  const loadUsers = async () => {
    try {
      const json = await userApi('GET');
      const list = Array.isArray(json.data) ? json.data : [];
      setUsers(list);
      const current = getCurrentAhmedUserId();
      const found = list.find((user) => String(user.id) === String(current));
      if (found) setSelectedId(String(found.id));
      if (!current && list[0]?.id) choose(list[0].id);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل المستخدمين');
    }
  };

  const addUser = async () => {
    const cleanName = String(name || '').trim();
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();
    if (!cleanName) return setMessage('أدخل الاسم الظاهر.');
    if (!cleanUsername) return setMessage('أدخل اسم الدخول.');
    if (!cleanPassword) return setMessage('أدخل الرقم السري.');
    try {
      const json = await userApi('POST', { name: cleanName, username: cleanUsername, password: cleanPassword });
      setName('');
      setUsername('');
      setPassword('');
      if (json.data?.id) choose(json.data.id);
      await loadUsers();
      setMessage('تم إنشاء المستخدم واختياره.');
    } catch (error) {
      setMessage(error.message || 'تعذر إنشاء المستخدم');
    }
  };

  useEffect(() => { loadUsers(); }, []);

  return (
    <View style={{ marginTop: 16, backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
      <View style={{ padding: 16, alignItems: 'flex-end', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 19, textAlign: 'right' }}>إدارة المستخدمين</Text>
        <Text style={{ marginTop: 5, color: '#64748b', fontWeight: '800', lineHeight: 21, textAlign: 'right' }}>كل مستخدم مستقل تمامًا وله اسم دخول ورقم سري وبياناته الخاصة.</Text>
      </View>

      <View style={{ padding: 14, alignItems: 'flex-end' }}>
        <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right', marginBottom: 8 }}>إضافة مستخدم جديد</Text>
        <TextInput value={name} onChangeText={setName} placeholder="الاسم الظاهر" placeholderTextColor="#94a3b8" style={inputStyle} />
        <TextInput value={username} onChangeText={setUsername} placeholder="اسم الدخول" placeholderTextColor="#94a3b8" autoCapitalize="none" style={[inputStyle, { marginTop: 8 }]} />
        <TextInput value={password} onChangeText={setPassword} placeholder="الرقم السري" placeholderTextColor="#94a3b8" secureTextEntry style={[inputStyle, { marginTop: 8 }]} />
        <TouchableOpacity onPress={addUser} style={{ marginTop: 9, minHeight: 42, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', width: '100%' }}><Text style={{ color: '#ffffff', fontWeight: '900' }}>إنشاء المستخدم</Text></TouchableOpacity>

        <Text style={{ color: '#0f172a', fontWeight: '900', textAlign: 'right', marginTop: 16, marginBottom: 8 }}>المستخدمون</Text>
        <ScrollView style={{ maxHeight: 240, width: '100%' }} showsVerticalScrollIndicator={false}>
          {users.map((user) => {
            const active = String(user.id) === String(selectedId);
            return (
              <TouchableOpacity key={user.id} onPress={() => choose(user.id)} style={{ marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: active ? '#ecfdf5' : '#f8fafc', borderWidth: 1, borderColor: active ? '#99f6e4' : '#e2e8f0', alignItems: 'flex-end' }}>
                <Text style={{ color: active ? '#0f766e' : '#0f172a', fontWeight: '900', textAlign: 'right' }}>{user.name}</Text>
                <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>اسم الدخول: {user.username || '-'}</Text>
                <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>رقم الحساب: {user.id}</Text>
              </TouchableOpacity>
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
