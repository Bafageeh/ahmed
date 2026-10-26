<?php

use App\Http\Controllers\Api\SmsCaptureController;
use App\Http\Controllers\Api\SmsReviewController;
use Illuminate\Support\Facades\Route;

// Native background ingestion uses a dedicated, revocable, account-scoped device token.
Route::post('/sms/ingest', [SmsCaptureController::class, 'ingest'])->middleware('throttle:120,1');

Route::middleware('ahmed.auth')->group(function () {
    Route::get('/sms/messages', [SmsCaptureController::class, 'index']);
    Route::get('/sms/messages/{id}/review', [SmsReviewController::class, 'show'])->whereNumber('id');
    Route::post('/sms/messages/{id}/approve', [SmsReviewController::class, 'approve'])->whereNumber('id');
    Route::post('/sms/devices', [SmsCaptureController::class, 'registerDevice']);
    Route::delete('/sms/devices/{installation}', [SmsCaptureController::class, 'disableDevice'])->whereUuid('installation');
});
