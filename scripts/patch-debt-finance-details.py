#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'ahmed-mobile' / 'DebtsScreen.js'
text = path.read_text(encoding='utf-8')

text = text.replace(
    '<MiniStat label="المبلغ الأصلي" value={money(debt?.original_amount)} />',
    '<MiniStat label="إجمالي التمويل" value={money(debt?.original_amount)} />',
)

if '<FinancingDetails debt={debt} />' not in text:
    anchor = '''      <View style={styles.detailStatsGrid}>
        <MiniStat label="إجمالي التمويل" value={money(debt?.original_amount)} />
        <MiniStat label="تم سداده" value={money(debt?.paid_amount)} />
        <MiniStat label="دفعة هذا الشهر" value={money(debt?.current_month_due)} />
        <MiniStat label="آخر دفعة" value={debt?.end_date ? monthLabel(debt.end_date) : '-'} />
      </View>
'''
    replacement = anchor + '      <FinancingDetails debt={debt} />\n'
    if anchor not in text:
        raise SystemExit('Debt detail stats anchor not found')
    text = text.replace(anchor, replacement, 1)

if 'function FinancingDetails(' not in text:
    anchor = '''function MiniStat({ label, value }) {
  return <View style={styles.miniStat}><Text style={styles.miniStatValue}>{value}</Text><Text style={styles.miniStatLabel}>{label}</Text></View>;
}
'''
    block = '''function FinancingDetails({ debt }) {
  const hasDetails = debt?.contract_date || n(debt?.down_payment) > 0 || n(debt?.financing_amount) > 0 || n(debt?.profit_amount) > 0;
  if (!hasDetails) return null;

  const previousCount = n(debt?.previous_installments_count);
  const previousAmount = n(debt?.previous_installment_amount);
  const previousFormula = previousCount > 0 && previousAmount > 0
    ? `${previousCount} × ${money(previousAmount)} = ${money(debt?.opening_paid_amount)}`
    : money(debt?.opening_paid_amount);

  return (
    <View style={styles.financeCard}>
      <Text style={styles.financeTitle}>بيانات التمويل والحساب</Text>
      <FinanceRow label="تاريخ العقد" value={debt?.contract_date ? dateLabel(debt.contract_date) : '-'} />
      <FinanceRow label="الدفعة الأولى" value={money(debt?.down_payment)} />
      <FinanceRow label="مبلغ التمويل" value={money(debt?.financing_amount)} />
      <FinanceRow label="مبلغ الربح" value={money(debt?.profit_amount)} />
      <FinanceRow label="إجمالي التمويل مع الربح" value={money(debt?.original_amount)} />
      <FinanceRow label="هامش الربح" value={debt?.profit_margin == null ? '-' : percent(debt.profit_margin)} />
      {previousAmount > 0 ? <FinanceRow label="قيمة القسط السابق" value={money(previousAmount)} /> : null}
      {previousCount > 0 ? <FinanceRow label="الأقساط السابقة" value={previousFormula} compact /> : null}
      <FinanceRow label="إجمالي المدفوع مع الدفعة الأولى" value={money(debt?.total_paid_with_down_payment)} />
      <FinanceRow label="إجمالي تكلفة العقار" value={money(debt?.total_cost)} />
      <FinanceRow label="نسبة السداد الإجمالية" value={percent(debt?.overall_progress_percent)} last />
    </View>
  );
}

function FinanceRow({ label, value, compact, last }) {
  return (
    <View style={[styles.financeRow, last && styles.financeRowLast]}>
      <Text style={[styles.financeValue, compact && styles.financeFormula]}>{value}</Text>
      <Text style={styles.financeLabel}>{label}</Text>
    </View>
  );
}

''' + anchor
    if anchor not in text:
        raise SystemExit('MiniStat anchor not found')
    text = text.replace(anchor, block, 1)

if 'financeCard:' not in text:
    anchor = "  filterRow: { marginTop: 13, flexDirection: 'row-reverse', gap: 7 },\n"
    styles = '''  financeCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#ddd6fe', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  financeTitle: { color: '#5b21b6', fontSize: 17, fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  financeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7', paddingVertical: 9 },
  financeRowLast: { borderBottomWidth: 0 },
  financeLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  financeValue: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'left' },
  financeFormula: { fontSize: 11 },
'''
    if anchor not in text:
        raise SystemExit('Styles anchor not found')
    text = text.replace(anchor, styles + anchor, 1)

path.write_text(text, encoding='utf-8')
print('Debt financing details patch applied')
