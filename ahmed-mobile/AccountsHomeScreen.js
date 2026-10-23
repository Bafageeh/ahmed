import React from 'react';
import { I18nManager, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ArrowDownLeft, BadgeCheck, ChartNoAxesCombined, ChevronLeft, CreditCard, Gem, Landmark, ReceiptText, Wallet } from 'lucide-react-native';

const incomeLinks = [
  {
    key: 'futureMonthlyIncome',
    title: 'دخل شهري مستقبلي',
    displayTitle: 'المستقبلي',
    caption: 'خطّط لدخلك القادم',
    action: 'مصادر الدخل',
    Icon: ChartNoAxesCombined,
    color: '#6D42CF',
    background: '#F2ECFF',
    border: '#E7DCFC',
    iconBackground: '#E7DBFF',
  },
  {
    key: 'actualMonthlyIncome',
    title: 'دخل شهري حقيقي',
    displayTitle: 'الحقيقي',
    caption: 'تابع دخلك المحقّق',
    action: 'الدخل الفعلي',
    Icon: BadgeCheck,
    color: '#13776A',
    background: '#EAF6F2',
    border: '#D7EDE5',
    iconBackground: '#D3EDE3',
  },
];

const accountLinks = [
  { key: 'personalExpenses', title: 'مصروفاتي', caption: 'المصروفات الشهرية والسنوية', Icon: ReceiptText, color: '#B36229', background: '#FFF1E5' },
  { key: 'debts', title: 'ديوني', caption: 'الأقساط والمبالغ المتبقية', Icon: CreditCard, color: '#4E6ABD', background: '#EBF0FF' },
  { key: 'wealth', title: 'ثروتي', caption: 'نظرة شاملة على أموالك', Icon: Gem, color: '#7852B8', background: '#F1EBFA' },
];

function AccountRow({ item, onPress, last }) {
  const { Icon } = item;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={item.caption}
      activeOpacity={0.72}
      onPress={onPress}
      style={[styles.accountRow, !last && styles.rowBorder]}
      testID={`accounts-link-${item.key}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: item.background }]}>
        <Icon size={23} color={item.color} strokeWidth={1.9} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowCaption}>{item.caption}</Text>
      </View>
      <ChevronLeft size={19} color="#9CA1B3" strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

export default function AccountsHomeScreen({ goTo }) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 300 || fontScale > 1.2;

  return (
    <SafeAreaView style={styles.safe} testID="accounts-home-redesign-v1">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text accessibilityRole="header" style={styles.title}>حساباتي</Text>
              <Text style={styles.subtitle}>دخلك والتزاماتك، في مكان واحد</Text>
            </View>
            <View style={styles.headingIcon}>
              <Wallet size={27} color="#7245CB" strokeWidth={1.8} />
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>الدخل الشهري</Text>
            <Text style={styles.sectionNote}>التخطيط والمتابعة</Text>
          </View>
          <View style={[styles.incomeGrid, singleColumn && styles.incomeGridStack]}>
            {incomeLinks.map(({ Icon, ...item }) => (
              <TouchableOpacity
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityHint={item.caption}
                activeOpacity={0.75}
                onPress={() => goTo(item.key)}
                style={[styles.incomeCard, { backgroundColor: item.background, borderColor: item.border }, singleColumn && styles.incomeCardStack]}
                testID={`accounts-link-${item.key}`}
              >
                <View style={[styles.incomeIcon, { backgroundColor: item.iconBackground }]}>
                  <Icon size={24} color={item.color} strokeWidth={1.8} />
                </View>
                <Text style={styles.incomeTitle}>{item.displayTitle}</Text>
                <Text style={styles.incomeCaption}>{item.caption}</Text>
                <View style={styles.incomeAction}>
                  <Text style={[styles.incomeActionText, { color: item.color }]}>{item.action}</Text>
                  <View style={styles.incomeArrow}><ArrowDownLeft size={17} color={item.color} strokeWidth={1.8} /></View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>الإدارة المالية</Text>
            <Text style={styles.sectionNote}>متابعة أموالك</Text>
          </View>
          <View style={styles.accountGroup}>
            {accountLinks.map((item, index) => (
              <AccountRow key={item.key} item={item} onPress={() => goTo(item.key)} last={index === accountLinks.length - 1} />
            ))}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="بيانات التمويل المرتبطة"
            accessibilityHint="عرض الأقساط والأرباح المستوردة من التمويل"
            activeOpacity={0.72}
            onPress={() => goTo('financeImports')}
            style={styles.linkedCard}
            testID="accounts-link-financeImports"
          >
            <View style={styles.linkedIcon}><Landmark size={21} color="#746486" strokeWidth={1.8} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.linkedTitle}>بيانات التمويل المرتبطة</Text>
              <Text style={styles.rowCaption}>الأقساط والأرباح المستوردة</Text>
            </View>
            <ChevronLeft size={19} color="#9CA1B3" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Use a physical right-to-left row in both native RTL and LTR web environments.
const rtlRow = I18nManager.isRTL ? 'row' : 'row-reverse';
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FC' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  heading: { flexDirection: rtlRow, alignItems: 'center', gap: 16, marginBottom: 25 },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { color: '#242235', fontSize: 30, lineHeight: 44, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: '#6C6B7D', fontSize: 13, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' },
  headingIcon: { width: 58, height: 58, borderRadius: 21, backgroundColor: '#EDE7F9', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: rtlRow, alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  sectionTitle: { color: '#343044', fontSize: 16, lineHeight: 26, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  sectionNote: { color: '#6D6C7E', fontSize: 11, lineHeight: 22, textAlign: 'left', writingDirection: 'rtl', flexShrink: 1 },
  incomeGrid: { flexDirection: rtlRow, alignItems: 'stretch', gap: 12, marginBottom: 25 },
  incomeGridStack: { flexDirection: 'column' },
  incomeCard: { flex: 1, minWidth: 0, borderRadius: 23, borderWidth: 1, padding: 16 },
  incomeCardStack: { flexBasis: 'auto', flexGrow: 0, flexShrink: 0 },
  incomeIcon: { width: 43, height: 43, borderRadius: 15, alignSelf: I18nManager.isRTL ? 'flex-start' : 'flex-end', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  incomeTitle: { color: '#302941', fontSize: 16, lineHeight: 27, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  incomeCaption: { marginTop: 4, color: '#686275', fontSize: 12, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  incomeAction: { flexDirection: rtlRow, alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 16 },
  incomeActionText: { flexShrink: 1, fontSize: 11, lineHeight: 22, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  incomeArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center' },
  accountGroup: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E8F0', borderRadius: 23, paddingHorizontal: 16 },
  accountRow: { flexDirection: rtlRow, alignItems: 'center', minHeight: 86, gap: 13, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0EFF5' },
  rowIcon: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#332F43', fontSize: 16, lineHeight: 25, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  rowCaption: { marginTop: 3, color: '#6D697B', fontSize: 12, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl' },
  linkedCard: { flexDirection: rtlRow, alignItems: 'center', minHeight: 83, gap: 12, marginTop: 17, borderWidth: 1, borderColor: '#E6E2EF', backgroundColor: '#F1EEF7', borderRadius: 21, paddingHorizontal: 16, paddingVertical: 14 },
  linkedIcon: { width: 41, height: 41, borderRadius: 14, backgroundColor: '#E8E2F0', alignItems: 'center', justifyContent: 'center' },
  linkedTitle: { color: '#5E506E', fontSize: 14, lineHeight: 24, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
});
