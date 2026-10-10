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

// Pure in-memory session persistence to prevent credentials/tokens appearing in DevTools Application tab
let inMemoryErpCookies = '';
let inMemoryCsrfToken = '';

export const getStoredErpCookies = () => {
    return inMemoryErpCookies || '';
};

export const setStoredErpCookies = (val) => {
    inMemoryErpCookies = val || '';
};

export const getStoredCsrfToken = () => {
    return inMemoryCsrfToken || '';
};

export const setStoredCsrfToken = (val) => {
    inMemoryCsrfToken = val || '';
};

const IGNORED_COOKIE_ATTRS = new Set(['path', 'expires', 'max-age', 'domain', 'samesite', 'secure', 'httponly', 'partitioned']);

export const saveErpCookiesFromResponse = (response, { forceAuthUpdate = true } = {}) => {
    try {
        if (!response) return;
        const newCookies = response.headers?.get?.('x-set-erp-cookie') || response.headers?.get?.('set-cookie');
        if (newCookies) {
            const existing = getStoredErpCookies();
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
            inMemoryErpCookies = merged;
        }
    } catch (e) {
        console.warn("[ERP] Failed to persist cookies:", e);
    }
};

export const clearStoredErpCookies = () => {
    inMemoryErpCookies = '';
    inMemoryCsrfToken = '';
    try {
        sessionStorage.removeItem('erp_session_cookie');
        localStorage.removeItem('erp_session_cookie');
        sessionStorage.removeItem('erp_csrf_token');
        localStorage.removeItem('erp_csrf_token');
        sessionStorage.removeItem('erp_authenticated');
    } catch {
        // ignore
    }
};

const buildErpHeaders = (extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    const cookie = getStoredErpCookies();
    if (cookie) {
        headers['x-erp-cookie'] = cookie;
    }
    return headers;
};

