import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global security interceptor: catches 401 Unauthorized across all API clients
// to prevent zombie sessions, unauthorized access, and stale token exploits
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const res = await originalFetch.call(this, input, init);
    if (res.status === 401) {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      // Exclude public authentication submission routes
      const isPublicAuthRoute =
        url.includes('/auth/login') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password') ||
        url.includes('/purchaser/auth/login') ||
        url.includes('/admin/auth/login');

      if (!isPublicAuthRoute) {
        try {
          window.sessionStorage?.removeItem('hims_employee_session');
          window.localStorage?.removeItem('hims_employee_session');
          window.sessionStorage?.removeItem('hims_session');
          window.localStorage?.removeItem('hims_session');
        } catch {}
        window.dispatchEvent(new CustomEvent('hims:unauthorized'));
      }
    }
    return res;
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
