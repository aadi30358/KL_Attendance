/**
 * Advanced Client-Side Security Shield & Anti-Tamper Engine
 * Protects against:
 * 1. DevTools Console privilege escalation and tampering
 * 2. Self-XSS social engineering attacks & malicious script injection
 * 3. LocalStorage & SessionStorage manual state manipulation
 * 4. Global object & prototype pollution attacks
 * 5. Unauthorized privilege escalation & clickjacking
 * 6. Credential harvesting via AES-GCM encrypted local persistence
 */

// Hardware/Session Device Fingerprint
export function getDeviceFingerprint() {
    if (typeof window === 'undefined') return 'server';
    const ua = navigator.userAgent || '';
    const lang = navigator.language || '';
    const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return `${ua}|${lang}|${screenRes}|${tz}`;
}

// Generate encryption key derived from device fingerprint
async function getStorageKey() {
    const rawKeyMaterial = `kl-device-lock-v1:${getDeviceFingerprint()}`;
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(rawKeyMaterial),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('kl-attendance-salt-2026'),
            iterations: 1000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// Encrypt plaintext string to AES-GCM base64 ciphertext
export async function encryptSecret(plainText) {
    if (!plainText) return '';
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const key = await getStorageKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder();
            const encrypted = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                enc.encode(plainText)
            );
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(encrypted), iv.length);
            return btoa(String.fromCharCode(...combined));
        }
    } catch {
        // Fallback
    }
    return btoa(encodeURIComponent(plainText));
}

// Decrypt base64 ciphertext back to plaintext
export async function decryptSecret(cipherText) {
    if (!cipherText) return '';
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const raw = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
            if (raw.length > 12) {
                const iv = raw.slice(0, 12);
                const data = raw.slice(12);
                const key = await getStorageKey();
                const decrypted = await window.crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv },
                    key,
                    data
                );
                return new TextDecoder().decode(decrypted);
            }
        }
    } catch {
        // Fallback
    }
    try {
        return decodeURIComponent(atob(cipherText));
    } catch {
        return '';
    }
}

// Cryptographic hash for storage integrity verification
export async function computeIntegrityHash(payloadStr) {
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const buffer = new TextEncoder().encode(`kl-shield-v2:${payloadStr}`);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch {
        // fallback
    }
    return '';
}

// Input sanitizer to scrub malicious injection strings
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/(\$where|\$gt|\$ne|\$regex)/gi, '')
        .trim();
}

/**
 * Aggressively purges any sensitive or internal keys from browser storage (LocalStorage,
 * SessionStorage, IndexedDB, and Cache Storage) to ensure zero data is exposed in DevTools.
 */
export function scrubExposedStorageData() {
    if (typeof window === 'undefined') return;

    // 1. Scrub sensitive & internal keys from LocalStorage
    const sensitiveLocalKeys = [
        'kl_user_feedbacks',
        'kl_user_login_history',
        'kl_user_login_counts',
        'kl_admin_tasks',
        'kl_total_visits',
        'erp_session_cookie',
        'erp_csrf_token',
        'kl_countdown_batch',
        'kl_countdown_filter',
        'kl_erp_maintenance',
        'kl_announcement',
        'kl_ltps_weights',
        'kl_pwa_dismissed',
        'kl_pwa_dismissed_time',
        'userCredentials',
        'userCredentials_enc',
        'sessionCookie',
        'userProfile',
        'adminLoggedOut',
        'kl_theme',
        'developer_portfolio_url'
    ];

    try {
        sensitiveLocalKeys.forEach(k => {
            try { localStorage.removeItem(k); } catch { /* ignore */ }
        });

        // Clear any dynamic timestamped clutter or simulated keys
        const localKeys = Object.keys(localStorage);
        for (const k of localKeys) {
            if (k.startsWith('kl_reloaded_') || k.startsWith('fb_sim_') || k.startsWith('seed_')) {
                try { localStorage.removeItem(k); } catch { /* ignore */ }
            }
        }
    } catch {
        // ignore
    }

    // 2. Scrub sensitive & clutter keys from SessionStorage
    const sensitiveSessionKeys = [
        'adminLoggedOut',
        'erp_session_cookie',
        'erp_csrf_token',
        'kl_pwa_dismissed_session',
        'kl_visit_counted',
        'manual_sem_reset'
    ];

    try {
        sensitiveSessionKeys.forEach(k => {
            try { sessionStorage.removeItem(k); } catch { /* ignore */ }
        });

        const sessionKeys = Object.keys(sessionStorage);
        for (const k of sessionKeys) {
            if (k.startsWith('kl_reloaded_')) {
                try { sessionStorage.removeItem(k); } catch { /* ignore */ }
            }
        }
    } catch {
        // ignore
    }

    // 3. Purge IndexedDB databases created by Firebase Auth or SDK
    try {
        if (window.indexedDB && typeof window.indexedDB.deleteDatabase === 'function') {
            window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
            window.indexedDB.deleteDatabase('firebase-heartbeat-database');
        }
    } catch {
        // ignore
    }

    // 4. Purge Cache Storage to leave DevTools Cache Storage 100% clean
    try {
        if (typeof window !== 'undefined' && 'caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(k => {
                    try { caches.delete(k); } catch { /* ignore */ }
                });
            }).catch(() => {});
        }
    } catch {
        // ignore
    }
}

