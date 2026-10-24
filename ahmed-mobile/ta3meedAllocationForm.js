export function normalizeAmountInput(value) {
  return String(value ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/٫/g, '.').replace(/[٬,\s]/g, '');
}

export function parseMoneyCents(value) {
  const text = normalizeAmountInput(value);
  if (!/^\d{1,10}(?:\.\d{0,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function amountText(value) {
  return (Math.round(Number(value || 0) * 100) / 100).toFixed(2);
}

export function allocationFormRows(item) {
  return (item?.allocations || []).map((a) => ({
    allocation_id: a.id,
    investor_id: a.investor_id,
    investor_name: a.investor_name || a.investor_code || '',
    amount: amountText(a.invested_amount),
  }));
}

export function hasProtectedAllocations(item) {
  if (!item) return false;
  return Boolean(item.allocations_locked) || (item.receipts || []).length > 0
    || ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'cancelled', 'canceled'].includes(String(item.status).toLowerCase())
    || (item.allocations || []).some((a) => Number(a.received_amount || 0) !== 0 || Number(a.actual_profit_amount || 0) !== 0);
}

export function sameAllocationForm(rows, item) {
  if (!item) return false;
  const key = (r) => `${Number(r.allocation_id || 0)}:${Number(r.investor_id || 0)}:${parseMoneyCents(r.amount)}`;
  return JSON.stringify((rows || []).map(key).sort()) === JSON.stringify(allocationFormRows(item).map(key).sort());
}

export function allocationFormError(rows, totalValue, profitValue = 0, item = null) {
  const total = parseMoneyCents(totalValue);
  const profit = parseMoneyCents(profitValue === '' ? 0 : profitValue);
  if (total === null || total <= 0) return 'أدخل أصل الاستثمار بمنزلتين عشريتين كحد أقصى.';
  if (profit === null) return 'أدخل الربح المتوقع بمنزلتين عشريتين كحد أقصى.';
  const ids = (rows || []).map((r) => Number(r.investor_id));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return 'أعد تحميل الفرصة لاختيار المستثمرين المسجلين.';
  if (new Set(ids).size !== ids.length) return 'لا يمكن تكرار المستثمر نفسه في الفرصة.';
  if ((rows || []).some((r) => parseMoneyCents(r.amount) === null || parseMoneyCents(r.amount) <= 0)) return 'أدخل مبلغاً موجباً لكل مستثمر بمنزلتين عشريتين كحد أقصى.';
  const unchanged = item && sameAllocationForm(rows, item)
    && total === Math.round(Number(item.principal_amount) * 100)
    && profit === Math.round(Number(item.expected_profit_amount) * 100);
  if (unchanged) return ''; // Historical totals stay intact during a date or notes edit.
  if (hasProtectedAllocations(item)) return 'الحصص ذات الدفعات محفوظة. استخدم إجراء تصحيح المستثمر عند وجود خطأ في المالك.';
  if (!rows?.length) return 'أضف مستثمراً واحداً على الأقل.';
  if (rows.reduce((sum, r) => sum + parseMoneyCents(r.amount), 0) !== total) return 'وزع مبلغ الاستثمار كاملاً حتى يصبح غير الموزع صفراً.';
  return '';
}

export function allocationPayload(rows) {
  return (rows || []).map((r) => ({
    ...(r.allocation_id ? { allocation_id: Number(r.allocation_id) } : {}),
    investor_id: Number(r.investor_id),
    amount: (parseMoneyCents(r.amount) / 100).toFixed(2),
  }));
}
