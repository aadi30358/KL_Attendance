import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initSecurityShield } from './utils/securityShield'
import { initConsolePortfolio } from './services/consolePortfolio'

// Initialize Anti-Tamper Protocol and Zero-Knowledge Storage before rendering
initSecurityShield();
initConsolePortfolio();

// Global defensive handlers to prevent network aborts or extension conflicts from breaking the UI
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError' || event.reason?.message?.includes?.('aborted')) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
  });
}

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
    }).catch(() => {});

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