import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import AppShell from './AppShell';
import { clearCurrentAhmedSession, setCurrentAhmedSession } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const SESSION_KEY = 'ahmed.secure.session.v1';

async function saveSession(session) {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') {
    window.localStorage?.setItem(SESSION_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function readSession() {
  try {
    const value = Platform.OS === 'web'
      ? window.localStorage?.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value);
    return session?.user?.id && session?.sessionKey ? session : null;
  } catch (error) {
    return null;
  }
}

async function removeSession() {
  if (Platform.OS === 'web') {
    window.localStorage?.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function hasBiometric() {
  if (Platform.OS === 'web') return false;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return Boolean(compatible && enrolled);
  } catch (error) {
    return false;
  }
}

async function verifyBiometric() {
  const enabled = await hasBiometric();
  if (!enabled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'الدخول إلى تطبيق أحمد',
    cancelLabel: 'إلغاء',
    fallbackLabel: 'استخدام الرقم السري',
    disableDeviceFallback: false,
  });
  return Boolean(result.success);
}

export default function AppShellWithAccountSelector() {
  const [booting, setBooting] = useState(true);
  const [savedSession, setSavedSession] = useState(null);
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const triedAutoBio = useRef(false);

  const title = useMemo(() => savedSession?.user?.name ? `مرحبًا ${savedSession.user.name}` : 'تسجيل دخول أحمد', [savedSession]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await readSession();
      const biometrics = await hasBiometric();
      if (!mounted) return;
      setBioReady(biometrics);
      if (stored) {
        setSavedSession(stored);
        setUsername(stored.user?.username || '');
      }
      setBooting(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!booting && savedSession && bioReady && !triedAutoBio.current) {
      triedAutoBio.current = true;
      unlockWithBiometric();
    }
  }, [booting, savedSession, bioReady]);

  const verifySavedSession = async (stored) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/ahmed/session`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${stored.sessionKey}`, 'X-Ahmed-Token': stored.sessionKey },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'انتهت الجلسة، سجل الدخول مرة أخرى.');
      const nextSession = { user: json.data || stored.user, sessionKey: stored.sessionKey };
      setCurrentAhmedSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      await removeSession();
      clearCurrentAhmedSession();
      setSavedSession(null);
      setMessage(error.message || 'تعذر التحقق من الجلسة.');
    } finally {
      setLoading(false);
    }
  };

  const unlockWithBiometric = async () => {
    if (!savedSession) return setMessage('لا توجد جلسة محفوظة. أدخل اليوزر والرقم السري أول مرة.');
    setMessage('');
    const ok = await verifyBiometric();
    if (!ok) return setMessage('لم يتم اعتماد البصمة. يمكنك الدخول باليوزر والرقم السري.');
    await verifySavedSession(savedSession);
  };

  const login = async () => {
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();
    if (!cleanUsername) return setMessage('أدخل اسم المستخدم.');
    if (!cleanPassword) return setMessage('أدخل الرقم السري.');
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/ahmed/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'تعذر تسجيل الدخول.');
      const nextSession = { user: json.data, sessionKey: json.session_key };
      await saveSession(nextSession);
      setCurrentAhmedSession(nextSession);
      setSavedSession(nextSession);
      setSession(nextSession);
      setPassword('');
    } catch (error) {
      clearCurrentAhmedSession();
      setMessage(error.message || 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const current = session || savedSession;
    try {
      if (current?.sessionKey) {
        await fetch(`${API_URL}/ahmed/session`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', Authorization: `Bearer ${current.sessionKey}`, 'X-Ahmed-Token': current.sessionKey },
        });
      }
    } catch (error) {}
    await removeSession();
    clearCurrentAhmedSession();
    setSession(null);
    setSavedSession(null);
    setPassword('');
    setMessage('تم تسجيل الخروج.');
  };

  if (booting) {
    return <View style={styles.loadingRoot}><StatusBar style="dark" /><ActivityIndicator /><Text style={styles.loadingText}>جاري تجهيز الحماية...</Text></View>;
  }

  if (session) {
    return <AppShell currentUser={session.user} onLogout={logout} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.badge}>Ahmed Secure</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>أدخل اسم المستخدم والرقم السري أول مرة. بعد ذلك يتم فتح التطبيق بالبصمة على هذا الجهاز.</Text>

          {savedSession && bioReady ? (
            <TouchableOpacity disabled={loading} onPress={unlockWithBiometric} style={styles.biometricButton}>
              <Text style={styles.biometricText}>الدخول بالبصمة</Text>
            </TouchableOpacity>
          ) : null}

          <TextInput value={username} onChangeText={setUsername} placeholder="اسم المستخدم" placeholderTextColor="#94a3b8" autoCapitalize="none" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} placeholder="الرقم السري" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} />

          <TouchableOpacity disabled={loading} onPress={login} style={[styles.loginButton, loading && styles.disabled]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>دخول</Text>}
          </TouchableOpacity>

          {!!message && <Text style={styles.message}>{message}</Text>}
          {savedSession && !bioReady ? <Text style={styles.hint}>البصمة غير مفعلة أو غير متاحة على هذا الجهاز، لذلك استخدم اليوزر والرقم السري.</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7fb' },
  loadingText: { marginTop: 10, color: '#64748b', fontWeight: '800' },
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 30, borderWidth: 1, borderColor: '#e2e8f0', padding: 22, alignItems: 'stretch' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#ecfdf5', color: '#0f766e', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '900' },
  title: { marginTop: 16, color: '#0f172a', fontSize: 31, fontWeight: '900', textAlign: 'right' },
  subtitle: { marginTop: 8, marginBottom: 14, color: '#64748b', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  input: { minHeight: 50, borderRadius: 17, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, marginTop: 10, textAlign: 'right', color: '#0f172a', fontWeight: '800' },
  biometricButton: { minHeight: 50, borderRadius: 17, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  biometricText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  loginButton: { minHeight: 52, borderRadius: 17, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  disabled: { opacity: 0.72 },
  loginText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  message: { marginTop: 12, color: '#be123c', textAlign: 'right', fontWeight: '900', lineHeight: 21 },
  hint: { marginTop: 10, color: '#64748b', textAlign: 'right', fontWeight: '800', lineHeight: 21 },
});
