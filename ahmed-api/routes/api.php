<?php

use App\Http\Controllers\Api\AhmedSessionController;
use App\Http\Controllers\Api\AhmedUserController;
use App\Http\Controllers\Api\CreditCardDebtController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\DebtDashboardController;
use App\Http\Controllers\Api\DebtSupportController;
use App\Http\Controllers\Api\IncomeController;
use App\Http\Controllers\Api\InvestmentPlatformController;
use App\Http\Controllers\Api\LinkedIncomeController;
use App\Http\Controllers\Api\MoneyMoonTenantController;
use App\Http\Controllers\Api\DinarInvestmentController;
use App\Http\Controllers\Api\PersonalExpenseController;
use App\Http\Controllers\Api\SecureVaultController;
use App\Http\Controllers\Api\Ta3meedController;
use App\Http\Controllers\Api\Ta3meedImportController;
use App\Http\Controllers\Api\Ta3meedImageImportController;
use App\Http\Controllers\Api\Ta3meedInvestorAccountController;
use App\Http\Controllers\Api\Ta3meedMutationController;
use App\Http\Controllers\Api\Ta3meedReceiptController;
use App\Http\Controllers\Api\WhatsAppController;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\MonthlyIncomeController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'Ahmed API',
        'version' => '1.0.0',
        'time' => now()->toDateTimeString(),
    ]);
});

Route::post('/data-deletion', function (Request $request) {
    $confirmationCode = 'delete-' . Str::lower(Str::random(16));

    return response()->json([
        'url' => 'https://ahmed.pm.sa/datadeletion?code=' . $confirmationCode,
        'confirmation_code' => $confirmationCode,
    ]);
});

Route::post('/ahmed/session', [AhmedSessionController::class, 'store']);
Route::post('/auth/login', [AhmedSessionController::class, 'store']);
Route::get('/wa/webhook', [WhatsAppController::class, 'verifyWebhook']);
Route::post('/wa/webhook', [WhatsAppController::class, 'webhook']);

