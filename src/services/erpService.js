import { SEMESTER_MAP, getCandidateYearIdsForYear } from '../config/api';
import { APP_CONFIG } from '../config';

const FALLBACK_ERP_BASE = 'https://kl-attendance-api.yaswanthadithyareddy10.workers.dev';

export const getErpBase = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return '';
        }
    }
    if (APP_CONFIG.API_URL && !APP_CONFIG.API_URL.includes('localhost') && APP_CONFIG.API_URL.startsWith('https://')) {
        return APP_CONFIG.API_URL;
    }
    return FALLBACK_ERP_BASE;
};

let inMemoryErpUser = '';
let inMemoryErpCookies = '';
let inMemoryCsrfToken = '';
let inMemoryCaptchaCookies = '';

export const hasActiveErpSession = (studentId = null) => {
    if (typeof window === 'undefined') return false;
    const cleanId = (studentId || '').trim();
    if (cleanId) {
        // Must be verified in the current browser session
        const sessionVerified = sessionStorage.getItem(`erp_verified_${cleanId}`) === 'true';
        if (!sessionVerified) return false;

        // And have active session cookie
        const cookie = localStorage.getItem(`erp_cookie_${cleanId}`);
        if (cookie && cookie.trim().length > 0) return true;
        if (inMemoryErpCookies && inMemoryErpUser === cleanId) return true;

        const rememberedId = localStorage.getItem('rememberedId');
        if (cleanId === rememberedId) {
            const myCookie = localStorage.getItem(`erp_cookie_${rememberedId}`) || localStorage.getItem('erp_cookie_main');
            if (myCookie && myCookie.trim().length > 0) return true;
            if (inMemoryErpCookies && (!inMemoryErpUser || inMemoryErpUser === rememberedId)) return true;
        }

        return false;
    }

    // No studentId passed: check active user
    const activeUser = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId');
    if (activeUser) {
        return hasActiveErpSession(activeUser);
    }
    return false;
};

export const isAttendanceLoggedIn = (studentId = null) => {
    if (typeof window === 'undefined') return false;
    const cleanId = (studentId || localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || '').trim();
    if (!cleanId) return false;

    // 1. Current active verified ERP session
    if (hasActiveErpSession(cleanId)) return true;

    // 2. Verified ERP authentication in session
    const isSessionVerified = sessionStorage.getItem(`erp_verified_${cleanId}`) === 'true' || 
                              sessionStorage.getItem('erp_authenticated') === 'true';

    // 3. Has real ERP attendance courses stored from an actual verified attendance query
    const userKleData = localStorage.getItem(`kleData_${cleanId}`) || 
                        (cleanId === localStorage.getItem('rememberedId') ? localStorage.getItem('kleData') : null);
    
    if (userKleData) {
        try {
            const parsed = JSON.parse(userKleData);
            const list = parsed?.attendance_data || parsed?.data || (Array.isArray(parsed) ? parsed : []);
            if (Array.isArray(list) && list.length > 0) {
                const activeUser = localStorage.getItem('activeErpUser');
                if (activeUser === cleanId || isSessionVerified || localStorage.getItem(`erp_cookie_${cleanId}`)) {
                    return true;
                }
            }
        } catch {
            // ignore
        }
    }

    if (isSessionVerified) return true;

    return false;
};

export const getStoredErpCookies = (studentId = null) => {
    if (typeof window === 'undefined') return inMemoryErpCookies || '';
    const cleanId = (studentId || '').trim();
    if (cleanId) {
        const friendCookie = localStorage.getItem(`erp_cookie_${cleanId}`);
        if (friendCookie) return friendCookie;
        if (inMemoryErpCookies && inMemoryErpUser === cleanId) return inMemoryErpCookies;
        const rememberedId = localStorage.getItem('rememberedId');
        if (cleanId === rememberedId) {
            const mainCookie = localStorage.getItem('erp_cookie_main');
            if (mainCookie) return mainCookie;
        }
        // Strict student isolation: Never return another student's cookies
        return '';
    }
    const activeUser = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId');
    if (activeUser) {
        const userCookie = localStorage.getItem(`erp_cookie_${activeUser}`);
        if (userCookie) return userCookie;
        if (inMemoryErpCookies && inMemoryErpUser === activeUser) return inMemoryErpCookies;
    }
    return '';
};

export const setStoredErpCookies = (val, studentId = null) => {
    inMemoryErpCookies = val || '';
    const cleanId = (studentId || '').trim();
    inMemoryErpUser = cleanId; // empty string when initializing pre-login captcha session
    if (typeof window !== 'undefined' && cleanId && val) {
        try {
            localStorage.setItem(`erp_cookie_${cleanId}`, val);
            const rememberedId = localStorage.getItem('rememberedId');
            if (cleanId === rememberedId) {
                localStorage.setItem('erp_cookie_main', val);
            }
        } catch { /* ignore */ }
    }
};

export const getStoredCsrfToken = () => {
    return inMemoryCsrfToken || '';
};

export const setStoredCsrfToken = (val) => {
    inMemoryCsrfToken = val || '';
};

/**
 * Validates that an ERP response HTML is genuine, authenticated student portal content.
 * Prevents recording logins if ERP rejected credentials, returned login-form, or encountered an error.
 */
export function isVerifiedErpDashboard(html, username = '') {
    if (!html || typeof html !== 'string') return false;

    // 1. If it contains the ERP login form or login input fields, it is NEVER an authenticated session
    if (
        html.includes('id="login-form"') || 
        html.includes('id="loginFormID"') || 
        html.includes('loginFormUserNameID') || 
        html.includes('loginFormPasswordID') ||
        html.includes('loginFormCaptcha-image') ||
        html.includes('name="LoginForm') ||
        html.includes('LoginForm[')
    ) {
        return false;
    }

    // 2. If it contains explicit login error / failure messages
    if (
        html.includes('The above error occurred while the Web server was processing your request') ||
        html.includes('Incorrect username or password') ||
        html.includes('The verification code is incorrect') ||
        html.includes('Enter Username') ||
        html.includes('Enter Password')
    ) {
        return false;
    }

    // 3. Positive verification: Must contain proof of an active ERP student session
    const hasLogout = html.includes('logout') || html.includes('site%2Flogout') || html.includes('site/logout');
    const hasStudentModule = html.includes('student') || html.includes('indexindi') || html.includes('attendance') || html.includes('academicyear') || html.includes('courselist');
    const cleanUser = username ? String(username).trim() : '';
    const hasUsername = cleanUser ? html.toLowerCase().includes(cleanUser.toLowerCase()) : false;

    if (cleanUser && hasUsername) {
        return Boolean(hasLogout || hasStudentModule);
    }

    return Boolean(hasLogout || hasStudentModule);
}

