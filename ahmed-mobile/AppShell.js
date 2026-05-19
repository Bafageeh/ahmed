import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StatsDashboardScreen from './StatsDashboardScreen';
import Ta3meedScreen from './Ta3meedNoResetFilterScreen';
import Ta3meedInvestorAccountsScreen from './Ta3meedInvestorAccountsScreen';
import Ta3meedImageImportScreen from './Ta3meedImageImportScreen';
import MoneyMoonScreen from './MoneyMoonActiveOnlyScreen';
import WealthScreen from './WealthScreen';
import AhmedUsersManagerPanel from './AhmedUsersManagerPanel';
import SecureVaultScreen from './SecureVaultScreen';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK, ICON_COLOR_SOFT } from './UiIcon';

const tabs = [
  { key: 'stats', label: 'احصائيات', icon: 'stats' },
  { key: 'wealth', label: 'ثروتي', icon: 'wealth' },
  { key: 'reports', label: '', icon: 'reports', center: true, accessibilityLabel: 'تقارير' },
  { key: 'investments', label: 'استثماراتي', icon: 'investments' },
  { key: 'more', label: 'مزيد', icon: 'more' },
];
const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon'];
const platforms = [
  { key: 'ta3meed', name: 'تعميد', icon: 'ta3meed', text: 'فرص تعميد والتصنيفات والمستثمرين.' },
  { key: 'moneymoon', name: 'موني مون', icon: 'moneymoon', text: 'إدارة استثمارات موني مون.' },
  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'قريبًا.' },
  { key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },
];

