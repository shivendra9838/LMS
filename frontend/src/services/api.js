import axios from 'axios';
import { clearPortalSession, getPortalSession, portalRole } from '../utils/portalSession.js';

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:5000/api/v1',
});

api.interceptors.request.use((config) => {
  const role = portalRole(window.location.pathname);
  const publicAuth = config.url === '/auth/login' || /^\/auth\/(admin|employee)\/(login|forgot-password|reset-password|otp\/(request|reset))$/.test(config.url || '');
  const token = !publicAuth && getPortalSession(role)?.token;
  config.portalRole = role;
  delete config.headers.Authorization;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined' && /^(post|put|patch|delete)$/i.test(response.config?.method || '') && /^\/(collections|loans|loan-schedules|loan-requests)(?:\/|$|\?)/.test(response.config?.url || '')) {
      window.dispatchEvent(new CustomEvent('royal:financial-change', {detail:{role:response.config.portalRole}}));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      const role = error.config.portalRole;
      // An old in-flight request must not sign out a more recent login or the other portal.
      if (`Bearer ${getPortalSession(role)?.token}` === error.config.headers.Authorization) {
        clearPortalSession(role);
        if (portalRole(window.location.pathname) === role && !window.location.pathname.includes('/login')) {
          window.location.href = `/${role.toLowerCase()}/login`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
