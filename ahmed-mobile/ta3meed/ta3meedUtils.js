export const today = () => new Date().toISOString().slice(0, 10);
export const n = (value) => Number(value || 0);
export const money = (value, digits = 0) => n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function metaOf(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch {
    return {};
  }
}

export function isReceived(item) {
  return item.status === 'received' || item.status === 'completed';
}

export function isOverdue(item, currentDate = today) {
  const meta = metaOf(item.metadata);
  const resolvedToday = typeof currentDate === 'function' ? currentDate() : currentDate;
  return !isReceived(item) && Boolean((item.maturity_date && item.maturity_date < resolvedToday) || meta.is_overdue || n(meta.remaining_days) < 0);
}

export function statusOf(item, currentDate = today) {
  if (isReceived(item)) return { key: 'received', label: 'مستلم' };
  if (isOverdue(item, currentDate)) return { key: 'overdue', label: 'متأخر' };
  return { key: 'active', label: 'نشط' };
}

export function titleOf(item) {
  const raw = item.reference_number || item.title || 'رقم غير مسجل';
  return String(raw).replace(/^\s*تعميد\s*-\s*/i, '').trim();
}

export function investorsOf(item) {
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  return allocations
    .map((allocation) => allocation.investor_name)
    .filter(Boolean);
}

export function investorCodesOf(item) {
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  return allocations
    .map((allocation) => allocation.investor_code || allocation.investor_name)
    .filter(Boolean);
}

export function searchable(item) {
  const meta = metaOf(item.metadata);
  return [
    item.title,
    item.reference_number,
    item.notes,
    item.status,
    meta.category,
    item.maturity_date,
    ...investorsOf(item),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
