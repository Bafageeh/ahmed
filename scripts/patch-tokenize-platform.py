#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / 'ahmed-mobile' / 'AppShell.js'
screen = root / 'ahmed-mobile' / 'TokenizeInvestmentsScreen.js'
api = root / 'ahmed-api' / 'routes' / 'api.php'
controller = root / 'ahmed-api' / 'app' / 'Http' / 'Controllers' / 'Api' / 'TokenizeInvestmentController.php'

# Keep Tokenize wiring idempotent so repeated Expo/APK deploys never duplicate imports/routes.
text = app.read_text()
import_line = "import TokenizeInvestmentsScreen from './TokenizeInvestmentsScreen';"
lines = [line for line in text.splitlines() if line.strip() != import_line]
text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
text = text.replace("import SulfaInvestmentScreen from './SulfaInvestmentScreen';", "import SulfaInvestmentScreen from './SulfaInvestmentScreen';\n" + import_line)
text = text.replace("const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa'];", "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa', 'tokenize'];")
text = text.replace("{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },", "{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'صكوك ترميز والعوائد والتوزيعات.' },")
nav_line = "      if (investmentScreen === 'tokenize') return <TokenizeInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;"
lines = [line for line in text.splitlines() if line.strip() != nav_line.strip()]
text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
text = text.replace("      if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;", "      if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;\n" + nav_line)
app.write_text(text)

# The actual cash distributions are the authoritative NET profit figures. ROI is the gross return before Tokenize fee.
text = screen.read_text()
text = text.replace("const emptyInvestment = () => ({ external_key: '', title: '', sector: '', investment_amount: '', units: '', duration_months: '', roi: '', apr: '', irr: '', distribution_type: 'ربع سنوي', start_date: '', end_date: '', status: 'active', notes: '' });",
                    "const emptyInvestment = () => ({ external_key: '', title: '', sector: '', investment_amount: '', units: '', duration_months: '', roi: '', apr: '', irr: '', platform_fee_rate: '1', platform_fee_vat_rate: '15', distribution_type: 'ربع سنوي', start_date: '', end_date: '', status: 'active', notes: '' });")
text = text.replace("      units: String(item.units ?? ''), duration_months: String(item.duration_months ?? ''), roi: String(item.roi ?? ''), apr: String(item.apr ?? ''), irr: String(item.irr ?? ''),\n      distribution_type: item.distribution_type || '',",
                    "      units: String(item.units ?? ''), duration_months: String(item.duration_months ?? ''), roi: String(item.roi ?? ''), apr: String(item.apr ?? ''), irr: String(item.irr ?? ''),\n      platform_fee_rate: String(item.platform_fee_rate ?? 1), platform_fee_vat_rate: String(item.platform_fee_vat_rate ?? 15), distribution_type: item.distribution_type || '',")
text = text.replace("          roi: num(form.roi), apr: num(form.apr), irr: num(form.irr), start_date: form.start_date || null, end_date: form.end_date || null,",
                    "          roi: num(form.roi), apr: num(form.apr), irr: num(form.irr), platform_fee_rate: num(form.platform_fee_rate), platform_fee_vat_rate: num(form.platform_fee_vat_rate), start_date: form.start_date || null, end_date: form.end_date || null,")
