import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StatsDashboardScreen from './StatsDashboardScreen';
import Ta3meedScreen from './Ta3meedNoResetFilterScreen';
import Ta3meedInvestorAccountsScreen from './Ta3meedInvestorAccountsScreen';
import Ta3meedImageImportScreen from './Ta3meedImageImportScreen';
import MoneyMoonScreen from './MoneyMoonActiveOnlyScreen';
import WealthScreen from './WealthScreen';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK, ICON_COLOR_SOFT } from './UiIcon';

const tabs = [
  { key: 'stats', label: 'احصائيات', icon: 'stats' },
  { key: 'wealth', label: 'ثروتي', icon: 'wealth' },
  { key: 'reports', label: '', icon: 'reports', center: true, accessibilityLabel: 'تقارير' },
  { key: 'investments', label: 'استثماراتي', icon: 'investments' },
  { key: 'more', label: 'مزيد', icon: 'more' },
];

const investmentPlatforms = [
  { key: 'ta3meed', name: 'تعميد', icon: 'ta3meed', text: 'فرص تعميد، التصنيفات، المستثمرين، السداد، والمتأخرات.' },
  { key: 'ta3meedAccounts', name: 'حسابات المستثمرين', icon: 'users', text: 'شاشة مستقلة لإضافة رصيد المستثمر وتعديل وحذف حركات الرصيد.' },
  { key: 'ta3meedImageImport', name: 'استيراد صورة تعميد', icon: 'ta3meed', text: 'رفع صورة الفرصة وقراءة بياناتها ثم إضافة أو تحديث الفرصة.' },
  { key: 'moneymoon', name: 'موني مون', icon: 'moneymoon', text: 'إدارة استثمارات موني مون النشطة والمستلمة.' },
  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'جاهزة لإضافة فرص دينار وحساباتها.' },
  { key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'جاهزة لإضافة فرص ترميز ومتابعتها.' },
];

const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon'];

export default function AppShell() {
  const [activeTab, setActiveTab] = useState('wealth');
  const [investmentScreen, setInvestmentScreen] = useState('list');

  const openTab = (tab) => {
    setActiveTab(tab);
    setInvestmentScreen('list');
  };

  const openInvestments = () => {
    setActiveTab('investments');
    setInvestmentScreen('list');
  };

  const openTa3meedInvestors = () => {
    setActiveTab('investments');
    setInvestmentScreen('ta3meed');
  };

  const openTa3meedAccounts = () => {
    setActiveTab('investments');
    setInvestmentScreen('ta3meedAccounts');
  };

  const inFullScreenInvestment = activeTab === 'investments' && activeInvestmentKeys.includes(investmentScreen);

  const renderScreen = () => {
    if (activeTab === 'stats') return <StatsDashboardScreen />;
    if (activeTab === 'investments') {
      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meedAccounts') return <Ta3meedInvestorAccountsScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meedImageImport') return <Ta3meedImageImportScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'moneymoon') return <MoneyMoonScreen onBack={() => setInvestmentScreen('list')} />;
      return <InvestmentsScreen openPlatform={setInvestmentScreen} />;
    }
    if (activeTab === 'reports') return <ReportsScreen goTo={openTab} />;
    if (activeTab === 'more') return <MoreScreen goTo={openTab} openTa3meedInvestors={openTa3meedInvestors} openTa3meedAccounts={openTa3meedAccounts} />;
    return <WealthScreen openInvestments={openInvestments} />;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.screenLayer, inFullScreenInvestment && styles.screenLayerNoTabs]}>{renderScreen()}</View>
      {!inFullScreenInvestment ? <BottomTabs activeTab={activeTab} setActiveTab={openTab} /> : null}
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  return <View style={styles.tabWrap} pointerEvents="box-none"><View style={styles.tabBar}>{tabs.map((tab) => <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onPress={() => setActiveTab(tab.key)} />)}</View></View>;
}

function TabButton({ tab, active, onPress }) {
  if (tab.center) {
    return <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.centerTabHit} accessibilityLabel={tab.accessibilityLabel}><View style={[styles.centerTabButton, active && styles.centerTabButtonActive]}><UiIcon name={tab.icon} size={30} color="#ffffff" /></View></TouchableOpacity>;
  }
  return <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}><View style={[styles.tabIconBubble, active && styles.tabIconBubbleActive]}><UiIcon name={tab.icon} size={21} color={active ? '#ffffff' : ICON_COLOR} /></View><Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{tab.label}</Text></TouchableOpacity>;
}

function InvestmentsScreen({ openPlatform }) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}><Header badge="استثماراتي" title="منصات الاستثمار" subtitle="هنا تظهر منصات الاستثمار فقط، بدون الدخل الأساسي أو Finance." icon="investments" /><View style={styles.platformsGrid}>{investmentPlatforms.map((platform) => { const isActive = activeInvestmentKeys.includes(platform.key); return <TouchableOpacity key={platform.key} activeOpacity={0.84} onPress={() => isActive ? openPlatform(platform.key) : null} disabled={!isActive} style={[styles.investmentPlatformCard, !isActive && styles.disabledPlatformCard]}><View style={styles.outlineCircle}><UiIcon name={platform.icon} size={29} /></View><Text style={styles.investmentPlatformName}>{platform.name}</Text><Text style={styles.investmentPlatformText}>{platform.text}</Text><Text style={[styles.platformOpenText, !isActive && styles.platformSoonText]}>{isActive ? 'فتح الشاشة' : 'قريبًا'}</Text></TouchableOpacity>; })}</View></ScrollView></SafeAreaView>;
}