const IGNORED_COOKIE_ATTRS = new Set(['path', 'expires', 'max-age', 'domain', 'samesite', 'secure', 'httponly', 'partitioned']);

export const saveErpCookiesFromResponse = (response, { forceAuthUpdate = true, studentId = null } = {}) => {
    try {
        if (!response) return;
        const newCookies = response.headers?.get?.('x-set-erp-cookie') || response.headers?.get?.('set-cookie');
        if (newCookies) {
            const existing = getStoredErpCookies(studentId);
            const cookieMap = new Map();
            if (existing && !forceAuthUpdate) {
                existing.split(';').forEach(pair => {
                    const [k, ...v] = pair.split('=');
                    if (k && k.trim() && !IGNORED_COOKIE_ATTRS.has(k.trim().toLowerCase())) {
                        cookieMap.set(k.trim(), v.join('=').trim());
                    }
                });
            }
            newCookies.split(';').forEach(pair => {
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) {
                    const key = k.trim();
                    if (IGNORED_COOKIE_ATTRS.has(key.toLowerCase())) return;
                    const val = v.join('=').trim();
                    cookieMap.set(key, val);
                }
            });
            const merged = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
            setStoredErpCookies(merged, studentId);
            try { sessionStorage.setItem('kl_captcha_cookies', merged); } catch { /* ignore */ }
        }
    } catch (e) {
        console.warn("[ERP] Failed to persist cookies:", e);
    }
};

export const clearStoredErpCookies = (studentId = null) => {
    const cleanId = (studentId || '').trim();
    if (cleanId) {
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(`erp_cookie_${cleanId}`);
                if (cleanId === localStorage.getItem('rememberedId')) {
                    localStorage.removeItem('erp_cookie_main');
                }
            } catch { /* ignore */ }
        }
        if (inMemoryErpUser === cleanId) {
            inMemoryErpCookies = '';
            inMemoryErpUser = '';
        }
    } else {
        inMemoryErpCookies = '';
        inMemoryErpUser = '';
        inMemoryCsrfToken = '';
    }
};

export const buildErpHeaders = (extraHeaders = {}, studentId = null) => {
    const headers = { ...extraHeaders };
    if (!headers['x-erp-cookie']) {
        const cookie = getStoredErpCookies(studentId);
        if (cookie) {
            headers['x-erp-cookie'] = cookie;
        }
    }
    return headers;
};

// High-Speed Pre-Warmed Captcha Cache & Concurrency Lock
let prewarmedCaptcha = null; // { csrfToken, captchaUrl, cookies, timestamp }
let prewarmPromise = null;

export const prewarmCaptcha = async (force = false) => {
    if (typeof window === 'undefined') return null;

    const now = Date.now();
    // Cache is valid for 3 minutes (180,000ms)
    if (!force && prewarmedCaptcha && (now - prewarmedCaptcha.timestamp < 180000)) {
        return prewarmedCaptcha;
    }

    if (prewarmPromise) {
        return prewarmPromise;
    }

    const apiBase = getErpBase();

    prewarmPromise = (async () => {
        try {
            const timeoutSignal = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined;
            let resp = await fetch(`${apiBase || ''}/api/session-init`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                signal: timeoutSignal
            }).catch(() => null);

            if (!resp || !resp.ok) {
                if (apiBase !== FALLBACK_ERP_BASE && typeof window !== 'undefined') {
                    resp = await fetch(`${FALLBACK_ERP_BASE}/api/session-init`, {
                        cache: 'no-store',
                        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined
                    }).catch(() => null);
                }
            }

            if (resp && resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.success && data.csrfToken && data.captchaUrl) {
                    prewarmedCaptcha = {
                        csrfToken: data.csrfToken,
                        captchaUrl: data.captchaUrl,
                        dataUrl: data.captchaUrl,
                        cookies: data.cookies || '',
                        timestamp: Date.now()
                    };
                    return prewarmedCaptcha;
                }
            }
        } catch (e) {
            console.warn('[ERP] Background captcha pre-warm notice:', e?.message || e);
        } finally {
            prewarmPromise = null;
        }
        return null;
    })();

    return prewarmPromise;
};

