<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class NormalizeMadaVaultCard
{
    public function handle(Request $request, Closure $next): Response
    {
        $isVaultWrite = $request->is('api/secure-vault*')
            && in_array($request->method(), ['POST', 'PUT', 'PATCH'], true);
        $isMadaCard = $request->input('record_type') === 'card'
            && $request->input('category') === 'cards'
            && $request->input('card_type') === 'mada';

        if ($isVaultWrite && $isMadaCard) {
            // The legacy controller still requires title + statement_day for every card.
            // Supply technical values only for validation; Mada has no statement date.
            $request->merge([
                'title' => trim((string) $request->input('title')) ?: 'مدى',
                'statement_day' => 1,
                'card_brand' => 'mada',
                'credit_card_debt_id' => null,
                'sadad_number' => null,
            ]);
        }

        $response = $next($request);

        if ($isVaultWrite && $isMadaCard && $response->isSuccessful()) {
            $payload = json_decode((string) $response->getContent(), true);
            $id = is_array($payload) ? ($payload['data']['id'] ?? null) : null;

            if ($id) {
                DB::table('secure_vault_items')
                    ->where('id', $id)
                    ->update(['statement_day' => null]);

                // Keep the immediate API response consistent with the stored value.
                $payload['data']['statement_day'] = null;
                $response->setContent(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            }
        }

        return $response;
    }
}
