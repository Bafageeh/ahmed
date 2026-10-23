const { dinarRemainingInvestment } = require('./dinarInvestmentMath');

export const FUTURE_INCOME_SOURCES = [
  { id: 'moneymoon', name: 'موني مون', icon: 'moneymoon', color: '#B27637', tint: '#FFF3E4', caption: 'الاستثمار النشط', formula: 'المبلغ النشط في موني مون × 12% ÷ 12' },
  { id: 'ta3meed', name: 'استثمار تعميد', icon: 'ta3meed', color: '#5667B8', tint: '#EEF0FF', caption: 'حساب المستثمر أحمد', formula: 'رصيد استثمار أحمد القائم في تعميد × 12% ÷ 12' },
  { id: 'dinar', name: 'استثمار دينار', icon: 'dinar', color: '#8A5DB7', tint: '#F5EEFC', caption: 'رأس المال القائم', formula: 'رأس المال المتبقي في دينار بعد استرداد الأصل × 12% ÷ 12' },
  { id: 'sulfa', name: 'استثمار سلفة', icon: 'sulfa', color: '#24856D', tint: '#EAF8F0', caption: 'الاستثمار القائم', formula: 'الاستثمار القائم في سلفة × 10.5% ÷ 12' },
  { id: 'tokenize', name: 'متوسط ربح ترميز', icon: 'tokenize', color: '#AA7D30', tint: '#FBF4E4', caption: 'متوسط الفرص القائمة', formula: 'مجموع ربح كل فرصة قائمة مقسومًا على مدتها بالأشهر' },
  { id: 'finance', name: 'ربح أحمد الصافي', icon: 'stats', color: '#398490', tint: '#EAF6F7', caption: 'من Finance', formula: 'صافي ربح أحمد الشهري بعد خصم المبالغ العالقة، كما يرد من Finance' },
  { id: 'com', name: 'ربحي الخاص من مؤسسة دليلي', icon: 'wallet', color: '#6D77A1', tint: '#EFF1F8', caption: 'مؤسسة دليلي', formula: 'حصتي الشهرية من صافي ربح مؤسسة دليلي، محسوبة من بيانات المؤسسة الحالية' },
];

export const incomeNumber = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

// Keep the investor-account rules used by the existing income screen.
export function ta3meedIncomeCapital(raw) {
  const number = (value) => incomeNumber(String(value ?? 0).replace(/,/g, ''));
  const ended = ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'مستلم', 'مستلمة', 'تم الاستلام', 'منتهي', 'منتهية', 'cancelled', 'canceled', 'void', 'ملغي', 'ملغية', 'ملغاة'];
  const inactive = (row) => [row.opportunity_status, row.allocation_status, row.status]
    .some((status) => ended.includes(String(status || '').trim().toLowerCase()));
  const summary = raw?.summary || {};
  if (summary.ta3meed != null) return number(summary.ta3meed);
  if (summary.ta3meed_remaining_amount != null) return number(summary.ta3meed_remaining_amount);
  if (raw?.ta3meed != null) return number(raw.ta3meed);
  return (Array.isArray(raw?.opportunities) ? raw.opportunities : []).reduce((sum, row) => {
    if (inactive(row)) return sum;
    if (row.ta3meed_remaining_amount != null) return sum + Math.max(0, number(row.ta3meed_remaining_amount));
    const invested = number(row.invested_amount);
    const received = Math.min(invested, Math.max(0, number(row.principal_received_amount ?? row.received_total_amount ?? row.received_amount)));
    return sum + Math.max(0, invested - received);
  }, 0);
}

export function sulfaIncomeValue(data) {
  const raw = data.platform_snapshot?.outstanding_investments;
  const capital = Number(raw);
  if (raw != null && Number.isFinite(capital) && capital >= 0) {
    return { amount: Math.round(capital * 0.105 / 12 * 100) / 100, capital };
  }
  const monthly = Number(data.monthly_profit);
  if (Number.isFinite(monthly)) return { amount: monthly };
  return { amount: incomeNumber(data.invested_amount) * 0.105 / 12 };
}

