<?php

use App\Http\Controllers\Api\InvestmentPlatformController;
use App\Http\Controllers\Api\MoneyMoonController;
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
Route::post('/moneymoon/investments/{id}/receive', [MoneyMoonController::class, 'receive']);
