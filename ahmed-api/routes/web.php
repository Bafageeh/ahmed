<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'app' => 'Ahmed Web',
        'time' => now()->toDateTimeString(),
    ]);
});

Route::get('/{any?}', function () {
    $index = public_path('webapp/index.html');

    if (file_exists($index)) {
        return response()->file($index);
    }

    return response('<h1>Ahmed Web is not built yet.</h1>', 200)
        ->header('Content-Type', 'text/html; charset=UTF-8');
})->where('any', '^(?!api|webapp|storage|favicon.ico|robots.txt).*$');
