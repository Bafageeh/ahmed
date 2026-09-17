<?php

namespace App\Providers;

use App\Http\Controllers\Api\Ta3meedDataToolsController;
use App\Http\Controllers\Api\Ta3meedExcelExportController;
use Illuminate\Support\ServiceProvider;

class Ta3meedExcelExportServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(Ta3meedDataToolsController::class, Ta3meedExcelExportController::class);
    }
}