function ReportsScreen({ goTo }) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}><Header badge="مركز التقارير" title="تقارير أحمد" subtitle="الدائرة الوسطى تفتح مركز التقارير بدون عرض اسم التبويب في الأسفل." icon="reports" /><View style={styles.reportHeroCard}><View style={styles.reportIcon}><UiIcon name="reports" size={31} color="#ffffff" /></View><View style={styles.reportInfo}><Text style={styles.reportTitle}>لوحة التقارير الرئيسية</Text><Text style={styles.reportText}>مركز مخصص للتقارير القادمة، مع اختصارات للشاشات الأساسية.</Text></View></View><View style={styles.quickGrid}><QuickAction title="احصائيات" text="احصائيات عامة ولكل منصة" icon="stats" onPress={() => goTo('stats')} /><QuickAction title="استثماراتي" text="منصات الاستثمار فقط" icon="investments" onPress={() => goTo('investments')} /><QuickAction title="ثروتي" text="الدخل والمنصات العامة" icon="wealth" onPress={() => goTo('wealth')} /><QuickAction title="مزيد" text="إعدادات وروابط" icon="more" onPress={() => goTo('more')} /></View></ScrollView></SafeAreaView>;
}

function MoreScreen({ goTo, openTa3meedInvestors, openTa3meedAccounts }) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}><Header badge="Ahmed" title="مزيد" subtitle="اختصارات ثابتة للوصول السريع إلى الشاشات الرئيسية." icon="settings" /><View style={styles.menuCard}><MenuRow title="احصائيات" text="احصائيات عامة ولكل منصة" icon="stats" onPress={() => goTo('stats')} /><MenuRow title="ثروتي" text="ممتلكاتي الخاصة وحصصي الاستثمارية" icon="wealth" onPress={() => goTo('wealth')} /><MenuRow title="تقارير" text="مركز التقارير الرئيسي" icon="reports" onPress={() => goTo('reports')} /><MenuRow title="استثماراتي" text="منصات الاستثمار فقط" icon="investments" onPress={() => goTo('investments')} /><MenuRow title="تعميد" text="فرص تعميد والتصنيفات والمستثمرين" icon="ta3meed" onPress={openTa3meedInvestors} /><MenuRow title="حسابات المستثمرين" text="إضافة رصيد وتعديل وحذف حركات المستثمرين" icon="users" onPress={openTa3meedAccounts} last /></View></ScrollView></SafeAreaView>;
}

function Header({ badge, title, subtitle, icon }) {
  return <View style={styles.modernHeader}><View style={styles.headerGlow} /><View style={styles.headerBadgeRow}><UiIcon name={icon} size={18} color="#cbd5e1" /><Text style={styles.headerBadgeText}>{badge}</Text></View><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{subtitle}</Text></View>;
}

function QuickAction({ title, text, icon, onPress }) {
  return <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.quickCard}><View style={styles.quickIcon}><UiIcon name={icon} size={24} /></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickText}>{text}</Text></TouchableOpacity>;
}

function MenuRow({ title, text, icon, onPress, last }) {
  return <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={[styles.menuRow, last && styles.menuRowLast]}><View style={styles.menuIcon}><UiIcon name={icon} size={24} /></View><View style={styles.menuTextBlock}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuText}>{text}</Text></View><UiIcon name="back" size={22} color={ICON_COLOR_SOFT} /></TouchableOpacity>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7fb' },
  screenLayer: { flex: 1, paddingBottom: 98, backgroundColor: '#f4f7fb' },
  screenLayerNoTabs: { paddingBottom: 0 },
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  pageContainer: { padding: 18, paddingBottom: 34 },
  modernHeader: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b' },
  headerGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 999, backgroundColor: '#64748b', opacity: 0.14, top: -70, left: -50 },
  headerBadgeRow: { alignSelf: 'flex-start', flexDirection: 'row-reverse', gap: 7, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  headerBadgeText: { color: '#cbd5e1', fontWeight: '900' },
  headerTitle: { marginTop: 16, color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  platformsGrid: { marginTop: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  investmentPlatformCard: { flexBasis: '47.5%', flexGrow: 1, minHeight: 176, backgroundColor: '#ffffff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', alignItems: 'flex-end' },
  disabledPlatformCard: { opacity: 0.72, backgroundColor: '#f8fafc' },
  outlineCircle: { width: 56, height: 56, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  investmentPlatformName: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  investmentPlatformText: { marginTop: 6, color: '#64748b', lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  platformOpenText: { marginTop: 'auto', color: ICON_COLOR_DARK, fontWeight: '900', textAlign: 'right' },
  platformSoonText: { color: '#94a3b8' },
  reportHeroCard: { marginTop: 16, backgroundColor: '#ffffff', borderRadius: 26, padding: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  reportIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: ICON_COLOR, alignItems: 'center', justifyContent: 'center' },
  reportInfo: { flex: 1, alignItems: 'flex-end' },
  reportTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  reportText: { marginTop: 6, color: '#64748b', lineHeight: 22, textAlign: 'right', fontWeight: '700' },
  quickGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  quickCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  quickIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  quickTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  quickText: { marginTop: 5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  menuCard: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  menuTextBlock: { flex: 1, alignItems: 'flex-end' },
  menuTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  tabBar: { width: '100%', minHeight: 78, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  tabButton: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabButtonActive: { backgroundColor: '#f8fafc' },
  tabIconBubble: { width: 35, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabIconBubbleActive: { backgroundColor: ICON_COLOR },
  tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tabLabelActive: { color: ICON_COLOR_DARK },
  centerTabHit: { flex: 1.05, minHeight: 74, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  centerTabButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#ffffff' },
  centerTabButtonActive: { backgroundColor: ICON_COLOR_DARK },
});