export const erpService = {
    getErpBase,
    getStoredErpCookies,
    saveErpCookiesFromResponse,
    clearStoredErpCookies,

    // Fetch the login page to scrape CSRF token and initial captcha atomically
    async getInitialState() {
        const apiBase = getErpBase();

        // Clear any stale session cookies before initializing fresh session
        clearStoredErpCookies();

        // 1. Fast single-trip session initialization via /api/session-init
        try {
            const resp = await fetch(`${apiBase || ''}/api/session-init`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.success && data.csrfToken) {
                    saveErpCookiesFromResponse(resp, { forceAuthUpdate: true });
                    if (data.cookies) {
                        setStoredErpCookies(data.cookies);
                    }
                    if (data.csrfToken) {
                        setStoredCsrfToken(data.csrfToken);
                    }
                    return {
                        csrfToken: data.csrfToken,
                        captchaUrl: data.captchaUrl
                    };
                }
            }
        } catch (e) {
            console.warn("[ERP] /api/session-init error, attempting fallback:", e);
        }

        // 2. Production fallback via Cloudflare edge if relative was not available
        if (apiBase !== FALLBACK_ERP_BASE && typeof window !== 'undefined' && (window.location.hostname.includes('.web.app') || window.location.hostname.includes('firebaseapp.com'))) {
            try {
                const resp = await fetch(`${FALLBACK_ERP_BASE}/api/session-init`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data && data.success && data.csrfToken) {
                        if (data.cookies) {
                            setStoredErpCookies(data.cookies);
                        }
                        if (data.csrfToken) {
                            setStoredCsrfToken(data.csrfToken);
                        }
                        return {
                            csrfToken: data.csrfToken,
                            captchaUrl: data.captchaUrl
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
            headers: buildErpHeaders({
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            })
        });

        let html = await response.text();
        saveErpCookiesFromResponse(response);
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
                    headers: buildErpHeaders()
                });
                if (imgResp.ok) {
                    saveErpCookiesFromResponse(imgResp);
                    captchaBlob = await imgResp.blob();
                }
            } catch (e) {
                console.warn("[ERP] Could not fetch initial captcha image:", e);
            }
        }

        return { csrfToken, captchaBlob };
    },

    // Refresh captcha directly via ERP endpoint
    async refreshCaptcha() {
        const apiBase = getErpBase();

        // 1. Fast captcha refresh via /api/refresh-captcha
        try {
            const resp = await fetch(`${apiBase || ''}/api/refresh-captcha`, {
                headers: buildErpHeaders({ 'Cache-Control': 'no-cache' })
            });
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.success && data.captchaUrl) {
                    saveErpCookiesFromResponse(resp, { forceAuthUpdate: true });
                    if (data.cookies) {
                        setStoredErpCookies(data.cookies);
                    }
                    if (data.csrfToken) {
                        setStoredCsrfToken(data.csrfToken);
                    }
                    return { dataUrl: data.captchaUrl, csrfToken: data.csrfToken };
                }
            }
        } catch (e) {
            console.warn("[ERP] /api/refresh-captcha error, attempting fallback:", e);
        }

        // Fallback to Cloudflare edge if relative failed in production
        if (apiBase !== FALLBACK_ERP_BASE && typeof window !== 'undefined' && (window.location.hostname.includes('.web.app') || window.location.hostname.includes('firebaseapp.com'))) {
            try {
                const resp = await fetch(`${FALLBACK_ERP_BASE}/api/refresh-captcha`, {
                    headers: buildErpHeaders({ 'Cache-Control': 'no-cache' })
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => null);
                    if (data && data.success && data.captchaUrl) {
                        saveErpCookiesFromResponse(resp, { forceAuthUpdate: true });
                        if (data.cookies) {
                            setStoredErpCookies(data.cookies);
                        }
                        if (data.csrfToken) {
                            setStoredCsrfToken(data.csrfToken);
                        }
                        return { dataUrl: data.captchaUrl, csrfToken: data.csrfToken };
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
                headers: buildErpHeaders({
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                })
            });
            saveErpCookiesFromResponse(refreshResp);
            const refreshData = await refreshResp.json().catch(() => null);
            let imgUrl = refreshData?.url || `/index.php?r=site%2Fcaptcha&v=${Math.random()}`;
            if (!imgUrl.startsWith('http') && apiBase) {
                imgUrl = `${apiBase}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
            }

            const imgResp = await fetch(imgUrl, {
                credentials: 'include',
                cache: 'no-store',
                headers: buildErpHeaders({
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                })
            });
            saveErpCookiesFromResponse(imgResp);
            const blob = await imgResp.blob();
            return { blob, url: imgUrl };
        } catch (e) {
            console.error('[ERP] refreshCaptcha error:', e);
            throw e;
        }
    },

    // Login function
    async login(username, password, captcha, csrfToken) {
        const apiBase = getErpBase();

        let token = csrfToken || getStoredCsrfToken();
        if (!token) {
            const initRes = await this.getInitialState();
            token = initRes?.csrfToken;
        }

        // 1. Try high-performance /api/fast-login endpoint
        try {
            const resp = await fetch(`${apiBase || ''}/api/fast-login`, {
                method: 'POST',
                headers: buildErpHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    username: username.trim(),
                    password,
                    captcha: captcha.trim(),
                    csrfToken: token
                })
            });

            saveErpCookiesFromResponse(resp);
            const data = await resp.json().catch(() => null);

            if (data) {
                if (data.cookies) {
                    setStoredErpCookies(data.cookies);
                }
                if (data.csrfToken) {
                    setStoredCsrfToken(data.csrfToken);
                }
                if (data.success) {
                    return { success: true, html: data.html || '' };
                }
                if (data.error) {
                    throw new Error(data.error);
                }
            }
        } catch (fastErr) {
            if (fastErr.message && !fastErr.message.includes('fetch') && !fastErr.message.includes('NetworkError') && !fastErr.message.includes('Failed to fetch')) {
                throw fastErr;
            }
            console.warn("[ERP] fast-login endpoint unavailable, trying direct POST:", fastErr);
        }

        // 2. Direct POST to /index.php?r=site%2Flogin
        const formData = new URLSearchParams();
        formData.append('_csrf', token || '');
        formData.append('LoginForm[username]', username.trim());
        formData.append('LoginForm[password]', password);
        formData.append('LoginForm[rememberMe]', '0');
        formData.append('LoginForm[captcha]', captcha.trim());
        formData.append('LoginForm[qr_code]', '');
        formData.append('login-button', '');

        const headers = buildErpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        });

        let url = `${apiBase || ''}/index.php?r=site%2Flogin`;
        let response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include',
            cache: 'no-store'
        });

        let html = await response.text();
        saveErpCookiesFromResponse(response, { forceAuthUpdate: true });

        // HTTP error check
        if (!response.ok || response.status >= 400) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const alertDanger = doc.querySelector('.alert-danger, .callout-danger, .site-error');
            const alertText = alertDanger?.textContent?.trim();
            if (alertText && !alertText.includes('The above error occurred')) {
                throw new Error(alertText);
            }
            throw new Error(`Login session rejected (HTTP ${response.status}). Please refresh captcha and try again.`);
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

        // Success detection: If we land away from login-form
        const loginForm = doc.getElementById('login-form');
        if (!loginForm) {
            const newCsrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                            doc.querySelector('input[name="_csrf"]')?.getAttribute('value');
            if (newCsrf) {
                setStoredCsrfToken(newCsrf);
            }
            return { success: true, html };
        } else {
            const alertDanger = doc.querySelector('.alert-danger, .callout-danger');
            if (alertDanger && alertDanger.textContent.trim()) {
                throw new Error(alertDanger.textContent.trim());
            }
            throw new Error("Incorrect Student ID, Password, or Captcha.");
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
                console.log("Successfully destroyed ERP session cookie.");
            }
        } catch (e) {
            console.error("Failed to notify ERP of logout", e);
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
    async getAvailableSessions() {
        try {
            const apiBase = getErpBase();
            const headers = buildErpHeaders({
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'X-Requested-With': 'XMLHttpRequest'
            });

            let resp = await fetch(`${apiBase || ''}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers
            });

            let html = resp.ok ? await resp.text() : '';
            if (!resp.ok || resp.status === 404 || html.includes('<div id="root">') || html.includes('/vite.svg')) {
                const target = apiBase || FALLBACK_ERP_BASE;
                resp = await fetch(`${target}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: buildErpHeaders(headers)
                });
                if (resp.ok) html = await resp.text();
            }

            if (!resp.ok) return null;
            if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                return null;
            }

            saveErpCookiesFromResponse(resp);
            return this.parseSearchInputHtml(html);
        } catch (e) {
            console.warn("[ERP] Failed to retrieve dynamic session options:", e);
            return null;
        }
    },

    // Fetch Subjects and Attendance with automatic session priming and candidate fallbacks
    async fetchAttendance(year, semester) {
        console.log(`[ERP] Fetch Attendance initiated -> Year: "${year}", Semester: "${semester}"`);

        const apiBase = getErpBase();
        const csrfToken = this.getCachedCsrfToken();

        // 1. Try high-performance /api/fast-attendance endpoint first (< 1s execution)
        try {
            const resp = await fetch(`${apiBase || ''}/api/fast-attendance`, {
                method: 'POST',
                headers: buildErpHeaders({
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
                }),
                body: JSON.stringify({
                    year,
                    semester,
                    csrfToken: csrfToken || ''
                })
            });

            saveErpCookiesFromResponse(resp);
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && data.sessionExpired) {
                    throw new Error("Your session has expired. Please log out and sign in again.");
                }
                if (data && data.html) {
                    const parsed = this.parseSubjects(data.html);
                    if (parsed.length > 0) {
                        console.log(`[ERP] Fast-attendance successfully fetched ${parsed.length} courses!`);
                        return parsed;
                    }
                }
            }
        } catch (fastErr) {
            if (fastErr.message?.includes('expired') || fastErr.message?.includes('sign in')) {
                throw fastErr;
            }
            console.warn("[ERP] Fast-attendance endpoint failed, trying direct courselist discovery:", fastErr.message);
        }

        // 2. Prime the controller session and discover dynamic options
        let sessionInfo = null;
        try {
            sessionInfo = await this.getAvailableSessions();
        } catch (e) {
            console.warn("[ERP] Session priming warning:", e);
        }

        const effectiveCsrfToken = sessionInfo?.csrfToken || csrfToken;

        // 3. Resolve matching year ID
        let matchedYearVal = null;
        const reqYearStr = String(year || '').trim().toLowerCase();

        if (sessionInfo?.years && sessionInfo.years.length > 0) {
            // Text match (e.g. "2026-2027", "26-27", "2026")
            const textMatch = sessionInfo.years.find(y => 
                y.text.toLowerCase() === reqYearStr ||
                y.text.toLowerCase().includes(reqYearStr) ||
                reqYearStr.includes(y.text.toLowerCase())
            );
            if (textMatch) matchedYearVal = textMatch.value;

            // Start year match (e.g. "2026")
            if (!matchedYearVal && reqYearStr.includes('-')) {
                const startY = reqYearStr.split('-')[0].trim();
                const startMatch = sessionInfo.years.find(y => y.text.startsWith(startY) || y.text.includes(startY));
                if (startMatch) matchedYearVal = startMatch.value;
            }

            // Direct value match
            if (!matchedYearVal) {
                const valMatch = sessionInfo.years.find(y => y.value === year);
                if (valMatch) matchedYearVal = valMatch.value;
            }
        }

        // 4. Resolve semester ID
        let semId = SEMESTER_MAP[semester] || '1';
        const reqSemStr = String(semester || '').trim().toLowerCase();

        if (sessionInfo?.semesters && sessionInfo.semesters.length > 0) {
            const semMatch = sessionInfo.semesters.find(s => 
                s.text.toLowerCase() === reqSemStr ||
                s.text.toLowerCase().includes(reqSemStr) ||
                (reqSemStr.includes('odd') && (s.value === '1' || s.text.toLowerCase().includes('odd'))) ||
                (reqSemStr.includes('even') && (s.value === '2' || s.text.toLowerCase().includes('even'))) ||
                (reqSemStr.includes('summer') && (s.value === '3' || s.text.toLowerCase().includes('summer'))) ||
                (reqSemStr.includes('term') && (s.value === '4' || s.text.toLowerCase().includes('term')))
            );
            if (semMatch) semId = semMatch.value;
        }

        // 5. Candidate IDs to try (matched first, then standard 2026 mappings, then selected default)
        const candidateYearIds = getCandidateYearIdsForYear(year, matchedYearVal, sessionInfo?.selectedYear?.value);
        console.log(`[ERP] Candidate Year IDs to query:`, candidateYearIds, `SemId:`, semId);

        let subjects = [];
        let lastHtml = '';
        let lastError = null;

        for (const currentYearId of candidateYearIds) {
            try {
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
                });
                if (effectiveCsrfToken) {
                    headers['X-CSRF-Token'] = effectiveCsrfToken;
                }

                let response = await fetch(`${apiBase || ''}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });

                if (response.status === 400) {
                    const errorText = await response.text();
                    if (errorText.includes('Unable to verify your data submission')) {
                        throw new Error("Your session has expired. Please completely sign out and log in again.");
                    }
                    continue;
                }

                let html = await response.text();
                if ((html.includes('<div id="root">') || html.includes('/vite.svg')) && apiBase !== FALLBACK_ERP_BASE) {
                    const fbHeaders = { ...headers };
                    const cookie = getStoredErpCookies();
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

                saveErpCookiesFromResponse(response);

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
                    console.log(`[ERP] Successfully fetched ${subjects.length} courses with YearId: ${currentYearId}`);
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
            if (type.includes('practical') || type === 'p') return 50;
            if (type.includes('theory') || type.includes('tutorial') || type === 't') return 100;
            if (type.includes('skill') || type === 's') return 25;
            return 1;
        };

        const tables = doc.querySelectorAll('table');

        tables.forEach(table => {
            let codeIdx = 1;
            let titleIdx = 2;
            let ltpsIdx = 3;
            let conductedIdx = 8;
            let attendedIdx = 9;

            // Detect headers if available
            const ths = Array.from(table.querySelectorAll('th'));
            if (ths.length >= 4) {
                ths.forEach((th, idx) => {
                    const txt = th.textContent.trim().toLowerCase();
                    if (txt.includes('code')) codeIdx = idx;
                    else if (txt.includes('title') || txt.includes('name') || txt.includes('course')) titleIdx = idx;
                    else if (txt.includes('ltps') || txt.includes('component') || txt.includes('type')) ltpsIdx = idx;
                    else if (txt.includes('conducted')) conductedIdx = idx;
                    else if (txt.includes('attended') || txt.includes('present')) attendedIdx = idx;
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
                        // Alphanumeric course code pattern (e.g., 23CS2101, 24AD01HF)
                        if (/^[0-9]{2}[A-Za-z]{2,5}[0-9A-Za-z]+$/.test(cellText)) {
                            code = cellText;
                            if (cols[i + 1]) title = cols[i + 1].textContent.trim();
                            if (cols[i + 2]) ltps = cols[i + 2].textContent.trim();
                            break;
                        }
                    }
                }

                if (!code || !title) return;
                if (code.toLowerCase() === 'course code' || code.toLowerCase() === 'code') return;

                // Extract conducted and attended numbers
                let rawConducted = 0;
                let rawAttended = 0;

                if (cols[conductedIdx] && cols[attendedIdx]) {
                    rawConducted = parseInt(cols[conductedIdx].textContent.trim() || '0', 10) || 0;
                    rawAttended = parseInt(cols[attendedIdx].textContent.trim() || '0', 10) || 0;
                }

                // Fallback: look for "Attended/Conducted" format in any column
                if (rawConducted === 0 && rawAttended === 0) {
                    for (let i = 0; i < cols.length; i++) {
                        const t = cols[i].textContent.trim();
                        if (t.includes('/')) {
                            const parts = t.split('/');
                            const a = parseInt(parts[0], 10);
                            const c = parseInt(parts[1], 10);
                            if (!isNaN(a) && !isNaN(c) && c > 0) {
                                rawAttended = a;
                                rawConducted = c;
                                break;
                            }
                        }
                    }
                }

                const weight = getWeight(ltps);
                const conducted = rawConducted * weight;
                const attended = rawAttended * weight;
                const componentName = ltps !== 'N/A' && ltps !== '' ? ltps : 'Unknown';
                const componentPercent = rawConducted > 0 ? parseFloat(((rawAttended / rawConducted) * 100).toFixed(2)) : 0;
                const componentData = {
                    conducted: rawConducted,
                    attended: rawAttended,
                    percent: componentPercent
                };

                if (!subjectMap.has(code)) {
                    subjectMap.set(code, {
                        code,
                        title,
                        ltpsArray: ltps !== 'N/A' && ltps !== '' ? [ltps] : [],
                        components: { [componentName]: componentData },
                        totalConducted: conducted,
                        totalAttended: attended,
                        rawConducted,
                        rawAttended
                    });
                } else {
                    const existing = subjectMap.get(code);
                    if (ltps !== 'N/A' && ltps !== '' && !existing.ltpsArray.includes(ltps)) {
                        existing.ltpsArray.push(ltps);
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
                percent: parseFloat(percent)
            };
        });
    },

    async getCaptchaUrl() {
        const apiBase = getErpBase();
        return `${apiBase}/api/captcha?v=${Math.random().toString(36).substring(7)}`;
    }
};
