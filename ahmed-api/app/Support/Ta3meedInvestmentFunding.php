<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Ta3meedInvestmentFunding
{
    /** Called only after the controller locks the authenticated owner's account and message. */
    public static function record(object $message): array
    {
        abort_unless(DB::transactionLevel() > 0, 500);
        $owner = (int) $message->user_id;
        $facts = Ta3meedInvestmentSmsParser::suggestion($message);
        abort_unless($facts['code'] !== '' && $facts['total_amount'] !== '', 422, 'رقم الفرصة أو مبلغ الاستثمار غير واضح في الرسالة.');
        $cents = Ta3meedAllocationPolicy::cents($facts['total_amount']);
        abort_unless($cents > 0, 422, 'مبلغ الاستثمار غير صحيح.');
        $reference = mb_strtolower(str_replace(['-', ' '], '', $facts['code']));
        $matches = DB::table('investment_opportunities as o')->where('o.user_id', $owner)
            ->whereExists(fn ($query) => $query->selectRaw('1')->from('investment_platforms as p')
                ->whereColumn('p.id', 'o.platform_id')->where('p.code', 'ta3meed'))
            ->whereRaw("LOWER(REPLACE(REPLACE(o.reference_number, '-', ''), ' ', '')) = ?", [$reference])
            ->lockForUpdate()->limit(2)->get(['o.*']);
        abort_unless($matches->count() === 1, 409, $matches->isEmpty()
            ? 'لم توجد فرصة مسجلة بهذا الرقم في تعميد. استخدم إكمال لإضافتها أولًا.' : 'يوجد أكثر من تطابق لرقم الفرصة؛ راجع الفرص قبل الخصم.');
        $opportunity = $matches->first();
        abort_unless(! $message->investment_opportunity_id || (int) $message->investment_opportunity_id === (int) $opportunity->id, 409, 'تغير ارتباط الرسالة بالفرصة؛ حدّث القائمة.');
        abort_unless(Ta3meedAllocationPolicy::savedCents($opportunity->principal_amount) === $cents, 409, 'مبلغ الفرصة المسجلة يختلف عن مبلغ الرسالة؛ راجع بياناتها قبل الخصم.');
        abort_if(in_array(strtolower((string) $opportunity->status), ['cancelled', 'canceled'], true), 409, 'الفرصة ملغاة؛ لم يُخصم مبلغها.');

        // The stable opportunity link deduplicates different SMS IDs and different delivery dates.
        $existing = DB::table('ta3meed_wallet_entries')->where('user_id', $owner)->where('investment_opportunity_id', $opportunity->id)->lockForUpdate()->first();
        if ($existing) {
            abort_unless($existing->voided_at === null && $existing->kind === 'withdrawal' && (int) $existing->amount_cents === -$cents, 409, 'حركة تمويل الفرصة تحتاج مراجعة؛ لم يتكرر الخصم.');
            return ['opportunity_id' => $opportunity->id, 'wallet_entry_id' => $existing->id, 'amount' => $facts['total_amount'],
                'reference' => $opportunity->reference_number, 'replayed' => true];
        }
        $date = $facts['start_date'];
        abort_unless($date !== '' && $date >= '2000-01-01' && $date <= now('Asia/Riyadh')->toDateString(), 422, 'تاريخ الرسالة غير واضح؛ لم يُخصم المبلغ.');
        $possibleDuplicate = Ta3meedWalletLedger::active($owner)->where('e.kind', '!=', 'opening_balance')
            ->whereRaw('('.Ta3meedWalletLedger::amountSql().') = ?', [-$cents])->whereRaw(Ta3meedWalletLedger::dateSql().' = ?', [$date])
            ->where(fn ($query) => $query->whereNull('e.investment_opportunity_id')->orWhere('e.investment_opportunity_id', $opportunity->id))->exists();
        abort_if($possibleDuplicate, 409, 'توجد حركة خصم بالقيمة والتاريخ نفسيهما؛ راجع المحفظة قبل الخصم.');
        $referenceUsed = DB::table('ta3meed_wallet_entries')->where('user_id', $owner)->where('kind', 'withdrawal')->whereNull('voided_at')
            ->whereRaw("LOWER(REPLACE(REPLACE(transaction_reference, '-', ''), ' ', '')) = ?", [$reference])->exists();
        abort_if($referenceUsed, 409, 'توجد حركة خصم برقم هذه الفرصة؛ راجع المحفظة قبل الخصم.');
        $id = DB::table('ta3meed_wallet_entries')->insertGetId([
            'user_id' => $owner, 'kind' => 'withdrawal', 'amount_cents' => -$cents, 'entry_date' => $date, 'source' => 'sms',
            'sms_message_id' => $message->id, 'investment_opportunity_id' => $opportunity->id,
            'fingerprint' => hash_hmac('sha256', 'investment-funding|'.$opportunity->id, (string) config('app.key')),
            'transaction_reference' => $opportunity->reference_number, 'notes' => 'تمويل فرصة تعميد '.$opportunity->reference_number.' · تم الرفع',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Ta3meedWalletLedger::audit($owner, $id, 'created');
        return ['opportunity_id' => $opportunity->id, 'wallet_entry_id' => $id, 'amount' => $facts['total_amount'],
            'reference' => $opportunity->reference_number, 'replayed' => false];
    }
}
