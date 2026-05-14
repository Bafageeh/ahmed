import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppShell from './AppShell';
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
      lastMessage = json.message || `تعذر الوصول إلى ${path}`;
      if (response.status !== 404) break;
    } catch (error) {
      lastMessage = error.message || 'تعذر الاتصال بالسيرفر';
    }
  }
  throw new Error(lastMessage || 'تعذر تحميل المستخدمين. قد يحتاج السيرفر لتحديث الراوتات.');
}

export default function AppShellWithAccountSelector() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedId, setSelectedId] = useState(getCurrentAhmedUserId() || '');
  const [label, setLabel] = useState(getCurrentAhmedUserId() ? `حساب ${getCurrentAhmedUserId()}` : 'الحساب الأساسي');
  const [message, setMessage] = useState('');

  const choose = (id, displayName) => {
    const cleanId = id ? String(id) : '';
    setCurrentAhmedUserId(cleanId || null);
    setSelectedId(cleanId);
    setLabel(cleanId ? (displayName || `حساب ${cleanId}`) : 'الحساب الأساسي');
    setMessage(cleanId ? 'تم اختيار الحساب.' : 'تم اختيار الحساب الأساسي.');
  };

  const loadUsers = async () => {
    try {
      const json = await userApi('GET');
      const list = Array.isArray(json.data) ? json.data : [];
      setUsers(list);
      const current = getCurrentAhmedUserId();
      const found = list.find((user) => String(user.id) === String(current));
      if (found) {
        setSelectedId(String(found.id));
        setLabel(found.name || `حساب ${found.id}`);
      } else if (!current && list[0]) {
        choose(list[0].id, list[0].name);
      }
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل المستخدمين');
    }
  };

  const addUser = async () => {
    const cleanName = String(name || '').trim();
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();
    if (!cleanName) return setMessage('أدخل اسم المستخدم الظاهر.');
    if (!cleanUsername) return setMessage('أدخل اسم الدخول.');
    if (!cleanPassword) return setMessage('أدخل الرقم السري.');
    try {
      const json = await userApi('POST', { name: cleanName, username: cleanUsername, password: cleanPassword });
      setName('');
      setUsername('');
      setPassword('');
      if (json.data?.id) choose(json.data.id, json.data.name);
      await loadUsers();
      setMessage('تم إنشاء المستخدم واختياره.');
    } catch (error) {
      setMessage(error.message || 'تعذر إنشاء المستخدم');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <AppShell />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 42, left: 14, right: 14, alignItems: 'flex-start' }}>
        {open ? (
          <View style={{ width: 310, maxHeight: 540, backgroundColor: '#ffffff', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#dbe3ea', shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 14 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 16 }}>إدارة المستخدمين</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ minWidth: 64, minHeight: 34, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#475569', fontWeight: '900' }}>إغلاق</Text></TouchableOpacity>
            </View>
            <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', lineHeight: 20 }}>كل مستخدم مستقل تمامًا وله اسم دخول ورقم سري وبياناته الخاصة.</Text>
            <View style={{ marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 18, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right', marginBottom: 8 }}>إضافة مستخدم جديد</Text>
              <TextInput value={name} onChangeText={setName} placeholder="الاسم الظاهر" placeholderTextColor="#94a3b8" style={{ minHeight: 42, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, textAlign: 'right', color: '#0f172a', fontWeight: '800' }} />
              <TextInput value={username} onChangeText={setUsername} placeholder="اسم الدخول" placeholderTextColor="#94a3b8" autoCapitalize="none" style={{ marginTop: 8, minHeight: 42, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, textAlign: 'right', color: '#0f172a', fontWeight: '800' }} />
              <TextInput value={password} onChangeText={setPassword} placeholder="الرقم السري" placeholderTextColor="#94a3b8" secureTextEntry style={{ marginTop: 8, minHeight: 42, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, textAlign: 'right', color: '#0f172a', fontWeight: '800' }} />
              <TouchableOpacity onPress={addUser} style={{ marginTop: 9, minHeight: 40, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontWeight: '900' }}>إنشاء المستخدم</Text></TouchableOpacity>
            </View>
            <Text style={{ color: '#0f172a', fontWeight: '900', textAlign: 'right', marginTop: 12, marginBottom: 8 }}>المستخدمون</Text>
            <ScrollView style={{ maxHeight: 210 }} showsVerticalScrollIndicator={false}>
              {users.map((user) => {
                const active = String(user.id) === String(selectedId);
                return (
                  <TouchableOpacity key={user.id} onPress={() => choose(user.id, user.name)} style={{ marginBottom: 8, padding: 11, borderRadius: 16, backgroundColor: active ? '#ecfdf5' : '#f8fafc', borderWidth: 1, borderColor: active ? '#99f6e4' : '#e2e8f0', alignItems: 'flex-end' }}>
                    <Text style={{ color: active ? '#0f766e' : '#0f172a', fontWeight: '900', textAlign: 'right' }}>{user.name}</Text>
                    <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>اسم الدخول: {user.username || '-'}</Text>
                    <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 3 }}>رقم الحساب: {user.id}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={loadUsers} style={{ minHeight: 38, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}><Text style={{ color: '#1d4ed8', fontWeight: '900' }}>تحديث القائمة</Text></TouchableOpacity>
            {!!message && <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right', marginTop: 9 }}>{message}</Text>}
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setOpen(true); loadUsers(); }} style={{ minHeight: 38, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#0f766e', fontWeight: '900', fontSize: 12 }}>{label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
