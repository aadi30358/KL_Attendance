import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_CONFIG } from '../config';
import { publishCrossDomainEvent } from './crossDomainSync';

const SYNC_CHANNEL = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('kl_portal_sync')
    : null;

// Initial university student login data seed to ensure admin always sees active metrics
// Helpers for formatting login date and time
export function formatLoginTime(isoString) {
    if (!isoString) return '—';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return String(isoString);
        return d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return String(isoString);
    }
}

export function formatLoginDate(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return '';
    }
}

export function getTimeOfDay(isoString) {
    if (!isoString) return { label: 'Day', icon: '☀️', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    try {
        const hour = new Date(isoString).getHours();
        if (hour >= 5 && hour < 12) return { label: 'Morning', icon: '🌅', color: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (hour >= 12 && hour < 17) return { label: 'Afternoon', icon: '☀️', color: 'bg-orange-50 text-orange-700 border-orange-200' };
        if (hour >= 17 && hour < 21) return { label: 'Evening', icon: '🌆', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
        return { label: 'Night', icon: '🌙', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    } catch {
        return { label: 'Day', icon: '☀️', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
}

export const SEED_STUDENT_LOGINS = [];
export const SEED_LOGIN_COUNTS = {};

export async function recordStudentLogin(studentId, customTimestamp = null) {
    if (!studentId) return;

    // Never record if currently in admin panel or performing admin actions
    if (typeof window !== 'undefined') {
        const path = (window.location?.pathname || '').toLowerCase();
        const hash = (window.location?.hash || '').toLowerCase();
        if (path.startsWith('/admin') || path.includes('/admin') || hash.includes('/admin')) {
            return;
        }
    }

    const cleanId = String(studentId).trim().toUpperCase();
    // Valid student ID validation (6 to 16 alphanumeric characters, e.g. 2400030358, 2500030329)
    if (!/^[0-9A-Z]{6,16}$/i.test(cleanId)) return;

    const validCustomDate = (customTimestamp && typeof customTimestamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(customTimestamp.trim()) && !isNaN(new Date(customTimestamp.trim()).getTime()))
        ? new Date(customTimestamp.trim())
        : null;

    const now = validCustomDate || new Date();
    const timestamp = now.toISOString();
    let dateKey = timestamp.slice(0, 10);
    try {
        dateKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } catch {
        // fallback to ISO UTC
    }
    const monthKey = dateKey.slice(0, 7);
    const yearKey = dateKey.slice(0, 4);
    const loginId = `log_${now.getTime()}_${cleanId}`;

    // Detect device summary
    const ua = navigator.userAgent;
    let device = 'Desktop Web';
    if (/android/i.test(ua)) device = 'Android Mobile';
    else if (/iphone|ipad|ipod/i.test(ua)) device = 'Apple iOS';
    else if (/windows/i.test(ua)) device = 'Windows PC';
    else if (/macintosh|mac os x/i.test(ua)) device = 'macOS';

    const loginRecord = {
        id: loginId,
        studentId: cleanId,
        timestamp,
        date: dateKey,
        month: monthKey,
        year: yearKey,
        device,
        userAgent: ua
    };

    // 2. Broadcast in real-time to open admin tabs and across domains (instant < 1s update)
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kl_new_login', { detail: loginRecord }));
        }
        if (SYNC_CHANNEL) {
            SYNC_CHANNEL.postMessage({ type: 'LOGIN_EVENT', data: loginRecord });
        }
        publishCrossDomainEvent('LOGIN_EVENT', loginRecord);
    } catch {
        // ignore
    }

    // 3. Post to cloud backend with keepalive
    try {
        const apiBase = APP_CONFIG.API_URL || '';
        if (apiBase) {
            fetch(`${apiBase}/api/logins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginRecord),
                keepalive: true
            }).catch(() => {});
        }
    } catch {
        // ignore
    }

    // 4. Save to Firestore (individual log in userLogins, profile counters in students & users, analytics)
    try {
        await Promise.allSettled([
            setDoc(doc(db, 'userLogins', loginId), loginRecord),
            setDoc(doc(db, 'students', cleanId), {
                studentId: cleanId,
                lastLoginAt: timestamp,
                loginCount: increment(1),
                lastDevice: device
            }, { merge: true }),
            setDoc(doc(db, 'users', cleanId), {
                studentId: cleanId,
                lastLoginAt: timestamp,
                loginCount: increment(1),
                date: dateKey,
                month: monthKey,
                year: yearKey,
                device,
                lastDevice: device
            }, { merge: true }),
            setDoc(doc(db, 'analytics', 'logins'), {
                totalLogins: increment(1),
                [`daily.${dateKey}`]: increment(1),
                [`monthly.${monthKey}`]: increment(1),
                [`yearly.${yearKey}`]: increment(1),
                lastLoginAt: timestamp
            }, { merge: true })
        ]);
        console.log(`[LoginTracker] Login recorded for ${cleanId} (Session: ${loginId})`);
    } catch (err) {
        console.warn('Firestore login record notice:', err);
    }

    return loginRecord;
}
