import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppPatched from './AppPatched';
import FinanceSummaryScreen from './FinanceSummaryScreen';
import Ta3meedScreen from './Ta3meedScreen';

const tabs = [
  { key: 'stats', label: 'احصائيات', icon: '⌁' },
  { key: 'wealth', label: 'ثروتي', icon: '◈' },
  { key: 'reports', label: 'تقارير', icon: '◎', center: true },
  { key: 'wallet', label: 'محفظتي', icon: '◍' },
  { key: 'more', label: 'مزيد', icon: '⋯' },
];

export default function AppShell() {
  const [activeTab, setActiveTab] = useState('wealth');

  const activeTitle = useMemo(() => tabs.find((tab) => tab.key === activeTab)?.label || 'ثروتي', [activeTab]);

  const renderScreen = () => {
    if (activeTab === 'stats') return <FinanceSummaryScreen onBack={() => setActiveTab('wealth')} />;
    if (activeTab === 'wallet') return <Ta3meedScreen onBack={() => setActiveTab('wealth')} />;
    if (activeTab === 'reports') return <ReportsScreen goTo={setActiveTab} />;
    if (activeTab === 'more') return <MoreScreen goTo={setActiveTab} />;
    return <AppPatched />;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.screenLayer}>
        {renderScreen()}
      </View>
      <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} activeTitle={activeTitle} />
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
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.centerTabHit}>
        <View style={[styles.centerTabButton, active && styles.centerTabButtonActive]}>
          <Text style={[styles.centerTabIcon, active && styles.centerTabIconActive]}>{tab.icon}</Text>
        </View>
        <Text style={[styles.centerTabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <View style={[styles.tabIconBubble, active && styles.tabIconBubbleActive]}>
        <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{tab.label}</Text>
    </TouchableOpacity>
  );
}

function ReportsScreen({ goTo }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.modernHeader}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerBadge}>مركز التقارير</Text>
          <Text style={styles.headerTitle}>تقارير أحمد</Text>
          <Text style={styles.headerSubtitle}>مدخل سريع للتقارير والملخصات القادمة من المحافظ والدخل و Finance.</Text>
        </View>

        <View style={styles.reportHeroCard}>
          <View style={styles.reportIcon}><Text style={styles.reportIconText}>◎</Text></View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>لوحة التقارير الرئيسية</Text>
            <Text style={styles.reportText}>تم تجهيز التبويب المركزي ليكون نقطة الوصول للتقارير التفصيلية القادمة.</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction title="احصائيات" text="قيم Finance والدخل" icon="⌁" onPress={() => goTo('stats')} />
          <QuickAction title="محفظتي" text="تعميد والاستثمارات" icon="◍" onPress={() => goTo('wallet')} />
          <QuickAction title="ثروتي" text="المنصات والدخل" icon="◈" onPress={() => goTo('wealth')} />
          <QuickAction title="مزيد" text="إعدادات وروابط" icon="⋯" onPress={() => goTo('more')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoreScreen({ goTo }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.modernHeader}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerBadge}>Ahmed</Text>
          <Text style={styles.headerTitle}>مزيد</Text>
          <Text style={styles.headerSubtitle}>اختصارات ثابتة للوصول السريع إلى الشاشات الرئيسية.</Text>
        </View>

        <View style={styles.menuCard}>
          <MenuRow title="احصائيات" text="عرض مؤشرات Finance والقيم المستوردة" icon="⌁" onPress={() => goTo('stats')} />
          <MenuRow title="ثروتي" text="الشاشة الرئيسية والمنصات والدخل" icon="◈" onPress={() => goTo('wealth')} />
          <MenuRow title="تقارير" text="مركز التقارير الرئيسي" icon="◎" onPress={() => goTo('reports')} />
          <MenuRow title="محفظتي" text="محفظة تعميد والاستثمارات" icon="◍" onPress={() => goTo('wallet')} last />
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
  screenLayer: { flex: 1, paddingBottom: 100, backgroundColor: '#f4f7fb' },
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  pageContainer: { padding: 18, paddingBottom: 32 },
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
    width: 170,
    height: 170,
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
  reportIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  reportIconText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  reportInfo: { flex: 1, alignItems: 'flex-end' },
  reportTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  reportText: { marginTop: 6, color: '#64748b', lineHeight: 22, textAlign: 'right', fontWeight: '700' },
  quickGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  quickCard: { flexBasis: '47.5%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  quickIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  quickIconText: { color: '#0f766e', fontSize: 23, fontWeight: '900' },
  quickTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  quickText: { marginTop: 5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  menuCard: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  menuIconText: { color: '#0f766e', fontSize: 24, fontWeight: '900' },
  menuTextBlock: { flex: 1, alignItems: 'flex-end' },
  menuTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  menuArrow: { color: '#94a3b8', fontSize: 28, fontWeight: '900', marginTop: -2 },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  tabBar: {
    width: '100%',
    minHeight: 78,
    borderRadius: 30,
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
  tabIconBubble: { width: 34, height: 30, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabIconBubbleActive: { backgroundColor: '#0f766e' },
  tabIcon: { color: '#64748b', fontSize: 19, fontWeight: '900' },
  tabIconActive: { color: '#ffffff' },
  tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tabLabelActive: { color: '#0f766e' },
  centerTabHit: { flex: 1.08, minHeight: 70, alignItems: 'center', justifyContent: 'center', marginTop: -24 },
  centerTabButton: {
    width: 68,
    height: 68,
    borderRadius: 26,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  centerTabButtonActive: { backgroundColor: '#0f766e' },
  centerTabIcon: { color: '#ffffff', fontSize: 32, fontWeight: '900' },
  centerTabIconActive: { color: '#ffffff' },
  centerTabLabel: { marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
});