text = text.replace("    const expectedByRoi = num(selected.investment_amount) * num(selected.roi) / 100;\n", "")
text = text.replace(
    '<View style={styles.profitCard}><Text style={styles.profitLabel}>الربح المتوقع حسب ROI</Text><Text style={styles.profitValue}>{money(expectedByRoi, 2)}</Text><Text style={styles.profitSub}>المجدول حاليًا {money(scheduledProfit, 2)} · المستلم {money(received, 2)}</Text></View>',
    '<View style={styles.profitCard}><Text style={styles.profitLabel}>صافي الربح بعد عمولة ترميز</Text><Text style={styles.profitValue}>{money(scheduledProfit, 2)}</Text><Text style={styles.profitSub}>قبل العمولة {money(selected.gross_profit, 2)} · العمولة والضريبة {money(selected.platform_fee_total, 2)}</Text><Text style={styles.profitSub}>عمولة {money(selected.platform_fee_before_vat, 2)} + ضريبة {money(selected.platform_fee_vat, 2)} · المستلم {money(received, 2)} · المتبقي {money(Math.max(0, scheduledProfit - received), 2)}</Text></View>'
)
text = text.replace(
    '<View style={styles.profitCard}><Text style={styles.profitLabel}>إجمالي أرباح جدول التوزيعات</Text><Text style={styles.profitValue}>{money(scheduledProfit, 2)}</Text><Text style={styles.profitSub}>المستلم {money(received, 2)} · المتبقي {money(Math.max(0, scheduledProfit - received), 2)}</Text></View>',
    '<View style={styles.profitCard}><Text style={styles.profitLabel}>صافي الربح بعد عمولة ترميز</Text><Text style={styles.profitValue}>{money(scheduledProfit, 2)}</Text><Text style={styles.profitSub}>قبل العمولة {money(selected.gross_profit, 2)} · العمولة والضريبة {money(selected.platform_fee_total, 2)}</Text><Text style={styles.profitSub}>عمولة {money(selected.platform_fee_before_vat, 2)} + ضريبة {money(selected.platform_fee_vat, 2)} · المستلم {money(received, 2)} · المتبقي {money(Math.max(0, scheduledProfit - received), 2)}</Text></View>'
)
text = text.replace(
    '<View style={styles.infoCard}><Info label="المدة" value={`${selected.duration_months} شهر`} /><Info label="عدد الصكوك" value={String(selected.units || 0)} /><Info label="التوزيع" value={selected.distribution_type || \'-\'} /><Info label="الحالة" value={statusLabel(selected.status)} /><Info label="بداية التوزيع" value={selected.start_date || \'-\'} /><Info label="نهاية التوزيع" value={selected.end_date || \'-\'} /></View>',
    '<View style={styles.infoCard}><Info label="المدة" value={`${selected.duration_months} شهر`} /><Info label="عدد الصكوك" value={String(selected.units || 0)} /><Info label="التوزيع" value={selected.distribution_type || \'-\'} /><Info label="الحالة" value={statusLabel(selected.status)} /><Info label="عمولة ترميز السنوية" value={pct(selected.platform_fee_rate)} /><Info label="ضريبة العمولة" value={pct(selected.platform_fee_vat_rate)} /><Info label="بداية التوزيع" value={selected.start_date || \'-\'} /><Info label="نهاية التوزيع" value={selected.end_date || \'-\'} /></View>'
)
text = text.replace(
    '<View style={styles.statsGrid}><Stat title="إجمالي الاستثمار" value={money(summary.total_investment, 0)} /><Stat title="الفرص القائمة" value={String(summary.active_count || 0)} /><Stat title="الربح المتوقع" value={money(summary.expected_profit, 2)} /><Stat title="متوسط APR" value={pct(summary.weighted_apr)} /></View>',
    '<View style={styles.statsGrid}><Stat title="إجمالي الاستثمار" value={money(summary.total_investment, 0)} /><Stat title="الفرص القائمة" value={String(summary.active_count || 0)} /><Stat title="الربح قبل العمولة" value={money(summary.gross_expected_profit, 2)} /><Stat title="عمولة ترميز + الضريبة" value={money(summary.platform_fee_total, 2)} /><Stat title="صافي الربح" value={money(summary.expected_profit, 2)} /><Stat title="متوسط APR" value={pct(summary.weighted_apr)} /></View>'
)
text = text.replace(
    '<View style={styles.twoCols}><Field label="APR %" value={form.apr} onChange={(v) => field(\'apr\', v)} numeric /><Field label="IRR %" value={form.irr} onChange={(v) => field(\'irr\', v)} numeric /></View>',
    '<View style={styles.twoCols}><Field label="APR %" value={form.apr} onChange={(v) => field(\'apr\', v)} numeric /><Field label="IRR %" value={form.irr} onChange={(v) => field(\'irr\', v)} numeric /></View>\n    <View style={styles.twoCols}><Field label="عمولة ترميز السنوية %" value={form.platform_fee_rate} onChange={(v) => field(\'platform_fee_rate\', v)} numeric /><Field label="ضريبة العمولة %" value={form.platform_fee_vat_rate} onChange={(v) => field(\'platform_fee_vat_rate\', v)} numeric /></View>'
)
screen.write_text(text)

