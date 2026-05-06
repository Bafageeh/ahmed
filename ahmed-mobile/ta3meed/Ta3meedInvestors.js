import React from 'react';
import { Text, View } from 'react-native';
import { EmptyCard } from './Ta3meedInvestmentCard';
import { styles } from './ta3meedStyles';
import { money } from './ta3meedUtils';

export function InvestorStats({ summary }) {
  const investors = summary?.investors || [];
  if (!investors.length) return <EmptyCard title="لا توجد إحصائيات" text="لا توجد بيانات مستثمرين بعد." />;

  return (
    <View style={styles.investorsCard}>
      <Text style={styles.panelTitle}>إحصائيات كل مستثمر</Text>
      {investors.map((investor) => (
        <View key={investor.name} style={styles.investorRow}>
          <View style={styles.investorAvatar}>
            <Text style={styles.investorAvatarText}>{String(investor.name || 'م').slice(0, 1)}</Text>
          </View>
          <View style={styles.investorInfo}>
            <Text style={styles.investorName}>{investor.name}</Text>
            <Text style={styles.investorText}>مجموع استثماراته: {money(investor.invested, 2)} ر.س</Text>
            <Text style={styles.investorText}>مجموع أرباحه المتوقعة: {money(investor.profit, 2)} ر.س</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
