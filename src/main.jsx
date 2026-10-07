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
      // Check for latest service worker on startup
      reg.update().catch(() => {});
    }).catch(err => {
      console.log('SW registration note:', err);
    });

    // Check for SW updates when switching tabs or focusing window
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().catch(() => {});
        });
      }
    });

    // Only reload on controllerchange if the page was ALREADY controlled by an older SW
    // (Prevents initial load double-reloads)
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}