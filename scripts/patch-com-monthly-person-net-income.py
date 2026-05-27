from pathlib import Path

path = Path('ahmed-mobile/AppShell.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/AppShell.js not found')

text = path.read_text(encoding='utf-8')

if 'comMonthlyPersonNet' not in text:
    text = text.replace(
        "  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);",
        "  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);\n  const [comMonthlyPersonNet, setComMonthlyPersonNet] = useState(0);"
    )

old_load = "  const loadIncomes = async () => { try { const response = await fetch(`${API_URL}/monthly-incomes?screen=future`, { headers: { Accept: 'application/json' } }); const json = await response.json(); setMonthlyIncomes(Array.isArray(json.data) ? json.data : []); } catch {} };"
new_load = "  const loadIncomes = async () => { try { const response = await fetch(`${API_URL}/monthly-incomes?screen=future`, { headers: { Accept: 'application/json' } }); const json = await response.json(); const rows = Array.isArray(json.data) ? json.data : []; const comRow = rows.find((item) => item.source_key === 'com_monthly_person_net' || item.id === 'fixed-com-monthly-person-net'); setComMonthlyPersonNet(Number(comRow?.amount || 0)); setMonthlyIncomes(rows.filter((item) => item.source_key !== 'com_monthly_person_net' && item.id !== 'fixed-com-monthly-person-net')); } catch {} };"
text = text.replace(old_load, new_load)

text = text.replace(
    "  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0);",
    "  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);"
)

if 'COM: com_monthly_person_net' not in text:
    marker = "<View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name=\"stats\" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>ربح أحمد الشهري الصافي</Text><Text style={styles.incomeRowAmount}>{Number(financeNetProfitAfterStuckDeduction || 0).toLocaleString('en-US')} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>Finance: ahmed_monthly_net_profit_after_stuck_deduction</Text></View></View>"
    addition = marker + "<View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name=\"stats\" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>صافي الشخص الشهري من COM</Text><Text style={styles.incomeRowAmount}>{Number(comMonthlyPersonNet || 0).toLocaleString('en-US')} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>COM: com_monthly_person_net</Text></View></View>"
    text = text.replace(marker, addition, 1)
else:
    text = text.replace('صافي الشخص الشهري</Text>', 'صافي الشخص الشهري من COM</Text>')

path.write_text(text, encoding='utf-8')
print('S-121 COM fixed card patch applied')
