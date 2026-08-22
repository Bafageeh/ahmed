import React from 'react';
import { registerRootComponent } from 'expo';
import App from './AppShellWithAccountSelector';
import AutoUpdater from './AutoUpdater';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const baseFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = ahmedUserHeaders(init.headers || {});
  return baseFetch(input, { ...init, headers });
};

function Root() {
  return React.createElement(AutoUpdater, null, React.createElement(App));
}

registerRootComponent(Root);