text = api.read_text()
use_line = "use App\\Http\\Controllers\\Api\\TokenizeInvestmentController;"
lines = [line for line in text.splitlines() if line.strip() != use_line]
text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
text = text.replace("use App\\Http\\Controllers\\Api\\Ta3meedReceiptController;", "use App\\Http\\Controllers\\Api\\Ta3meedReceiptController;\n" + use_line)
route_needles = [
    "    Route::get('/tokenize/investments', [TokenizeInvestmentController::class, 'index']);",
    "    Route::post('/tokenize/investments', [TokenizeInvestmentController::class, 'store']);",
    "    Route::put('/tokenize/investments/{id}', [TokenizeInvestmentController::class, 'update']);",
    "    Route::delete('/tokenize/investments/{id}', [TokenizeInvestmentController::class, 'destroy']);",
    "    Route::post('/tokenize/investments/{investmentId}/payments', [TokenizeInvestmentController::class, 'storePayment']);",
    "    Route::put('/tokenize/investments/{investmentId}/payments/{paymentId}', [TokenizeInvestmentController::class, 'updatePayment']);",
    "    Route::delete('/tokenize/investments/{investmentId}/payments/{paymentId}', [TokenizeInvestmentController::class, 'destroyPayment']);",
    "    Route::post('/tokenize/payments/{paymentId}/toggle-paid', [TokenizeInvestmentController::class, 'togglePayment']);",
]
lines = [line for line in text.splitlines() if line not in route_needles]
text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
anchor = "    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);"
routes = anchor + "\n\n" + "\n".join(route_needles)
text = text.replace(anchor, routes)
api.write_text(text)

text = controller.read_text()
text = text.replace("            'irr' => ['nullable', 'numeric', 'min:0', 'max:1000'],\n            'distribution_type'", "            'irr' => ['nullable', 'numeric', 'min:0', 'max:1000'],\n            'platform_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],\n            'platform_fee_vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],\n            'distribution_type'")
text = text.replace("            'irr' => $data['irr'] ?? 0,\n            'distribution_type'", "            'irr' => $data['irr'] ?? 0,\n            'platform_fee_rate' => $data['platform_fee_rate'] ?? 1,\n            'platform_fee_vat_rate' => $data['platform_fee_vat_rate'] ?? 15,\n            'distribution_type'")
# Add columns for existing databases. Defaults reproduce the commission visible in the supplied Tokenize schedules.
schema_anchor = "        if (! Schema::hasTable('tokenize_payments')) {"
schema_add = "        if (! Schema::hasColumn('tokenize_investments', 'platform_fee_rate')) {\n            Schema::table('tokenize_investments', function (Blueprint $table) {\n                $table->decimal('platform_fee_rate', 8, 4)->default(1)->after('irr');\n            });\n        }\n        if (! Schema::hasColumn('tokenize_investments', 'platform_fee_vat_rate')) {\n            Schema::table('tokenize_investments', function (Blueprint $table) {\n                $table->decimal('platform_fee_vat_rate', 8, 4)->default(15)->after('platform_fee_rate');\n            });\n        }\n\n"
if "Schema::hasColumn('tokenize_investments', 'platform_fee_rate')" not in text:
    text = text.replace(schema_anchor, schema_add + schema_anchor)
