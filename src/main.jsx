import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initSecurityShield } from './utils/securityShield'

// Initialize Anti-Tamper Protocol before rendering
initSecurityShield();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// High-speed Service Worker with real-time update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // 1. Immediately check for latest service worker
      reg.update().catch(() => {});

      // 2. Poll for updates every 15 seconds to catch newly deployed builds immediately
      setInterval(() => {
        reg.update().catch(() => {});
      }, 15000);
    }).catch(err => {
      console.log('SW registration note:', err);
    });

    // 3. Check for SW updates when switching tabs or focusing window
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().catch(() => {});
        });
      }
    });

    // 4. Reload once when a new service worker takes control (instant deployment upgrade)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}