import { useEffect, useState } from 'react';
import { getPortalSession, isSessionStorageKey, SESSION_EVENT } from '../utils/portalSession';

export default function usePortalSession(role) {
  const [session, setSession] = useState(() => getPortalSession(role));
  useEffect(() => {
    const update = () => setSession(getPortalSession(role));
    const storageChanged = event => { if (isSessionStorageKey(event.key, role)) update(); };
    const sessionChanged = event => { if (event.detail?.role === role) update(); };
    update();
    window.addEventListener('storage', storageChanged);
    window.addEventListener(SESSION_EVENT, sessionChanged);
    return () => { window.removeEventListener('storage', storageChanged); window.removeEventListener(SESSION_EVENT, sessionChanged); };
  }, [role]);
  return session;
}