Route::middleware('ahmed.auth')->group(function () {
    Route::get('/ahmed/session', [AhmedSessionController::class, 'show']);
    Route::delete('/ahmed/session', [AhmedSessionController::class, 'destroy']);
    Route::get('/auth/me', [AhmedSessionController::class, 'show']);
    Route::post('/auth/logout', [AhmedSessionController::class, 'destroy']);

    Route::get('/ahmed/users', [AhmedUserController::class, 'index']);
    Route::post('/ahmed/users', [AhmedUserController::class, 'store']);
    Route::put('/ahmed/users/{id}', [AhmedUserController::class, 'update']);
    Route::get('/users', [AhmedUserController::class, 'index']);
    Route::post('/users', [AhmedUserController::class, 'store']);
    Route::put('/users/{id}', [AhmedUserController::class, 'update']);
    Route::get('/accounts', [AhmedUserController::class, 'index']);
    Route::post('/accounts', [AhmedUserController::class, 'store']);
    Route::put('/accounts/{id}', [AhmedUserController::class, 'update']);

    Route::get('/secure-vault', [SecureVaultController::class, 'index']);
    Route::post('/secure-vault', [SecureVaultController::class, 'store']);
    Route::get('/secure-vault/{id}', [SecureVaultController::class, 'show']);
    Route::put('/secure-vault/{id}', [SecureVaultController::class, 'update']);
    Route::delete('/secure-vault/{id}', [SecureVaultController::class, 'destroy']);

    Route::get('/investment-platforms', [InvestmentPlatformController::class, 'index']);
    Route::get('/moneymoon/investments', [MoneyMoonTenantController::class, 'index']);
    Route::post('/moneymoon/investments', [MoneyMoonTenantController::class, 'store']);
    Route::put('/moneymoon/investments/{id}', [MoneyMoonTenantController::class, 'update']);
    Route::delete('/moneymoon/investments/{id}', [MoneyMoonTenantController::class, 'destroy']);
    Route::post('/moneymoon/investments/{id}/receive', [MoneyMoonTenantController::class, 'receive']);
    Route::get('/dinar/investments', [DinarInvestmentController::class, 'index']);
    Route::post('/dinar/payments/{id}/toggle-paid', [DinarInvestmentController::class, 'togglePayment']);

    Route::get('/ta3meed/investments', [Ta3meedController::class, 'index']);
    Route::post('/ta3meed/investments', [Ta3meedController::class, 'store']);
    Route::post('/ta3meed/investments/import-finished', [Ta3meedImportController::class, 'finished']);
    Route::post('/ta3meed/image-import', [Ta3meedImageImportController::class, 'import']);
    Route::put('/ta3meed/investments/{id}', [Ta3meedMutationController::class, 'update']);
    Route::post('/ta3meed/investments/{id}/receive', [Ta3meedMutationController::class, 'receive']);
    Route::post('/ta3meed/investments/{id}/receipts', [Ta3meedReceiptController::class, 'store']);
    Route::put('/ta3meed/receipts/{id}', [Ta3meedReceiptController::class, 'update']);
    Route::delete('/ta3meed/receipts/{id}', [Ta3meedReceiptController::class, 'destroy']);
    Route::post('/ta3meed/receipts/parse', [Ta3meedReceiptController::class, 'parse']);
    Route::post('/ta3meed/receipts/apply-message', [Ta3meedReceiptController::class, 'applyMessage']);
    Route::post('/ta3meed/receipts/apply-message-confirmed', [Ta3meedReceiptController::class, 'applyMessageConfirmed']);
    Route::get('/ta3meed/investors/{code}/account', [Ta3meedInvestorAccountController::class, 'show']);
    Route::post('/ta3meed/investors/{code}/account/entries', [Ta3meedMutationController::class, 'storeInvestorAccountEntry']);
    Route::put('/ta3meed/investors/{code}/account/entries/{entryId}', [Ta3meedMutationController::class, 'updateInvestorAccountEntry']);
    Route::delete('/ta3meed/investors/{code}/account/entries/{entryId}', [Ta3meedMutationController::class, 'deleteInvestorAccountEntry']);
    Route::get('/ta3meed/summary', [Ta3meedController::class, 'summary']);
    Route::get('/income/basic', [IncomeController::class, 'index']);
    Route::post('/income/basic', [IncomeController::class, 'store']);
    Route::delete('/income/basic/{id}', [IncomeController::class, 'destroy']);
    Route::get('/personal-expenses', [PersonalExpenseController::class, 'index']);
    Route::post('/personal-expenses', [PersonalExpenseController::class, 'store']);
    Route::put('/personal-expenses/{id}', [PersonalExpenseController::class, 'update']);
    Route::delete('/personal-expenses/{id}', [PersonalExpenseController::class, 'destroy']);

    Route::get('/debts', [DebtDashboardController::class, 'index']);
    Route::get('/debts/{id}', [DebtSupportController::class, 'show']);
    Route::post('/debts/installments/{installmentId}/pay', [DebtController::class, 'pay']);
    Route::delete('/debts/installments/{installmentId}/payment', [DebtController::class, 'undoPayment']);

    Route::get('/credit-card-debts', [CreditCardDebtController::class, 'index']);
    Route::post('/credit-card-debts', [CreditCardDebtController::class, 'store']);
    Route::put('/credit-card-debts/{id}', [CreditCardDebtController::class, 'update']);
    Route::delete('/credit-card-debts/{id}', [CreditCardDebtController::class, 'destroy']);

    Route::get('/income/linked', [LinkedIncomeController::class, 'index']);
    Route::get('/income/linked/finance/summary', [LinkedIncomeController::class, 'financeSummary']);
    Route::post('/income/linked/finance/visibility', [LinkedIncomeController::class, 'updateFinanceVisibility']);
    Route::post('/income/linked/finance/summary/sync', [LinkedIncomeController::class, 'syncFinanceSummary']);
    Route::post('/income/linked/finance/card/sync', [LinkedIncomeController::class, 'syncFinanceMetric']);
    Route::post('/income/linked/finance/installments/sync', [LinkedIncomeController::class, 'syncFinanceInstallments']);
    Route::post('/income/linked/moneymoon/profits/sync', [LinkedIncomeController::class, 'syncMoneyMoonProfits']);
    Route::get('/wa/status', [WhatsAppController::class, 'status']);
    Route::get('/wa/messages', [WhatsAppController::class, 'index']);
    Route::post('/wa/send', [WhatsAppController::class, 'sendText']);
    Route::post('/wa/template', [WhatsAppController::class, 'sendTemplate']);
    Route::post('/wa/queue', [WhatsAppController::class, 'scheduleText']);
    Route::post('/wa/queue-template', [WhatsAppController::class, 'queueTemplate']);
});

Route::get('/monthly-incomes', [MonthlyIncomeController::class, 'index']);
Route::post('/monthly-incomes', [MonthlyIncomeController::class, 'store']);
Route::put('/monthly-incomes/{id}', [MonthlyIncomeController::class, 'update']);
Route::delete('/monthly-incomes/{id}', [MonthlyIncomeController::class, 'destroy']);
