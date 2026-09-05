import React from 'react';
import { registerRootComponent } from 'expo';
import App from './AppShellWithAccountSelector';
import AutoUpdater from './AutoUpdater';
import CardStatementNotificationGate from './CardStatementNotificationGate';
import { ahmedUserHeaders, getCurrentAhmedUser } from './ahmedCurrentUser';

const AHMED_API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api').replace(/\/$/, '');
const baseFetch = globalThis.fetch;

function requestUrl(input) {
  if (typeof input === 'string') return input;
  return typeof input?.url === 'string' ? input.url : '';
}

function isAhmedApiRequest(url) {
  return url === AHMED_API_URL || url.startsWith(`${AHMED_API_URL}/`);
}

function isAdminOwnedExternalIntegration(url) {
  return (
    url.startsWith('https://finance.pm.sa/api/v1/integrations/ahmed') ||
    url.startsWith('https://com.pm.sa/api/v1/integrations/ahmed')
  );
}

globalThis.fetch = (input, init = {}) => {
  const url = requestUrl(input);
  const currentUser = getCurrentAhmedUser();

  // Finance/COM endpoints currently represent the administrator's linked accounts.
  // A non-admin session must never read them directly from the mobile client.
  if (currentUser && !currentUser.is_admin && isAdminOwnedExternalIntegration(url)) {
    return Promise.reject(new Error('ADMIN_OWNED_INTEGRATION_BLOCKED'));
  }

  // Never send the Ahmed bearer token or tenant id to another host.
  const headers = isAhmedApiRequest(url)
    ? ahmedUserHeaders(init.headers || {})
    : (init.headers || {});

  return baseFetch(input, { ...init, headers });
};

function Root() {
  return React.createElement(
    AutoUpdater,
    null,
    React.createElement(CardStatementNotificationGate, null, React.createElement(App))
  );
}

registerRootComponent(Root);
