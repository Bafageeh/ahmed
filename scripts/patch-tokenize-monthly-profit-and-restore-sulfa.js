const fs = require('fs');
const cp = require('child_process');

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

function restoreFromCommit(path, commit) {
  const content = cp.execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8' });
  write(path, content);
  console.log(`restored ${path} from ${commit}`);
}

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Missing marker: ${label}`);
  return source.replace(needle, replacement);
}

// Restore Sulfa to the simple approximate model: 10.5% annual + principal / 24.
const SIMPLE_SULFA_COMMIT = 'f6c30aa606547fe6a5db0a961791d1f13facdef4';
restoreFromCommit('ahmed-api/app/Http/Controllers/Api/SulfaInvestmentController.php', SIMPLE_SULFA_COMMIT);
restoreFromCommit('ahmed-mobile/SulfaInvestmentScreen.js', SIMPLE_SULFA_COMMIT);

// Remove detailed Sulfa endpoints that were added by mistake.
{
  const path = 'ahmed-api/routes/api.php';
  let s = read(path);
  const extraRoutes = [
    "    Route::get('/sulfa/investments', [SulfaInvestmentController::class, 'index']);\n",
    "    Route::post('/sulfa/investments', [SulfaInvestmentController::class, 'storeEntry']);\n",
    "    Route::put('/sulfa/investments/{id}', [SulfaInvestmentController::class, 'updateEntry']);\n",
    "    Route::delete('/sulfa/investments/{id}', [SulfaInvestmentController::class, 'destroyEntry']);\n",
    "    Route::post('/sulfa/investments/{id}/toggle-active', [SulfaInvestmentController::class, 'toggleEntry']);\n",
  ];
  for (const line of extraRoutes) s = s.replace(line, '');
  write(path, s);
}

// Add monthly-profit-by-duration calculations to Tokenize.
{
  const path = 'ahmed-api/app/Http/Controllers/Api/TokenizeInvestmentController.php';
  let s = read(path);

  const itemNeedle = `        $item->net_profit_calculated = round($grossProfit - $feeBeforeVat - $feeVat, 2);\n        $item->scheduled_profit = round($scheduledProfit, 2);\n        return $item;`;
  const itemReplacement = `        $item->net_profit_calculated = round($grossProfit - $feeBeforeVat - $feeVat, 2);\n        $item->scheduled_profit = round($scheduledProfit, 2);\n\n        // متوسط الربح الشهري للفرصة مع مراعاة مدة كل استثمار.\n        // نستخدم جدول التوزيعات عند توفره لأنه الأقرب للربح المتوقع الفعلي،\n        // وإلا نرجع لصافي الربح المحسوب بعد عمولة ترميز والضريبة.\n        $profitForMonthlyAverage = $scheduledProfit > 0\n            ? $scheduledProfit\n            : max(0, $grossProfit - $feeBeforeVat - $feeVat);\n        $monthsForAverage = max(1, $durationMonths);\n        $monthlyProfitAverage = $profitForMonthlyAverage / $monthsForAverage;\n\n        $item->profit_for_monthly_average = round($profitForMonthlyAverage, 2);\n        $item->monthly_profit_average = round($monthlyProfitAverage, 2);\n        $item->annualized_profit_rate = $amount > 0\n            ? round((($monthlyProfitAverage * 12) / $amount) * 100, 2)\n            : 0;\n        return $item;`;
  s = replaceOnce(s, itemNeedle, itemReplacement, 'Tokenize per-investment monthly average');

  const summaryRegex = /    private function summary\(\$items\): array\n    \{[\s\S]*?\n    \}\n\n    private function userId/;
  const summaryReplacement = `    private function summary($items): array\n    {\n        $total = 0.0;\n        $expected = 0.0;\n        $received = 0.0;\n        $grossExpected = 0.0;\n        $platformFees = 0.0;\n        $weightedApr = 0.0;\n        $active = 0;\n        $activeInvestment = 0.0;\n        $monthlyProfitAverage = 0.0;\n\n        foreach ($items as $item) {\n            $amount = (float) $item->investment_amount;\n            $total += $amount;\n            $grossExpected += (float) ($item->gross_profit ?? 0);\n            $platformFees += (float) ($item->platform_fee_total ?? 0);\n            $weightedApr += $amount * (float) $item->apr;\n\n            if ($item->status === 'active') {\n                $active++;\n                $activeInvestment += $amount;\n                $monthlyProfitAverage += (float) ($item->monthly_profit_average ?? 0);\n            }\n\n            foreach ($item->payments as $payment) {\n                $expected += (float) $payment->profit_amount;\n                if ((bool) $payment->is_paid) {\n                    $received += (float) $payment->profit_amount;\n                }\n            }\n        }\n\n        $annualizedProfitRate = $activeInvestment > 0\n            ? (($monthlyProfitAverage * 12) / $activeInvestment) * 100\n            : 0;\n\n        return [\n            'count' => $items->count(),\n            'active_count' => $active,\n            'total_investment' => round($total, 2),\n            'active_investment' => round($activeInvestment, 2),\n            'gross_expected_profit' => round($grossExpected, 2),\n            'platform_fee_total' => round($platformFees, 2),\n            'expected_profit' => round($expected, 2),\n            'received_profit' => round($received, 2),\n            'weighted_apr' => $total > 0 ? round($weightedApr / $total, 2) : 0,\n            'monthly_profit_average' => round($monthlyProfitAverage, 2),\n            'annualized_profit_rate' => round($annualizedProfitRate, 2),\n        ];\n    }\n\n    private function userId`;
  if (!s.includes("'monthly_profit_average' => round($monthlyProfitAverage, 2)")) {
    if (!summaryRegex.test(s)) throw new Error('Missing Tokenize summary function');
    s = s.replace(summaryRegex, summaryReplacement);
  }

  write(path, s);
}

