#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / 'ahmed-mobile' / 'AppShell.js'
screen = root / 'ahmed-mobile' / 'TokenizeInvestmentsScreen.js'
api = root / 'ahmed-api' / 'routes' / 'api.php'
controller = root / 'ahmed-api' / 'app' / 'Http' / 'Controllers' / 'Api' / 'TokenizeInvestmentController.php'

for required_path in (app, screen, api, controller):
    if not required_path.exists():
        raise SystemExit(f'Missing required Tokenize file: {required_path}')

# Keep the mobile wiring idempotent. The feature implementation itself is now
# committed in source; deploy-time patches must never rewrite tenant ownership.
text = app.read_text(encoding='utf-8')
import_line = "import TokenizeInvestmentsScreen from './TokenizeInvestmentsScreen';"
if import_line not in text:
    anchor = "import SulfaInvestmentScreen from './SulfaInvestmentScreen';"
    if anchor not in text:
        raise SystemExit('Tokenize mobile import anchor not found')
    text = text.replace(anchor, anchor + "\n" + import_line, 1)

if "{ key: 'tokenize', name: 'ترميز'" in text:
    text = text.replace(
        "{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },",
        "{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'صكوك ترميز والعوائد والتوزيعات.' },",
    )

nav_line = "      if (investmentScreen === 'tokenize') return <TokenizeInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;"
if nav_line not in text:
    anchor = "      if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;"
    if anchor not in text:
        raise SystemExit('Tokenize navigation anchor not found')
    text = text.replace(anchor, anchor + "\n" + nav_line, 1)

app.write_text(text, encoding='utf-8')

# Keep API routes present without deleting/rebuilding them. The Dinar endpoint
# now uses TenantDinarInvestmentController, so older exact-anchor logic could
# remove every Tokenize route during deployment and then fail to reinsert it.
text = api.read_text(encoding='utf-8')
use_line = "use App\\Http\\Controllers\\Api\\TokenizeInvestmentController;"
if use_line not in text:
    anchor = "use App\\Http\\Controllers\\Api\\Ta3meedReceiptController;"
    if anchor not in text:
        raise SystemExit('Tokenize controller import anchor not found')
    text = text.replace(anchor, anchor + "\n" + use_line, 1)

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
missing_routes = [route for route in route_needles if route not in text]
if missing_routes:
    anchors = [
        "    Route::post('/dinar/payments/{id}/toggle-paid', [TenantDinarInvestmentController::class, 'togglePayment']);",
        "    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);",
    ]
    anchor = next((candidate for candidate in anchors if candidate in text), None)
    if not anchor:
        raise SystemExit('Tokenize API insertion anchor not found')
    text = text.replace(anchor, anchor + "\n\n" + "\n".join(missing_routes), 1)

api.write_text(text, encoding='utf-8')

# Profit/commission accounting is maintained directly in the committed files.
# Verify it instead of applying broad textual rewrites at deploy time.
checks = [
    (import_line, app),
    ("'tokenize'", app),
    ("صكوك ترميز والعوائد والتوزيعات", app),
    (use_line, api),
    ("Route::get('/tokenize/investments'", api),
    ("Route::post('/tokenize/payments/{paymentId}/toggle-paid'", api),
    ("صافي الربح بعد عمولة ترميز", screen),
    ("عمولة ترميز السنوية %", screen),
    ("platform_fee_rate", controller),
    ("platform_fee_total", controller),
    ("$expected += (float) $payment->profit_amount;", controller),
]
for needle, path in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Missing {needle} in {path}')

if app.read_text(encoding='utf-8').count(import_line) != 1:
    raise SystemExit('Tokenize import must appear exactly once')
if "expectedByRoi" in screen.read_text(encoding='utf-8'):
    raise SystemExit('Tokenize screen still calculates expected profit from ROI')
if "$expected += $amount * ((float) $item->roi / 100);" in controller.read_text(encoding='utf-8'):
    raise SystemExit('Tokenize API still calculates expected profit from ROI')

print('Tokenize platform wiring verified without altering tenant isolation')
