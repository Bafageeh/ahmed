let currentSession = null;

export function setCurrentAhmedUserId(id) {
  if (id) {
    currentSession = { ...(currentSession || {}), user: { ...((currentSession || {}).user || {}), id: Number(id) } };
  } else {
    currentSession = null;
  }
}

export function setCurrentAhmedSession(session) {
  currentSession = session && session.user && session.sessionKey
    ? { user: session.user, sessionKey: String(session.sessionKey) }
    : null;
}

export function clearCurrentAhmedSession() {
  currentSession = null;
}

export function getCurrentAhmedSession() {
  return currentSession;
}

export function getCurrentAhmedUser() {
  return currentSession?.user || null;
}

export function getCurrentAhmedUserId() {
  return currentSession?.user?.id ? String(currentSession.user.id) : null;
}

export function ahmedUserHeaders(extra = {}) {
  const headers = { ...extra };
  if (currentSession?.sessionKey) {
    headers.Authorization = `Bearer ${currentSession.sessionKey}`;
    headers['X-Ahmed-Token'] = currentSession.sessionKey;
  }
  if (currentSession?.user?.id) {
    headers['X-Ahmed-User-Id'] = String(currentSession.user.id);
  }
  return headers;
}