# Enrich every opportunity with gross fee and net calculations.
old_with = "        $item->payments = DB::table('tokenize_payments')\n            ->where('user_id', $userId)\n            ->where('tokenize_investment_id', $item->id)\n            ->orderBy('due_date')\n            ->orderBy('installment_no')\n            ->get();\n        return $item;"
new_with = "        $item->payments = DB::table('tokenize_payments')\n            ->where('user_id', $userId)\n            ->where('tokenize_investment_id', $item->id)\n            ->orderBy('due_date')\n            ->orderBy('installment_no')\n            ->get();\n\n        $amount = (float) $item->investment_amount;\n        $durationMonths = max(0, (int) $item->duration_months);\n        $feeRate = isset($item->platform_fee_rate) ? (float) $item->platform_fee_rate : 1.0;\n        $vatRate = isset($item->platform_fee_vat_rate) ? (float) $item->platform_fee_vat_rate : 15.0;\n        $grossProfit = $amount * ((float) $item->roi / 100);\n        $feeBeforeVat = $amount * ($feeRate / 100) * ($durationMonths / 12);\n        $feeVat = $feeBeforeVat * ($vatRate / 100);\n        $scheduledProfit = (float) $item->payments->sum('profit_amount');\n\n        $item->platform_fee_rate = round($feeRate, 4);\n        $item->platform_fee_vat_rate = round($vatRate, 4);\n        $item->gross_profit = round($grossProfit, 2);\n        $item->platform_fee_before_vat = round($feeBeforeVat, 2);\n        $item->platform_fee_vat = round($feeVat, 2);\n        $item->platform_fee_total = round($feeBeforeVat + $feeVat, 2);\n        $item->net_profit_calculated = round($grossProfit - $feeBeforeVat - $feeVat, 2);\n        $item->scheduled_profit = round($scheduledProfit, 2);\n        return $item;"
if "net_profit_calculated" not in text:
    text = text.replace(old_with, new_with)
text = text.replace("            $expected += $amount * ((float) $item->roi / 100);\n", "")
text = text.replace(
    "        $received = 0.0;\n        $weightedApr = 0.0;",
    "        $received = 0.0;\n        $grossExpected = 0.0;\n        $platformFees = 0.0;\n        $weightedApr = 0.0;"
)
text = text.replace(
    "            $total += $amount;\n            $weightedApr += $amount * (float) $item->apr;",
    "            $total += $amount;\n            $grossExpected += (float) ($item->gross_profit ?? 0);\n            $platformFees += (float) ($item->platform_fee_total ?? 0);\n            $weightedApr += $amount * (float) $item->apr;"
)
text = text.replace(
    "            foreach ($item->payments as $payment) {\n                if ((bool) $payment->is_paid) $received += (float) $payment->profit_amount;\n            }",
    "            foreach ($item->payments as $payment) {\n                $expected += (float) $payment->profit_amount;\n                if ((bool) $payment->is_paid) $received += (float) $payment->profit_amount;\n            }"
)
text = text.replace(
    "            'expected_profit' => round($expected, 2),\n            'received_profit'",
    "            'gross_expected_profit' => round($grossExpected, 2),\n            'platform_fee_total' => round($platformFees, 2),\n            'expected_profit' => round($expected, 2),\n            'received_profit'"
)
controller.write_text(text)

checks = [
    (import_line, app),
    ("'tokenize'", app),
    ("صكوك ترميز والعوائد والتوزيعات", app),
    (use_line, api),
    ("Route::get('/tokenize/investments'", api),
    ("صافي الربح بعد عمولة ترميز", screen),
    ("عمولة ترميز السنوية %", screen),
    ("platform_fee_rate", controller),
    ("platform_fee_total", controller),
    ("$expected += (float) $payment->profit_amount;", controller),
]
for needle, path in checks:
    if needle not in path.read_text():
        raise SystemExit(f'Missing {needle} in {path}')
if app.read_text().count(import_line) != 1:
    raise SystemExit('Tokenize import must appear exactly once')
if "expectedByRoi" in screen.read_text():
    raise SystemExit('Tokenize screen still calculates expected profit from ROI')
if "$expected += $amount * ((float) $item->roi / 100);" in controller.read_text():
    raise SystemExit('Tokenize API still calculates expected profit from ROI')

print('Tokenize platform patch applied and verified')