export const erpService = {
    prewarmCaptcha,
    getErpBase,
    getStoredErpCookies,
    saveErpCookiesFromResponse,
    clearStoredErpCookies,

    // Fetch the login page to scrape CSRF token and initial captcha atomically
    // Fetch the login page to scrape CSRF token and initial captcha atomically
    async getInitialState() {
        const now = Date.now();

        // 1. Instant 0ms return if pre-warmed captcha is ready
        if (prewarmedCaptcha && (now - prewarmedCaptcha.timestamp < 180000)) {
            const consumed = prewarmedCaptcha;
            prewarmedCaptcha = null; // Consume atomically

            inMemoryCaptchaCookies = consumed.cookies;
            if (consumed.csrfToken) {
                setStoredCsrfToken(consumed.csrfToken);
            }

            // Immediately start pre-warming the NEXT captcha in background for zero lag on refresh
            setTimeout(() => { prewarmCaptcha(true).catch(() => {}); }, 400);

            return {
                csrfToken: consumed.csrfToken,
                captchaUrl: consumed.captchaUrl,
                dataUrl: consumed.captchaUrl,
                cookies: consumed.cookies,
                blob: null
            };
        }

        // 2. If a pre-warm request is currently in-flight, await it directly without redundant network fetch
        if (prewarmPromise) {
            try {
                const result = await prewarmPromise;
                if (result && (Date.now() - result.timestamp < 180000)) {
                    prewarmedCaptcha = null; // Consume
                    inMemoryCaptchaCookies = result.cookies;
                    if (result.csrfToken) {
                        setStoredCsrfToken(result.csrfToken);
                    }
                    setTimeout(() => { prewarmCaptcha(true).catch(() => {}); }, 400);
                    return {
                        csrfToken: result.csrfToken,
                        captchaUrl: result.captchaUrl,
                        dataUrl: result.captchaUrl,
                        cookies: result.cookies,
                        blob: null
                    };
                }
            } catch {
                // proceed to standard fetch
            }
        }

        const apiBase = getErpBase();
        inMemoryCaptchaCookies = '';
        inMemoryCsrfToken = '';

        // 3. Fast single-trip session initialization via /api/session-init
        try {
            const resp = await fetch(`${apiBase || ''}/api/session-init`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined
            });
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.success && data.csrfToken) {
                    if (data.cookies) {
                        inMemoryCaptchaCookies = data.cookies;
                        try { sessionStorage.setItem('kl_captcha_cookies', data.cookies); } catch { /* ignore */ }
                    }
                    if (data.csrfToken) {
                        setStoredCsrfToken(data.csrfToken);
                    }
                    setTimeout(() => { prewarmCaptcha(true).catch(() => {}); }, 400);
                    return {
                        csrfToken: data.csrfToken,
                        captchaUrl: data.captchaUrl,
                        dataUrl: data.captchaUrl,
                        cookies: data.cookies,
                        blob: null
                    };
                }
            }
        } catch (e) {
            console.warn("[ERP] /api/session-init error, attempting fallback:", e);
        }

        // 2. Production fallback via Cloudflare edge if relative was not available
        if (apiBase !== FALLBACK_ERP_BASE && typeof window !== 'undefined' && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) {
            try {
                const resp = await fetch(`${FALLBACK_ERP_BASE}/api/session-init`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data && data.success && data.csrfToken) {
                        if (data.cookies) {
                            inMemoryCaptchaCookies = data.cookies;
                        }
                        if (data.csrfToken) {
                            setStoredCsrfToken(data.csrfToken);
                        }
                        return {
                            csrfToken: data.csrfToken,
                            captchaUrl: data.captchaUrl,
                            dataUrl: data.captchaUrl,
                            cookies: data.cookies,
                            blob: null
                        };
                    }
                }
            } catch (e) {
                console.warn("[ERP] Edge /api/session-init fallback error:", e);
            }
        }

        // 3. Direct scraping flow via /index.php
        const timestamp = new Date().getTime();
        let response = await fetch(`${apiBase || ''}/index.php?_t=${timestamp}`, { 
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            }
        });

        let html = await response.text();
        const sc = response.headers?.get?.('x-set-erp-cookie') || response.headers?.get?.('set-cookie');
        if (sc) inMemoryCaptchaCookies = sc;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          doc.querySelector('input[name="_csrf"]')?.getAttribute('value');
        if (csrfToken) {
            setStoredCsrfToken(csrfToken);
        }

        const captchaImg = doc.querySelector('#loginFormCaptcha-image')?.getAttribute('src');
        let captchaBlob = null;
        if (captchaImg) {
            try {
                const imgUrl = `${apiBase || ''}${captchaImg.startsWith('/') ? '' : '/'}${captchaImg.replace(/&amp;/g, '&')}`;
                const imgResp = await fetch(imgUrl, {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: inMemoryCaptchaCookies ? { 'x-erp-cookie': inMemoryCaptchaCookies } : {}
                });
                if (imgResp.ok) {
                    const imgSc = imgResp.headers?.get?.('x-set-erp-cookie') || imgResp.headers?.get?.('set-cookie');
                    if (imgSc) inMemoryCaptchaCookies = imgSc;
                    captchaBlob = await imgResp.blob();
                }
            } catch (e) {
                console.warn("[ERP] Could not fetch initial captcha image:", e);
            }
        }

        const initialCaptchaUrl = captchaBlob ? URL.createObjectURL(captchaBlob) : null;
        return {
            csrfToken,
            captchaBlob,
            blob: captchaBlob,
            captchaUrl: initialCaptchaUrl,
            dataUrl: initialCaptchaUrl
        };
    },

    // Refresh captcha directly via ERP endpoint
    async refreshCaptcha(_studentId = null) {
        void _studentId;
        const now = Date.now();

        // 1. Instant 0ms return if pre-warmed captcha is ready
        if (prewarmedCaptcha && (now - prewarmedCaptcha.timestamp < 180000)) {
            const consumed = prewarmedCaptcha;
            prewarmedCaptcha = null; // Consume atomically

            inMemoryCaptchaCookies = consumed.cookies;
            if (consumed.csrfToken) {
                setStoredCsrfToken(consumed.csrfToken);
            }

            // Immediately start pre-warming the NEXT captcha in background
            setTimeout(() => { prewarmCaptcha(true).catch(() => {}); }, 400);

            return {
                captchaUrl: consumed.captchaUrl,
                dataUrl: consumed.captchaUrl,
                csrfToken: consumed.csrfToken,
                cookies: consumed.cookies,
                blob: null
            };
        }

        // 2. If a pre-warm request is currently in-flight, await it directly
        if (prewarmPromise) {
            try {
                const result = await prewarmPromise;
                if (result && (Date.now() - result.timestamp < 180000)) {
                    prewarmedCaptcha = null; // Consume
                    inMemoryCaptchaCookies = result.cookies;
                    if (result.csrfToken) {
                        setStoredCsrfToken(result.csrfToken);
                    }
                    setTimeout(() => { prewarmCaptcha(true).catch(() => {}); }, 400);
                    return {
                        captchaUrl: result.captchaUrl,
                        dataUrl: result.captchaUrl,
                        csrfToken: result.csrfToken,
                        cookies: result.cookies,
                        blob: null
                    };
                }
            } catch {
                // proceed to standard refresh
            }
        }

        const apiBase = getErpBase();
        const reqHeaders = { 'Cache-Control': 'no-cache' };
        if (inMemoryCaptchaCookies) {
            reqHeaders['x-erp-cookie'] = inMemoryCaptchaCookies;
        }

        // 1. Fast captcha refresh via /api/refresh-captcha
        try {
            const resp = await fetch(`${apiBase || ''}/api/refresh-captcha`, {
                headers: reqHeaders
            });
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.success && data.captchaUrl) {
                    if (data.cookies) {
                        inMemoryCaptchaCookies = data.cookies;
                        try { sessionStorage.setItem('kl_captcha_cookies', data.cookies); } catch { /* ignore */ }
                    }
                    if (data.csrfToken) {
                        setStoredCsrfToken(data.csrfToken);
                    }
                    return { captchaUrl: data.captchaUrl, dataUrl: data.captchaUrl, csrfToken: data.csrfToken, cookies: data.cookies, blob: null };
                }
            }
        } catch (e) {
            console.warn("[ERP] /api/refresh-captcha error, attempting fallback:", e);
        }

        // Fallback to Cloudflare edge if relative failed in production
        if (apiBase !== FALLBACK_ERP_BASE && typeof window !== 'undefined' && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) {
            try {
                const resp = await fetch(`${FALLBACK_ERP_BASE}/api/refresh-captcha`, {
                    headers: reqHeaders
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data && data.success && data.captchaUrl) {
                        if (data.cookies) {
                            inMemoryCaptchaCookies = data.cookies;
                        }
                        if (data.csrfToken) {
                            setStoredCsrfToken(data.csrfToken);
                        }
                        return { captchaUrl: data.captchaUrl, dataUrl: data.captchaUrl, csrfToken: data.csrfToken, blob: null };
                    }
                }
            } catch (e) {
                console.warn("[ERP] Edge /api/refresh-captcha fallback error:", e);
            }
        }

        // 2. Direct fallback via /index.php?r=site%2Fcaptcha
        try {
            const refreshResp = await fetch(`${apiBase || ''}/index.php?r=site%2Fcaptcha&refresh=1`, {
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    ...(inMemoryCaptchaCookies ? { 'x-erp-cookie': inMemoryCaptchaCookies } : {})
                }
            });
            const sc = refreshResp.headers?.get?.('x-set-erp-cookie') || refreshResp.headers?.get?.('set-cookie');
            if (sc) inMemoryCaptchaCookies = sc;

            const refreshData = await refreshResp.json().catch(() => null);
            let imgUrl = refreshData?.url || `/index.php?r=site%2Fcaptcha&v=${Math.random()}`;
            if (!imgUrl.startsWith('http') && apiBase) {
                imgUrl = `${apiBase}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
            }

            const imgResp = await fetch(imgUrl, {
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    ...(inMemoryCaptchaCookies ? { 'x-erp-cookie': inMemoryCaptchaCookies } : {})
                }
            });
            const imgSc = imgResp.headers?.get?.('x-set-erp-cookie') || imgResp.headers?.get?.('set-cookie');
            if (imgSc) inMemoryCaptchaCookies = imgSc;
            const blob = await imgResp.blob();
            const objectUrl = URL.createObjectURL(blob);
            return {
                blob,
                captchaBlob: blob,
                url: imgUrl,
                captchaUrl: objectUrl,
                dataUrl: objectUrl,
                csrfToken: inMemoryCsrfToken || '',
                cookies: inMemoryCaptchaCookies || ''
            };
        } catch (e) {
            console.error('[ERP] refreshCaptcha error:', e);
            throw e;
        }
    },

    // Login function
    async login(username, password, captcha, csrfToken, boundCookies = null) {
        const apiBase = getErpBase();

        let token = csrfToken || getStoredCsrfToken();
        if (!token) {
            const initRes = await this.getInitialState();
            token = initRes?.csrfToken;
        }

        const cleanUsername = username.trim();
        const activeCaptchaCookie = boundCookies || inMemoryCaptchaCookies || (typeof window !== 'undefined' ? sessionStorage.getItem('kl_captcha_cookies') : '') || inMemoryErpCookies;

        // 1. Try high-performance /api/fast-login endpoint first
        try {
            const resp = await fetch(`${apiBase || ''}/api/fast-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'x-csrf-token': token } : {}),
                    ...(activeCaptchaCookie ? { 'x-erp-cookie': activeCaptchaCookie } : {})
                },
                body: JSON.stringify({
                    username: cleanUsername,
                    password,
                    captcha: captcha.trim(),
                    csrfToken: token
                }),
                signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(25000) : undefined
            });

            const data = await resp.json().catch(() => null);

            if (data) {
                if (data.cookies) {
                    inMemoryCaptchaCookies = data.cookies;
                }
                if (data.csrfToken) {
                    setStoredCsrfToken(data.csrfToken);
                }
                if (data.success) {
                    if (isVerifiedErpDashboard(data.html, cleanUsername)) {
                        setStoredErpCookies(data.cookies, cleanUsername);
                        try {
                            sessionStorage.setItem(`erp_verified_${cleanUsername}`, 'true');
                        } catch { /* ignore */ }
                        inMemoryCaptchaCookies = '';
                        return { success: true, verified: true, html: data.html || '' };
                    } else {
                        throw new Error(data.error || "Incorrect Student ID, Password, or Captcha.");
                    }
                }
                if (data.error) {
                    throw new Error(data.error);
                }
                throw new Error("Incorrect Student ID, Password, or Captcha.");
            }
        } catch (fastErr) {
            const errMsg = String(fastErr?.message || '');
            const lowerErr = errMsg.toLowerCase();
            // If the error came from the ERP response (incorrect credentials, captcha, validation error, etc.), throw it directly to the user
            if (
                lowerErr.includes('incorrect') || 
                lowerErr.includes('verification') || 
                lowerErr.includes('captcha') || 
                lowerErr.includes('password') || 
                lowerErr.includes('username') ||
                lowerErr.includes('unable to verify') ||
                lowerErr.includes('rejected') ||
                lowerErr.includes('expired')
            ) {
                throw fastErr;
            }
            // For any timeout, abort, or network issue with /api/fast-login, silently fall back to direct ERP login
            console.warn('[ERP] fast-login network bypass, proceeding to direct ERP login:', errMsg);
        }

        // 2. Direct POST to /index.php?r=site%2Flogin fallback
        const formData = new URLSearchParams();
        if (token) formData.append('_csrf', token);
        formData.append('LoginForm[username]', cleanUsername);
        formData.append('LoginForm[password]', password);
        formData.append('LoginForm[rememberMe]', '0');
        formData.append('LoginForm[captcha]', captcha.trim());
        formData.append('LoginForm[qr_code]', '');
        formData.append('login-button', '');

        const headers = buildErpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            ...(token ? { 'x-csrf-token': token } : {}),
            ...(activeCaptchaCookie ? { 'x-erp-cookie': activeCaptchaCookie } : {})
        }, cleanUsername);

        let url = `${apiBase || ''}/index.php?r=site%2Flogin`;
        let response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData.toString(),
            credentials: 'include',
            cache: 'no-store',
            signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(25000) : undefined
        });

        let html = await response.text();

        // HTTP error check
        if (!response.ok || response.status >= 400) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const alertDanger = doc.querySelector('.alert-danger, .callout-danger, .site-error');
            const alertText = alertDanger?.textContent?.trim();
            if (alertText && !alertText.includes('The above error occurred') && !alertText.includes('Forbidden')) {
                throw new Error(alertText);
            }
            if (response.status === 403 || response.status === 400) {
                throw new Error("Incorrect Captcha, Student ID, or Password. Please try again.");
            }
            throw new Error("Unable to log in to ERP. Please refresh the captcha and try again.");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Check for specific field error blocks
        const pwdError = doc.querySelector('.field-loginFormPasswordID .help-block, .field-loginform-password .help-block, .field-loginFormUserNameID .help-block');
        if (pwdError && pwdError.textContent.trim()) {
            throw new Error(pwdError.textContent.trim());
        }

        const captchaError = doc.querySelector('.field-loginFormCaptcha .help-block, .field-loginform-captcha .help-block');
        if (captchaError && captchaError.textContent.trim()) {
            throw new Error(captchaError.textContent.trim() || "The verification code is incorrect.");
        }

        const generalError = doc.querySelector('.text-danger:not(span)');
        if (generalError && generalError.textContent.trim() && generalError.textContent.trim() !== '*') {
            throw new Error(generalError.textContent.trim());
        }

        const errorBlocks = doc.querySelectorAll('.help-block, .help-block-error');
        for (const el of errorBlocks) {
            const txt = el.textContent.trim();
            if (txt && !txt.includes('*') && txt !== 'Enter Username' && txt !== 'Enter Password') {
                if (txt.toLowerCase().includes('verification code') || txt.toLowerCase().includes('captcha')) {
                    throw new Error("The verification code is incorrect.");
                }
                if (txt.toLowerCase().includes('incorrect username') || txt.toLowerCase().includes('password')) {
                    throw new Error(txt);
                }
            }
        }

        // Success detection: strictly require confirmed authenticated ERP session
        if (isVerifiedErpDashboard(html, cleanUsername)) {
            saveErpCookiesFromResponse(response, { forceAuthUpdate: true, studentId: cleanUsername });
            try {
                sessionStorage.setItem(`erp_verified_${cleanUsername}`, 'true');
            } catch { /* ignore */ }
            const newCsrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                            doc.querySelector('input[name="_csrf"]')?.getAttribute('value');
            if (newCsrf) {
                setStoredCsrfToken(newCsrf);
            }
            return { success: true, verified: true, html };
        } else {
            const alertDanger = doc.querySelector('.alert-danger, .callout-danger, .site-error, .help-block-error');
            const alertText = alertDanger?.textContent?.trim();
            throw new Error(alertText || "Incorrect Student ID, Password, or Captcha.");
        }
    },

    // Destroy ERP session cookie
    async erpLogout() {
        try {
            clearStoredErpCookies();
            const apiBase = getErpBase();
            const csrfToken = this.getCachedCsrfToken();
            if (csrfToken) {
                const formData = new URLSearchParams();
                formData.append('_csrf', csrfToken);

                const headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                };
                if (apiBase) {
                    const cookie = getStoredErpCookies();
                    if (cookie) headers['x-erp-cookie'] = cookie;
                }

                await fetch(`${apiBase}/index.php?r=site%2Flogout`, {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });
            }
        } catch {
            // silent
        }
    },

    // Helper to get CSRF token from cached dashboard HTML
    getCachedCsrfToken() {
        try {
            const token = getStoredCsrfToken();
            if (token) return token;

            const dashboardHtml = localStorage.getItem('erpDashboardHtml');
            if (dashboardHtml) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                return doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                       doc.querySelector('input[name="_csrf"]')?.getAttribute('value') || null;
            }
        } catch {
            return null;
        }
        return null;
    },

    // Parse Student Data from Dashboard HTML
    parseStudentData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let name = "Student";
        let image = "/assets/default-user.png";

        const nameEl = doc.querySelector('.profile_info h2') || doc.querySelector('.user-profile');
        if (nameEl) name = nameEl.textContent.trim();

        const imgEl = doc.querySelector('.profile_pic img') || doc.querySelector('img.img-circle');
        if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src) image = src;
        }

        return { name, image };
    },

    // Parse the search form HTML to extract available academic years, semesters, and active selections
    parseSearchInputHtml(html) {
        if (!html) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          doc.querySelector('input[name="_csrf"]')?.getAttribute('value') ||
                          this.getCachedCsrfToken();

        const years = [];
        let selectedYear = null;
        const yearSelect = doc.querySelector('select[name*="academicyear"], select#dynamicmodel-academicyear, select#academicyear');
        if (yearSelect) {
            yearSelect.querySelectorAll('option').forEach(opt => {
                const val = (opt.getAttribute('value') || opt.value || '').trim();
                const text = opt.textContent.trim();
                if (val && val !== '') {
                    const isSelected = opt.hasAttribute('selected') || opt.selected;
                    years.push({ value: val, text, isSelected });
                    if (isSelected) {
                        selectedYear = { value: val, text };
                    }
                }
            });
        }

        const semesters = [];
        let selectedSemester = null;
        const semSelect = doc.querySelector('select[name*="semesterid"], select#dynamicmodel-semesterid, select#semesterid');
        if (semSelect) {
            semSelect.querySelectorAll('option').forEach(opt => {
                const val = (opt.getAttribute('value') || opt.value || '').trim();
                const text = opt.textContent.trim();
                if (val && val !== '') {
                    const isSelected = opt.hasAttribute('selected') || opt.selected;
                    semesters.push({ value: val, text, isSelected });
                    if (isSelected) {
                        selectedSemester = { value: val, text };
                    }
                }
            });
        }

        return { csrfToken, years, semesters, selectedYear, selectedSemester, rawHtml: html };
    },

    // Prime the Yii2 controller session and fetch real options
    async getAvailableSessions(studentId = null) {
        try {
            const cleanSid = (studentId || '').trim();
            if (cleanSid) {
                const cookie = getStoredErpCookies(cleanSid);
                if (!cookie) {
                    return null; // Strict isolation: Do not query without student's session cookie
                }
            }

            const apiBase = getErpBase();
            const headers = buildErpHeaders({
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'X-Requested-With': 'XMLHttpRequest'
            }, studentId);

            let resp = await fetch(`${apiBase || ''}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers
            });

            let html = resp.ok ? await resp.text() : '';
            if (!resp.ok || resp.status === 404 || html.includes('<div id="root">') || html.includes('/vite.svg') || html.includes('/timetable-logo.svg')) {
                const target = apiBase || FALLBACK_ERP_BASE;
                resp = await fetch(`${target}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: buildErpHeaders(headers, studentId)
                });
                if (resp.ok) html = await resp.text();
            }

            if (!resp.ok) return null;
            if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                return null;
            }

            saveErpCookiesFromResponse(resp, { studentId });
            return this.parseSearchInputHtml(html);
        } catch (e) {
            console.warn("[ERP] Failed to retrieve dynamic session options:", e);
            return null;
        }
    },

    // Lightweight session keep-alive ping to prevent university ERP timeout
    async keepSessionAlive() {
        try {
            const activeUser = typeof window !== 'undefined' ? (localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId')) : null;
            if (!activeUser) return { success: false, sessionActive: false, reason: 'No active user' };
            const cookie = getStoredErpCookies(activeUser);
            if (!cookie) return { success: false, sessionActive: false, reason: 'No session cookie' };

            const apiBase = getErpBase();
            const headers = buildErpHeaders({
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'X-Requested-With': 'XMLHttpRequest'
            }, activeUser);

            let resp = await fetch(`${apiBase || ''}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers
            });

            if (!resp.ok && apiBase !== FALLBACK_ERP_BASE) {
                resp = await fetch(`${FALLBACK_ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: buildErpHeaders(headers, activeUser)
                });
            }

            if (!resp.ok) {
                return { success: false, sessionActive: false, status: resp?.status };
            }

            const html = await resp.text();
            if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                return { success: false, sessionActive: false, reason: 'Session expired' };
            }

            saveErpCookiesFromResponse(resp, { studentId: activeUser });
            return { success: true, sessionActive: true };
        } catch (e) {
            console.warn("[ERP] Session keep-alive ping notice:", e.message);
            return { success: false, sessionActive: true, networkError: true };
        }
    },

    // Fetch Subjects and Attendance with automatic session priming and candidate fallbacks
    async fetchAttendance(year, semester, studentId = null) {
        const apiBase = getErpBase();
        const csrfToken = this.getCachedCsrfToken();
        const targetStudent = studentId || (typeof window !== 'undefined' ? (localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId')) : null);
        if (!targetStudent) return [];

        // STRICT GUARD: Must have authentic session cookie for this specific student!
        const targetCookie = getStoredErpCookies(targetStudent);
        if (!targetCookie) {
            console.warn(`[ERP] Refusing to fetch attendance for ${targetStudent}: No active session cookie found. Prevents cross-student data contamination.`);
            return [];
        }

        // 1. Prime the controller session and discover dynamic options
        let sessionInfo = null;
        try {
            sessionInfo = await this.getAvailableSessions(targetStudent);
        } catch {
            // silent fallback
        }

        const effectiveCsrfToken = sessionInfo?.csrfToken || csrfToken;

        // 3. Resolve matching year ID
        let matchedYearVal = null;
        const reqYearStr = String(year || '').trim();
        const cleanReqStr = reqYearStr.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        const legacyToYear = { '18': '2026', '17': '2025', '16': '2024', '15': '2023', '14': '2022', '13': '2021', '10': '2020' };
        const targetYearStart = legacyToYear[reqYearStr] || 
            (cleanReqStr.includes('-') ? cleanReqStr.split('-')[0].trim() : (cleanReqStr.match(/\b(20\d\d)\b/)?.[1] || ''));

        if (sessionInfo?.years && sessionInfo.years.length > 0) {
            // Direct ERP DB value match first (e.g. '29')
            const valMatch = sessionInfo.years.find(y => y.value === reqYearStr);
            if (valMatch && parseInt(reqYearStr, 10) > 20) {
                matchedYearVal = valMatch.value;
            }

            // Text match with clean string (normalize whitespace around hyphens)
            if (!matchedYearVal && cleanReqStr) {
                const normReq = cleanReqStr.replace(/\s+/g, '');
                const textMatch = sessionInfo.years.find(y => {
                    const yClean = y.text.toLowerCase().trim().replace(/\s+/g, '');
                    return yClean === normReq || yClean.includes(normReq) || normReq.includes(yClean);
                });
                if (textMatch) matchedYearVal = textMatch.value;
            }

            // Target start year match (e.g. '2026')
            if (!matchedYearVal && targetYearStart) {
                const startMatch = sessionInfo.years.find(y => {
                    const clean = (y.text || '').toLowerCase().trim();
                    return clean.startsWith(targetYearStart) || clean.includes(targetYearStart + '-');
                });
                if (startMatch) matchedYearVal = startMatch.value;
            }

            // Direct value fallback
            if (!matchedYearVal && valMatch) {
                matchedYearVal = valMatch.value;
            }

            // If still unresolved and no year was provided, use ERP's selected or first option
            if (!matchedYearVal && !reqYearStr) {
                matchedYearVal = sessionInfo.selectedYear?.value || sessionInfo.years[0]?.value;
            }
        }

        // 4. Resolve semester ID
        let semId = SEMESTER_MAP[semester] || '1';
        const reqSemStr = String(semester || '').trim().toLowerCase();
        const isReqSummer = reqSemStr.includes('summer') || reqSemStr === '3';
        const isReqTerm3 = (reqSemStr.includes('term') || reqSemStr.includes('tri') || reqSemStr === '4') && !isReqSummer;

        if (sessionInfo?.semesters && sessionInfo.semesters.length > 0) {
            const semMatch = sessionInfo.semesters.find(s => {
                const sText = (s.text || '').toLowerCase();
                const sVal = String(s.value || '').trim();

                if (isReqSummer) {
                    return sVal === '3' || sText.includes('summer');
                }
                if (isReqTerm3) {
                    return (sVal === '4' || sText.includes('tri') || sText.includes('term 3') || sText.includes('term-3') || (sText.includes('term') && !sText.includes('summer'))) && !sText.includes('summer') && sVal !== '3';
                }
                if (reqSemStr.includes('even') || reqSemStr === '2') {
                    return sVal === '2' || sText.includes('even');
                }
                if (reqSemStr.includes('odd') || reqSemStr === '1') {
                    return sVal === '1' || sText.includes('odd');
                }
                return sText === reqSemStr || sText.includes(reqSemStr);
            });
            if (semMatch) semId = semMatch.value;
        }

        // 5. Candidate IDs to try (combine matched value and all historical candidate aliases for requested year)
        const fallbackCandidates = getCandidateYearIdsForYear(year, null, null);
        const candidateYearIds = Array.from(new Set([
            matchedYearVal,
            ...fallbackCandidates
        ].filter(Boolean)));

        let subjects = [];
        let lastHtml = '';
        let lastError = null;

        for (const currentYearId of candidateYearIds) {
            try {
                // 1. Prime searchgetinput with candidate year and sem to update Yii2 controller session context
                try {
                    const primeForm = new URLSearchParams();
                    primeForm.append('DynamicModel[academicyear]', String(currentYearId));
                    primeForm.append('DynamicModel[semesterid]', String(semId));
                    if (effectiveCsrfToken) {
                        primeForm.append('_csrf', effectiveCsrfToken);
                        primeForm.append('_csrf-frontend', effectiveCsrfToken);
                    }
                    const primeHeaders = buildErpHeaders({
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache',
                        'Referer': 'https://newerp.kluniversity.in/index.php'
                    }, targetStudent);
                    primeHeaders['x-erp-cookie'] = targetCookie;

                    await fetch(`${apiBase || ''}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                        method: 'POST',
                        headers: primeHeaders,
                        body: primeForm,
                        credentials: 'include',
                        cache: 'no-store'
                    });
                } catch {
                    // ignore priming failure and continue to courselist
                }

                // 2. Query courselist
                const formData = new URLSearchParams();
                formData.append('DynamicModel[academicyear]', String(currentYearId));
                formData.append('DynamicModel[semesterid]', String(semId));
                formData.append('DynamicModel[academic_year]', String(currentYearId));
                formData.append('DynamicModel[semester_id]', String(semId));
                formData.append('academicyear', String(currentYearId));
                formData.append('semesterid', String(semId));
                if (effectiveCsrfToken) {
                    formData.append('_csrf', effectiveCsrfToken);
                    formData.append('_csrf-frontend', effectiveCsrfToken);
                }

                const headers = buildErpHeaders({
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'Referer': 'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput'
                }, targetStudent);
                headers['x-erp-cookie'] = targetCookie;
                if (effectiveCsrfToken) {
                    headers['X-CSRF-Token'] = effectiveCsrfToken;
                }

                let response = await fetch(`${apiBase || ''}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store',
                    signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(25000) : undefined
                });

                if (response.status === 400) {
                    const errorText = await response.text();
                    if (errorText.includes('Unable to verify your data submission')) {
                        throw new Error("Your session has expired. Please completely sign out and log in again.");
                    }
                    continue;
                }

                let html = await response.text();
                if ((html.includes('<div id="root">') || html.includes('/vite.svg') || html.includes('/timetable-logo.svg')) && apiBase !== FALLBACK_ERP_BASE) {
                    const fbHeaders = { ...headers, 'x-erp-cookie': targetCookie };
                    const cookie = getStoredErpCookies(targetStudent);
                    if (cookie) fbHeaders['x-erp-cookie'] = cookie;
                    response = await fetch(`${FALLBACK_ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                        method: 'POST',
                        headers: fbHeaders,
                        body: formData,
                        credentials: 'include',
                        cache: 'no-store'
                    });
                    html = await response.text();
                }

                saveErpCookiesFromResponse(response, { studentId: targetStudent });

                if (!response.ok) {
                    console.warn(`[ERP] Candidate Year ID ${currentYearId} returned status ${response.status}`);
                    continue;
                }

                lastHtml = html;

                if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                    throw new Error("Your session has expired. Please log out and sign in again.");
                }

                const parsed = this.parseSubjects(html);
                if (parsed.length > 0) {
                    subjects = parsed;
                    break;
                }
            } catch (err) {
                lastError = err;
                if (err.message?.includes('expired') || err.message?.includes('sign in')) {
                    throw err;
                }
                console.warn(`[ERP] Error querying Year ID ${currentYearId}:`, err.message);
            }
        }

        if (subjects.length > 0) { 
            return subjects;
        }

        if (lastError && lastError.message?.includes('expired')) {
            throw lastError;
        }

        if (lastHtml) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(lastHtml, 'text/html');
            if (doc.getElementById('login-form')) {
                throw new Error("Your session has expired. Please log out and sign in again.");
            }
        }

        // Return empty array to trigger standard "No Courses Found" view gracefully
        return [];
    },

    // Resilient Parser for Attendance HTML
    parseSubjects(html) {
        if (!html) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const subjectMap = new Map();

        // Standard LTPS Weights: Lecture=100, Tutorial=100, Practical=50, Skill=25
        const getWeight = (ltpsType) => {
            const type = (ltpsType || '').toLowerCase();
            if (type.includes('lecture') || type === 'l') return 100;
            if (type.includes('practical') || type.includes('lab') || type === 'p') return 50;
            if (type.includes('theory') || type.includes('tutorial') || type === 't') return 100;
            if (type.includes('skill') || type === 's') return 25;
            return 1;
        };

        const normalizeComponentName = (rawType) => {
            if (!rawType || rawType === 'N/A' || rawType === 'Unknown') return 'Classes';
            const t = String(rawType).trim().toLowerCase();
            if (t.includes('skill') || t === 's') return 'Skill';
            if (t.includes('practical') || t.includes('lab') || t === 'p') return 'Practical';
            if (t.includes('lecture') || t === 'l') return 'Lecture';
            if (t.includes('tutorial') || t.includes('theory') || t === 't') return 'Tutorial';
            return rawType.trim();
        };

        const tables = doc.querySelectorAll('table');

        tables.forEach(table => {
            let codeIdx = 1;
            let titleIdx = 2;
            let ltpsIdx = 3;
            let conductedIdx = 8;
            let attendedIdx = 9;

            // Detect headers if available (from <th> or first row cells)
            let headerCells = Array.from(table.querySelectorAll('th'));
            if (headerCells.length < 4) {
                const firstRow = table.querySelector('tr');
                if (firstRow) {
                    headerCells = Array.from(firstRow.querySelectorAll('td, th'));
                }
            }

            if (headerCells.length >= 4) {
                headerCells.forEach((th, idx) => {
                    const txt = th.textContent.trim().toLowerCase();
                    if (txt.includes('code')) codeIdx = idx;
                    else if (txt.includes('title') || txt.includes('name') || txt.includes('course')) titleIdx = idx;
                    else if (txt.includes('ltps') || txt.includes('component') || txt.includes('type')) ltpsIdx = idx;
                    else if (txt.includes('conducted')) conductedIdx = idx;
                    else if ((txt.includes('attended') || txt.includes('present')) && !txt.includes('absent')) attendedIdx = idx;
                });
            }

            const rows = table.querySelectorAll('tr');

            rows.forEach(row => {
                // Ignore pure header rows
                if (row.querySelector('th') && !row.querySelector('td')) return;

                const cols = row.querySelectorAll('td');
                if (cols.length < 3) return;

                let code = cols[codeIdx]?.textContent.trim();
                let title = cols[titleIdx]?.textContent.trim();
                let ltps = cols[ltpsIdx]?.textContent.trim() || 'N/A';

                // If standard index didn't produce a valid course code, scan cells
                if (!code || code.length < 3 || code.toLowerCase().includes('code')) {
                    for (let i = 0; i < cols.length; i++) {
                        const cellText = cols[i].textContent.trim();
                        // Alphanumeric course code pattern (e.g., 23CS2101, 24AD01HF, 25CS2103E-S)
                        if (/^[0-9]{2}[A-Za-z]{2,5}[0-9A-Za-z]+([-_/][LPTS])?$/i.test(cellText)) {
                            code = cellText;
                            if (cols[i + 1]) title = cols[i + 1].textContent.trim();
                            if (cols[i + 2]) ltps = cols[i + 2].textContent.trim();
                            break;
                        }
                    }
                }

                if (!code || !title) return;
                if (code.toLowerCase() === 'course code' || code.toLowerCase() === 'code') return;

                // Strip component suffix if appended to course code (e.g., 25CS2103E-S -> 25CS2103E)
                // and deduce LTPS if missing
                let baseCode = code.replace(/[-_/]\s*[LPTS]$/i, '').trim();
                if ((!ltps || ltps === 'N/A' || ltps === 'Unknown') && /[-_/]\s*([LPTS])$/i.test(code)) {
                    ltps = code.match(/[-_/]\s*([LPTS])$/i)[1].toUpperCase();
                }
                const normalizedCode = baseCode || code;

                // Extract conducted and attended numbers
                let rawConducted = 0;
                let rawAttended = 0;

                if (cols[conductedIdx] && cols[attendedIdx]) {
                    rawConducted = parseInt(cols[conductedIdx].textContent.trim().replace(/[^\d]/g, '') || '0', 10) || 0;
                    rawAttended = parseInt(cols[attendedIdx].textContent.trim().replace(/[^\d]/g, '') || '0', 10) || 0;
                }

                // Fallback: look for "Attended/Conducted" format in any column
                if (rawConducted === 0 && rawAttended === 0) {
                    for (let i = 0; i < cols.length; i++) {
                        const t = cols[i].textContent.trim();
                        if (t.includes('/')) {
                            const parts = t.split('/');
                            const a = parseInt(parts[0].replace(/[^\d]/g, ''), 10);
                            const c = parseInt(parts[1].replace(/[^\d]/g, ''), 10);
                            if (!isNaN(a) && !isNaN(c) && c > 0) {
                                rawAttended = a;
                                rawConducted = c;
                                break;
                            }
                        }
                    }
                }

                const componentName = normalizeComponentName(ltps);
                const weight = getWeight(componentName);
                const conducted = rawConducted * weight;
                const attended = rawAttended * weight;
                const componentPercent = rawConducted > 0 ? parseFloat(((rawAttended / rawConducted) * 100).toFixed(2)) : 0;
                const componentData = {
                    conducted: rawConducted,
                    attended: rawAttended,
                    percent: componentPercent
                };

                if (!subjectMap.has(normalizedCode)) {
                    subjectMap.set(normalizedCode, {
                        code: normalizedCode,
                        title,
                        ltpsArray: componentName !== 'Classes' ? [componentName] : [],
                        components: { [componentName]: componentData },
                        totalConducted: conducted,
                        totalAttended: attended,
                        rawConducted,
                        rawAttended
                    });
                } else {
                    const existing = subjectMap.get(normalizedCode);
                    if (componentName !== 'Classes' && !existing.ltpsArray.includes(componentName)) {
                        existing.ltpsArray.push(componentName);
                    }

                    if (existing.components[componentName]) {
                        existing.components[componentName].conducted += rawConducted;
                        existing.components[componentName].attended += rawAttended;
                        const cTot = existing.components[componentName].conducted;
                        existing.components[componentName].percent = cTot > 0
                            ? parseFloat(((existing.components[componentName].attended / cTot) * 100).toFixed(2))
                            : 0;
                    } else {
                        existing.components[componentName] = componentData;
                    }

                    existing.totalConducted += conducted;
                    existing.totalAttended += attended;
                    existing.rawConducted += rawConducted;
                    existing.rawAttended += rawAttended;
                }
            });
        });

        try {
            if (typeof window !== 'undefined') {
                const mappings = JSON.parse(localStorage.getItem('subjectMappings') || '{}');
                let updated = false;
                subjectMap.forEach(subj => {
                    if (subj.code && subj.title && subj.title !== subj.code) {
                        mappings[subj.code] = subj.title;
                        const cleanCode = subj.code.replace(/-[LPTS]$/, '').trim();
                        mappings[cleanCode] = subj.title;
                        updated = true;
                    }
                });
                if (updated) {
                    try { localStorage.setItem('subjectMappings', JSON.stringify(mappings)); } catch { /* ignore */ }
                    window.dispatchEvent(new CustomEvent('kl_subject_mappings_updated'));
                }
            }
        } catch { /* ignore storage error */ }

        return Array.from(subjectMap.values()).map(subj => {
            const percent = subj.totalConducted > 0
                ? Math.ceil((subj.totalAttended / subj.totalConducted) * 100)
                : 0;

            return {
                code: subj.code,
                title: subj.title,
                ltps: subj.ltpsArray.length > 0 ? subj.ltpsArray.join(' + ') : 'N/A',
                components: subj.components,
                attended: `${subj.rawAttended}/${subj.rawConducted}`,
                rawAttended: subj.rawAttended,
                rawConducted: subj.rawConducted,
                percent: parseFloat(percent)
            };
        });
    },

    async getCaptchaUrl() {
        const apiBase = getErpBase();
        return `${apiBase}/api/captcha?v=${Math.random().toString(36).substring(7)}`;
    }
};
