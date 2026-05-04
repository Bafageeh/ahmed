<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvestmentAccount extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'wallet_balance' => 'decimal:2',
            'total_invested_snapshot' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function platform()
    {
        return $this->belongsTo(InvestmentPlatform::class, 'platform_id');
    }

    public function opportunities()
    {
        return $this->hasMany(InvestmentOpportunity::class, 'account_id');
    }
}
