import React from 'react';

const n = (value) => Number(value || 0);
const money = (value, digits = 2) => `${n(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ر.س`;

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

function itemHasInvestor(item, selectedInvestor) {
  if (!selectedInvestor || selectedInvestor === 'all') return true;
  return (item.allocations || []).some((allocation) => investorKey(allocation) === selectedInvestor);
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
        const selectedInvestor = typeof deps?.[3] === 'string' ? deps[3] : 'all';
        const extraItems = deps[0].filter((item) => isPartialOpportunity(item) && !currentIds.has(String(item?.id)) && itemHasInvestor(item, selectedInvestor));
        if (extraItems.length) return [...value, ...extraItems];
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