// Surface the calculated monthly profit in the Tokenize UI.
{
  const path = 'ahmed-mobile/TokenizeInvestmentsScreen.js';
  let s = read(path);

  s = replaceOnce(
    s,
    `<View style={styles.hero}><Text style={styles.heroBadge}>ترميز</Text><Text style={styles.heroTitle}>صكوك وفرص الاستثمار</Text><Text style={styles.heroText}>إضافة الفرص وإدارتها ومتابعة العوائد والتوزيعات ورأس المال.</Text></View>`,
    `<View style={styles.hero}><Text style={styles.heroBadge}>ترميز</Text><Text style={styles.heroTitle}>صكوك وفرص الاستثمار</Text><Text style={styles.heroText}>إضافة الفرص وإدارتها ومتابعة العوائد والتوزيعات ورأس المال. الربح الشهري يحسب من ربح كل فرصة ÷ مدتها ثم يجمع للفرص القائمة.</Text></View>`,
    'Tokenize hero text'
  );

  s = replaceOnce(
    s,
    `<View style={styles.statsGrid}><Stat title="إجمالي الاستثمار" value={money(summary.total_investment, 0)} /><Stat title="الفرص القائمة" value={String(summary.active_count || 0)} /><Stat title="الربح قبل العمولة" value={money(summary.gross_expected_profit, 2)} /><Stat title="عمولة ترميز + الضريبة" value={money(summary.platform_fee_total, 2)} /><Stat title="صافي الربح" value={money(summary.expected_profit, 2)} /><Stat title="متوسط APR" value={pct(summary.weighted_apr)} /></View>`,
    `<View style={styles.statsGrid}><Stat title="إجمالي الاستثمار" value={money(summary.total_investment, 0)} /><Stat title="الفرص القائمة" value={String(summary.active_count || 0)} /><Stat title="الربح الشهري المتوقع" value={money(summary.monthly_profit_average, 2)} /><Stat title="العائد السنوي المحسوب" value={pct(summary.annualized_profit_rate)} /><Stat title="الربح قبل العمولة" value={money(summary.gross_expected_profit, 2)} /><Stat title="عمولة ترميز + الضريبة" value={money(summary.platform_fee_total, 2)} /><Stat title="صافي الربح" value={money(summary.expected_profit, 2)} /><Stat title="متوسط APR" value={pct(summary.weighted_apr)} /></View>`,
    'Tokenize summary stats'
  );

  s = replaceOnce(
    s,
    `<View style={styles.statsGrid}><Stat title="الاستثمار" value={money(selected.investment_amount, 0)} /><Stat title="ROI" value={pct(selected.roi)} /><Stat title="APR" value={pct(selected.apr)} /><Stat title="IRR" value={pct(selected.irr)} /></View>`,
    `<View style={styles.statsGrid}><Stat title="الاستثمار" value={money(selected.investment_amount, 0)} /><Stat title="متوسط الربح الشهري" value={money(selected.monthly_profit_average, 2)} /><Stat title="ROI" value={pct(selected.roi)} /><Stat title="APR" value={pct(selected.apr)} /><Stat title="IRR" value={pct(selected.irr)} /></View>`,
    'Tokenize detail monthly stat'
  );

  write(path, s);
}

