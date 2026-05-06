export const today = () => new Date().toISOString().slice(0, 10);
export const n = (value) => Number(value || 0);
export const money = (value, digits = 0) => n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fallbackTitles = ['استثمار شركة ألف', 'استثمار مصنع النور', 'استثمار الواحة العقارية', 'استثمار السوق الذكي', 'استثمار المستقبل'];

export const themes = [
  { bg: '#007371', icon: '▥' },
  { bg: '#6d5aa7', icon: '▤' },
  { bg: '#ff8a00', icon: '▦' },
  { bg: '#05a5a3', icon: '▱' },
  { bg: '#2e72bd', icon: '◇' },
];

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

export function titleOf(item, index) {
  const meta = metaOf(item.metadata);
  return item.title || meta.title || meta.name || item.reference_number || fallbackTitles[index % fallbackTitles.length];
}

export function searchable(item) {
  const meta = metaOf(item.metadata);
  return [item.title, item.reference_number, item.notes, item.status, meta.category, item.maturity_date]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
