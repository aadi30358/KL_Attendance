import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SYNC_DOC_REF = doc(db, 'config', 'sync');
const DEPLOYMENT_DOC_REF = doc(db, 'config', 'deployment');

let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
        broadcastChannel = new BroadcastChannel('kl_portal_sync');
    } catch {
        broadcastChannel = null;
    }
}

// Track last handled timestamp to prevent echo loops
const handledTimestamps = new Set();

/**
 * Publish an event that synchronizes instantaneously across all domains
 * (klattendancecalculator.web.app <-> klattendance.online <-> localhost)
 * and all open browser tabs in < 1 second via Firestore real-time engine.
 */
export async function publishCrossDomainEvent(type, data = {}) {
    const timestamp = Date.now();
    const eventPayload = {
        type,
        data,
        timestamp,
        origin: typeof window !== 'undefined' ? window.location.origin : ''
    };

    handledTimestamps.add(timestamp);

    // 1. Instant local window event (0ms)
    if (typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent('kl_cross_sync', { detail: eventPayload }));
        } catch {
            // ignore
        }
    }

    // 2. Same-origin BroadcastChannel (0ms)
    if (broadcastChannel) {
        try {
            broadcastChannel.postMessage(eventPayload);
        } catch {
            // ignore
        }
    }

    // 3. Global Cross-Domain Firestore Engine (< 500ms real-time push to all domains)
    try {
        await setDoc(SYNC_DOC_REF, eventPayload, { merge: true });
    } catch (err) {
        console.warn('[CrossDomainSync] Publish notice:', err);
    }

    return eventPayload;
}

/**
 * Convenience helper to broadcast attendance changes instantly across tabs and devices.
 */
export async function broadcastAttendanceUpdate(attendancePayload) {
    return publishCrossDomainEvent('ATTENDANCE_UPDATED', attendancePayload);
}

/**
 * Subscribe to cross-domain real-time synchronization events.
 * Triggers callback whenever any user or admin updates anything on ANY domain.
 */
export function subscribeCrossDomainSync(callback) {
    if (typeof window === 'undefined' || typeof callback !== 'function') {
        return () => {};
    }

    const handleEvent = (event) => {
        if (!event || !event.timestamp) return;
        if (handledTimestamps.has(event.timestamp)) return;
        handledTimestamps.add(event.timestamp);

        // Keep set bounded
        if (handledTimestamps.size > 200) {
            const arr = Array.from(handledTimestamps);
            arr.slice(0, 100).forEach(t => handledTimestamps.delete(t));
        }

        try {
            callback(event);
        } catch (err) {
            console.warn('[CrossDomainSync] Handler notice:', err);
        }
    };

    // 1. In-window custom event listener
    const onWindowSync = (e) => {
        if (e.detail) handleEvent(e.detail);
    };
    window.addEventListener('kl_cross_sync', onWindowSync);

    // 2. BroadcastChannel message listener
    const onBcMessage = (e) => {
        if (e.data) handleEvent(e.data);
    };
    if (broadcastChannel) {
        broadcastChannel.addEventListener('message', onBcMessage);
    }

    // 3. Real-time Firestore onSnapshot (Cross-domain bridge)
    let unsubFirestore = null;
    try {
        unsubFirestore = onSnapshot(SYNC_DOC_REF, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                handleEvent(data);
            }
        }, (err) => {
            console.warn('[CrossDomainSync] Firestore listener notice:', err);
        });
    } catch {
        // ignore
    }

    return () => {
        window.removeEventListener('kl_cross_sync', onWindowSync);
        if (broadcastChannel) {
            broadcastChannel.removeEventListener('message', onBcMessage);
        }
        if (unsubFirestore) {
            unsubFirestore();
        }
    };
}

/**
 * Real-time listener for deployment updates across both domains.
 * Fires when a new build is deployed so active tabs upgrade seamlessly without lag.
 */
export function subscribeDeploymentUpdates(onNewDeployment) {
    if (typeof window === 'undefined' || typeof onNewDeployment !== 'function') {
        return () => {};
    }

    let unsub = null;
    try {
        unsub = onSnapshot(DEPLOYMENT_DOC_REF, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                onNewDeployment(data);
            }
        }, () => {});
    } catch {
        // ignore
    }

    return () => {
        if (unsub) unsub();
    };
}
