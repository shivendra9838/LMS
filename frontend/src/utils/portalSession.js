const roles = ['ADMIN', 'EMPLOYEE'];
export const SESSION_EVENT = 'royal:portal-session-change';
export const sessionKey = role => `royal.session.${role.toLowerCase()}`;

export function portalRole(pathname) {
  if (/^\/admin(?:\/|$)/.test(pathname)) return 'ADMIN';
  if (/^\/employee(?:\/|$)/.test(pathname)) return 'EMPLOYEE';
  return null;
}

function validSession(value, role) {
  try {
    if (!roles.includes(role) || typeof value?.token !== 'string' || value.user?.role !== role) return null;
    const payload = value.token.split('.')[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    // UI consistency check only. The server still verifies JWT signatures and permissions.
    if (claims.exp !== undefined && (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now())) return null;
    if (claims.role !== role || String(claims.id) !== String(value.user.id) || !value.user.id) return null;
    return value;
  } catch { return null; }
}

export function getPortalSession(role, storage = window.localStorage) {
  if (!roles.includes(role)) return null;
  try {
    const temporary = storage === window.localStorage ? window.sessionStorage?.getItem(sessionKey(role)) : null;
    const stored = temporary ?? storage.getItem(sessionKey(role));
    if (stored !== null) return validSession(JSON.parse(stored), role);
    // Preserve a valid existing login only in its matching portal during migration.
    return validSession({token:storage.getItem('token'), user:JSON.parse(storage.getItem('user') || 'null')}, role);
  } catch { return null; }
}

function clearLegacy(role, storage) {
  try {
    if (JSON.parse(storage.getItem('user') || 'null')?.role === role) {
      storage.removeItem('token'); storage.removeItem('user');
    }
  } catch { /* Do not touch the other portal's session. */ }
}

export function savePortalSession(role, session, storage = window.localStorage) {
  if (!validSession(session, role)) throw new Error('Login session does not match this portal. Please sign in again.');
  if (storage === window.localStorage) window.sessionStorage?.removeItem(sessionKey(role));
  else if (storage === window.sessionStorage) {window.localStorage.removeItem(sessionKey(role));clearLegacy(role,window.localStorage);}
  storage.setItem(sessionKey(role), JSON.stringify(session));
  clearLegacy(role, storage);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EVENT, {detail:{role}}));
}

export function clearPortalSession(role, storage = window.localStorage) {
  if (!roles.includes(role)) return;
  storage.removeItem(sessionKey(role));
  if (storage === window.localStorage) window.sessionStorage?.removeItem(sessionKey(role));
  clearLegacy(role, storage);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EVENT, {detail:{role}}));
}

export function isSessionStorageKey(key, role) {
  return key === null || key === sessionKey(role) || key === 'token' || key === 'user';
}
