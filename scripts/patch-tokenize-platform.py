#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / 'ahmed-mobile' / 'AppShell.js'
api = root / 'ahmed-api' / 'routes' / 'api.php'

# Keep the mobile wiring canonical even when this patch is run repeatedly
# by Expo restart, OTA publish, diagnostics, or APK build jobs.
text = app.read_text()
lines = text.splitlines()

# Remove any previously injected Tokenize import/navigation lines first.
lines = [
    line for line in lines
    if "import TokenizeInvestmentsScreen from './TokenizeInvestmentsScreen';" not in line
    and "if (investmentScreen === 'tokenize') return <TokenizeInvestmentsScreen" not in line
]
text = '\n'.join(lines) + '\n'

sulfa_import = "import SulfaInvestmentScreen from './SulfaInvestmentScreen';"
tokenize_import = "import TokenizeInvestmentsScreen from './TokenizeInvestmentsScreen';"
if sulfa_import not in text:
    raise SystemExit('Missing Sulfa import anchor in AppShell.js')
text = text.replace(sulfa_import, f"{sulfa_import}\n{tokenize_import}", 1)

old_keys = "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa'];"
new_keys = "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa', 'tokenize'];"
text = text.replace(old_keys, new_keys)

text = text.replace(
    "{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },",
    "{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'صكوك ترميز والعوائد والتوزيعات.' },",
)

sulfa_nav = "      if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;"
tokenize_nav = "      if (investmentScreen === 'tokenize') return <TokenizeInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;"
if sulfa_nav not in text:
    raise SystemExit('Missing Sulfa navigation anchor in AppShell.js')
text = text.replace(sulfa_nav, f"{sulfa_nav}\n{tokenize_nav}", 1)
app.write_text(text)

# Keep the API controller import canonical as well.
text = api.read_text()
api_lines = [
    line for line in text.splitlines()
    if "use App\\Http\\Controllers\\Api\\TokenizeInvestmentController;" not in line
]
text = '\n'.join(api_lines) + '\n'
receipt_import = "use App\\Http\\Controllers\\Api\\Ta3meedReceiptController;"
tokenize_controller_import = "use App\\Http\\Controllers\\Api\\TokenizeInvestmentController;"
if receipt_import not in text:
    raise SystemExit('Missing Ta3meedReceiptController import anchor in api.php')
text = text.replace(receipt_import, f"{receipt_import}\n{tokenize_controller_import}", 1)

anchor = "    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);"
routes = """    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);

    Route::get('/tokenize/investments', [TokenizeInvestmentController::class, 'index']);
    Route::post('/tokenize/investments', [TokenizeInvestmentController::class, 'store']);
    Route::put('/tokenize/investments/{id}', [TokenizeInvestmentController::class, 'update']);
    Route::delete('/tokenize/investments/{id}', [TokenizeInvestmentController::class, 'destroy']);
    Route::post('/tokenize/investments/{investmentId}/payments', [TokenizeInvestmentController::class, 'storePayment']);
    Route::put('/tokenize/investments/{investmentId}/payments/{paymentId}', [TokenizeInvestmentController::class, 'updatePayment']);
    Route::delete('/tokenize/investments/{investmentId}/payments/{paymentId}', [TokenizeInvestmentController::class, 'destroyPayment']);
    Route::post('/tokenize/payments/{paymentId}/toggle-paid', [TokenizeInvestmentController::class, 'togglePayment']);"""
if "Route::get('/tokenize/investments'" not in text:
    if anchor not in text:
        raise SystemExit('Missing Dinar route anchor in api.php')
    text = text.replace(anchor, routes, 1)
api.write_text(text)

app_text = app.read_text()
api_text = api.read_text()
checks = [
    ("TokenizeInvestmentsScreen", app_text),
    ("'tokenize'", app_text),
    ("صكوك ترميز والعوائد والتوزيعات", app_text),
    ("TokenizeInvestmentController", api_text),
    ("Route::get('/tokenize/investments'", api_text),
]
for needle, haystack in checks:
    if needle not in haystack:
        raise SystemExit(f'Missing {needle}')

if app_text.count(tokenize_import) != 1:
    raise SystemExit('Tokenize mobile import must exist exactly once')
if app_text.count("if (investmentScreen === 'tokenize')") != 1:
    raise SystemExit('Tokenize navigation must exist exactly once')
if api_text.count(tokenize_controller_import) != 1:
    raise SystemExit('Tokenize API controller import must exist exactly once')

print('Tokenize platform patch applied idempotently and verified')
