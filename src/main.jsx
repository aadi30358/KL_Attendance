import React from 'react'
import ReactDOM from 'react-dom/client'
import { SpeedInsights } from "@vercel/speed-insights/react"
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <SpeedInsights />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('SW registered:', reg);

        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New content available; automatically refreshing...');
                // Force a page reload to aggressively un-brick and get new assets
                window.location.reload();
              } else {
                console.log('Content cached for offline use.');
              }
            }
          };
        };
      })
      .catch(err => console.error('SW registration failed:', err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