export default function AppShell({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('wealth');
  const [investmentScreen, setInvestmentScreen] = useState('list');
  const isAdmin = Boolean(currentUser?.is_admin);
  const openTab = (tab) => { setActiveTab(tab); setInvestmentScreen('list'); };
  const openInvestments = () => { setActiveTab('investments'); setInvestmentScreen('list'); };
  const inFullScreen = (activeTab === 'investments' && activeInvestmentKeys.includes(investmentScreen)) || activeTab === 'usersManager' || activeTab === 'secureVault';

  const renderScreen = () => {
    if (activeTab === 'stats') return <StatsDashboardScreen />;
    if (activeTab === 'reports') return <ReportsScreen goTo={openTab} />;
    if (activeTab === 'usersManager') return <UsersManagerScreen onBack={() => openTab('more')} currentUser={currentUser} />;
    if (activeTab === 'secureVault') return <SecureVaultScreen onBack={() => openTab('more')} />;
    if (activeTab === 'more') return <MoreScreen goTo={openTab} setInvestmentScreen={setInvestmentScreen} setActiveTab={setActiveTab} currentUser={currentUser} isAdmin={isAdmin} onLogout={onLogout} />;
    if (activeTab === 'investments') {
      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenMore={() => openTab('more')} />;
      if (investmentScreen === 'ta3meedAccounts') return <Ta3meedInvestorAccountsScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meedImageImport') return <Ta3meedImageImportScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'moneymoon') return <MoneyMoonScreen onBack={() => setInvestmentScreen('list')} />;
      return <InvestmentsScreen openPlatform={setInvestmentScreen} />;
    }
    return <WealthScreen openInvestments={openInvestments} />;
  };

  return <View style={styles.root}><StatusBar style="dark" /><View style={[styles.screenLayer, inFullScreen && styles.noTabs]}>{renderScreen()}</View>{!inFullScreen ? <BottomTabs activeTab={activeTab} setActiveTab={openTab} /> : null}</View>;
}

function BottomTabs({ activeTab, setActiveTab }) {
  return <View style={styles.tabWrap} pointerEvents="box-none"><View style={styles.tabBar}>{tabs.map((tab) => <TouchableOpacity key={tab.key} activeOpacity={0.84} onPress={() => setActiveTab(tab.key)} style={[tab.center ? styles.centerTabHit : styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}>{tab.center ? <View style={[styles.centerTabButton, activeTab === tab.key && styles.centerTabButtonActive]}><UiIcon name={tab.icon} size={30} color="#fff" /></View> : <><View style={[styles.tabIconBubble, activeTab === tab.key && styles.tabIconBubbleActive]}><UiIcon name={tab.icon} size={21} color={activeTab === tab.key ? '#fff' : ICON_COLOR} /></View><Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text></>}</TouchableOpacity>)}</View></View>;
}

function Header({ badge, title, subtitle, icon }) {
  return <View style={styles.header}><View style={styles.headerBadge}><UiIcon name={icon} size={18} color="#cbd5e1" /><Text style={styles.headerBadgeText}>{badge}</Text></View><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{subtitle}</Text></View>;
}
function ScreenWrap({ children }) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>; }
function InvestmentsScreen({ openPlatform }) {
  return <ScreenWrap><Header badge="استثماراتي" title="منصات الاستثمار" subtitle="منصات الاستثمار فقط." icon="investments" /><View style={styles.grid}>{platforms.map((p) => { const isActive = activeInvestmentKeys.includes(p.key); return <TouchableOpacity key={p.key} disabled={!isActive} onPress={() => openPlatform(p.key)} style={[styles.card, !isActive && styles.disabledCard]}><View style={styles.iconBox}><UiIcon name={p.icon} size={29} /></View><Text style={styles.cardTitle}>{p.name}</Text><Text style={styles.cardText}>{p.text}</Text><Text style={[styles.openText, !isActive && styles.soonText]}>{isActive ? 'فتح الشاشة' : 'قريبًا'}</Text></TouchableOpacity>; })}</View></ScreenWrap>;
}
function ReportsScreen({ goTo }) {
  return <ScreenWrap><Header badge="مركز التقارير" title="تقارير أحمد" subtitle="مركز التقارير والاختصارات." icon="reports" /><View style={styles.grid}><Quick title="احصائيات" icon="stats" onPress={() => goTo('stats')} /><Quick title="استثماراتي" icon="investments" onPress={() => goTo('investments')} /><Quick title="ثروتي" icon="wealth" onPress={() => goTo('wealth')} /><Quick title="مزيد" icon="more" onPress={() => goTo('more')} /></View></ScreenWrap>;
}
function UsersManagerScreen({ onBack, currentUser }) {
  return <ScreenWrap><View style={styles.simpleTopBar}><TouchableOpacity style={styles.simpleBackButton} onPress={onBack}><UiIcon name="back" size={24} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.simpleTopTitle}>إدارة المستخدمين</Text><View style={styles.simpleBackButton} /></View><Header badge="Ahmed" title="إدارة المستخدمين" subtitle="هذه الشاشة للمدير فقط، ولا تسمح بتغيير حساب الجلسة أو مشاهدة بيانات مستخدم آخر." icon="users" /><AhmedUsersManagerPanel currentUser={currentUser} /></ScreenWrap>;
}
function MoreScreen({ goTo, setInvestmentScreen, setActiveTab, currentUser, isAdmin, onLogout }) {
  const openInvestment = (screen) => { setActiveTab('investments'); setInvestmentScreen(screen); };
  return <ScreenWrap><Header badge={currentUser?.name || 'Ahmed'} title="مزيد" subtitle="الاختصارات والإعدادات." icon="settings" /><View style={styles.currentUserCard}><Text style={styles.currentUserTitle}>الحساب الحالي</Text><Text style={styles.currentUserText}>{currentUser?.name || '-'}</Text><Text style={styles.currentUserText}>اسم الدخول: {currentUser?.username || '-'}</Text></View><View style={styles.menu}>{isAdmin ? <MenuRow title="إدارة المستخدمين" text="إضافة وتعديل المستخدمين للمدير فقط" icon="users" onPress={() => goTo('usersManager')} /> : null}<MenuRow title="الخزنة الآمنة" text="حفظ الحسابات والبطاقات وCVV والبيانات الحساسة" icon="settings" onPress={() => goTo('secureVault')} /><MenuRow title="احصائيات" text="احصائيات عامة" icon="stats" onPress={() => goTo('stats')} /><MenuRow title="تقارير" text="مركز التقارير" icon="reports" onPress={() => goTo('reports')} /><MenuRow title="استيراد صورة تعميد" text="قراءة صورة الفرصة" icon="ta3meed" onPress={() => openInvestment('ta3meedImageImport')} /><MenuRow title="حسابات المستثمرين" text="حركات وأرصدة المستثمرين" icon="users" onPress={() => openInvestment('ta3meedAccounts')} /><MenuRow title="خروج" text="إقفال الجلسة والعودة لشاشة الدخول" icon="close" onPress={onLogout} last /></View></ScreenWrap>;
}
function Quick({ title, icon, onPress }) { return <TouchableOpacity onPress={onPress} style={styles.card}><View style={styles.iconBox}><UiIcon name={icon} size={24} /></View><Text style={styles.cardTitle}>{title}</Text></TouchableOpacity>; }
function MenuRow({ title, text, icon, onPress, last }) { return <TouchableOpacity onPress={onPress} style={[styles.menuRow, last && styles.menuRowLast]}><View style={styles.menuIcon}><UiIcon name={icon} size={24} /></View><View style={styles.menuTextBlock}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuText}>{text}</Text></View><UiIcon name="back" size={22} color={ICON_COLOR_SOFT} /></TouchableOpacity>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7fb' },
  screenLayer: { flex: 1, paddingBottom: 98 },
  noTabs: { paddingBottom: 0 },
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  page: { padding: 18, paddingBottom: 34 },
  simpleTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 },
  simpleBackButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  simpleTopTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  headerBadge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', gap: 7, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  headerBadgeText: { color: '#cbd5e1', fontWeight: '900' },
  headerTitle: { marginTop: 16, color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  currentUserCard: { marginTop: 14, backgroundColor: '#ecfdf5', borderRadius: 22, borderWidth: 1, borderColor: '#99f6e4', padding: 14, alignItems: 'flex-end' },
  currentUserTitle: { color: '#0f766e', fontWeight: '900', fontSize: 17, textAlign: 'right' },
  currentUserText: { marginTop: 4, color: '#0f172a', fontWeight: '800', textAlign: 'right' },
  grid: { marginTop: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  card: { flexBasis: '47.5%', flexGrow: 1, minHeight: 150, backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', alignItems: 'flex-end' },
  disabledCard: { opacity: 0.72, backgroundColor: '#f8fafc' },
  iconBox: { width: 54, height: 54, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  cardText: { marginTop: 6, color: '#64748b', lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  openText: { marginTop: 'auto', color: ICON_COLOR_DARK, fontWeight: '900', textAlign: 'right' },
  soonText: { color: '#94a3b8' },
  menu: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  menuTextBlock: { flex: 1, alignItems: 'flex-end' },
  menuTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  tabBar: { width: '100%', minHeight: 78, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  tabButton: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: '#f8fafc' },
  tabIconBubble: { width: 35, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabIconBubbleActive: { backgroundColor: ICON_COLOR },
  tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tabLabelActive: { color: ICON_COLOR_DARK },
  centerTabHit: { flex: 1.05, minHeight: 74, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  centerTabButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#fff' },
  centerTabButtonActive: { backgroundColor: ICON_COLOR_DARK },
});