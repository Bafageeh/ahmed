import React from 'react';
import { TouchableOpacity } from 'react-native';

const RESET_FILTER_TEXT = 'إعادة الفلتر إلى نشط';
const CATEGORIES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

const today = () => new Date().toISOString().slice(0, 10);
const n = (value) => Number(value || 0);

function containsResetFilterText(node) {
  if (typeof node === 'string') return node.includes(RESET_FILTER_TEXT);
  if (Array.isArray(node)) return node.some(containsResetFilterText);
  if (node && typeof node === 'object') return containsResetFilterText(node.props?.children);
  return false;
}

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

function statusKeyOf(item) {
  if (item?.status === 'received' || item?.status === 'completed') return 'received';
  if (item?.status === 'partial_received') return 'partial_received';
  if (item?.maturity_date && item.maturity_date < today()) return 'overdue';
  return 'active';
}

function investorKey(allocation) {
  return String(allocation?.investor_code || allocation?.investor_name || '').trim();
}

function itemHasInvestor(item, selectedInvestor) {
  if (!selectedInvestor || selectedInvestor === 'all') return true;
  return (item.allocations || []).some((allocation) => investorKey(allocation) === selectedInvestor);
}

function itemMatchesKeyword(item, keyword) {
  if (!keyword) return true;
  const meta = metaOf(item);
  const category = categoryOf(item);
  const text = [
    item.reference_number,
    item.status,
    item.maturity_date,
    meta.category,
    category,
    meta.withdrawal_date,
    ...(item.allocations || []).map((allocation) => allocation.investor_name),
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes(keyword);
}

function activeStatusFilteredItems(items, categoryFilter, investorFilter, query) {
  const keyword = String(query || '').trim().toLowerCase();

  return (items || []).filter((item) => {
    if (statusKeyOf(item) === 'received') return false;
    if (categoryFilter !== 'all' && categoryOf(item) !== categoryFilter) return false;
    if (!itemHasInvestor(item, investorFilter)) return false;
    return itemMatchesKeyword(item, keyword);
  });
}

function receivedAmountOf(item, meta, receipts, allocations) {
  const metaReceived = n(meta.ta3meed_received_total);
  const itemReceived = n(item.received_amount);
  const receiptsReceived = (receipts || []).reduce((sum, receipt) => sum + n(receipt.amount), 0);
  const allocationsReceived = (allocations || []).reduce((sum, allocation) => sum + n(allocation.received_amount), 0);
  return Math.max(metaReceived, itemReceived, receiptsReceived, allocationsReceived);
}

function netActiveInvestedAmount(items, selectedInvestor) {
  return (items || []).reduce((total, item) => {
    if (statusKeyOf(item) === 'received') return total;

    const allocations = item.allocations || [];
    const selectedAllocations = selectedInvestor && selectedInvestor !== 'all'
      ? allocations.filter((allocation) => investorKey(allocation) === selectedInvestor)
      : allocations;

    if (selectedInvestor && selectedInvestor !== 'all' && selectedAllocations.length === 0) {
      return total;
    }

    if (selectedAllocations.length > 0) {
      const meta = metaOf(item);
      const totalAllocated = allocations.reduce((sum, allocation) => sum + n(allocation.invested_amount), 0);
      const itemReceivedTotal = receivedAmountOf(item, meta, item.receipts || [], allocations);
      const hasAllocationReceipts = allocations.some((allocation) => n(allocation.received_amount) > 0);

      return total + selectedAllocations.reduce((sum, allocation) => {
        const invested = n(allocation.invested_amount);
        const proportionalReceived = totalAllocated > 0 ? itemReceivedTotal * (invested / totalAllocated) : 0;
        const received = hasAllocationReceipts ? n(allocation.received_amount) : proportionalReceived;
        return sum + Math.max(0, invested - Math.min(invested, received));
      }, 0);
    }

    const meta = metaOf(item);
    const invested = n(item.principal_amount);
    const received = receivedAmountOf(item, meta, item.receipts || [], allocations);
    return total + Math.max(0, invested - Math.min(invested, received));
  }, 0);
}

function expectedProfitForActiveItems(items) {
  return (items || []).reduce((sum, item) => {
    if (statusKeyOf(item) === 'received') return sum;
    return sum + n(item.expected_profit_amount);
  }, 0);
}

function countActiveItems(items) {
  return (items || []).filter((item) => statusKeyOf(item) !== 'received').length;
}

const originalUseState = React.useState;
const originalUseMemo = React.useMemo;
let renderingTa3meed = false;
let stateHookIndex = 0;
let currentInvestorFilter = 'all';

React.useState = function patchedTa3meedUseState(initialState) {
  const hookIndex = stateHookIndex;
  stateHookIndex += 1;
  const stateTuple = originalUseState.call(this, initialState);

  if (renderingTa3meed && hookIndex === 6) {
    currentInvestorFilter = stateTuple[0] || 'all';
  }

  return stateTuple;
};

React.useMemo = function patchedTa3meedUseMemo(factory, deps) {
  const value = originalUseMemo.call(this, factory, deps);

  const looksLikeFilteredItems = Array.isArray(value)
    && Array.isArray(deps)
    && deps.length === 5
    && Array.isArray(deps[0])
    && typeof deps[1] === 'string'
    && typeof deps[2] === 'string'
    && typeof deps[3] === 'string';

  if (renderingTa3meed && looksLikeFilteredItems && deps[1] === 'active') {
    const [items, , categoryFilter, investorFilter, query] = deps;
    return activeStatusFilteredItems(items, categoryFilter, investorFilter, query);
  }

  const looksLikeTotals = value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'invested')
    && Object.prototype.hasOwnProperty.call(value, 'profit')
    && Object.prototype.hasOwnProperty.call(value, 'active')
    && Object.prototype.hasOwnProperty.call(value, 'partial')
    && Object.prototype.hasOwnProperty.call(value, 'received')
    && Array.isArray(deps)
    && deps.length === 1
    && Array.isArray(deps[0]);

  if (!renderingTa3meed || !looksLikeTotals) return value;

  return {
    ...value,
    invested: netActiveInvestedAmount(deps[0], currentInvestorFilter),
    profit: expectedProfitForActiveItems(deps[0]),
    active: countActiveItems(deps[0]),
  };
};

const Ta3meedCompactFiltersScreen = require('./Ta3meedCompactFiltersScreen.js').default;

export default function Ta3meedNoResetFilterScreen(props) {
  const originalCreateElement = React.createElement;

  React.createElement = function createElementWithoutResetFilterButton(type, elementProps, ...children) {
    if (type === TouchableOpacity && containsResetFilterText(children)) {
      return null;
    }

    return originalCreateElement.call(this, type, elementProps, ...children);
  };

  renderingTa3meed = true;
  stateHookIndex = 0;

  try {
    return Ta3meedCompactFiltersScreen(props);
  } finally {
    renderingTa3meed = false;
    React.createElement = originalCreateElement;
  }
}
