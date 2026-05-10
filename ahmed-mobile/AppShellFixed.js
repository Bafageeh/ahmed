import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StatsDashboardScreen from './StatsDashboardScreen';
import Ta3meedScreen from './Ta3meedChromeFixedScreen';
import MoneyMoonScreen from './MoneyMoonScreen';
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
  { key: 'ta3meed', name: 'تعميد', icon: 'ta3meed', text: 'فرص تعميد، المستثمرين، الاستلام، والمتأخرات.', color: '#14b8a6' },
  { key: 'moneymoon', name: 'موني مون', icon: 'moneymoon', text: 'إدارة استثمارات موني مون النشطة والمستلمة.', color: '#7c3aed' },
  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'جاهزة لإضافة فرص دينار وحساباتها.', disabled: true, color: '#f59e0b' },
  { key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'جاهزة لإضافة فرص ترميز ومتابعتها.', disabled: true, color: '#0ea5e9' },
];

export default function AppShellFixed() {
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

  const inFullScreenInvestment = activeTab === 'investments' && (investmentScreen === 'ta3meed' || investmentScreen === 'moneymoon');

  const renderScreen = () => {
    if (activeTab === 'stats') return <StatsDashboardScreen />;
    if (activeTab === 'investments') {
      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'moneymoon') return <MoneyMoonScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meed-investors') return <Ta3meedInvestorsPlaceholder onBack={() => setInvestmentScreen('list')} />;
      return <InvestmentsScreen openPlatform={setInvestmentScreen} />;
    }
    if (activeTab === 'reports') return <ReportsScreen goTo={openTab} />;
    if (activeTab === 'more') return <MoreScreen goTo={openTab} openTa3meedInvestors={openTa3meedInvestors} />;
    return <WealthScreen openInvestments={openInvestments} />;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.bgBlobOne} />
      <View style={styles.bgBlobTwo} />
      <View style={[styles.screenLayer, inFullScreenInvestment && styles.screenLayerNoTabs]}>{renderScreen()}</View>
      {!inFullScreenInvestment ? <BottomTabs activeTab={activeTab} setActiveTab={openTab} /> : null}
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  return (
    <View style={styles.tabWrap} pointerEvents="box-none">
      <View style={styles.tabBar}>
        {tabs.map((tab) => <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onPress={() => setActiveTab(tab.key)} />)}
      </View>
    </View>
  );
}

function TabButton({ tab, active, onPress }) {
  if (tab.center) {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.centerTabHit} accessibilityLabel={tab.accessibilityLabel}>
        <View style={[styles.centerTabButton, active && styles.centerTabButtonActive]}>
          <UiIcon name={tab.icon} size={30} color="#ffffff" />
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <View style={[styles.tabIconBubble, active && styles.tabIconBubbleActive]}>
        <UiIcon name={tab.icon} size={21} color={active ? '#ffffff' : ICON_COLOR_DARK} />
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{tab.label}</Text>
    </TouchableOpacity>
  );
}

