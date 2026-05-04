<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InvestmentPlatform extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name_ar',
        'name_en',
        'category',
        'calculation_method',
        'description',
        'settings',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(InvestmentAccount::class, 'platform_id');
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(InvestmentOpportunity::class, 'platform_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class, 'platform_id');
    }
}
