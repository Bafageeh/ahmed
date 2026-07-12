import React from 'react';

const n = (value) => Number(value || 0);
const money = (value, digits = 2) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;
const CATEGORIES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

function metaOf(item) {
  try {
    return typeof item?.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item?.metadata || {};
  } catch {
    return {};
  }
}

function categoryOf(item) {
  const raw = String(metaOf(item).category || item.category || '').trim().toUpperCase().replace(/\s+/g, '');
  return CATEGORIES.includes(raw) ? raw : '-';
}

function investorKey(allocation) {
  return String(allocation?.investor_code || allocation?.investor_name || '').trim();
}

function isEndedOpportunity(item) {
  const status = String(item?.status || '').trim().toLowerCase();
  return ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done'].includes(status);
}

function isPartialOpportunity(item) {
  return String(item?.status || '').trim().toLowerCase() === 'partial_received';
}

function compareOpportunityOrder(a, b) {
  const dateValue = (item) => {
    const dateText = String(item?.maturity_date || item?.due_date || '').slice(0, 10);
    if (!dateText) return null;
    const value = new Date(`${dateText}T00:00:00`).getTime();
    return Number.isFinite(value) ? value : null;
  };

  const aValue = dateValue(a);
  const bValue = dateValue(b);

  if (aValue === null && bValue !== null) return -1;
  if (aValue !== null && bValue === null) return 1;
  if (aValue !== null && bValue !== null && aValue !== bValue) return aValue - bValue;

  return String(a?.reference_number || a?.code || a?.id || '').localeCompare(
    String(b?.reference_number || b?.code || b?.id || ''),
    'ar'
  );
}

function itemHasInvestor(item, selectedInvestor) {
  if (!selectedInvestor || selectedInvestor === 'all') return true;
  return (item.allocations || []).some((allocation) => investorKey(allocation) === selectedInvestor);
}

function itemHasCategory(item, selectedCategory) {
  if (!selectedCategory || selectedCategory === 'all') return true;
  return categoryOf(item) === selectedCategory;
}

function normalizeSearchValue(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0625\u0623\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addSearchPart(parts, value) {
  if (value === null || value === undefined || value === '') return;
  const raw = String(value);
  parts.push(raw);
  const numeric = raw.replace(/,/g, '');
  if (numeric !== raw) parts.push(numeric);
}

function searchTextOf(item) {
  const meta = metaOf(item);
  const parts = [];

  [
    item.reference_number,
    item.code,
    meta.reference_number,
    meta.code,
    meta.company_name,
    item.company_name,
    meta.activity,
    item.activity,
    meta.description,
    item.description,
    meta.tasks,
    item.tasks,
    meta.executor,
    item.executor,
    item.principal_amount,
    item.total_amount,
    item.amount,
    meta.total_amount,
    meta.amount,
  ].forEach((value) => addSearchPart(parts, value));

  (item.allocations || []).forEach((allocation) => {
    [
      allocation.investor_name,
      allocation.investor_code,
      allocation.invested_amount,
    ].forEach((value) => addSearchPart(parts, value));
  });

  const normalized = normalizeSearchValue(parts.join(' '));
  const collapsed = normalized.replace(/\s+/g, '');
  return { normalized, collapsed };
}

function itemMatchesSearch(item, query) {
  const tokens = normalizeSearchValue(query).split(' ').filter(Boolean);
  if (!tokens.length) return true;

  const { normalized, collapsed } = searchTextOf(item);

  return tokens.every((token) => {
    const cleanToken = normalizeSearchValue(token);
    if (!cleanToken) return true;
    const collapsedToken = cleanToken.replace(/\s+/g, '');
    return normalized.includes(cleanToken) || collapsed.includes(collapsedToken);
  });
}

function partialReceivedAmount(items, selectedInvestor = 'all') {
  return (items || []).reduce((total, item) => {
    if (isEndedOpportunity(item)) return total;

    const allocations = item.allocations || [];
    const selectedAllocations = selectedInvestor && selectedInvestor !== 'all'
      ? allocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
      : allocations;

    if (selectedInvestor && selectedInvestor !== 'all' && selectedAllocations.length === 0) return total;

    const receiptAllocationsTotal = (item.receipts || []).reduce((receiptTotal, receipt) => {
      const receiptAllocations = receipt.allocations || [];
      const selectedReceiptAllocations = selectedInvestor && selectedInvestor !== 'all'
        ? receiptAllocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
        : receiptAllocations;

      return receiptTotal + selectedReceiptAllocations.reduce((sum, allocation) => sum + n(allocation.received_amount), 0);
    }, 0);

    const allocationReceivedTotal = selectedAllocations.reduce((sum, allocation) => sum + n(allocation.received_amount), 0);

    if (receiptAllocationsTotal > 0 || allocationReceivedTotal > 0) {
      return total + Math.max(receiptAllocationsTotal, allocationReceivedTotal);
    }

    if (selectedInvestor && selectedInvestor !== 'all') return total;

    const rawReceiptTotal = (item.receipts || []).reduce((sum, receipt) => sum + n(receipt.amount), 0);
    return total + Math.max(n(item.received_amount), rawReceiptTotal);
  }, 0);
}

if (!React.__ta3meedPartialReceivedMemoPatched) {
  const originalUseMemo = React.useMemo;

  React.useMemo = function patchedUseMemo(factory, deps) {
    return originalUseMemo.call(this, () => {
      const value = factory();

      if (Array.isArray(value) && Array.isArray(deps?.[0]) && deps?.[1] === 'active') {
        const currentIds = new Set(value.map((item) => String(item?.id)));
        const selectedCategory = typeof deps?.[2] === 'string' ? deps[2] : 'all';
        const selectedInvestor = typeof deps?.[3] === 'string' ? deps[3] : 'all';
        const query = typeof deps?.[4] === 'string' ? deps[4] : '';
        const extraItems = deps[0].filter((item) => (
          isPartialOpportunity(item)
          && !currentIds.has(String(item?.id))
          && itemHasCategory(item, selectedCategory)
          && itemHasInvestor(item, selectedInvestor)
          && itemMatchesSearch(item, query)
        ));
        if (extraItems.length) return [...value, ...extraItems].sort(compareOpportunityOrder);
      }

      const looksLikeTa3meedTotals = value && typeof value === 'object' && !Array.isArray(value)
        && Object.prototype.hasOwnProperty.call(value, 'invested')
        && Object.prototype.hasOwnProperty.call(value, 'profit')
        && Object.prototype.hasOwnProperty.call(value, 'active')
        && Object.prototype.hasOwnProperty.call(value, 'partial')
        && Object.prototype.hasOwnProperty.call(value, 'received');

      if (!looksLikeTa3meedTotals) return value;

      const filteredItems = Array.isArray(deps?.[0]) ? deps[0] : [];
      const allItems = Array.isArray(deps?.[1]) ? deps[1] : [];
      const selectedInvestor = typeof deps?.[2] === 'string' ? deps[2] : 'all';

      return {
        ...value,
        active: filteredItems.filter((item) => !isEndedOpportunity(item)).length,
        partial: money(partialReceivedAmount(allItems, selectedInvestor), 2),
      };
    }, deps);
  };

  React.__ta3meedPartialReceivedMemoPatched = true;
}

const Ta3meedCompactFiltersScreen = require('./Ta3meedCompactFiltersScreen.js').default;

export default function Ta3meedNoResetFilterScreen(props) {
  return <Ta3meedCompactFiltersScreen {...props} />;
}
