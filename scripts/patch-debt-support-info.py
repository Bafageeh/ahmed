#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'ahmed-mobile' / 'DebtsLoansScreen.js'
text = path.read_text(encoding='utf-8')

hero_anchor = '''                <DebtDetailHero debt={detail || selectedDebt} />
'''
info_line = '''                <FinancingDetails debt={detail || selectedDebt} />
'''
if info_line not in text:
    if hero_anchor not in text:
        raise SystemExit('Debt detail hero anchor not found')
    text = text.replace(hero_anchor, hero_anchor + info_line, 1)

if 'function FinancingDetails({ debt })' not in text:
    anchor = '''function MiniStat({ label, value }) {
'''
    block = r'''function FinancingDetails({ debt }) {
  const hasDetails = debt?.contract_date
    || n(debt?.down_payment) > 0
    || n(debt?.financing_amount) > 0
    || n(debt?.profit_amount) > 0
    || n(debt?.monthly_government_support) > 0;

  if (!hasDetails) return null;

  const previousCount = n(debt?.previous_installments_count);
  const previousAmount = n(debt?.previous_installment_amount);
  const previousTotal = n(debt?.previous_installments_total)
    || (previousCount * previousAmount);
  const supportAmount = n(debt?.monthly_government_support);
  const supportCount = n(debt?.previous_support_count);
  const supportTotal = n(debt?.previous_support_total)
    || (supportCount * supportAmount);

  return (
    <View style={styles.financeCard}>
      <View style={styles.financeHeader}>
        {supportAmount > 0 ? (
          <View style={styles.supportBadge}>
            <Text style={styles.supportBadgeText}>دعم حكومي</Text>
          </View>
        ) : null}
        <Text style={styles.financeTitle}>بيانات التمويل والدعم</Text>
      </View>

      <FinanceRow label="تاريخ العقد" value={debt?.contract_date ? dateLabel(debt.contract_date) : '-'} />
      <FinanceRow label="الدفعة الأولى" value={money(debt?.down_payment)} />
      <FinanceRow label="مبلغ التمويل" value={money(debt?.financing_amount)} />
      <FinanceRow label="مبلغ الربح" value={money(debt?.profit_amount)} />
      <FinanceRow label="إجمالي التمويل مع الربح" value={money(debt?.original_amount)} />
      <FinanceRow label="هامش الربح" value={debt?.profit_margin == null ? '-' : percent(debt.profit_margin)} />

      {previousAmount > 0 ? (
        <FinanceRow label="قيمة القسط السابق" value={money(previousAmount)} />
      ) : null}
      {previousCount > 0 ? (
        <FinanceRow
          label="الأقساط السابقة"
          value={`${previousCount} × ${money(previousAmount)} = ${money(previousTotal)}`}
          compact
        />
      ) : null}

      {supportAmount > 0 ? (
        <>
          <FinanceRow label="الدعم الحكومي الشهري" value={money(supportAmount)} highlight />
          <FinanceRow
            label="دفعات الدعم السابقة"
            value={`${supportCount} × ${money(supportAmount)} = ${money(supportTotal)}`}
            compact
            highlight
          />
          <FinanceRow
            label="إجمالي المسدد السابق مع الدعم"
            value={money(debt?.previous_total_paid_with_support)}
            highlight
          />
          <FinanceRow
            label="حصة هذا الشهر بعد الدعم"
            value={money(debt?.current_month_customer_share_after_support)}
            highlight
          />
        </>
      ) : null}

      <FinanceRow label="إجمالي المدفوع مع الدفعة الأولى" value={money(debt?.total_paid_with_down_payment)} />
      <FinanceRow label="إجمالي تكلفة العقار" value={money(debt?.total_cost)} />
      <FinanceRow label="نسبة السداد الإجمالية" value={percent(debt?.overall_progress_percent)} last />
    </View>
  );
}

function FinanceRow({ label, value, compact, highlight, last }) {
  return (
    <View style={[styles.financeRow, highlight && styles.financeRowHighlight, last && styles.financeRowLast]}>
      <Text style={[styles.financeValue, compact && styles.financeFormula, highlight && styles.financeValueHighlight]}>{value}</Text>
      <Text style={[styles.financeLabel, highlight && styles.financeLabelHighlight]}>{label}</Text>
    </View>
  );
}

'''
    if anchor not in text:
        raise SystemExit('MiniStat anchor not found')
    text = text.replace(anchor, block + anchor, 1)

if 'financeCard:' not in text:
    anchor = "  filterRow: { marginTop: 13, flexDirection: 'row-reverse', gap: 7 },\n"
    styles = r'''  financeCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 21, borderWidth: 1, borderColor: '#ddd6fe', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  financeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  financeTitle: { flex: 1, color: '#5b21b6', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  supportBadge: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  supportBadgeText: { color: '#047857', fontSize: 10, fontWeight: '900' },
  financeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7', paddingVertical: 9 },
  financeRowHighlight: { backgroundColor: '#f0fdf4', marginHorizontal: -7, paddingHorizontal: 7, borderBottomColor: '#dcfce7' },
  financeRowLast: { borderBottomWidth: 0 },
  financeLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  financeLabelHighlight: { color: '#047857' },
  financeValue: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'left' },
  financeValueHighlight: { color: '#047857' },
  financeFormula: { fontSize: 11 },
'''
    if anchor not in text:
        raise SystemExit('Finance styles anchor not found')
    text = text.replace(anchor, styles + anchor, 1)

path.write_text(text, encoding='utf-8')
print('Debt support information patch applied')
