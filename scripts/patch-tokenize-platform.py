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

# The actual cash distributions are the authoritative profit figures. ROI/APR/IRR stay informational.
text = screen.read_text()
text = text.replace("    const expectedByRoi = num(selected.investment_amount) * num(selected.roi) / 100;\n", "")
text = text.replace(
    '<View style={styles.profitCard}><Text style={styles.profitLabel}>الربح المتوقع حسب ROI</Text><Text style={styles.profitValue}>{money(expectedByRoi, 2)}</Text><Text style={styles.profitSub}>المجدول حاليًا {money(scheduledProfit, 2)} · المستلم {money(received, 2)}</Text></View>',
    '<View style={styles.profitCard}><Text style={styles.profitLabel}>إجمالي أرباح جدول التوزيعات</Text><Text style={styles.profitValue}>{money(scheduledProfit, 2)}</Text><Text style={styles.profitSub}>المستلم {money(received, 2)} · المتبقي {money(Math.max(0, scheduledProfit - received), 2)}</Text></View>'
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
text = text.replace("            $expected += $amount * ((float) $item->roi / 100);\n", "")
text = text.replace(
    "            foreach ($item->payments as $payment) {\n                if ((bool) $payment->is_paid) $received += (float) $payment->profit_amount;\n            }",
    "            foreach ($item->payments as $payment) {\n                $expected += (float) $payment->profit_amount;\n                if ((bool) $payment->is_paid) $received += (float) $payment->profit_amount;\n            }"
)
controller.write_text(text)

checks = [
    (import_line, app),
    ("'tokenize'", app),
    ("صكوك ترميز والعوائد والتوزيعات", app),
    (use_line, api),
    ("Route::get('/tokenize/investments'", api),
    ("إجمالي أرباح جدول التوزيعات", screen),
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
