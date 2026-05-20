<?php

namespace App\Support;

class Ta3meedInvestorName
{
    private const DISPLAY_NAMES = [
        'ahmed' => 'أحمد',
        'sara' => 'سارة',
        'amal' => 'آمال',
        'mother' => 'أمي',
        'father' => 'الوالد',
        'building' => 'المبنى',
    ];

    private const ALIASES = [
        'ahmed' => 'ahmed',
        'احمد' => 'ahmed',
        'sara' => 'sara',
        'ساره' => 'sara',
        'سارا' => 'sara',
        'amal' => 'amal',
        'امال' => 'amal',
        'امل' => 'amal',
        'mother' => 'mother',
        'mom' => 'mother',
        'امي' => 'mother',
        'امى' => 'mother',
        'الام' => 'mother',
        'والدتي' => 'mother',
        'father' => 'father',
        'dad' => 'father',
        'الوالد' => 'father',
        'والدي' => 'father',
        'ابوي' => 'father',
        'ابي' => 'father',
        'building' => 'building',
        'المبنى' => 'building',
        'المبني' => 'building',
    ];

    public static function code(?string $value): string
    {
        $key = self::key($value);

        if ($key === '') {
            return 'investor';
        }

        if (isset(self::ALIASES[$key])) {
            return self::ALIASES[$key];
        }

        return $key;
    }

    public static function displayName(?string $value, ?string $code = null): string
    {
        $canonicalCode = $code ? self::code($code) : self::code($value);

        if (isset(self::DISPLAY_NAMES[$canonicalCode])) {
            return self::DISPLAY_NAMES[$canonicalCode];
        }

        $name = trim((string) $value);

        return $name !== '' ? $name : $canonicalCode;
    }

    public static function key(?string $value): string
    {
        $value = mb_strtolower(trim((string) $value), 'UTF-8');
        $value = str_replace(["\u{200f}", "\u{200e}", "\u{00a0}", 'ـ'], ['', '', ' ', ''], $value);
        $value = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $value) ?: $value;
        $value = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $value);
        $value = str_replace(['ة', 'ى'], ['ه', 'ي'], $value);
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '', $value) ?: $value;

        return trim($value);
    }

    public static function isKnown(?string $value): bool
    {
        return isset(self::DISPLAY_NAMES[self::code($value)]);
    }
}
