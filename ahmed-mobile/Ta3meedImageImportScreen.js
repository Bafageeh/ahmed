import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: `رد غير JSON من ${path}` }; }
  if (!response.ok) {
    const error = new Error(json.message || `خطأ ${response.status}`);
    error.status = response.status;
    error.data = json.data;
    throw error;
  }
  return json;
}

function money(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س`;
}


async function cropImagePart(asset, label, crop) {
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ crop }],
    {
      compress: 0.95,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  return {
    label,
    base64: result.base64,
    mime_type: 'image/jpeg',
  };
}

async function buildImageParts(asset) {
  const width = asset.width || 1200;
  const height = asset.height || 1600;

  const safeCrop = (originX, originY, cropWidth, cropHeight) => ({
    originX: Math.max(0, Math.round(originX)),
    originY: Math.max(0, Math.round(originY)),
    width: Math.max(1, Math.min(width - Math.max(0, Math.round(originX)), Math.round(cropWidth))),
    height: Math.max(1, Math.min(height - Math.max(0, Math.round(originY)), Math.round(cropHeight))),
  });

  const headerCrop = safeCrop(0, 0, width, height * 0.48);
  const metricsCrop = safeCrop(0, height * 0.36, width, height * 0.55);

  const parts = [];

  try {
    parts.push(await cropImagePart(asset, 'header_green_area', headerCrop));
  } catch {}

  try {
    parts.push(await cropImagePart(asset, 'financial_cards_area', metricsCrop));
  } catch {}

  return parts.filter((part) => part.base64);
}

export default function Ta3meedImageImportScreen({ onBack }) {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [errorData, setErrorData] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageParts, setImageParts] = useState([]);
  const [manualReference, setManualReference] = useState('');

  const pickImage = async () => {
    setMessage('');
    setResult(null);
    setErrorData(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('يجب السماح بالوصول للصور أولًا.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });

    if (picked.canceled) return;

    const asset = picked.assets?.[0];
    if (!asset?.base64) {
      setMessage('تعذر قراءة الصورة.');
      return;
    }

    setImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType || 'image/jpeg',
    });

    setMessage('جاري تجهيز قصّات الصورة للقراءة...');
    const parts = await buildImageParts(asset);
    setImageParts(parts);
    setMessage(parts.length ? `تم تجهيز ${parts.length} قصّة مركزة من الصورة.` : 'تم اختيار الصورة.');
  };

  const importImage = async () => {
    if (!image?.base64) {
      setMessage('اختر صورة الفرصة أولًا.');
      return;
    }

    setBusy(true);
    setMessage('جاري قراءة الصورة وتحديث قاعدة البيانات...');
    setResult(null);
    setErrorData(null);

    try {
      const json = await apiJson('/ta3meed/image-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: image.base64,
          mime_type: image.mimeType || 'image/jpeg',
          image_parts: imageParts,
          manual_reference_number: manualReference.trim() || null,
          instructions: 'رقم الفرصة يظهر في الهيدر الأخضر أعلى الصورة وأسفل اسم المنشأة، ويظهر أيضًا في بطاقة رقم الفرصة.',
        }),
      });

      setResult(json.data);
      setMessage(json.data?.action === 'created' ? 'تمت إضافة فرصة جديدة من الصورة.' : 'تم تحديث الفرصة الموجودة من الصورة.');
    } catch (error) {
      setErrorData(error.data || null);
      setMessage(error.message || 'تعذر استيراد الصورة.');
    } finally {
      setBusy(false);
    }
  };

  const parsed = result?.parsed || {};
  const action = result?.action;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={onBack} activeOpacity={0.85}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.screenId}>#S-105</Text>
          <Text style={styles.headerTitle}>استيراد فرصة من صورة</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>تعميد · قراءة صورة فرصة</Text>
          <Text style={styles.heroTitle}>ارفع صورة الفرصة</Text>
          <Text style={styles.heroText}>
            يعتمد النظام على رقم الفرصة. إذا لم يكن موجودًا يضيف فرصة جديدة، وإذا كان موجودًا يحدث فقط الحقول المقروءة من الصورة.
          </Text>
        </View>

        <TouchableOpacity style={styles.pickButton} onPress={pickImage} activeOpacity={0.85}>
          <Text style={styles.pickButtonText}>اختيار صورة الفرصة</Text>
        </TouchableOpacity>

        {image?.uri ? <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" /> : null}

        {image?.uri ? <Text style={styles.partsText}>قصّات مركزة جاهزة للقراءة: {imageParts.length}</Text> : null}

        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>رقم الفرصة يدويًا عند عدم التعرف عليه</Text>
          <TextInput
            value={manualReference}
            onChangeText={setManualReference}
            placeholder="مثال: ER-XHYI565"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            style={styles.manualInput}
          />
        </View>

        <TouchableOpacity style={[styles.importButton, busy && styles.disabledButton]} onPress={importImage} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.importButtonText}>قراءة الصورة وإدخالها</Text>}
        </TouchableOpacity>

        {!!message && <Text style={styles.message}>{message}</Text>}

        {errorData ? (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>النص المقروء من الصورة</Text>
            <Text style={styles.debugText}>{errorData.ocr_text_preview || 'لم يرجع نص مقروء من الصورة.'}</Text>

            <Text style={styles.debugTitle}>البيانات التي حاول النظام قراءتها</Text>
            <Text style={styles.debugText}>{JSON.stringify(errorData, null, 2)}</Text>
          </View>
        ) : null}


        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{action === 'created' ? 'فرصة جديدة' : 'تحديث فرصة موجودة'}</Text>
            <Info label="رقم الفرصة" value={parsed.reference_number || '-'} />
            <Info label="اسم المنشأة" value={parsed.company_name || '-'} />
            <Info label="النشاط" value={parsed.sector || '-'} />
            <Info label="قيمة الاستثمار" value={parsed.principal_amount ? money(parsed.principal_amount) : '-'} />
            <Info label="ربح متوقع" value={parsed.expected_profit_amount ? money(parsed.expected_profit_amount) : '-'} />
            <Info label="العائد السنوي" value={parsed.expected_rate ? `${parsed.expected_rate}%` : '-'} />
            <Info label="مدة التمويل" value={parsed.months ? `${parsed.months} شهر` : '-'} />
            <Info label="تاريخ الاستحقاق" value={parsed.maturity_date || '-'} />
            <Info label="التصنيف" value={parsed.category || '-'} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  header: { paddingHorizontal: 22, paddingTop: 34, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f7fb' },
  headerIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, alignItems: 'center' },
  screenId: { color: '#0f766e', fontSize: 12, fontWeight: '900', marginBottom: 2 },
  headerTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { width: 46 },
  content: { paddingHorizontal: 14, paddingBottom: 32 },
  heroCard: { marginTop: 8, backgroundColor: '#0f766e', borderRadius: 24, padding: 18, alignItems: 'flex-end' },
  heroKicker: { color: '#ccfbf1', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  heroTitle: { marginTop: 7, color: '#ffffff', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  heroText: { marginTop: 8, color: '#ecfeff', fontSize: 13, fontWeight: '800', lineHeight: 22, textAlign: 'right' },
  pickButton: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#99f6e4', alignItems: 'center' },
  pickButtonText: { color: '#0f766e', fontSize: 14, fontWeight: '900' },
  previewImage: { marginTop: 12, width: '100%', height: 360, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  manualCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  manualLabel: { color: '#0f172a', fontSize: 12, fontWeight: '900', textAlign: 'right', marginBottom: 7 },
  manualInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  importButton: { marginTop: 12, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.65 },
  importButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  partsText: { marginTop: 8, color: '#0f766e', textAlign: 'right', fontSize: 12, fontWeight: '900' },
  message: { marginTop: 12, color: '#075985', backgroundColor: '#eff6ff', borderRadius: 14, padding: 10, textAlign: 'right', fontWeight: '900', overflow: 'hidden' },
  debugCard: { marginTop: 12, backgroundColor: '#fff7ed', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#fed7aa' },
  debugTitle: { color: '#9a3412', fontSize: 13, fontWeight: '900', textAlign: 'right', marginBottom: 6, marginTop: 6 },
  debugText: { color: '#431407', fontSize: 11, fontWeight: '800', textAlign: 'left', lineHeight: 18 },
  resultCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  resultTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right', marginBottom: 10 },
  infoRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  infoLabel: { color: '#64748b', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  infoValue: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'left' },
});
