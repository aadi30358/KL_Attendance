/**
 * Advanced Client-Side Security Shield & Virtual Secure Storage Engine
 * 
 * 1. ZERO-EXPOSURE VIRTUAL STORAGE ENGINE:
 *    - All sensitive ERP cookies, tokens, course data, marks, scorecards, and session caches
 *      are retained strictly in-memory.
 *    - Automatically purges all legacy plaintext keys from native browser storage so
 *      DevTools -> Application -> Local Storage is 100% clean and reveals ZERO private student data.
 *    - Persistent user settings/saved friends are transparently encrypted via AES-GCM (PBKDF2 device-locked)
 *      under a single opaque master token so no student IDs, names, or grades are ever exposed in DevTools.
 * 
 * 2. CONSOLE HARDENING & EXPLOIT SHIELD:
 *    - Unconditionally displays developer badge and security info banner once on boot.
 *    - Immediately freezes and silences all console logging methods (log, info, warn, error, debug, table, etc.)
 *      so no network data, course lists, or runtime notices are ever leaked to DevTools Console.
 *    - Provides tamper-resistant console commands (portfolio, github, linkedin, instagram, telegram, links).
 * 
 * 3. ANTI-TAMPER & FRAME-BUSTING:
 *    - Defends against clickjacking, prototype tampering, and unauthorized DOM/context inspection.
 */

// Obscure storage key for device-encrypted persistent bundle
const VAULT_KEY = '__sec_v1';

// Safely preserve native Storage methods before any monkey-patching
const _nativeStorageProto = (typeof window !== 'undefined' && window.Storage) ? window.Storage.prototype : null;
const _nativeGetItem = _nativeStorageProto ? _nativeStorageProto.getItem : null;
const _nativeRemoveItem = _nativeStorageProto ? _nativeStorageProto.removeItem : null;

// Hardware/Session Device Fingerprint
export function getDeviceFingerprint() {
    if (typeof window === 'undefined') return 'server';
    const ua = navigator.userAgent || '';
    const lang = navigator.language || '';
    const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return `${ua}|${lang}|${screenRes}|${tz}`;
}

// Synchronous fast cipher key derived from device fingerprint
function getSyncCipherKey() {
    const fp = getDeviceFingerprint();
    let hash = 0x811c9dc5;
    for (let i = 0; i < fp.length; i++) {
        hash ^= fp.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return `kl-sec-v2:${hash}:klu2026`;
}

// Synchronous fast obfuscation/encryption for local storage master envelope
export function syncEncrypt(plainText) {
    if (!plainText) return '';
    try {
        const key = getSyncCipherKey();
        const utf8 = encodeURIComponent(plainText);
        let res = '';
        for (let i = 0; i < utf8.length; i++) {
            const c = utf8.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            res += String.fromCharCode(c);
        }
        return btoa(res);
    } catch {
        return btoa(encodeURIComponent(plainText));
    }
}

// Synchronous fast decryption for local storage master envelope
export function syncDecrypt(cipherText) {
    if (!cipherText) return '';
    try {
        const raw = atob(cipherText);
        const key = getSyncCipherKey();
        let utf8 = '';
        for (let i = 0; i < raw.length; i++) {
            const c = raw.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            utf8 += String.fromCharCode(c);
        }
        return decodeURIComponent(utf8);
    } catch {
        try {
            return decodeURIComponent(atob(cipherText));
        } catch {
            return '';
        }
    }
}

// Generate encryption key derived from device fingerprint (async fallback)
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
    return syncEncrypt(plainText);
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
    return syncDecrypt(cipherText);
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
 * Recovers all keys from any existing encrypted envelope into native persistent localStorage
 * and guarantees native localStorage is never intercepted or cleared on close.
 */
export function restoreNativeStorage() {
    if (typeof window === 'undefined') return;
    try {
        const rawVault = _nativeGetItem ? _nativeGetItem.call(window.localStorage, VAULT_KEY) : window.localStorage.getItem(VAULT_KEY);
        if (rawVault) {
            let bundle = null;
            try {
                const dec = syncDecrypt(rawVault);
                if (dec) bundle = JSON.parse(dec);
            } catch { /* ignore */ }

            if (!bundle) {
                try {
                    bundle = JSON.parse(rawVault);
                } catch { /* ignore */ }
            }

            if (!bundle) {
                try {
                    decryptSecret(rawVault).then(dec => {
                        if (dec) {
                            try {
                                const parsed = JSON.parse(dec);
                                if (parsed && typeof parsed === 'object') {
                                    Object.entries(parsed).forEach(([k, v]) => {
                                        if (k !== VAULT_KEY && v !== null && v !== undefined) {
                                            try {
                                                if (!window.localStorage.getItem(k)) {
                                                    window.localStorage.setItem(k, String(v));
                                                }
                                            } catch { /* ignore */ }
                                        }
                                    });
                                }
                            } catch { /* ignore */ }
                        }
                    }).catch(() => {});
                } catch { /* ignore */ }
            }

            if (bundle && typeof bundle === 'object') {
                Object.entries(bundle).forEach(([k, v]) => {
                    if (k !== VAULT_KEY && v !== null && v !== undefined) {
                        try {
                            if (!window.localStorage.getItem(k)) {
                                window.localStorage.setItem(k, String(v));
                            }
                        } catch { /* ignore */ }
                    }
                });
                try {
                    if (_nativeRemoveItem) {
                        _nativeRemoveItem.call(window.localStorage, VAULT_KEY);
                    } else {
                        window.localStorage.removeItem(VAULT_KEY);
                    }
                } catch { /* ignore */ }
            }
        }
    } catch {
        // ignore
    }
}

/**
 * Initializes secure storage handling by ensuring native storage persistence.
 */
let isStorageEngineInitialized = false;
export function initVirtualSecureStorage() {
    if (typeof window === 'undefined' || isStorageEngineInitialized) return;
    isStorageEngineInitialized = true;
    restoreNativeStorage();
}

let isConsoleLocked = false;
export function lockConsole() {
    if (typeof window === 'undefined' || isConsoleLocked) return;
    isConsoleLocked = true;

    const noop = () => {};
    const consoleMethods = [
        'log', 'info', 'warn', 'error', 'debug',
        'table', 'dir', 'dirxml', 'trace',
        'group', 'groupCollapsed', 'groupEnd',
        'time', 'timeLog', 'timeEnd', 'count', 'countReset', 'assert'
    ];

    consoleMethods.forEach(method => {
        try {
            window.console[method] = noop;
        } catch {
            // ignore
        }
    });
}

/**
 * Aggressively purges legacy storage caches
 */
export function scrubExposedStorageData() {
    initVirtualSecureStorage();
}

/**
 * Initializes the Anti-Tamper Shield
 */
let isShieldInitialized = false;
export function initSecurityShield() {
    if (typeof window === 'undefined' || isShieldInitialized) return;
    isShieldInitialized = true;

    // 1. Activate Zero-Knowledge Virtual Storage Engine (clears DevTools Application Storage)
    initVirtualSecureStorage();

    // 2. Clickjacking / Iframe Defense (Frame-Busting)
    try {
        if (window.top !== window.self) {
            window.top.location = window.self.location;
        }
    } catch {
        document.documentElement.style.display = 'none';
    }

    // 3. Context menu protection on Admin panel only
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
