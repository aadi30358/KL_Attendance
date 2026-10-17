import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeCrossDomainSync } from './crossDomainSync';

/**
 * Real-time hook for ERP Maintenance state across Firestore, cross-domain BroadcastChannel,
 * and localStorage (< 500ms sync across all devices & domains).
 */
export function useMaintenance() {
    const [maintenanceConfig, setMaintenanceConfig] = useState(() => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('kl_erp_maintenance') : null;
            return raw ? JSON.parse(raw) : { enabled: false };
        } catch {
            return { enabled: false };
        }
    });

    useEffect(() => {
        let unsubFirestore = null;
        try {
            unsubFirestore = onSnapshot(doc(db, 'config', 'maintenance'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMaintenanceConfig(data);
                    try {
                        localStorage.setItem('kl_erp_maintenance', JSON.stringify(data));
                    } catch {
                        // ignore quota
                    }
                } else {
                    setMaintenanceConfig({ enabled: false });
                    try {
                        localStorage.removeItem('kl_erp_maintenance');
                    } catch {
                        // ignore quota
                    }
                }
            }, (err) => console.warn('[useMaintenance] Sync notice:', err));
        } catch (e) {
            console.warn('[useMaintenance] Listener notice:', e);
        }

        const unsubCross = subscribeCrossDomainSync((event) => {
            if (event.type === 'MAINTENANCE_UPDATE' && event.data) {
                setMaintenanceConfig(event.data);
            }
        });

        const handleStorage = (e) => {
            if (e.key === 'kl_erp_maintenance') {
                try {
                    setMaintenanceConfig(e.newValue ? JSON.parse(e.newValue) : { enabled: false });
                } catch {
                    // ignore parse error
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (unsubFirestore) unsubFirestore();
            if (unsubCross) unsubCross();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const isMaintenance = Boolean(maintenanceConfig?.enabled);

    return {
        isMaintenance,
        maintenanceConfig
    };
}
