import { registerRootComponent } from 'expo';
import App from './AppShellWithAccountSelector';
import { ahmedUserHeaders } from './ahmedCurrentUser';

const baseFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = ahmedUserHeaders(init.headers || {});
  return baseFetch(input, { ...init, headers });
};

registerRootComponent(App);
