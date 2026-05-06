import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './ta3meedStyles';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

export function Ta3meedFinishedImport({ onImported, onBack }) {
  const [text, setText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const importFinished = async () => {
    if (!text.trim()) {
      setMessage('الصق بيانات الاستثمارات المنتهية أولًا');
      return;
    }

    setBusy(true);
    setMessage('جاري استيراد الاستثمارات المنتهية...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/import-finished`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ text, replace_existing: replaceExisting }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'import failed');

      const result = json.data || {};
      setMessage(`تم الاستيراد: قراءة ${result.parsed || 0}، إضافة ${result.created || 0}، تحديث ${result.updated || 0}`);
      setText('');
      onImported?.();
    } catch {
      setMessage('تعذر استيراد الاستثمارات. تأكد من لصق الجدول كاملًا كما هو.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.finishedImportCard}>
      <View style={styles.finishedImportHeader}>
        <TouchableOpacity style={styles.investorAccountBackButton} onPress={onBack} activeOpacity={0.84}>
          <Text style={styles.investorAccountBackText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.finishedImportTitle}>استيراد استثمارات تعميد المنتهية</Text>
      </View>

      <Text style={styles.finishedImportHint}>
        الصق بيانات جدول الاستثمارات المنتهية كما هي، وسيتم إدخالها بحالة مستلم/منتهي مع توزيع مبالغ المستثمرين والأرباح والتواريخ.
      </Text>

      {!!message && <Text style={styles.message}>{message}</Text>}

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={'الكود\nاحمد\nسارة\nالمبنى\nامال\n...\nQBJM848\n5,000\n6\n18.24\n456.00\nC\n17-01-2024\n17-07-2024\n21-07-2024'}
        placeholderTextColor="#94a3b8"
        style={styles.finishedImportInput}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.replaceToggleRow} onPress={() => setReplaceExisting((value) => !value)} activeOpacity={0.84}>
        <View style={[styles.replaceToggleBox, replaceExisting && styles.replaceToggleBoxActive]}>
          <Text style={styles.replaceToggleCheck}>{replaceExisting ? '✓' : ''}</Text>
        </View>
        <Text style={styles.replaceToggleText}>تحديث الاستثمار إذا كان الكود موجودًا مسبقًا</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.investorPaymentButton, busy && styles.disabledAction]} onPress={importFinished} disabled={busy} activeOpacity={0.84}>
        <Text style={styles.investorPaymentButtonText}>{busy ? 'جاري الاستيراد...' : 'استيراد الاستثمارات المنتهية'}</Text>
      </TouchableOpacity>
    </View>
  );
}
