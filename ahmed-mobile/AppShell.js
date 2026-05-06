import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StatsDashboardScreen from './StatsDashboardScreen';
import Ta3meedScreen from './Ta3meedChromeFixedScreen';
import WealthScreen from './WealthScreen';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const asNumber = (value) => Number(value || 0);
const money = (value) => `${asNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

const tabs = [
  { key: 'stats', label: 'احصائيات', icon: '📊' },
  { key: 'wealth', label: 'ثروتي', icon: '💎' },
  { key: 'reports', label: '', icon: '📋', center: true, accessibilityLabel: 'تقارير' },
  { key: 'investments', label: 'استثماراتي', icon: '📈' },
  { key: 'more', label: 'مزيد', icon: '⚙️' },
];

const investmentPlatforms = [
  { key: 'ta3meed', name: 'تعميد', icon: '🏦', text: 'فرص تعميد، المستثمرين، الاستلام، والمتأخرات.' },
  { key: 'moneymoon', name: 'موني مون', icon: '🌙', text: 'إدارة استثمارات موني مون النشطة والمستلمة.' },
  { key: 'dinar', name: 'دينار', icon: '🪙', text: 'جاهزة لإضافة فرص دينار وحساباتها.' },
  { key: 'tokenize', name: 'ترميز', icon: '🔷', text: 'جاهزة لإضافة فرص ترميز ومتابعتها.' },
];

export default function AppShell() {
  const [activeTab, setActiveTab] = useState('wealth');
  const [investmentScreen, setInvestmentScreen] = useState('list');

  const openTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'investments') setInvestmentScreen('list');
  };

  const openInvestments = () => {
    setActiveTab('investments');
    setInvestmentScreen('list');
  };

  const openTa3meedInvestors = () => {
    setActiveTab('investments');
    setInvestmentScreen('ta3meed-investors');
  };

  const isLegacyTa3meedOpen = activeTab === 'investments' && investmentScreen === 'ta3meed';

  const renderScreen = () => {
    if (activeTab === 'stats') return <StatsDashboardScreen />;
    if (activeTab === 'investments') {
      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meed-investors') return <Ta3meedInvestorsScreen onBack={() => setInvestmentScreen('list')} />;
      return <InvestmentsScreen openPlatform={setInvestmentScreen} />;
    }
    if (activeTab === 'reports') return <ReportsScreen goTo={openTab} />;
    if (activeTab === 'more') return <MoreScreen goTo={openTab} openTa3meedInvestors={openTa3meedInvestors} />;
    return <WealthScreen openInvestments={openInvestments} />;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.screenLayer, isLegacyTa3meedOpen && styles.screenLayerNoTabs]}>
        {renderScreen()}
      </View>
      {!isLegacyTa3meedOpen ? <BottomTabs activeTab={activeTab} setActiveTab={openTab} /> : null}
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  return (
    <View style={styles.tabWrap} pointerEvents="box-none">
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({ tab, active, onPress }) {
  if (tab.center) {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.centerTabHit} accessibilityLabel={tab.accessibilityLabel}>
        <View style={[styles.centerTabButton, active && styles.centerTabButtonActive]}>
          <Text style={styles.centerTabIcon}>{tab.icon}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <View style={[styles.tabIconBubble, active && styles.tabIconBubbleActive]}>
        <Text style={styles.tabIcon}>{tab.icon}</Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{tab.label}</Text>
    </TouchableOpacity>
  );
}

function InvestmentsScreen({ openPlatform }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.modernHeader}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerBadge}>📈 استثماراتي</Text>
          <Text style={styles.headerTitle}>منصات الاستثمار</Text>
          <Text style={styles.headerSubtitle}>هنا تظهر منصات الاستثمار فقط، بدون الدخل الأساسي أو Finance.</Text>
        </View>

        <View style={styles.platformsGrid}>
          {investmentPlatforms.map((platform) => (
            <TouchableOpacity
              key={platform.key}
              activeOpacity={0.84}
              onPress={() => platform.key === 'ta3meed' ? openPlatform('ta3meed') : null}
              style={[styles.investmentPlatformCard, platform.key !== 'ta3meed' && styles.disabledPlatformCard]}
            >
              <View style={styles.investmentPlatformIcon}><Text style={styles.investmentPlatformIconText}>{platform.icon}</Text></View>
              <Text style={styles.investmentPlatformName}>{platform.name}</Text>
              <Text style={styles.investmentPlatformText}>{platform.text}</Text>
              <Text style={[styles.platformOpenText, platform.key !== 'ta3meed' && styles.platformSoonText]}>
                {platform.key === 'ta3meed' ? 'فتح المنصة' : 'قريبًا'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Ta3meedInvestorsScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/ta3meed/summary`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error('summary');
      setSummary(json.data || null);
    } catch (loadError) {
      setError('تعذر تحميل مستثمرين تعميد');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const investors = Array.isArray(summary?.investors) ? summary.investors : [];
  const totalInvested = investors.reduce((total, investor) => total + asNumber(investor.invested), 0);
  const totalProfit = investors.reduce((total, investor) => total + asNumber(investor.profit), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <TouchableOpacity style={styles.roundBackButton} onPress={onBack} activeOpacity={0.84}>
            <Text style={styles.roundBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topLineTitle}>مستثمرين تعميد</Text>
        </View>

        <View style={styles.modernHeader}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerBadge}>🏦 تعميد</Text>
          <Text style={styles.headerTitle}>مستثمرين تعميد</Text>
          <Text style={styles.headerSubtitle}>رابط مستقل داخل تبويب مزيد العام.</Text>
        </View>

        {loading ? (
          <View style={styles.statusCard}>
            <ActivityIndicator />
            <Text style={styles.statusText}>جاري تحميل المستثمرين...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.statusCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.84}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.investorTotalsRow}>
              <View style={styles.investorTotalCard}>
                <Text style={styles.investorTotalValue}>{money(totalInvested)}</Text>
                <Text style={styles.investorTotalLabel}>إجمالي استثمارات المستثمرين</Text>
              </View>
              <View style={styles.investorTotalCard}>
                <Text style={styles.investorTotalValue}>{money(totalProfit)}</Text>
                <Text style={styles.investorTotalLabel}>إجمالي الأرباح المتوقعة</Text>
              </View>
            </View>

            {investors.length === 0 ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusText}>لا توجد بيانات مستثمرين بعد.</Text>
              </View>
            ) : investors.map((investor) => (
              <View key={investor.name} style={styles.investorCard}>
                <View style={styles.investorAvatar}><Text style={styles.investorAvatarText}>{String(investor.name || 'م').slice(0, 1)}</Text></View>
                <View style={styles.investorInfo}>
                  <Text style={styles.investorName}>{investor.name}</Text>
                  <Text style={styles.investorMeta}>الاستثمار: {money(investor.invested)}</Text>
                  <Text style={styles.investorMeta}>الربح المتوقع: {money(investor.profit)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportsScreen({ goTo }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.modernHeader}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerBadge}>📋 مركز التقارير</Text>
          <Text style={styles.headerTitle}>تقارير أحمد</Text>
          <Text style={styles.headerSubtitle}>الدائرة الوسطى تفتح مركز التقارير بدون عرض اسم التبويب في الأسفل.</Text>
        </View>

        <View style={styles.reportHeroCard}>
          <View style={styles.reportIcon}><Text style={styles.reportIconText}>📋</Text></View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>لوحة التقارير الرئيسية</Text>
            <Text style={styles.reportText}>مركز مخصص للتقارير القادمة، مع اختصارات للشاشات الأساسية.</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction title="احصائيات" text="احصائيات عامة ولكل منصة" icon="📊" onPress={() => goTo('stats')} />
          <QuickAction title="استثماراتي" text="منصات الاستثمار فقط" icon="📈" onPress={() => goTo('investments')} />
          <QuickAction title="ثروتي" text="الدخل والمنصات العامة" icon="💎" onPress={() => goTo('wealth')} />
          <QuickAction title="مزيد" text="إعدادات وروابط" icon="⚙️" onPress={() => goTo('more')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoreScreen({ goTo, openTa3meedInvestors }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.modernHeader}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerBadge}>⚙️ Ahmed</Text>
          <Text style={styles.headerTitle}>مزيد</Text>
          <Text style={styles.headerSubtitle}>اختصارات ثابتة للوصول السريع إلى الشاشات الرئيسية.</Text>
        </View>

        <View style={styles.menuCard}>
          <MenuRow title="احصائيات" text="احصائيات عامة ولكل منصة" icon="📊" onPress={() => goTo('stats')} />
          <MenuRow title="ثروتي" text="ممتلكاتي الخاصة وحصصي الاستثمارية" icon="💎" onPress={() => goTo('wealth')} />
          <MenuRow title="تقارير" text="مركز التقارير الرئيسي" icon="📋" onPress={() => goTo('reports')} />
          <MenuRow title="استثماراتي" text="منصات الاستثمار فقط" icon="📈" onPress={() => goTo('investments')} />
          <MenuRow title="مستثمرين تعميد" text="إحصائيات وتوزيع مستثمري تعميد" icon="🏦" onPress={openTa3meedInvestors} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ title, text, icon, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.quickCard}>
      <View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickText}>{text}</Text>
    </TouchableOpacity>
  );
}

