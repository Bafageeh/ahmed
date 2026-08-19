'use strict';

module.exports = function debtDetailExtraStatsPlugin() {
  return {
    name: 'ahmed-debt-detail-extra-stats',

    parserOverride(code, parserOptions, parse) {
      if (!code.includes('function DebtDetailHero') || !code.includes('styles.detailStatsGrid')) {
        return parse(code, parserOptions);
      }

      let source = code;

      if (!source.includes('label="الدفعة الأولى"')) {
        const anchor = `        <MiniStat label="آخر دفعة" value={debt?.end_date ? monthLabel(debt.end_date) : '-'} />
      </View>`;

        const replacement = `        <MiniStat label="آخر دفعة" value={debt?.end_date ? monthLabel(debt.end_date) : '-'} />
        <MiniStat label="الدفعة الأولى" value={money(debt?.down_payment)} />
        <MiniStat label="تاريخ البدء" value={debt?.contract_date ? dateLabel(debt.contract_date) : '-'} />
        <MiniStat label="مبلغ الربح" value={money(debt?.profit_amount)} />
        <MiniStat label="هامش الربح" value={debt?.profit_margin == null ? '-' : percent(debt.profit_margin)} />
        <MiniStat label="الأقساط المتبقية" value={String(debt?.remaining_installments_count ?? 0)} />
      </View>`;

        source = source.replace(anchor, replacement);
      }

      return parse(source, parserOptions);
    },
  };
};
