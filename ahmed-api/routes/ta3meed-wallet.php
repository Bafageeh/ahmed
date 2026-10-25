<?php

use App\Http\Controllers\Api\Ta3meedWalletController;
use Illuminate\Support\Facades\Route;

Route::middleware('ahmed.auth')->group(function () {
    Route::get('/ta3meed/wallet', [Ta3meedWalletController::class, 'index']);
    Route::post('/ta3meed/wallet/entries', [Ta3meedWalletController::class, 'store']);
    Route::put('/ta3meed/wallet/entries/{id}', [Ta3meedWalletController::class, 'update'])->whereNumber('id');
    Route::delete('/ta3meed/wallet/entries/{id}', [Ta3meedWalletController::class, 'destroy'])->whereNumber('id');
});