// Add Tokenize monthly profit into S-121 future monthly income, while Sulfa stays approximate.
{
  const path = 'ahmed-mobile/AppShell.js';
  let s = read(path);

  s = replaceOnce(
    s,
    `  const [sulfaMonthlyIncome, setSulfaMonthlyIncome] = useState(0);\n  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);`,
    `  const [sulfaMonthlyIncome, setSulfaMonthlyIncome] = useState(0);\n  const [tokenizeMonthlyIncome, setTokenizeMonthlyIncome] = useState(0);\n  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);`,
    'S121 Tokenize state'
  );

  const financeLoaderMarker = `  const loadFinanceNetProfitAfterStuckDeduction = async () =>`;
  if (!s.includes('const loadTokenizeIncome = async () =>')) {
    const loader = `  const loadTokenizeIncome = async () => {\n    try {\n      const response = await fetch(\`${'${API_URL}'}/tokenize/investments\`, { headers: { Accept: 'application/json' } });\n      const json = await response.json();\n      if (!response.ok) throw new Error(json.message || 'tokenize fetch failed');\n      setTokenizeMonthlyIncome(Number(json?.summary?.monthly_profit_average || 0));\n    } catch {\n      setTokenizeMonthlyIncome(0);\n    }\n  };\n`;
    if (!s.includes(financeLoaderMarker)) throw new Error('Missing finance loader marker');
    s = s.replace(financeLoaderMarker, loader + financeLoaderMarker);
  }

  s = replaceOnce(
    s,
    `        loadSulfaIncome(),\n        loadFinanceNetProfitAfterStuckDeduction(),`,
    `        loadSulfaIncome(),\n        loadTokenizeIncome(),\n        loadFinanceNetProfitAfterStuckDeduction(),`,
    'S121 reload Tokenize'
  );

  s = replaceOnce(
    s,
    `  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(dinarMonthlyIncome || 0) + Number(sulfaMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);`,
    `  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(dinarMonthlyIncome || 0) + Number(sulfaMonthlyIncome || 0) + Number(tokenizeMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);`,
    'S121 total Tokenize'
  );

  const sulfaCardEnd = `<Text style={styles.fixedIncomeFormulaFinance}>المبلغ المستثمر في سلفة × 10.5% ÷ 12</Text></View></View>`;
  if (!s.includes('متوسط ربح ترميز الشهري')) {
    const tokenizeCard = `${sulfaCardEnd}<View style={[styles.incomeRow, styles.fixedIncomeRowDinar]}><View style={styles.fixedIncomeBadgeDinar}><Text style={styles.fixedIncomeBadgeTextDinar}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="tokenize" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>متوسط ربح ترميز الشهري</Text><Text style={styles.incomeRowAmount}>{Number(tokenizeMonthlyIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormulaDinar}>مجموع (ربح كل فرصة قائمة ÷ مدتها بالأشهر)</Text></View></View>`;
    if (!s.includes(sulfaCardEnd)) throw new Error('Missing Sulfa S121 card marker');
    s = s.replace(sulfaCardEnd, tokenizeCard);
  }

  write(path, s);
}

console.log('Tokenize monthly-profit patch complete; Sulfa restored to approximate model.');
