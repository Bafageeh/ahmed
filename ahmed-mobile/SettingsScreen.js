import React from 'react';
import { Platform, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UiIcon from './UiIcon';

const TOP_INSET = Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight || 0, 24) : 0;
const ACCENT = '#6d57b8';

export default function SettingsScreen({ goTo, currentUser, isAdmin, onLogout }) {
  const adminItems = [
    { key: 'bankStatementSchedules', title: 'مواعيد كشف البطاقات', detail: 'إدارة مواعيد الكشف والتنبيهات', icon: 'payments' },
    { key: 'usersManager', title: 'إدارة المستخدمين', detail: 'إضافة المستخدمين وإدارة حساباتهم', icon: 'users' },
  ];
  const dataItems = [
    { key: 'smsArchive', title: 'رسائل SMS', detail: 'حفظ رسائل تعميد ومراجعتها واعتمادها', icon: 'sms' },
    { key: 'financeImports', title: 'قيم التمويل المستوردة', detail: 'عرض القيم المرتبطة بتطبيق Finance', icon: 'stats' },
  ];

  return <SafeAreaView style={s.safe} testID="ahmed-settings-redesign">
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="رجوع إلى الرئيسية" onPress={() => goTo('reports')} style={s.back}><UiIcon name="back" color={ACCENT} size={22} /></TouchableOpacity>
      <View style={s.heading}><Text accessibilityRole="header" style={s.title}>الإعدادات</Text><Text style={s.subtitle}>حسابك وأدواتك في مكان واحد</Text></View>
    </View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.profile}>
        <View style={s.avatar}><UiIcon name="users" size={24} color={ACCENT} /></View>
        <View style={s.identity}><Text style={s.accountLabel}>الحساب الحالي</Text><Text numberOfLines={2} style={s.name}>{currentUser?.name || currentUser?.username || 'حسابي'}</Text><Text numberOfLines={1} style={s.username}>{currentUser?.username ? `@${currentUser.username}` : 'حساب مسجل الدخول'}</Text></View>
        <View style={s.role}><Text style={s.roleText}>{isAdmin ? 'مدير' : 'مستخدم'}</Text></View>
      </View>

      {isAdmin ? <Group title="الإدارة" items={adminItems} goTo={goTo} /> : null}
      <Group title="الرسائل والبيانات" items={dataItems} goTo={goTo} />

      <View style={s.session}>
        <SettingsRow title="تسجيل الخروج" detail="إنهاء الجلسة الحالية" icon="logout" danger onPress={onLogout} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Group({ title, items, goTo }) {
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
    <View style={s.group}>{items.map((item, index) => <React.Fragment key={item.key}>
      {index ? <View style={s.divider} /> : null}
      <SettingsRow title={item.title} detail={item.detail} icon={item.icon} onPress={() => goTo(item.key)} />
    </React.Fragment>)}</View>
  </View>;
}

function SettingsRow({ title, detail, icon, onPress, danger = false }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} activeOpacity={0.7} onPress={onPress} style={s.row}>
    <View style={[s.rowIcon, danger && s.dangerIcon]}><UiIcon name={icon} size={21} color={danger ? '#b44758' : ACCENT} /></View>
    <View style={s.rowCopy}><Text style={[s.rowTitle, danger && s.dangerText]}>{title}</Text><Text style={s.rowDetail}>{detail}</Text></View>
    {danger ? <View style={s.endSpace} /> : <UiIcon name="back" size={17} color="#a2a5b5" />}
  </TouchableOpacity>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: TOP_INSET + 12, paddingBottom: 17 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e6f0', alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, alignItems: 'flex-end' }, title: { color: '#20263c', fontSize: 23, fontWeight: '800', textAlign: 'right' }, subtitle: { color: '#6f7388', fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: 'right' },
  content: { paddingHorizontal: 16, paddingBottom: 20 },
  profile: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e7f0', borderRadius: 19, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 19 },
  avatar: { width: 49, height: 49, backgroundColor: '#f0ecfa', borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, alignItems: 'flex-end' }, accountLabel: { color: '#6f7388', fontSize: 10, marginBottom: 4 }, name: { color: '#252b41', fontSize: 16, lineHeight: 23, fontWeight: '800', textAlign: 'right' }, username: { color: '#6f7388', fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: 'right' },
  role: { borderRadius: 8, backgroundColor: '#f2effa', paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'center' }, roleText: { color: ACCENT, fontSize: 10, fontWeight: '700' },
  section: { marginBottom: 18 }, sectionTitle: { color: '#6f7388', fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 8, paddingHorizontal: 4 },
  group: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e7f0', borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 72, flexDirection: 'row-reverse', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 13 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#f3f1fa', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, alignItems: 'flex-end' }, rowTitle: { color: '#2b3046', fontSize: 14, fontWeight: '700', lineHeight: 22, textAlign: 'right' }, rowDetail: { color: '#6f7388', fontSize: 11, lineHeight: 18, marginTop: 2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#f0f0f6', marginRight: 64, marginLeft: 13 }, endSpace: { width: 17 },
  session: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#ede4e9' }, dangerIcon: { backgroundColor: '#fcf0f2' }, dangerText: { color: '#b44758' },
});
