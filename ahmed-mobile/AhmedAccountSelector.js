import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentAhmedUserId, setCurrentAhmedUserId } from './ahmedCurrentUser';

export default function AhmedAccountSelector() {
  const [value, setValue] = useState(getCurrentAhmedUserId() || '');
  const [message, setMessage] = useState('');

  const save = () => {
    const id = String(value || '').trim();
    if (!id) {
      setCurrentAhmedUserId(null);
      setMessage('تم الرجوع للحساب الأساسي.');
      return;
    }
    setCurrentAhmedUserId(id);
    setMessage('تم اختيار الحساب رقم ' + id + '.');
  };

  return (
    <View style={{ marginTop: 16, backgroundColor: '#ffffff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' }}>
      <Text style={{ color: '#0f766e', fontWeight: '900', fontSize: 16, textAlign: 'right' }}>اختيار الحساب</Text>
      <Text style={{ color: '#64748b', fontWeight: '800', textAlign: 'right', marginTop: 5, lineHeight: 21 }}>أدخل رقم الحساب المطلوب. كل حساب له مستثمروه وبياناته المستقلة.</Text>
      <View style={{ marginTop: 12, flexDirection: 'row-reverse', gap: 8, width: '100%' }}>
        <TextInput value={value} onChangeText={setValue} keyboardType="number-pad" placeholder="رقم الحساب" placeholderTextColor="#94a3b8" style={{ flex: 1, minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingHorizontal: 12, textAlign: 'right', color: '#0f172a', fontWeight: '800' }} />
        <TouchableOpacity onPress={save} style={{ minWidth: 78, borderRadius: 16, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: '900' }}>حفظ</Text>
        </TouchableOpacity>
      </View>
      {!!message && <Text style={{ color: '#0f766e', fontWeight: '900', textAlign: 'right', marginTop: 9 }}>{message}</Text>}
    </View>
  );
}
