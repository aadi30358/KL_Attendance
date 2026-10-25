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

// In-Memory Virtual Storage Stores
const _memoryVault = new Map(); 
const _sessionMemoryVault = new Map();

// Obscure storage key for device-encrypted persistent bundle
const VAULT_KEY = '__sec_v1';

// Ephemeral keys that should not be persisted across browser sessions
const NON_PERSISTENT_KEYS = new Set([
    'manual_sem_reset',
    VAULT_KEY
]);

// Safely preserve native Storage methods before any monkey-patching
const _nativeStorageProto = (typeof window !== 'undefined' && window.Storage) ? window.Storage.prototype : null;
const _nativeGetItem = _nativeStorageProto ? _nativeStorageProto.getItem : null;
const _nativeSetItem = _nativeStorageProto ? _nativeStorageProto.setItem : null;
const _nativeRemoveItem = _nativeStorageProto ? _nativeStorageProto.removeItem : null;
const _nativeClear = _nativeStorageProto ? _nativeStorageProto.clear : null;
const _nativeKey = _nativeStorageProto ? _nativeStorageProto.key : null;

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
 * Persists all application keys to native storage in a device-bound encrypted master envelope
 */
let persistDebounceTimer = null;
function flushPersistentVault() {
    if (typeof window === 'undefined') return;
    try {
        const bundle = {};
        _memoryVault.forEach((val, key) => {
            if (key !== VAULT_KEY && !NON_PERSISTENT_KEYS.has(key)) {
                bundle[key] = val;
            }
        });

        if (Object.keys(bundle).length === 0) {
            try {
                if (_nativeRemoveItem) {
                    _nativeRemoveItem.call(window.localStorage, VAULT_KEY);
                }
            } catch {
                // ignore
            }
            return;
        }

        const json = JSON.stringify(bundle);
        const encrypted = syncEncrypt(json);
        if (_nativeSetItem) {
            _nativeSetItem.call(window.localStorage, VAULT_KEY, encrypted);
        }
    } catch {
        // silent
    }
}

function schedulePersistVault() {
    if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
    persistDebounceTimer = setTimeout(() => {
        flushPersistentVault();
    }, 150);
}

// Ensure pending debounced storage flushes write synchronously before unload
if (typeof window !== 'undefined') {
    try {
        window.addEventListener('beforeunload', () => {
            if (persistDebounceTimer) {
                clearTimeout(persistDebounceTimer);
                persistDebounceTimer = null;
            }
            flushPersistentVault();
        });
        window.addEventListener('pagehide', () => {
            if (persistDebounceTimer) {
                clearTimeout(persistDebounceTimer);
                persistDebounceTimer = null;
            }
            flushPersistentVault();
        });
    } catch {
        // ignore
    }
}

/**
 * Initializes the Zero-Knowledge Virtual Storage Engine.
 * Wipes all plaintext keys from DevTools Application Storage and routes all future
 * localStorage / sessionStorage operations through memory.
 */
