const fs = require('fs');

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Missing marker: ${label}`);
  return source.replace(needle, replacement);
}

const appPath = 'ahmed-mobile/AppShell.js';
let app = fs.readFileSync(appPath, 'utf8');

app = replaceOnce(
  app,
  "import DinarInvestmentsScreen from './DinarInvestmentsScreen';",
  "import DinarInvestmentsScreen from './DinarInvestmentsScreen';\nimport SulfaInvestmentScreen from './SulfaInvestmentScreen';",
  'Sulfa screen import'
);

app = replaceOnce(
  app,
  "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar'];",
  "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa'];",
  'active investment keys'
);

app = replaceOnce(
  app,
  "  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'شركات دينار والتوزيعات والإحصائيات.' },\n  { key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },",
  "  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'شركات دينار والتوزيعات والإحصائيات.' },\n  { key: 'sulfa', name: 'سلفة', icon: 'sulfa', text: 'تسجيل المبلغ المستثمر وحساب الربح الشهري.' },\n  { key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },",
  'platform card'
);

app = replaceOnce(
  app,
  "      if (investmentScreen === 'dinar') return <DinarInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;",
  "      if (investmentScreen === 'dinar') return <DinarInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;\n      if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;",
  'Sulfa route'
);

app = replaceOnce(
  app,
  "  const [dinarMonthlyIncome, setDinarMonthlyIncome] = useState(0);",
  "  const [dinarMonthlyIncome, setDinarMonthlyIncome] = useState(0);\n  const [sulfaMonthlyIncome, setSulfaMonthlyIncome] = useState(0);",
  'Sulfa income state'
);

const sulfaLoader = `  const loadSulfaIncome = async () => {\n    try {\n      const response = await fetch(\`${'${API_URL}'}/sulfa/investment\`, { headers: { Accept: 'application/json' } });\n      const json = await response.json();\n      if (!response.ok) throw new Error(json.message || 'sulfa fetch failed');\n      const data = json.data || {};\n      const monthlyProfit = Number(data.monthly_profit);\n      if (Number.isFinite(monthlyProfit)) {\n        setSulfaMonthlyIncome(monthlyProfit);\n        return;\n      }\n      const investedAmount = Number(data.invested_amount || 0);\n      setSulfaMonthlyIncome((investedAmount * 0.105) / 12);\n    } catch {\n      setSulfaMonthlyIncome(0);\n    }\n  };\n`;

if (!app.includes('const loadSulfaIncome = async () =>')) {
  const marker = '  const loadFinanceNetProfitAfterStuckDeduction = async () =>';
  if (!app.includes(marker)) throw new Error('Missing marker: Finance loader');
  app = app.replace(marker, sulfaLoader + marker);
}

app = replaceOnce(
  app,
  "        loadDinarIncome(),\n        loadFinanceNetProfitAfterStuckDeduction(),",
  "        loadDinarIncome(),\n        loadSulfaIncome(),\n        loadFinanceNetProfitAfterStuckDeduction(),",
  'reload Sulfa income'
);

app = replaceOnce(
  app,
  "  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(dinarMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);",
  "  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(dinarMonthlyIncome || 0) + Number(sulfaMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);",
  'future income total'
);

if (!app.includes('المبلغ المستثمر في سلفة × 10.5% ÷ 12')) {
  const financeStart = '<View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="stats" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>ربح أحمد الشهري الصافي</Text>';
  if (!app.includes(financeStart)) throw new Error('Missing marker: first Finance fixed-income card');
  const sulfaCard = '<View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="sulfa" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>استثمار سلفة</Text><Text style={styles.incomeRowAmount}>{Number(sulfaMonthlyIncome || 0).toLocaleString(\'en-US\', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>المبلغ المستثمر في سلفة × 10.5% ÷ 12</Text></View></View>';
  app = app.replace(financeStart, sulfaCard + financeStart);
}

fs.writeFileSync(appPath, app);

const iconPath = 'ahmed-mobile/UiIcon.js';
let icons = fs.readFileSync(iconPath, 'utf8');
icons = replaceOnce(
  icons,
  '  dinar: CircleDollarSign,\n  tokenize: Hexagon,',
  '  dinar: CircleDollarSign,\n  sulfa: Banknote,\n  tokenize: Hexagon,',
  'Sulfa icon'
);
fs.writeFileSync(iconPath, icons);

const routesPath = 'ahmed-api/routes/api.php';
let routes = fs.readFileSync(routesPath, 'utf8');
routes = replaceOnce(
  routes,
  'use App\\Http\\Controllers\\Api\\SecureVaultController;\nuse App\\Http\\Controllers\\Api\\Ta3meedController;',
  'use App\\Http\\Controllers\\Api\\SecureVaultController;\nuse App\\Http\\Controllers\\Api\\SulfaInvestmentController;\nuse App\\Http\\Controllers\\Api\\Ta3meedController;',
  'Sulfa controller import'
);
routes = replaceOnce(
  routes,
  "    Route::get('/dinar/investments', [DinarInvestmentController::class, 'index']);\n    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);",
  "    Route::get('/dinar/investments', [DinarInvestmentController::class, 'index']);\n    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);\n    Route::get('/sulfa/investment', [SulfaInvestmentController::class, 'show']);\n    Route::put('/sulfa/investment', [SulfaInvestmentController::class, 'update']);",
  'Sulfa routes'
);
fs.writeFileSync(routesPath, routes);

console.log('Sulfa platform patch applied successfully.');