export function parseIncomeAmount(value) {
  return Number(String(value).trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٬,\s]/g, '').replace(/٫/g, '.'));
}

export async function fetchFutureIncomeData({ apiUrl, headers, includeFinance = true, fetcher = fetch }) {
  const values = {};
  const failed = [];
  let manual = null;
  const request = async (url, external = false) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetcher(url, { headers: external ? { Accept: 'application/json' } : headers, signal: controller.signal });
      const json = await response.json();
      if (!response.ok) throw new Error('INCOME_SOURCE_UNAVAILABLE');
      return json;
    } finally { clearTimeout(timer); }
  };
  const run = async (id, task) => {
    try { await task(); } catch { failed.push(id); }
  };
  await Promise.all([
    run('manual', async () => {
      const json = await request(`${apiUrl}/monthly-incomes?screen=future`);
      if (!Array.isArray(json.data)) throw new Error('INVALID_INCOME_LIST');
      const com = json.data.find((row) => row.source_key === 'com_monthly_person_net' || row.id === 'fixed-com-monthly-person-net');
      if (includeFinance) {
        if (com && com.amount != null && Number.isFinite(Number(com.amount)) && !['unavailable', 'error'].includes(com.sync_status)) {
          values.com = { amount: Number(com.amount), syncedAt: com.synced_at || null };
        } else {
          failed.push('com');
        }
      }
      manual = json.data.filter((row) => row.source_key !== 'com_monthly_person_net' && row.id !== 'fixed-com-monthly-person-net');
    }),
    run('moneymoon', async () => {
      const json = await request(`${apiUrl}/moneymoon/investments`);
      const rows = Array.isArray(json.data) ? json.data : [];
      const capital = rows.filter((row) => row.status !== 'received' && row.status !== 'completed')
        .reduce((sum, row) => sum + incomeNumber(row.principal_amount), 0);
      values.moneymoon = { amount: capital * 0.12 / 12, capital };
    }),
    run('ta3meed', async () => {
      let capital = 0;
      let found = false;
      for (const code of ['ahmed', 'أحمد', 'احمد']) {
        let json;
        try { json = await request(`${apiUrl}/ta3meed/investors/${encodeURIComponent(code)}/account`); }
        catch { continue; }
        found = true;
        capital = ta3meedIncomeCapital(json.data || json);
        if (capital > 0) break;
      }
      if (!found) throw new Error('INVESTOR_UNAVAILABLE');
      values.ta3meed = { amount: capital * 0.12 / 12, capital };
    }),
    run('dinar', async () => {
      const json = await request(`${apiUrl}/dinar/investments`);
      const raw = json.summary?.total_investment;
      const rows = Array.isArray(json.data) ? json.data : [];
      const capital = raw != null && Number.isFinite(Number(raw))
        ? Math.max(0, Number(raw)) : rows.reduce((sum, row) => sum + dinarRemainingInvestment(row), 0);
      values.dinar = { amount: capital * 0.12 / 12, capital };
    }),
    run('sulfa', async () => {
      const json = await request(`${apiUrl}/sulfa/investment`);
      values.sulfa = sulfaIncomeValue(json.data || {});
    }),
    run('tokenize', async () => {
      const json = await request(`${apiUrl}/tokenize/investments`);
      values.tokenize = { amount: incomeNumber(json.summary?.monthly_profit_average) };
    }),
    includeFinance ? run('finance', async () => {
      const json = await request('https://finance.pm.sa/api/v1/integrations/ahmed/summary', true);
      const data = json.data || json;
      const candidates = [data.income?.ahmed_monthly_net_profit_after_stuck_deduction, data.portfolio?.ahmed_monthly_net_profit_after_stuck_deduction, data.ahmed_monthly_net_profit_after_stuck_deduction];
      values.finance = { amount: incomeNumber(candidates.find((value) => value != null && value !== '')) };
    }) : Promise.resolve(),
  ]);
  return { values, manual, failed };
}
