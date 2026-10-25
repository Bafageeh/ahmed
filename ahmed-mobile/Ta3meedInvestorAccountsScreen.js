import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';
import { Ta3meedInvestorAccounts } from './ta3meed/Ta3meedInvestorAccounts';
import { ahmedUserHeaders, getCurrentAhmedUserId } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

function nameKey(name) {
  return String(name || '').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u200c-\u200f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// The registry is authoritative; duplicate historical records are grouped for display only.
function buildInvestors(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    const code = String(item?.code || '').trim();
    const name = String(item?.name || '').trim();
    const activity = Number(item?.opportunity_count || 0) + Number(item?.account_entry_count || 0);
    if (!code || !name || activity <= 0) return;
    const key = nameKey(name);
    const existing = map.get(key);
    const entryCount = Number(item.account_entry_count || 0);
    if (existing) {
      existing.codes.push(code);
      if (entryCount > existing.entryCount || (entryCount === existing.entryCount && Number(item.id) > existing.primaryId)) {
        existing.code = code; existing.name = name; existing.entryCount = entryCount; existing.primaryId = Number(item.id);
      }
    } else {
      map.set(key, { code, name, codes: [code], entryCount, primaryId: Number(item.id) });
    }
  });
  return Array.from(map.values()).map(({ code, codes, name }) => ({ code, codes, name }));
}

export default function Ta3meedInvestorAccountsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [backRequestVersion, setBackRequestVersion] = useState(0);
  const [loadedUserId, setLoadedUserId] = useState(getCurrentAhmedUserId());

  const investors = useMemo(() => buildInvestors(items), [items]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investors`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل المستثمرين');
      setItems(Array.isArray(json.data) ? json.data : []);
      setLoadedUserId(getCurrentAhmedUserId());
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل المستثمرين.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (loadedUserId !== getCurrentAhmedUserId()) load();
  });

  const requestBack = () => {
    setBackRequestVersion((value) => value + 1);
  };

  return (
    <SafeAreaView style={screenStyles.safe}>
      <StatusBar style="dark" />
      <View style={screenStyles.header}>
        <TouchableOpacity style={screenStyles.headerIcon} onPress={requestBack} activeOpacity={0.85}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <View style={screenStyles.titleBlock}>
          <Text style={screenStyles.headerTitle}>حسابات المستثمرين</Text>
        </View>
        <View style={screenStyles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={screenStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0f766e" />}
      >
        {loading ? <ActivityIndicator color="#0f766e" style={screenStyles.loader} /> : null}
        {!!message && <Text style={screenStyles.message}>{message}</Text>}

        <Ta3meedInvestorAccounts investors={investors} backRequestVersion={backRequestVersion} onExit={onBack} />
      </ScrollView>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f8fc' },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f8fc' },
  headerIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe5ef', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#111a2d', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { width: 45, height: 45 },
  content: { paddingHorizontal: 12, paddingBottom: 34 },
  loader: { marginTop: 12 },
  message: { marginTop: 8, marginBottom: 8, color: '#075985', backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10, textAlign: 'right', fontWeight: '800', overflow: 'hidden' },
});