function InvestmentsScreen({ openPlatform }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <Header badge="استثماراتي" title="منصات الاستثمار" subtitle="بطاقات ملونة لكل منصة مع اختصارات سريعة وواضحة." icon="investments" />
        <View style={styles.platformsGrid}>
          {investmentPlatforms.map((platform) => (
            <TouchableOpacity
              key={platform.key}
              activeOpacity={0.84}
              onPress={() => platform.disabled ? null : openPlatform(platform.key)}
              style={[styles.investmentPlatformCard, platform.disabled && styles.disabledPlatformCard]}
            >
              <View style={[styles.platformAccent, { backgroundColor: platform.color }]} />
              <View style={[styles.outlineCircle, { borderColor: `${platform.color}44`, backgroundColor: `${platform.color}16` }]}><UiIcon name={platform.icon} size={29} color={platform.color} /></View>
              <Text style={styles.investmentPlatformName}>{platform.name}</Text>
              <Text style={styles.investmentPlatformText}>{platform.text}</Text>
              <Text style={[styles.platformOpenText, { color: platform.color }, platform.disabled && styles.platformSoonText]}>{platform.disabled ? 'قريبًا' : 'فتح المنصة'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Ta3meedInvestorsPlaceholder({ onBack }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <TouchableOpacity style={styles.roundBackButton} onPress={onBack} activeOpacity={0.84}><UiIcon name="back" size={24} /></TouchableOpacity>
          <Text style={styles.topLineTitle}>مستثمرين تعميد</Text>
        </View>
        <Header badge="تعميد" title="مستثمرين تعميد" subtitle="افتح شاشة تعميد لعرض تفاصيل المستثمرين والإحصائيات." icon="ta3meed" />
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportsScreen({ goTo }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <Header badge="مركز التقارير" title="تقارير أحمد" subtitle="اختصارات ملونة للوصول إلى أهم أجزاء التطبيق." icon="reports" />
        <View style={styles.quickGrid}>
          <QuickAction title="احصائيات" text="احصائيات عامة ولكل منصة" icon="stats" tone="#14b8a6" onPress={() => goTo('stats')} />
          <QuickAction title="استثماراتي" text="منصات الاستثمار فقط" icon="investments" tone="#7c3aed" onPress={() => goTo('investments')} />
          <QuickAction title="ثروتي" text="الدخل والمنصات العامة" icon="wealth" tone="#f97316" onPress={() => goTo('wealth')} />
          <QuickAction title="مزيد" text="إعدادات وروابط" icon="more" tone="#0ea5e9" onPress={() => goTo('more')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoreScreen({ goTo, openTa3meedInvestors }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <Header badge="Ahmed" title="مزيد" subtitle="اختصارات ثابتة بتصميم أوضح وألوان أخف." icon="settings" />
        <View style={styles.menuCard}>
          <MenuRow title="احصائيات" text="احصائيات عامة ولكل منصة" icon="stats" tone="#14b8a6" onPress={() => goTo('stats')} />
          <MenuRow title="ثروتي" text="ممتلكاتي الخاصة وحصصي الاستثمارية" icon="wealth" tone="#f97316" onPress={() => goTo('wealth')} />
          <MenuRow title="تقارير" text="مركز التقارير الرئيسي" icon="reports" tone="#0ea5e9" onPress={() => goTo('reports')} />
          <MenuRow title="استثماراتي" text="منصات الاستثمار فقط" icon="investments" tone="#7c3aed" onPress={() => goTo('investments')} />
          <MenuRow title="مستثمرين تعميد" text="إحصائيات وتوزيع مستثمري تعميد" icon="ta3meed" tone="#14b8a6" onPress={openTa3meedInvestors} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ badge, title, subtitle, icon }) {
  return (
    <View style={styles.modernHeader}>
      <View style={styles.headerGlowOne} />
      <View style={styles.headerGlowTwo} />
      <View style={styles.headerBadgeRow}><UiIcon name={icon} size={18} color="#ffffff" /><Text style={styles.headerBadgeText}>{badge}</Text></View>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </View>
  );
}

function QuickAction({ title, text, icon, tone, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.quickCard}>
      <View style={[styles.quickIcon, { backgroundColor: `${tone}18`, borderColor: `${tone}33` }]}><UiIcon name={icon} size={24} color={tone} /></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickText}>{text}</Text>
    </TouchableOpacity>
  );
}

function MenuRow({ title, text, icon, tone, onPress, last }) {
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={[styles.menuRow, last && styles.menuRowLast]}>
      <View style={[styles.menuIcon, { backgroundColor: `${tone}16`, borderColor: `${tone}33` }]}><UiIcon name={icon} size={24} color={tone} /></View>
      <View style={styles.menuTextBlock}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuText}>{text}</Text></View>
      <UiIcon name="back" size={22} color={ICON_COLOR_SOFT} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef2ff' },
  bgBlobOne: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: '#ddd6fe', top: -90, right: -80, opacity: 0.75 },
  bgBlobTwo: { position: 'absolute', width: 210, height: 210, borderRadius: 999, backgroundColor: '#bae6fd', bottom: 40, left: -90, opacity: 0.65 },
  screenLayer: { flex: 1, paddingBottom: 98, backgroundColor: 'transparent' },
  screenLayerNoTabs: { paddingBottom: 0 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  pageContainer: { padding: 18, paddingBottom: 34 },
  modernHeader: { marginTop: 10, backgroundColor: '#312e81', borderRadius: 32, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#4338ca' },
  headerGlowOne: { position: 'absolute', width: 190, height: 190, borderRadius: 999, backgroundColor: '#7c3aed', opacity: 0.38, top: -70, left: -45 },
  headerGlowTwo: { position: 'absolute', width: 160, height: 160, borderRadius: 999, backgroundColor: '#38bdf8', opacity: 0.24, bottom: -70, right: -45 },
  headerBadgeRow: { alignSelf: 'flex-start', flexDirection: 'row-reverse', gap: 7, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  headerBadgeText: { color: '#ffffff', fontWeight: '900' },
  headerTitle: { marginTop: 16, color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { marginTop: 8, color: '#e0e7ff', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  topLine: { marginTop: 4, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  roundBackButton: { width: 46, height: 46, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  topLineTitle: { flex: 1, color: '#312e81', fontSize: 22, fontWeight: '900', textAlign: 'center', marginRight: 46 },
  platformsGrid: { marginTop: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  investmentPlatformCard: { flexBasis: '47.5%', flexGrow: 1, minHeight: 184, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 28, padding: 16, borderWidth: 1, borderColor: '#e0e7ff', alignItems: 'flex-end', overflow: 'hidden' },
  platformAccent: { position: 'absolute', width: 5, top: 16, bottom: 16, right: 0, borderTopLeftRadius: 99, borderBottomLeftRadius: 99 },
  disabledPlatformCard: { opacity: 0.74, backgroundColor: '#f8fafc' },
  outlineCircle: { width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1 },
  investmentPlatformName: { color: '#111827', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  investmentPlatformText: { marginTop: 6, color: '#64748b', lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  platformOpenText: { marginTop: 'auto', fontWeight: '900', textAlign: 'right' },
  platformSoonText: { color: '#94a3b8' },
  quickGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  quickCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#e0e7ff', alignItems: 'flex-end' },
  quickIcon: { width: 44, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1 },
  quickTitle: { color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  quickText: { marginTop: 5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  menuCard: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 28, borderWidth: 1, borderColor: '#e0e7ff', overflow: 'hidden' },
  menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#eef2ff' },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 50, height: 50, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  menuTextBlock: { flex: 1, alignItems: 'flex-end' },
  menuTitle: { color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  tabBar: { width: '100%', minHeight: 80, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#ddd6fe', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  tabButton: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabButtonActive: { backgroundColor: '#f5f3ff' },
  tabIconBubble: { width: 36, height: 33, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabIconBubbleActive: { backgroundColor: ICON_COLOR },
  tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tabLabelActive: { color: ICON_COLOR_DARK },
  centerTabHit: { flex: 1.05, minHeight: 76, alignItems: 'center', justifyContent: 'center', marginTop: -28 },
  centerTabButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#ffffff' },
  centerTabButtonActive: { backgroundColor: '#312e81' },
});
