import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  Layers,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { n } from './ta3meedUtils';

const formatAmount = (value) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function Amount({ value, loading, style, currencyStyle, large = false }) {
  return (
    <View style={ui.amountRow}>
      <Text
        style={[ui.amount, large && ui.heroAmount, style]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {loading ? '—' : formatAmount(value)}
      </Text>
      <Text style={[ui.currency, currencyStyle]}>ر.س</Text>
    </View>
  );
}

function ActionIcon({ label, hint, Icon, color, backgroundColor, onPress, testID }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testID}
      activeOpacity={0.72}
      onPress={onPress}
      style={[ui.action, { backgroundColor }]}
    >
      <Icon size={21} color={color} strokeWidth={1.9} />
    </TouchableOpacity>
  );
}

function Metric({ title, value, note, Icon, color, backgroundColor, loading, compact }) {
  return (
    <View style={ui.metric}>
      <View style={ui.metricHeading}>
        <View style={[ui.metricIcon, { backgroundColor }]}>
          <Icon size={16} color={color} strokeWidth={1.9} />
        </View>
        <Text style={ui.metricTitle}>{title}</Text>
      </View>
      <Amount value={value} loading={loading} style={{ color, fontSize: compact ? 18 : 21 }} />
      <Text style={ui.metricNote}>{note}</Text>
    </View>
  );
}

export function InvestorAccountDashboard({ investor, account, message, setScreen }) {
  const { width } = useWindowDimensions();
  const balance = n(account?.balance);
  const ta3meed = n(account?.ta3meed);
  const endedProfit = n(account?.endedProfit);
  const cash = balance + endedProfit - ta3meed;
  const capital = balance + endedProfit;
  const loading = !account;
  const metrics = [
    { title: 'الحوالات الشخصية', value: balance, note: 'الإضافات بعد خصم السحوبات', Icon: ArrowLeftRight, color: '#275bb9', backgroundColor: '#edf3ff' },
    { title: 'رأس المال', value: capital, note: 'الحوالات + ربح تعميد المنتهي', Icon: CircleDollarSign, color: '#0f766e', backgroundColor: '#eaf8f3' },
    { title: 'إجمالي المستثمر', value: n(account?.activeInvested), note: 'رأس مال الفرص غير المنتهية', Icon: Banknote, color: '#334155', backgroundColor: '#f1f5f9' },
    { title: 'نصيبه المستلم', value: n(account?.activeReceived), note: 'المستلم من أصل رأس المال فقط', Icon: ArrowDownLeft, color: '#7550b5', backgroundColor: '#f2edfc' },
    { title: 'ربح متوقع', value: n(account?.expectedProfit), note: 'الربح المتوقع لحصة المستثمر', Icon: TrendingUp, color: '#a66a0c', backgroundColor: '#fff5dc' },
    { title: 'ربح تعميد المنتهي', value: endedProfit, note: 'المستلم كاملًا − أصل الاستثمار', Icon: BadgeCheck, color: '#0f766e', backgroundColor: '#eaf8f3' },
  ];

  return (
    <View testID="ta3meed-investor-dashboard" style={ui.root}>
      <View style={ui.heading}>
        <View style={ui.identity}>
          <View style={ui.avatar}><UserRound size={23} color="#645391" strokeWidth={1.7} /></View>
          <View style={ui.identityCopy}>
            <Text style={ui.eyebrow}>حساب المستثمر</Text>
            <Text style={ui.name}>{investor.name}</Text>
          </View>
        </View>
        <View style={ui.actions}>
          <ActionIcon
            label="إدارة حركات الرصيد"
            hint="إضافة رصيد وتسجيل سحب وتعديل الحركات"
            Icon={SlidersHorizontal}
            color="#645391"
            backgroundColor="#ede8f7"
            onPress={() => setScreen('manage')}
            testID="investor-manage-balance"
          />
          <ActionIcon
            label="الحركات المالية"
            hint="عرض الاستلامات والإيداعات والسحوبات"
            Icon={ArrowLeftRight}
            color="#0f766e"
            backgroundColor="#e3f2ee"
            onPress={() => setScreen('movements')}
            testID="investor-financial-movements"
          />
        </View>
      </View>

      <View style={ui.hero}>
        <View style={ui.heroHeading}>
          <Text style={ui.heroTitle}>مستثمر تعميد</Text>
          <View style={ui.heroIcon}><TrendingUp size={20} color="#bde9de" strokeWidth={1.8} /></View>
        </View>
        <Amount value={ta3meed} loading={loading} large currencyStyle={ui.heroCurrency} />
        <Text style={ui.heroNote}>رأس المال المتبقي في الفرص غير المنتهية</Text>

        <View style={ui.cash}>
          <View style={ui.cashHeading}>
            <Wallet size={17} color="#e3def3" strokeWidth={1.8} />
            <Text style={ui.cashTitle}>الكاش</Text>
          </View>
          <Amount
            value={cash}
            loading={loading}
            style={[ui.cashAmount, cash < 0 && ui.negative]}
            currencyStyle={ui.cashCurrency}
          />
        </View>
        <Text style={ui.cashNote}>الحوالات + ربح المنتهي − مستثمر تعميد</Text>
      </View>

      {!!message && <Text accessibilityRole="alert" style={ui.message}>{message}</Text>}

      <View style={ui.sectionHeading}>
        <Text style={ui.sectionTitle}>تفاصيل الحساب</Text>
        <View style={ui.count}>
          <Layers size={13} color="#7a7196" strokeWidth={1.8} />
          <Text style={ui.countText}>{loading ? '—' : n(account?.opportunitiesCount)} فرصة</Text>
        </View>
      </View>

      {[0, 2, 4].map((index) => (
        <View key={index} style={ui.metricsRow}>
          {metrics.slice(index, index + 2).map((metric) => <Metric key={metric.title} {...metric} loading={loading} compact={width < 360} />)}
        </View>
      ))}
    </View>
  );
}

