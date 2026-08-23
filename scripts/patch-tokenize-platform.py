#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / 'ahmed-mobile' / 'AppShell.js'
api = root / 'ahmed-api' / 'routes' / 'api.php'

text = app.read_text()
text = text.replace("import SulfaInvestmentScreen from './SulfaInvestmentScreen';", "import SulfaInvestmentScreen from './SulfaInvestmentScreen';\nimport TokenizeInvestmentsScreen from './TokenizeInvestmentsScreen';")
text = text.replace("const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa'];", "const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar', 'sulfa', 'tokenize'];")
text = text.replace("{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },", "{ key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'صكوك ترميز والعوائد والتوزيعات.' },")
text = text.replace("if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;", "if (investmentScreen === 'sulfa') return <SulfaInvestmentScreen onBack={() => setInvestmentScreen('list')} />;\n      if (investmentScreen === 'tokenize') return <TokenizeInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;")
app.write_text(text)

text = api.read_text()
text = text.replace("use App\\Http\\Controllers\\Api\\Ta3meedReceiptController;", "use App\\Http\\Controllers\\Api\\Ta3meedReceiptController;\nuse App\\Http\\Controllers\\Api\\TokenizeInvestmentController;")
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
    text = text.replace(anchor, routes)
api.write_text(text)

checks = [
    ("TokenizeInvestmentsScreen", app),
    ("'tokenize'", app),
    ("صكوك ترميز والعوائد والتوزيعات", app),
    ("TokenizeInvestmentController", api),
    ("Route::get('/tokenize/investments'", api),
]
for needle, path in checks:
    if needle not in path.read_text():
        raise SystemExit(f'Missing {needle} in {path}')

print('Tokenize platform patch applied and verified')
