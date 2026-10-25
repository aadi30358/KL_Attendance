/* global __APP_BUILD_TIME__ */
import { useEffect } from 'react';
import { subscribeDeploymentUpdates } from './crossDomainSync';

// Embedded build timestamp defined by Vite at build time
const CURRENT_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();

export function useDeploymentSync() {
    useEffect(() => {
        if (typeof window === 'undefined' || import.meta.env.DEV) return;

        let isChecking = false;

        const checkVersionJson = async () => {
            if (isChecking) return;
            isChecking = true;
            try {
                const res = await fetch(`/version.json?_t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.version) {
                        handleIncomingVersion(Number(data.version));
                    }
                }
            } catch {
                // Ignore network glitch
            } finally {
                isChecking = false;
            }
        };

        const handleIncomingVersion = (remoteVersion) => {
            if (!remoteVersion || isNaN(remoteVersion)) return;
            const current = Number(CURRENT_BUILD_TIME);
            // Require remoteVersion to be strictly newer by at least 1500ms to avoid build-jitter reloads
            if (remoteVersion > current + 1500) {
                const lastSynced = sessionStorage.getItem('kl_last_synced_version');
                if (lastSynced === String(remoteVersion)) return;
                sessionStorage.setItem('kl_last_synced_version', String(remoteVersion));
                try {
                    Object.keys(sessionStorage).forEach(k => {
                        if (k.startsWith('kl_reloaded_')) sessionStorage.removeItem(k);
                    });
                } catch {
                    // ignore
                }
                // Purge all stale cache storages once
                if ('caches' in window) {
                    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
                        window.location.reload();
                    });
                } else {
                    window.location.reload();
                }
            }
        };

        // 1. Initial check on mount
        checkVersionJson();

        // 2. Fallback poll every 5 minutes (Firestore real-time listener handles sub-second instant push)
        const intervalId = setInterval(checkVersionJson, 5 * 60 * 1000);

        // 3. Check immediately when tab becomes visible or focused
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersionJson();
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then(reg => {
                        if (reg) reg.update();
                    });
                }
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', checkVersionJson);

        // 4. Instant push from Firestore deployment document (< 1 second)
        const unsubDeployment = subscribeDeploymentUpdates((data) => {
            if (data && data.version) {
                handleIncomingVersion(Number(data.version));
            }
        });

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', checkVersionJson);
            unsubDeployment();
        };
    }, []);
}
