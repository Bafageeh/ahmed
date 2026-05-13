import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import UiIcon, { ICON_COLOR_DARK } from './UiIcon';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const HIDDEN_INVESTOR_ACCOUNT_STAT_TITLE = 'متبقي الفرص';

function shouldHideRemainingOpportunitiesStat(type, props) {
  if (props?.title !== HIDDEN_INVESTOR_ACCOUNT_STAT_TITLE) return false;
  return typeof type === 'function' || typeof type === 'string';
}

if (!React.__ahmedHideRemainingOpportunitiesStat) {
  const originalCreateElement = React.createElement;

  React.createElement = function createElementWithoutRemainingOpportunitiesStat(type, elementProps, ...children) {
    if (shouldHideRemainingOpportunitiesStat(type, elementProps)) {
      return null;
    }

    return originalCreateElement.call(this, type, elementProps, ...children);
  };

  try {
    const jsxRuntime = require('react/jsx-runtime');
    const originalJsx = jsxRuntime.jsx;
    const originalJsxs = jsxRuntime.jsxs;
    const originalJsxDEV = jsxRuntime.jsxDEV;

    if (typeof originalJsx === 'function') {
      jsxRuntime.jsx = function jsxWithoutRemainingOpportunitiesStat(type, props, key) {
        if (shouldHideRemainingOpportunitiesStat(type, props)) return null;
        return originalJsx.call(this, type, props, key);
      };
    }

    if (typeof originalJsxs === 'function') {
      jsxRuntime.jsxs = function jsxsWithoutRemainingOpportunitiesStat(type, props, key) {
        if (shouldHideRemainingOpportunitiesStat(type, props)) return null;
        return originalJsxs.call(this, type, props, key);
      };
    }

    if (typeof originalJsxDEV === 'function') {
      jsxRuntime.jsxDEV = function jsxDEVWithoutRemainingOpportunitiesStat(type, props, key, isStaticChildren, source, self) {
        if (shouldHideRemainingOpportunitiesStat(type, props)) return null;
        return originalJsxDEV.call(this, type, props, key, isStaticChildren, source, self);
      };
    }
  } catch {
    // Older React Native/Babel runtimes may not expose react/jsx-runtime.
  }

  React.__ahmedHideRemainingOpportunitiesStat = true;
}

const { Ta3meedInvestorAccounts } = require('./ta3meed/Ta3meedInvestorAccountsV2');

const defaultInvestors = [
  { code: 'ahmed', name: 'أحمد' },
  { code: 'sara', name: 'سارة' },
  { code: 'amal', name: 'آمال' },
  { code: 'mother', name: 'أمي' },
  { code: 'father', name: 'الوالد' },
];

function investorKey(allocation) {
  return String(allocation?.investor_code || allocation?.investor_name || '').trim();
}

function buildInvestors(items) {
  const map = new Map(defaultInvestors.map((investor) => [investor.code, investor]));

  items.forEach((item) => {
    (item.allocations || []).forEach((allocation) => {
      const code = investorKey(allocation);
      const name = allocation.investor_name || code;
      if (code && name) map.set(code, { code, name });
    });
  });

  return Array.from(map.values());
}

export default function Ta3meedInvestorAccountsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [backRequestVersion, setBackRequestVersion] = useState(0);

  const investors = useMemo(() => buildInvestors(items), [items]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل المستثمرين');
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل المستثمرين، ستظهر الحسابات الأساسية فقط.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
          <Text style={screenStyles.screenId}>#S-110</Text>
          <Text style={screenStyles.headerTitle}>حسابات المستثمرين</Text>
        </View>
        <TouchableOpacity style={screenStyles.refreshButton} onPress={load} activeOpacity={0.85}>
          <Text style={screenStyles.refreshText}>تحديث</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={screenStyles.content} showsVerticalScrollIndicator={false}>
        <View style={screenStyles.heroCard}>
          <Text style={screenStyles.heroKicker}>#S-110 · شاشة مستقلة</Text>
          <Text style={screenStyles.heroTitle}>إدارة أرصدة مستثمري تعميد</Text>
          <Text style={screenStyles.heroText}>هذه الشاشة منفصلة عن فلتر المستثمرين. اختر المستثمر ثم أضف رصيدًا أو سجل سحبًا أو عدّل واحذف حركات الرصيد.</Text>
        </View>

        {loading ? <ActivityIndicator color="#0f766e" style={screenStyles.loader} /> : null}
        {!!message && <Text style={screenStyles.message}>{message}</Text>}

        <Ta3meedInvestorAccounts investors={investors} backRequestVersion={backRequestVersion} onExit={onBack} />
      </ScrollView>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  header: { paddingHorizontal: 28, paddingTop: 34, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4f7fb' },
  headerIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screenId: { color: '#0f766e', fontSize: 12, fontWeight: '900', textAlign: 'center', marginBottom: 2 },
  headerTitle: { color: '#0f172a', fontSize: 25, fontWeight: '900', textAlign: 'center' },
  refreshButton: { minWidth: 70, height: 48, borderRadius: 17, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  refreshText: { color: '#ffffff', fontWeight: '900', fontSize: 13 },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  heroCard: { marginTop: 8, backgroundColor: '#0f766e', borderRadius: 28, padding: 22, alignItems: 'flex-end' },
  heroKicker: { color: '#ccfbf1', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  heroTitle: { marginTop: 8, color: '#ffffff', fontSize: 25, fontWeight: '900', textAlign: 'right' },
  heroText: { marginTop: 10, color: '#ecfeff', fontSize: 14, fontWeight: '800', lineHeight: 23, textAlign: 'right' },
  loader: { marginTop: 14 },
  message: { marginTop: 12, color: '#075985', backgroundColor: '#eff6ff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, textAlign: 'right', fontWeight: '900', overflow: 'hidden' },
});