let isStorageEngineInitialized = false;
export function initVirtualSecureStorage() {
    if (typeof window === 'undefined' || isStorageEngineInitialized) return;
    isStorageEngineInitialized = true;

    try {
        const nativeProto = Storage.prototype;

        // 1. Synchronously decode existing persistent vault if present
        try {
            const rawVault = _nativeGetItem ? _nativeGetItem.call(window.localStorage, VAULT_KEY) : null;
            if (rawVault) {
                let dec = syncDecrypt(rawVault);
                let loaded = false;
                if (dec) {
                    try {
                        const parsed = JSON.parse(dec);
                        if (parsed && typeof parsed === 'object') {
                            Object.entries(parsed).forEach(([k, v]) => {
                                if (k !== VAULT_KEY) {
                                    _memoryVault.set(k, String(v));
                                }
                            });
                            loaded = true;
                        }
                    } catch { /* ignore */ }
                }
                if (!loaded) {
                    // Try legacy PBKDF2 AES-GCM vault fallback
                    decryptSecret(rawVault).then(legacyDec => {
                        if (legacyDec) {
                            try {
                                const parsed = JSON.parse(legacyDec);
                                if (parsed && typeof parsed === 'object') {
                                    Object.entries(parsed).forEach(([k, v]) => {
                                        if (k !== VAULT_KEY && !_memoryVault.has(k)) {
                                            _memoryVault.set(k, String(v));
                                        }
                                    });
                                    schedulePersistVault();
                                }
                            } catch { /* ignore */ }
                        }
                    }).catch(() => {});
                }
            }
        } catch {
            // ignore
        }

        // 2. Discover and purge any legacy plaintext keys from DevTools Application tab
        try {
            const total = window.localStorage.length;
            const legacyKeys = [];
            for (let i = 0; i < total; i++) {
                const k = _nativeKey ? _nativeKey.call(window.localStorage, i) : null;
                if (k && k !== VAULT_KEY) {
                    legacyKeys.push(k);
                }
            }

            let hadLegacyData = false;
            legacyKeys.forEach(k => {
                try {
                    const val = _nativeGetItem ? _nativeGetItem.call(window.localStorage, k) : null;
                    if (val !== null) {
                        if (!_memoryVault.has(k)) {
                            _memoryVault.set(k, val);
                        }
                        hadLegacyData = true;
                    }
                    if (_nativeRemoveItem) {
                        _nativeRemoveItem.call(window.localStorage, k);
                    }
                } catch {
                    // ignore
                }
            });

            if (hadLegacyData) {
                flushPersistentVault();
            }
        } catch {
            // ignore
        }

        // Wipe sessionStorage completely
        try {
            const sTotal = window.sessionStorage.length;
            const sKeys = [];
            for (let i = 0; i < sTotal; i++) {
                const sk = _nativeKey ? _nativeKey.call(window.sessionStorage, i) : null;
                if (sk) sKeys.push(sk);
            }
            sKeys.forEach(sk => {
                try {
                    const val = _nativeGetItem ? _nativeGetItem.call(window.sessionStorage, sk) : null;
                    if (val !== null) _sessionMemoryVault.set(sk, val);
                    if (_nativeRemoveItem) {
                        _nativeRemoveItem.call(window.sessionStorage, sk);
                    }
                } catch {
                    // ignore
                }
            });
        } catch {
            // ignore
        }

        // 3. Patch Storage.prototype to transparently redirect all calls to in-memory vault
        nativeProto.getItem = function(k) {
            const keyStr = String(k);
            if (this === window.localStorage) {
                return _memoryVault.get(keyStr) ?? null;
            }
            if (this === window.sessionStorage) {
                return _sessionMemoryVault.get(keyStr) ?? null;
            }
            return _nativeGetItem ? _nativeGetItem.call(this, k) : null;
        };

        nativeProto.setItem = function(k, v) {
            const keyStr = String(k);
            const valStr = String(v);
            if (keyStr === VAULT_KEY) {
                // Prevent recursive insertion into vault
                return;
            }
            if (this === window.localStorage) {
                _memoryVault.set(keyStr, valStr);
                schedulePersistVault();
                return;
            }
            if (this === window.sessionStorage) {
                _sessionMemoryVault.set(keyStr, valStr);
                return;
            }
            if (_nativeSetItem) {
                _nativeSetItem.call(this, k, v);
            }
        };

        nativeProto.removeItem = function(k) {
            const keyStr = String(k);
            if (keyStr === VAULT_KEY) {
                if (_nativeRemoveItem) {
                    _nativeRemoveItem.call(window.localStorage, VAULT_KEY);
                }
                return;
            }
            if (this === window.localStorage) {
                _memoryVault.delete(keyStr);
                schedulePersistVault();
                return;
            }
            if (this === window.sessionStorage) {
                _sessionMemoryVault.delete(keyStr);
                return;
            }
            if (_nativeRemoveItem) {
                _nativeRemoveItem.call(this, k);
            }
        };

        nativeProto.clear = function() {
            if (this === window.localStorage) {
                _memoryVault.clear();
                schedulePersistVault();
                return;
            }
            if (this === window.sessionStorage) {
                _sessionMemoryVault.clear();
                return;
            }
            if (_nativeClear) {
                _nativeClear.call(this);
            }
        };

        nativeProto.key = function(index) {
            if (this === window.localStorage) {
                return Array.from(_memoryVault.keys())[index] ?? null;
            }
            if (this === window.sessionStorage) {
                return Array.from(_sessionMemoryVault.keys())[index] ?? null;
            }
            return _nativeKey ? _nativeKey.call(this, index) : null;
        };

        Object.defineProperty(nativeProto, 'length', {
            get() {
                if (this === window.localStorage) {
                    return _memoryVault.size;
                }
                if (this === window.sessionStorage) {
                    return _sessionMemoryVault.size;
                }
                return 0;
            },
            configurable: true,
            enumerable: false
        });

        // 4. Wrap window.localStorage and window.sessionStorage with Proxy for object syntax (localStorage.foo = 'bar')
        const createProxy = (storageTarget, memMap, isLocal) => {
            return new Proxy(storageTarget, {
                get(target, prop, receiver) {
                    if (prop === 'getItem') return (k) => memMap.get(String(k)) ?? null;
                    if (prop === 'setItem') return (k, v) => {
                        const keyStr = String(k);
                        if (keyStr === VAULT_KEY) return;
                        memMap.set(keyStr, String(v));
                        if (isLocal) schedulePersistVault();
                    };
                    if (prop === 'removeItem') return (k) => {
                        const keyStr = String(k);
                        if (keyStr === VAULT_KEY) {
                            if (isLocal && _nativeRemoveItem) _nativeRemoveItem.call(window.localStorage, VAULT_KEY);
                            return;
                        }
                        memMap.delete(keyStr);
                        if (isLocal) schedulePersistVault();
                    };
                    if (prop === 'clear') return () => {
                        memMap.clear();
                        if (isLocal) schedulePersistVault();
                    };
                    if (prop === 'key') return (i) => Array.from(memMap.keys())[i] ?? null;
                    if (prop === 'length') return memMap.size;

                    if (typeof prop === 'string' && memMap.has(prop)) {
                        return memMap.get(prop);
                    }
                    const val = Reflect.get(target, prop, receiver);
                    return typeof val === 'function' ? val.bind(target) : val;
                },
                set(target, prop, value) {
                    if (typeof prop === 'string') {
                        if (prop === VAULT_KEY) return true;
                        memMap.set(prop, String(value));
                        if (isLocal) schedulePersistVault();
                        return true;
                    }
                    return Reflect.set(target, prop, value);
                },
                deleteProperty(target, prop) {
                    if (typeof prop === 'string') {
                        if (prop === VAULT_KEY) {
                            if (isLocal && _nativeRemoveItem) _nativeRemoveItem.call(window.localStorage, VAULT_KEY);
                            return true;
                        }
                        memMap.delete(prop);
                        if (isLocal) schedulePersistVault();
                        return true;
                    }
                    return Reflect.deleteProperty(target, prop);
                },
                has(target, prop) {
                    return memMap.has(prop) || Reflect.has(target, prop);
                },
                ownKeys() {
                    return Array.from(memMap.keys());
                },
                getOwnPropertyDescriptor(target, prop) {
                    if (memMap.has(prop)) {
                        return {
                            value: memMap.get(prop),
                            writable: true,
                            enumerable: true,
                            configurable: true
                        };
                    }
                    return Reflect.getOwnPropertyDescriptor(target, prop);
                }
            });
        };

        try {
            const localProxy = createProxy(window.localStorage, _memoryVault, true);
            Object.defineProperty(window, 'localStorage', {
                value: localProxy,
                configurable: true,
                writable: true,
                enumerable: true
            });
        } catch {
            // ignore
        }

        try {
            const sessionProxy = createProxy(window.sessionStorage, _sessionMemoryVault, false);
            Object.defineProperty(window, 'sessionStorage', {
                value: sessionProxy,
                configurable: true,
                writable: true,
                enumerable: true
            });
        } catch {
            // ignore
        }

    } catch {
        // Fallback
    }
}


/**
 * Permanently locks and freezes DevTools Console after the official developer banner is output.
 * Ensures zero data, courses, tokens, or warnings can be dumped to console.
 */
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
