import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ta3meedScreen from './Ta3meedScreen';
import UiIcon, { ICON_COLOR } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

export default function Ta3meedChromeFixedScreen(props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const parseReceipt = async () => {
    if (!receiptMessage.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setMessage('جاري تحليل الرسالة...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/receipts/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: receiptMessage }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'parse failed');
      setReceiptPreview(json.data);
      setMessage('تم تحليل الرسالة');
    } catch (error) {
      setMessage(error.message || 'تعذر تحليل الرسالة');
    }
  };

  const applyReceipt = async () => {
    if (!receiptMessage.trim()) return setMessage('الصق رسالة تعميد أولًا');
    setSaving(true);
    setMessage('جاري اعتماد الدفعة...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/receipts/apply-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: receiptMessage }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'save failed');
      setReceiptPreview(json.data?.parsed || null);
      setReceiptMessage('');
      setMessage('تم اعتماد الدفعة وتوزيعها على المستثمرين. اسحب لتحديث الشاشة.');
    } catch (error) {
      setMessage(error.message || 'تعذر اعتماد الدفعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Ta3meedScreen {...props} />
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <View style={styles.backMask} pointerEvents="none" />

        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchOpen((value) => !value)} activeOpacity={0.85}>
          <UiIcon name="search" size={21} color={ICON_COLOR} />
        </TouchableOpacity>

        <Text style={styles.title}>تعميد</Text>

        <TouchableOpacity style={styles.moreButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}>
          <Text style={styles.receiptTopIcon}>سداد</Text>
        </TouchableOpacity>
      </View>

      {searchOpen ? (
        <View style={styles.searchPanel}>
          <Text style={styles.searchTitle}>البحث في تعميد</Text>
          <Text style={styles.searchHint}>استخدم فلتر الشاشة الحالي أو افتح زر سداد للصق رسائل تعميد. تم تفعيل زر البحث في الهيدر الصحيح.</Text>
        </View>
      ) : null}

      <Modal visible={receiptOpen} transparent animationType="fade" onRequestClose={() => setReceiptOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <TouchableOpacity onPress={() => setReceiptOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity>
              <Text style={styles.receiptTitle}>لصق رسالة استلام تعميد</Text>
            </View>
            <Text style={styles.receiptText}>الصق رسالة السداد من تعميد وسيتم استخراج رقم الفرصة والمبلغ ونوع السداد تلقائيًا.</Text>
            <TextInput
              value={receiptMessage}
              onChangeText={setReceiptMessage}
              style={styles.receiptInput}
              multiline
              textAlign="right"
              textAlignVertical="top"
              placeholder={'مثال: تم إضافة سداد جزئي بقيمة 3741.53 للفرصة رقم ER-TIQX836'}
              placeholderTextColor="#94a3b8"
            />
            {receiptPreview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>ملخص القراءة</Text>
                <Text style={styles.previewText}>رقم الفرصة: {receiptPreview.reference_number || '-'}</Text>
                <Text style={styles.previewText}>المبلغ: {receiptPreview.amount || 0} ر.س</Text>
                <Text style={styles.previewText}>النوع: {receiptPreview.label || '-'}</Text>
                <Text style={styles.previewText}>{receiptPreview.is_final ? 'يغلق البطاقة كمستلمة بالكامل' : 'دفعة جزئية ولا يغلق البطاقة'}</Text>
              </View>
            ) : null}
            {!!message && <Text style={styles.modalMessage}>{message}</Text>}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={parseReceipt} activeOpacity={0.85}><Text style={styles.secondaryText}>تحليل الرسالة</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={applyReceipt} disabled={saving} activeOpacity={0.85}><Text style={styles.primaryText}>{saving ? 'جاري الاعتماد...' : 'اعتماد الدفعة'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f7f6' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 99,
    backgroundColor: '#f3f7f6',
    zIndex: 50,
  },
  backMask: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 250,
    height: 79,
    borderRadius: 22,
    backgroundColor: '#f3f7f6',
  },
  searchButton: {
    position: 'absolute',
    left: 8,
    top: 22,
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6eaf0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.045,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  moreButton: {
    position: 'absolute',
    right: 8,
    top: 22,
    minWidth: 52,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6eaf0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.045,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  receiptTopIcon: { color: ICON_COLOR, fontWeight: '900', fontSize: 12 },
  title: {
    position: 'absolute',
    top: 28,
    left: 70,
    right: 70,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
  },
  searchPanel: {
    position: 'absolute',
    top: 102,
    left: 18,
    right: 18,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe7e5',
    zIndex: 60,
  },
  searchTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 16 },
  searchHint: { color: '#64748b', fontWeight: '700', textAlign: 'right', marginTop: 6, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.32)', justifyContent: 'center', padding: 18 },
  receiptCard: { backgroundColor: '#ffffff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe7e5' },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  closeText: { color: '#0f172a', fontWeight: '900', fontSize: 24, marginTop: -2 },
  receiptTitle: { flex: 1, color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right', marginRight: 10 },
  receiptText: { color: '#64748b', fontWeight: '700', lineHeight: 21, textAlign: 'right', marginTop: 10 },
  receiptInput: { marginTop: 12, minHeight: 105, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 13, color: '#0f172a', fontWeight: '800' },
  previewBox: { marginTop: 12, backgroundColor: '#f0fdfa', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#ccfbf1' },
  previewTitle: { color: '#0f766e', fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  previewText: { color: '#0f172a', fontWeight: '800', textAlign: 'right', marginTop: 3 },
  modalMessage: { marginTop: 10, color: '#075985', backgroundColor: '#eff6ff', borderRadius: 14, padding: 10, textAlign: 'right', fontWeight: '800' },
  actionRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 },
  primaryButton: { flex: 1, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontWeight: '900' },
  secondaryButton: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryText: { color: '#0f172a', fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
});