const ui = StyleSheet.create({
  root: { paddingBottom: 12 },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, paddingHorizontal: 2 },
  identity: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede8f7' },
  identityCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  eyebrow: { color: '#7a8191', fontSize: 11, fontWeight: '600', textAlign: 'right', writingDirection: 'rtl' },
  name: { color: '#202238', fontSize: 23, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginTop: 2 },
  actions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  action: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: '#443578', borderRadius: 23, paddingHorizontal: 20, paddingTop: 17, paddingBottom: 13 },
  heroHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  heroTitle: { color: '#e8e1fa', fontSize: 14, fontWeight: '700', textAlign: 'right' },
  heroIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#554585', alignItems: 'center', justifyContent: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 5, minWidth: 0 },
  amount: { color: '#202238', fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: 'right', flexShrink: 1 },
  currency: { color: '#8b91a0', fontSize: 10, fontWeight: '600', flexShrink: 0 },
  heroAmount: { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -0.6 },
  heroCurrency: { color: '#ddd4f2', fontSize: 13, marginLeft: 2 },
  heroNote: { color: '#cfc5e6', fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl', marginTop: 3 },
  cash: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 17, borderTopWidth: 1, borderTopColor: '#6b5c96', paddingTop: 13 },
  cashHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  cashTitle: { color: '#eee8fc', fontSize: 13, fontWeight: '700' },
  cashAmount: { color: '#c0f2df', fontSize: 23 },
  negative: { color: '#ffc2cb' },
  cashCurrency: { color: '#ddd4f2', fontSize: 10 },
  cashNote: { color: '#cfc5e6', fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl', marginTop: 7 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 11, paddingHorizontal: 3 },
  sectionTitle: { color: '#30334b', fontSize: 15, fontWeight: '800', textAlign: 'right' },
  count: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: '#edeaf4' },
  countText: { color: '#7a7196', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  metricsRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  metric: { flex: 1, minWidth: 0, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e8ef', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 13 },
  metricHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginBottom: 11 },
  metricIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricTitle: { flex: 1, color: '#647084', fontSize: 11, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  metricNote: { color: '#737e91', fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  message: { backgroundColor: '#edf3ff', color: '#275bb9', borderRadius: 12, padding: 11, marginTop: 12, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
});
