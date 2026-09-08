import { ahmedUserHeaders } from './ahmedCurrentUser';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const bankIdFromOwnerGroup = (ownerGroup) => {
  const match = String(ownerGroup || '').match(/^bank:(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const cleanBankName = (value) => {
  const raw = String(value || '').trim();
  return raw.replace(/^بنك\s+/u, '').replace(/^البنك\s+/u, '') || raw || 'البنك';
};

export async function loadVaultCreditCardDebtData() {
  const response = await fetch(`${API_URL}/secure-vault`, {
    headers: ahmedUserHeaders({ Accept: 'application/json' }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'تعذر تحميل بطاقات الخزنة الآمنة');

  const items = Array.isArray(json.data) ? json.data : [];
  const banksById = new Map(
    items
      .filter((item) => item?.category === 'banks')
      .map((bank) => [Number(bank.id), bank]),
  );

  const cards = items
    .filter((item) => item?.category === 'cards' || item?.record_type === 'card')
    .map((item) => {
      const limit = numberValue(item.credit_balance);
      const bankId = bankIdFromOwnerGroup(item.owner_group);
      const bank = bankId ? banksById.get(bankId) : null;
      const bankName = cleanBankName(bank?.title || String(item.owner_group || '').replace(/^bank:/i, ''));
      const brand = item.card_type === 'mada'
        ? 'mada'
        : item.card_brand === 'mastercard'
          ? 'mastercard'
          : 'visa';

      return {
        id: item.id,
        secure_vault_item_id: item.id,
        bank_name: bankName,
        card_name: item.title || 'بطاقة',
        credit_limit: limit,
        card_brand: brand,
        card_type: item.card_type || (brand === 'mada' ? 'mada' : 'credit'),
        card_last_four: item.card_last_four || '',
      };
    })
    .filter((card) => card.card_type !== 'mada' && card.credit_limit > 0)
    .sort((a, b) => a.bank_name.localeCompare(b.bank_name, 'ar') || a.card_name.localeCompare(b.card_name, 'ar'));

  const total = cards.reduce((sum, card) => sum + numberValue(card.credit_limit), 0);
  const highestCard = cards.reduce((highest, card) => (
    !highest || numberValue(card.credit_limit) > numberValue(highest.credit_limit) ? card : highest
  ), null);

  return {
    cards,
    summary: {
      cards_count: cards.length,
      total_debt: total,
      highest_limit: highestCard ? numberValue(highestCard.credit_limit) : 0,
      highest_card: highestCard,
      average_limit: cards.length ? total / cards.length : 0,
    },
  };
}
