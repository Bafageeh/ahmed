import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppShell from './AppShell';
import { getCurrentAhmedUserId, setCurrentAhmedUserId } from './ahmedCurrentUser';

export default function AppShellWithAccountSelector() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getCurrentAhmedUserId() || '');
  const [label, setLabel] = useState(getCurrentAhmedUserId() ? `حساب ${getCurrentAhmedUserId()}` : 'الحساب الأساسي');

  const save = () => {
    const id = String(value || '').trim();
    setCurrentAhmedUserId(id || null);
    setLabel(id ? `حساب ${id}` : 'الحساب الأساسي');
    setOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppShell />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 42, left: 14, right: 14, alignItems: 'flex-start' }}>
        {open ? (
          <View style={{ width: 220, backgroundColor: '#ffffff', borderRadius: 22, padding: 12, borderWidth: 1, borderColor: '#dbe3ea', shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 14 }}>
            <Text style={{ color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 8 }}>اختيار الحساب</Text>
            <TextInput value={value} onChangeText={setValue} keyboardType="number-pad" placeholder="رقم الحساب" placeholderTextColor="#94a3b8" style={{ minHeight: 42, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, textAlign: 'right', color: '#0f172a', fontWeight: '800' }} />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 9 }}>
              <TouchableOpacity onPress={save} style={{ flex: 1, minHeight: 38, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900' }}>حفظ</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ flex: 1, minHeight: 38, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#475569', fontWeight: '900' }}>إغلاق</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setOpen(true)} style={{ minHeight: 38, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#0f766e', fontWeight: '900', fontSize: 12 }}>{label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
