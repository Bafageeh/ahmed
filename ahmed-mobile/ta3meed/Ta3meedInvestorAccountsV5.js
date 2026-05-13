import React from 'react';
import { Text } from 'react-native';
import { money, n } from './ta3meedUtils';

let latestCashByInvestor = {};
let activeCashReplacement = null;
let patched = false;

function computeInvestorTa3meed(opportunities) {
  const closedStatuses = ['received', 'completed', 'closed', 'cancelled', 'canceled', 'finished', 'ended'];
  return (opportunities || []).reduce((sum, opportunity) => {
    const status = String(opportunity?.opportunity_status || opportunity?.allocation_status || '').trim().toLowerCase();
    const remaining = n(opportunity?.remaining_amount);
    if (closedStatuses.includes(status) || remaining <= 0) return sum;
    const invested = n(opportunity?.invested_amount);
    const received = n(opportunity?.received_amount);
    return sum + Math.max(0, invested - received);
  }, 0);
}

function rememberCashFromAccount(url, data) {
  const match = String(url || '').match(/\/ta3meed\/investors\/([^/]+)\/account/);
  const key = match?.[1];
  const summary = data?.data?.summary || {};
  const opportunities = Array.isArray(data?.data?.opportunities) ? data.data.opportunities : [];
  const balance = n(data?.data?.balance !== undefined ? data.data.balance : summary.manual_balance);
  const ta3meed = computeInvestorTa3meed(opportunities);
  if (key) latestCashByInvestor[key] = money(balance - ta3meed, 2);
}

function textOf(children) {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

function patchRuntime() {
  if (patched) return;
  patched = true;

  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = args[0];
    if (String(url || '').includes('/ta3meed/investors/') && String(url || '').includes('/account')) {
      response.clone().json().then((json) => rememberCashFromAccount(url, json)).catch(() => {});
    }
    return response;
  };

  const originalCreateElement = React.createElement;
  React.createElement = function patchedCreateElement(type, props, ...children) {
    if (type === Text) {
      const label = textOf(children.length ? children : props?.children);
      if (label === 'الكاش') activeCashReplacement = 'next';
      else if (activeCashReplacement === 'next' && /^-?[\d,.]+$/.test(label.trim())) {
        activeCashReplacement = null;
        const firstKey = Object.keys(latestCashByInvestor).slice(-1)[0];
        if (firstKey && latestCashByInvestor[firstKey]) {
          return originalCreateElement.call(this, type, props, latestCashByInvestor[firstKey]);
        }
      }
    }
    return originalCreateElement.call(this, type, props, ...children);
  };

  try {
    const runtime = require('react/jsx-runtime');
    ['jsx', 'jsxs', 'jsxDEV'].forEach((name) => {
      const original = runtime[name];
      if (typeof original !== 'function') return;
      runtime[name] = function patchedJsx(type, props, ...rest) {
        if (type === Text) {
          const label = textOf(props?.children);
          if (label === 'الكاش') activeCashReplacement = 'next';
          else if (activeCashReplacement === 'next' && /^-?[\d,.]+$/.test(label.trim())) {
            activeCashReplacement = null;
            const firstKey = Object.keys(latestCashByInvestor).slice(-1)[0];
            if (firstKey && latestCashByInvestor[firstKey]) {
              return original.call(this, type, { ...props, children: latestCashByInvestor[firstKey] }, ...rest);
            }
          }
        }
        return original.call(this, type, props, ...rest);
      };
    });
  } catch {}
}

patchRuntime();

export { Ta3meedInvestorAccounts } from './Ta3meedInvestorAccountsV4';
