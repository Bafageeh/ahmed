<?php

use App\Http\Controllers\Api\InvestmentPlatformController;
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
