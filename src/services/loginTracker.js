import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_CONFIG } from '../config';

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

// Initial university student login data seed with both morning and afternoon logins for testing
const todayBase = new Date();
const todayDateStr = todayBase.toISOString().slice(0, 10);
const todayMonthStr = todayBase.toISOString().slice(0, 7);
const todayYearStr = todayBase.toISOString().slice(0, 4);

const setHourToday = (hour, minute, second) => {
    const d = new Date();
    d.setHours(hour, minute, second, 0);
    return d.toISOString();
};

export const SEED_STUDENT_LOGINS = [];
export const SEED_LOGIN_COUNTS = {};

export async function recordStudentLogin(studentId) {
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
    // Real KLU student ID validation (8 to 12 digits)
    if (!/^\d{8,12}$/.test(cleanId)) return;

    // Check last login in localStorage to debounce accidental double-clicks within 3 seconds
    try {
        const rawHistory = localStorage.getItem('kl_user_login_history');
        if (rawHistory) {
            const localHistory = JSON.parse(rawHistory);
            if (Array.isArray(localHistory)) {
                const recentLog = localHistory.find(
                    l => l.studentId === cleanId && (Date.now() - new Date(l.timestamp || 0).getTime()) < 3000
                );
                if (recentLog) {
                    // Accidental immediate double-click within 3 seconds, ignore
                    return;
                }
            }
        }
    } catch {
        // continue
    }

    const now = new Date();
    const timestamp = now.toISOString();
    let dateKey = timestamp.slice(0, 10);
    try {
        dateKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } catch {
        // fallback to ISO UTC
    }
    const monthKey = dateKey.slice(0, 7);
    const yearKey = dateKey.slice(0, 4);
    const loginId = `log_${Date.now()}_${cleanId}`;

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

    // 1. Synchronously save to local storage history (only real records)
    try {
        const rawHistory = localStorage.getItem('kl_user_login_history');
        const localHistory = (rawHistory ? JSON.parse(rawHistory) : [])
            .filter(l => l && l.studentId && /^\d{8,12}$/.test(l.studentId) && !l.id?.startsWith('seed_'));
        localHistory.push(loginRecord);
        localStorage.setItem('kl_user_login_history', JSON.stringify(localHistory.slice(-2000)));

        const rawCounts = localStorage.getItem('kl_user_login_counts');
        const userCounts = rawCounts ? JSON.parse(rawCounts) : {};
        userCounts[cleanId] = (userCounts[cleanId] || 0) + 1;
        localStorage.setItem('kl_user_login_counts', JSON.stringify(userCounts));
    } catch {
        // Ignore storage quota
    }

    // 2. Broadcast in real-time to open admin tabs (instant 0ms update)
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kl_new_login', { detail: loginRecord }));
        }
        if (SYNC_CHANNEL) {
            SYNC_CHANNEL.postMessage({ type: 'LOGIN_EVENT', data: loginRecord });
        }
    } catch {
        // ignore
    }

    // 3. Post to cloud backend asynchronously
    try {
        const apiBase = APP_CONFIG.API_URL || '';
        if (apiBase) {
            fetch(`${apiBase}/api/logins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginRecord)
            }).catch(() => {});
        }
    } catch {
        // ignore
    }

    // 4. Save individual login log to Firestore if enabled
    setDoc(doc(db, 'userLogins', loginId), loginRecord).catch(() => {});

    // 5. Increment student's cumulative profile in Firestore
    setDoc(doc(db, 'students', cleanId), {
        studentId: cleanId,
        lastLoginAt: timestamp,
        loginCount: increment(1)
    }, { merge: true }).catch(() => {});

    // 6. Update aggregated stats (Today, Month, Year) in Firestore
    setDoc(doc(db, 'analytics', 'logins'), {
        totalLogins: increment(1),
        [`daily.${dateKey}`]: increment(1),
        [`monthly.${monthKey}`]: increment(1),
        [`yearly.${yearKey}`]: increment(1),
        lastLoginAt: timestamp
    }, { merge: true }).catch(() => {});
}
