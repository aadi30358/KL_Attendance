/* global __APP_BUILD_TIME__ */
import { useEffect } from 'react';
import { subscribeDeploymentUpdates } from './crossDomainSync';

// Embedded build timestamp defined by Vite at build time
const CURRENT_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();

export function useDeploymentSync() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

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
            if (remoteVersion > current) {
                const reloadKey = `kl_reloaded_${remoteVersion}`;
                if (sessionStorage.getItem(reloadKey)) return;
                sessionStorage.setItem(reloadKey, 'true');

                console.log(`[DeploymentSync] Newer deployment detected (${remoteVersion} > ${current}). Refreshing application...`);

                // Purge all stale cache storages
                if ('caches' in window) {
                    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
                        window.location.reload();
                    });
                } else {
                    window.location.reload();
                }
            }
        };

        // 1. Initial check
        checkVersionJson();

        // 2. Poll every 12 seconds
        const intervalId = setInterval(checkVersionJson, 12000);

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