function MenuRow({ title, text, icon, onPress, last }) {
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={[styles.menuRow, last && styles.menuRowLast]}>
      <View style={styles.menuIcon}><Text style={styles.menuIconText}>{icon}</Text></View>
      <View style={styles.menuTextBlock}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuText}>{text}</Text>
      </View>
      <Text style={styles.menuArrow}>‹</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7fb' },
  screenLayer: { flex: 1, paddingBottom: 98, backgroundColor: '#f4f7fb' },
  screenLayerNoTabs: { paddingBottom: 0 },
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  pageContainer: { padding: 18, paddingBottom: 34 },
  modernHeader: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 30,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  headerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: '#14b8a6',
    opacity: 0.18,
    top: -70,
    left: -50,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    color: '#ccfbf1',
    backgroundColor: 'rgba(20,184,166,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '900',
  },
  headerTitle: { marginTop: 16, color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  topLine: { marginTop: 4, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  roundBackButton: { width: 46, height: 46, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  roundBackText: { color: '#0f172a', fontSize: 34, fontWeight: '900', marginTop: -3 },
  topLineTitle: { flex: 1, color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'center', marginRight: 46 },
  statusCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  statusText: { marginTop: 8, color: '#64748b', textAlign: 'center', fontWeight: '800' },
  errorText: { color: '#b91c1c', fontWeight: '900', textAlign: 'center' },
  retryButton: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '900' },
  investorTotalsRow: { marginTop: 14, flexDirection: 'row-reverse', gap: 10 },
  investorTotalCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  investorTotalValue: { color: '#0f766e', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  investorTotalLabel: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  investorCard: { marginTop: 10, backgroundColor: '#ffffff', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  investorAvatar: { width: 52, height: 52, borderRadius: 20, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  investorAvatarText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  investorInfo: { flex: 1, alignItems: 'flex-end' },
  investorName: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  investorMeta: { marginTop: 5, color: '#64748b', fontWeight: '800', textAlign: 'right' },
  platformsGrid: { marginTop: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  investmentPlatformCard: { flexBasis: '47.5%', flexGrow: 1, minHeight: 176, backgroundColor: '#ffffff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', alignItems: 'flex-end' },
  disabledPlatformCard: { opacity: 0.72, backgroundColor: '#f8fafc' },
  investmentPlatformIcon: { width: 56, height: 56, borderRadius: 22, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#ccfbf1' },
  investmentPlatformIconText: { fontSize: 29 },
  investmentPlatformName: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  investmentPlatformText: { marginTop: 6, color: '#64748b', lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  platformOpenText: { marginTop: 'auto', color: '#0f766e', fontWeight: '900', textAlign: 'right' },
  platformSoonText: { color: '#94a3b8' },
  reportHeroCard: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reportIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  reportIconText: { fontSize: 30 },
  reportInfo: { flex: 1, alignItems: 'flex-end' },
  reportTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  reportText: { marginTop: 6, color: '#64748b', lineHeight: 22, textAlign: 'right', fontWeight: '700' },
  quickGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  quickCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  quickIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  quickIconText: { fontSize: 23 },
  quickTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  quickText: { marginTop: 5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  menuCard: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  menuIconText: { fontSize: 24 },
  menuTextBlock: { flex: 1, alignItems: 'flex-end' },
  menuTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  menuArrow: { color: '#94a3b8', fontSize: 28, fontWeight: '900', marginTop: -2 },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  tabBar: {
    width: '100%',
    minHeight: 78,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tabButton: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabButtonActive: { backgroundColor: '#f0fdfa' },
  tabIconBubble: { width: 35, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabIconBubbleActive: { backgroundColor: '#0f766e' },
  tabIcon: { fontSize: 19 },
  tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tabLabelActive: { color: '#0f766e' },
  centerTabHit: { flex: 1.05, minHeight: 74, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  centerTabButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  centerTabButtonActive: { backgroundColor: '#0f766e' },
  centerTabIcon: { fontSize: 31 },
});
