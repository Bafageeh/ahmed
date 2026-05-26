from pathlib import Path

path = Path('ahmed-mobile/AppShell.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/AppShell.js not found')

text = path.read_text(encoding='utf-8')

if 'COM_MONTHLY_PERSON_NET_PATHS' not in text:
    text = text.replace(
        "const FINANCE_NET_PROFIT_AFTER_STUCK_PATHS = [\n  'income.ahmed_monthly_net_profit_after_stuck_deduction',\n  'portfolio.ahmed_monthly_net_profit_after_stuck_deduction',\n  'ahmed_monthly_net_profit_after_stuck_deduction',\n];",
        "const FINANCE_NET_PROFIT_AFTER_STUCK_PATHS = [\n  'income.ahmed_monthly_net_profit_after_stuck_deduction',\n  'portfolio.ahmed_monthly_net_profit_after_stuck_deduction',\n  'ahmed_monthly_net_profit_after_stuck_deduction',\n];\nconst COM_SUMMARY_URLS = [\n  'https://com.pm.sa/api/v1/integrations/ahmed/summary',\n  'https://com.pm.sa/api/integrations/ahmed/summary',\n];\nconst COM_MONTHLY_PERSON_NET_PATHS = [\n  'income.com_monthly_person_net',\n  'person.com_monthly_person_net',\n  'portfolio.com_monthly_person_net',\n  'com_monthly_person_net',\n];"
    )

if 'comMonthlyPersonNet' not in text:
    text = text.replace(
        "  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);",
        "  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);\n  const [comMonthlyPersonNet, setComMonthlyPersonNet] = useState(0);"
    )

if 'loadComMonthlyPersonNet' not in text:
    text = text.replace(
        "  const loadFinanceNetProfitAfterStuckDeduction = async () => { try { const response = await fetch(FINANCE_SUMMARY_URL, { headers: { Accept: 'application/json' } }); const json = await response.json(); if (!response.ok) throw new Error(json.message || 'finance fetch failed'); const data = json.data || json; setFinanceNetProfitAfterStuckDeduction(pickFinanceNumber(data, FINANCE_NET_PROFIT_AFTER_STUCK_PATHS)); } catch { setFinanceNetProfitAfterStuckDeduction(0); } };",
        "  const loadFinanceNetProfitAfterStuckDeduction = async () => { try { const response = await fetch(FINANCE_SUMMARY_URL, { headers: { Accept: 'application/json' } }); const json = await response.json(); if (!response.ok) throw new Error(json.message || 'finance fetch failed'); const data = json.data || json; setFinanceNetProfitAfterStuckDeduction(pickFinanceNumber(data, FINANCE_NET_PROFIT_AFTER_STUCK_PATHS)); } catch { setFinanceNetProfitAfterStuckDeduction(0); } };\n  const loadComMonthlyPersonNet = async () => { for (const url of COM_SUMMARY_URLS) { try { const response = await fetch(url, { headers: { Accept: 'application/json' } }); const json = await response.json(); if (!response.ok) throw new Error(json.message || 'com fetch failed'); const data = json.data || json; setComMonthlyPersonNet(pickFinanceNumber(data, COM_MONTHLY_PERSON_NET_PATHS)); return; } catch {} } setComMonthlyPersonNet(0); };"
    )

text = text.replace(
    "  useEffect(() => { loadIncomes(); loadMoneyMoonIncome(); loadTa3meedIncome(); loadFinanceNetProfitAfterStuckDeduction(); }, []);",
    "  useEffect(() => { loadIncomes(); loadMoneyMoonIncome(); loadTa3meedIncome(); loadFinanceNetProfitAfterStuckDeduction(); loadComMonthlyPersonNet(); }, []);"
)

text = text.replace(
    "  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0);",
    "  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);"
)

if 'COM: com_monthly_person_net' not in text:
    marker = "<View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name=\"stats\" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>ربح أحمد الشهري الصافي</Text><Text style={styles.incomeRowAmount}>{Number(financeNetProfitAfterStuckDeduction || 0).toLocaleString('en-US')} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>Finance: ahmed_monthly_net_profit_after_stuck_deduction</Text></View></View>"
    addition = marker + "<View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name=\"stats\" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>صافي الشخص الشهري</Text><Text style={styles.incomeRowAmount}>{Number(comMonthlyPersonNet || 0).toLocaleString('en-US')} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>COM: com_monthly_person_net</Text></View></View>"
    text = text.replace(marker, addition, 1)

path.write_text(text, encoding='utf-8')
print('COM monthly person net income patch applied')
