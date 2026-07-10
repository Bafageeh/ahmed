<?php

use App\Services\DebtAutoPaymentService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function () {
    app(DebtAutoPaymentService::class)->apply();
})
    ->name('debts:auto-pay')
    ->dailyAt('00:05')
    ->timezone('Asia/Riyadh')
    ->withoutOverlapping();
