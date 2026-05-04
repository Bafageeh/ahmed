<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvestmentPlatform;
use Illuminate\Http\JsonResponse;

class InvestmentPlatformController extends Controller
{
    public function index(): JsonResponse
    {
        $platforms = InvestmentPlatform::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $platforms,
        ]);
    }
}