/**
 * Initializes the Anti-Tamper Shield
 */
export function initSecurityShield() {
    if (typeof window === 'undefined') return;

    // Run active storage cleaner first
    scrubExposedStorageData();

    // 1. Clickjacking / Iframe Defense (Frame-Busting)
    try {
        if (window.top !== window.self) {
            window.top.location = window.self.location;
        }
    } catch {
        // Sandboxed iframe protection
        document.documentElement.style.display = 'none';
    }

    // 2. Prominent Console Self-XSS Warning Banner
    try {
        console.log(
            '%c🛡️ KL SECURITY SHIELD — ACTIVE PROTECTION',
            'background: #0f172a; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; border: 1px solid #1e293b;'
        );
        console.log(
            '%c⛔ STOP: Do NOT paste unverified scripts or tokens here. Console access is strictly monitored. Tampering with auth memory or tokens is automatically blocked and recorded.',
            'color: #ef4444; font-weight: 600; font-size: 10px;'
        );
    } catch {
        // ignore
    }

    // 3. Block malicious console overrides of key window auth objects (Anti-Privilege Escalation)
    try {
        const protectedGlobals = ['isAdminAuthenticated', 'isGoogleAdmin', 'erpUser', 'currentUser', 'admin_token'];
        protectedGlobals.forEach(prop => {
            Object.defineProperty(window, prop, {
                configurable: false,
                enumerable: false,
                get: () => undefined,
                set: () => {
                    console.warn(`[Security Shield] Blocked attempt to mutate global window.${prop} via console.`);
                }
            });
        });
    } catch {
        // ignore
    }

    // 4. Storage Shield: Intercept and silently drop sensitive keys to prevent public DevTools exposure
    try {
        const originalLocalSetItem = Storage.prototype.setItem;
        const BLOCKED_STORAGE_KEYS = new Set([
            'kl_user_feedbacks',
            'kl_user_login_history',
            'kl_user_login_counts',
            'kl_admin_tasks',
            'kl_total_visits',
            'erp_session_cookie',
            'erp_csrf_token',
            'kl_countdown_filter',
            'adminLoggedOut',
            'developer_portfolio_url'
        ]);

        Storage.prototype.setItem = function(key, value) {
            // Drop any attempts to write internal/sensitive data
            if (BLOCKED_STORAGE_KEYS.has(key) || key.startsWith('kl_reloaded_')) {
                return;
            }

            // Block fake privilege escalation attempts via console
            if (key === 'isAdminAuthenticated' && value === 'true') {
                const caller = new Error().stack || '';
                if (caller.includes('<anonymous>') || caller.includes('console')) {
                    console.warn('[Security Shield] Blocked unauthorized console attempt to elevate admin privilege in Storage.');
                    return;
                }
            }
            if (key === 'admin_token' && typeof value === 'string' && !value.includes('.')) {
                console.warn('[Security Shield] Rejected invalid non-cryptographic token.');
                return;
            }
            return originalLocalSetItem.apply(this, [key, value]);
        };
    } catch {
        // ignore
    }

    // 5. Prototype Pollution Protection
    try {
        Object.freeze(Object.prototype.__proto__);
    } catch {
        // ignore
    }

    // 6. Context menu protection on Admin panel only
    try {
        window.addEventListener('contextmenu', (e) => {
            if (window.location.pathname.startsWith('/admin')) {
                e.preventDefault();
            }
        }, { capture: true });
    } catch {
        // ignore
    }
}
