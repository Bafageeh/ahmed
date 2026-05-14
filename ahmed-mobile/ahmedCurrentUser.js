let currentUserId = null;

export function setCurrentAhmedUserId(id) {
  currentUserId = id ? String(id) : null;
}

export function getCurrentAhmedUserId() {
  return currentUserId;
}

export function ahmedUserHeaders(extra = {}) {
  return currentUserId ? { ...extra, 'X-Ahmed-User-Id': String(currentUserId) } : extra;
}
