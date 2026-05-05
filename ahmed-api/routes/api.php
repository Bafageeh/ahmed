<?php

use App\Http\Controllers\Api\IncomeController;
use App\Http\Controllers\Api\InvestmentPlatformController;
use App\Http\Controllers\Api\LinkedIncomeController;
use App\Http\Controllers\Api\MoneyMoonController;
use App\Http\Controllers\Api\Ta3meedController;
use App\Http\Controllers\Api\Ta3meedMutationController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'Ahmed API',
        'version' => '1.0.0',
        'time' => now()->toDateTimeString(),
    ]);
});

Route::get('/investment-platforms', [InvestmentPlatformController::class, 'index']);
Route::get('/moneymoon/investments', [MoneyMoonController::class, 'index']);
Route::post('/moneymoon/investments', [MoneyMoonController::class, 'store']);
Route::put('/moneymoon/investments/{id}', [MoneyMoonController::class, 'update']);
Route::delete('/moneymoon/investments/{id}', [MoneyMoonController::class, 'destroy']);
Route::post('/moneymoon/investments/{id}/receive', [MoneyMoonController::class, 'receive']);
Route::get('/ta3meed/investments', [Ta3meedController::class, 'index']);
Route::post('/ta3meed/investments', [Ta3meedController::class, 'store']);
Route::put('/ta3meed/investments/{id}', [Ta3meedMutationController::class, 'update']);
Route::post('/ta3meed/investments/{id}/receive', [Ta3meedMutationController::class, 'receive']);
Route::get('/ta3meed/summary', [Ta3meedController::class, 'summary']);
Route::get('/income/basic', [IncomeController::class, 'index']);
Route::post('/income/basic', [IncomeController::class, 'store']);
Route::delete('/income/basic/{id}', [IncomeController::class, 'destroy']);
Route::get('/income/linked', [LinkedIncomeController::class, 'index']);
Route::get('/income/linked/finance/summary', [LinkedIncomeController::class, 'financeSummary']);
Route::post('/income/linked/finance/visibility', [LinkedIncomeController::class, 'updateFinanceVisibility']);
Route::post('/income/linked/finance/summary/sync', [LinkedIncomeController::class, 'syncFinanceSummary']);
Route::post('/income/linked/finance/card/sync', [LinkedIncomeController::class, 'syncFinanceMetric']);
Route::post('/income/linked/finance/installments/sync', [LinkedIncomeController::class, 'syncFinanceInstallments']);
Route::post('/income/linked/moneymoon/profits/sync', [LinkedIncomeController::class, 'syncMoneyMoonProfits']);
