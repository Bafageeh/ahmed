import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

export default function App() {
  const [status, setStatus] = useState('جاري فحص الاتصال بالـ API...');

  const checkApi = async () => {
    setStatus('جاري فحص الاتصال بالـ API...');
    try {
      const res = await fetch(`${API_URL}/health`);
      const data = await res.json();
      setStatus(data.ok ? 'API متصل بنجاح' : 'API غير جاهز');
    } catch (e) {
      setStatus('تعذر الاتصال بالـ API');
    }
  };

  useEffect(() => {
    checkApi();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.badge}>Ahmed Mobile Native</Text>
        <Text style={styles.title}>مشروع أحمد</Text>
        <Text style={styles.subtitle}>
          تطبيق الجوال Native جاهز ومربوط مع API.
        </Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>حالة الاتصال</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={checkApi}>
          <Text style={styles.buttonText}>إعادة الفحص</Text>
        </TouchableOpacity>

        <Text style={styles.url}>{API_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f7fb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 26,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef6ff',
    color: '#075985',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 29,
    color: '#475569',
    textAlign: 'right',
  },
  statusBox: {
    marginTop: 24,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
  },
  statusText: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  url: {
    marginTop: 14,
    color: '#64748b',
    textAlign: 'center',
    fontSize: 12,
  },
});
