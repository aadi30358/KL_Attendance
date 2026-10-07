import { SEMESTER_MAP, getAcademicYearCode, findAcademicYearFromHtml, getCandidateYearIdsForYear, findSemesterFromHtml, isHtmlMatchingRequestedYear } from '../config/api';
import { APP_CONFIG } from '../config';

const FALLBACK_ERP_BASE = 'https://kl-attendance-backend-newnode-env.onrender.com';
let activeErpBase = APP_CONFIG.API_URL || FALLBACK_ERP_BASE;

export const getErpBase = () => activeErpBase || FALLBACK_ERP_BASE;

export const switchToFallbackErpBase = () => {
    if (activeErpBase !== FALLBACK_ERP_BASE) {
        console.warn(`[ERP] Switching API from ${activeErpBase} to fallback: ${FALLBACK_ERP_BASE}`);
        activeErpBase = FALLBACK_ERP_BASE;
    }
    return activeErpBase;
};

export const getStoredErpCookies = () => {
    return sessionStorage.getItem('erp_session_cookie') || localStorage.getItem('erp_session_cookie') || '';
};

export const getStoredCsrfToken = () => {
    let token = sessionStorage.getItem('erp_csrf_token') || localStorage.getItem('erp_csrf_token');
    if (!token) {
        const dashboardHtml = localStorage.getItem('erpDashboardHtml');
        if (dashboardHtml) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                token = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
                if (token) {
                    sessionStorage.setItem('erp_csrf_token', token);
                    localStorage.setItem('erp_csrf_token', token);
                }
            } catch {
                // Ignore parse errors
            }
        }
    }
    return token;
};

export const saveErpCookiesFromResponse = (response) => {
    try {
        if (!response) return;
        // Do NOT save cookies from error responses (400, 401, 403, 500)
        // because error pages frequently issue guest sessions that poison authenticated cookies
        if (response.status && response.status >= 400) {
            return;
        }

        const newCookies = response.headers?.get?.('x-set-erp-cookie');
        if (newCookies) {
            const existing = getStoredErpCookies();
            const cookieMap = new Map();
            if (existing) {
                existing.split(';').forEach(pair => {
                    const [k, ...v] = pair.split('=');
                    if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
                });
            }
            newCookies.split(';').forEach(pair => {
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
            const merged = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
            sessionStorage.setItem('erp_session_cookie', merged);
            localStorage.setItem('erp_session_cookie', merged);
        }
    } catch (e) {
        console.warn("[ERP] Failed to persist x-set-erp-cookie:", e);
    }
};

export const clearStoredErpCookies = () => {
    sessionStorage.removeItem('erp_session_cookie');
    localStorage.removeItem('erp_session_cookie');
    sessionStorage.removeItem('erp_csrf_token');
    localStorage.removeItem('erp_csrf_token');
};

const buildErpHeaders = (extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    const cookie = getStoredErpCookies();
    if (cookie) {
        headers['x-erp-cookie'] = cookie;
    }
    return headers;
};

export const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

export const erpService = {
    getErpBase,
    getStoredErpCookies,
    saveErpCookiesFromResponse,
    clearStoredErpCookies,

    // Ultra-fast session & captcha initialization in a single round-trip
    async getSessionInit() {
        clearStoredErpCookies();
        let apiBase = getErpBase();
        if (apiBase) {
            try {
                const resp = await fetchWithTimeout(`${apiBase}/api/session-init`, {
                    headers: { 'Cache-Control': 'no-cache' }
                }, 7000);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success && data.csrfToken && data.captchaUrl) {
                        saveErpCookiesFromResponse(resp);
                        if (data.cookies) {
                            sessionStorage.setItem('erp_session_cookie', data.cookies);
                            localStorage.setItem('erp_session_cookie', data.cookies);
                        }
                        return {
                            csrfToken: data.csrfToken,
                            captchaUrl: data.captchaUrl
                        };
                    }
                }
            } catch (e) {
                console.warn("[ERP] Fast session-init unavailable on current base, trying fallback:", e);
                if (apiBase !== FALLBACK_ERP_BASE) {
                    apiBase = switchToFallbackErpBase();
                    try {
                        const fbResp = await fetchWithTimeout(`${FALLBACK_ERP_BASE}/api/session-init`, {
                            headers: { 'Cache-Control': 'no-cache' }
                        }, 7000);
                        if (fbResp.ok) {
                            const data = await fbResp.json();
                            if (data.success && data.csrfToken && data.captchaUrl) {
                                saveErpCookiesFromResponse(fbResp);
                                if (data.cookies) {
                                    sessionStorage.setItem('erp_session_cookie', data.cookies);
                                    localStorage.setItem('erp_session_cookie', data.cookies);
                                }
                                return {
                                    csrfToken: data.csrfToken,
                                    captchaUrl: data.captchaUrl
                                };
                            }
                        }
                    } catch (fbErr) {
                        console.warn("[ERP] Fallback session-init also failed:", fbErr);
                    }
                }
            }
        }

        // Fallback to legacy getInitialState
        const state = await this.getInitialState();
        if (!state || !state.csrfToken) {
            throw new Error("Unable to connect to ERP server. Please check your internet connection or refresh.");
        }
        return state;
    },

    // Ultra-fast captcha refresh in a single round-trip
    async fastRefreshCaptcha() {
        let apiBase = getErpBase();
        if (apiBase) {
            try {
                const headers = buildErpHeaders({ 'Cache-Control': 'no-cache' });
                const resp = await fetchWithTimeout(`${apiBase}/api/refresh-captcha`, { headers }, 7000);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success && data.captchaUrl) {
                        saveErpCookiesFromResponse(resp);
                        if (data.cookies) {
                            sessionStorage.setItem('erp_session_cookie', data.cookies);
                            localStorage.setItem('erp_session_cookie', data.cookies);
                        }
                        return data.captchaUrl;
                    }
                }
            } catch (e) {
                console.warn("[ERP] Fast refresh-captcha unavailable on base, trying fallback:", e);
                if (apiBase !== FALLBACK_ERP_BASE) {
                    switchToFallbackErpBase();
                    try {
                        const headers = buildErpHeaders({ 'Cache-Control': 'no-cache' });
                        const resp = await fetchWithTimeout(`${FALLBACK_ERP_BASE}/api/refresh-captcha`, { headers }, 7000);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data.success && data.captchaUrl) {
                                saveErpCookiesFromResponse(resp);
                                if (data.cookies) {
                                    sessionStorage.setItem('erp_session_cookie', data.cookies);
                                    localStorage.setItem('erp_session_cookie', data.cookies);
                                }
                                return data.captchaUrl;
                            }
                        }
                    } catch (fbErr) {
                        console.warn("[ERP] Fallback refresh-captcha also failed:", fbErr);
                    }
                }
            }
        }
        return null;
    },

    // Fetch the login page to scrape CSRF token and establish a clean ERP session
    async getInitialState() {
        // ALWAYS clear stale cookies so ERP issues a fresh, active PHPSESSID
        clearStoredErpCookies();
        const timestamp = new Date().getTime();
        const headers = {
            'Cache-Control': 'no-cache'
        };
        let response;
        try {
            response = await fetchWithTimeout(`${getErpBase()}/index.php?_t=${timestamp}`, { 
                credentials: 'include',
                cache: 'no-store',
                headers
            }, 8000);
        } catch (fetchErr) {
            if (getErpBase() !== FALLBACK_ERP_BASE) {
                switchToFallbackErpBase();
                response = await fetchWithTimeout(`${FALLBACK_ERP_BASE}/index.php?_t=${timestamp}`, { 
                    credentials: 'include',
                    cache: 'no-store',
                    headers
                }, 8000);
            } else {
                throw fetchErr;
            }
        }
        saveErpCookiesFromResponse(response);
        const html = await response.text();
        if (response.status === 503 || html.includes('Service Suspended')) {
            throw new Error("ERP backend server is suspended on Render (503). Please resume the service in your Render dashboard.");
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) {
            throw new Error("Unable to connect to ERP server. Please check your internet connection or refresh.");
        }
        return { csrfToken };
    },

    // Login function - sub-second fast path with resilient fallback
    async login(username, password, captcha, csrfToken) {
        const apiBase = getErpBase();
        const storedCookie = getStoredErpCookies();

        // 1. Ultra-fast direct backend login (sub-second response, zero client DOM parsing lag)
        if (apiBase) {
            try {
                const fastResp = await fetch(`${apiBase}/api/fast-login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                        ...(storedCookie ? { 'x-erp-cookie': storedCookie } : {})
                    },
                    body: JSON.stringify({ username, password, captcha, csrfToken })
                });

                saveErpCookiesFromResponse(fastResp);
                const fastData = await fastResp.json();

                if (fastData.cookies) {
                    sessionStorage.setItem('erp_session_cookie', fastData.cookies);
                    localStorage.setItem('erp_session_cookie', fastData.cookies);
                }

                if (fastResp.ok && fastData.success && fastData.html) {
                    const html = fastData.html;
                    const isForm = html.includes('id="login-form"') || html.includes('loginFormUserNameID');
                    const hasAuthProof = html.includes('site%2Flogout') || 
                                         html.includes('site/logout') || 
                                         html.includes('indexindi') || 
                                         html.includes('logout') || 
                                         html.includes(username);

                    if (!isForm && hasAuthProof) {
                        console.log("[ERP] Fast login succeeded and verified in single hop!");
                        return { success: true, verified: true, html };
                    }
                    throw new Error("Credentials verification failed. Please check your Student ID and Password.");
                }

                if (fastData && fastData.error) {
                    throw new Error(fastData.error);
                }
                if (fastData && !fastData.success) {
                    throw new Error(fastData.error || "Incorrect Student ID, Password, or Captcha code.");
                }
            } catch (err) {
                // If it's a real authentication error (e.g. wrong password/captcha), throw immediately
                if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
                    throw err;
                }
                console.warn("[ERP] Fast login endpoint network failure, trying fallback:", err);
                if (apiBase !== FALLBACK_ERP_BASE) {
                    switchToFallbackErpBase();
                    try {
                        const fbResp = await fetch(`${FALLBACK_ERP_BASE}/api/fast-login`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache',
                                ...(storedCookie ? { 'x-erp-cookie': storedCookie } : {})
                            },
                            body: JSON.stringify({ username, password, captcha, csrfToken })
                        });
                        saveErpCookiesFromResponse(fbResp);
                        const fbData = await fbResp.json();
                        if (fbData.cookies) {
                            sessionStorage.setItem('erp_session_cookie', fbData.cookies);
                            localStorage.setItem('erp_session_cookie', fbData.cookies);
                        }
                        if (fbResp.ok && fbData.success && fbData.html) {
                            const html = fbData.html;
                            const isForm = html.includes('id="login-form"') || html.includes('loginFormUserNameID');
                            const hasAuthProof = html.includes('site%2Flogout') || 
                                                 html.includes('site/logout') || 
                                                 html.includes('indexindi') || 
                                                 html.includes('logout') || 
                                                 html.includes(username);

                            if (!isForm && hasAuthProof) {
                                console.log("[ERP] Fallback fast login succeeded and verified!");
                                return { success: true, verified: true, html };
                            }
                            throw new Error("Credentials verification failed. Please check your Student ID and Password.");
                        }
                        if (fbData && fbData.error) {
                            throw new Error(fbData.error);
                        }
                        if (fbData && !fbData.success) {
                            throw new Error(fbData.error || "Incorrect Student ID, Password, or Captcha code.");
                        }
                    } catch (fbErr) {
                        if (fbErr.message && !fbErr.message.includes('Failed to fetch') && !fbErr.message.includes('NetworkError')) {
                            throw fbErr;
                        }
                    }
                }
            }
        }

        // 2. Resilient fallback to legacy proxy submission
        const formData = new URLSearchParams();
        formData.append('_csrf', csrfToken);
        formData.append('LoginForm[username]', username);
        formData.append('LoginForm[password]', password);
        formData.append('LoginForm[rememberMe]', '0');
        formData.append('LoginForm[captcha]', captcha);
        formData.append('LoginForm[qr_code]', '');
        formData.append('login-button', '');

        const headers = buildErpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache'
        });

        let response;
        try {
            response = await fetch(`${getErpBase()}/index.php?r=site%2Flogin`, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include',
                cache: 'no-store'
            });
        } catch (fetchErr) {
            if (getErpBase() !== FALLBACK_ERP_BASE) {
                switchToFallbackErpBase();
                response = await fetch(`${FALLBACK_ERP_BASE}/index.php?r=site%2Flogin`, {
                    method: 'POST',
                    headers: buildErpHeaders({
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cache-Control': 'no-cache'
                    }),
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });
            } else {
                throw fetchErr;
            }
        }

        if (!response.ok) {
            throw new Error(`ERP server responded with status ${response.status}. Please check your connection or try again.`);
        }

        saveErpCookiesFromResponse(response);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const loginForm = doc.getElementById('login-form');

        // Extract precise error message from ERP page:
        // 1. Password error
        const passwordError = doc.querySelector('.field-loginFormPasswordID .help-block, .field-loginform-password .help-block');
        const pwdErrText = passwordError?.textContent?.trim();

        // 2. Captcha error
        const captchaError = doc.querySelector('.field-loginFormCaptcha .help-block, .field-loginform-captcha .help-block');
        const capErrText = captchaError?.textContent?.trim();

        // 3. Username error
        const usernameError = doc.querySelector('.field-loginFormUserNameID .help-block, .field-loginform-username .help-block');
        const usrErrText = usernameError?.textContent?.trim();

        // 4. Any .has-error help-block
        const anyHelpError = doc.querySelector('.has-error .help-block');
        const anyErrText = anyHelpError?.textContent?.trim();

        // 5. Alert banners
        const alertBanner = doc.querySelector('.alert-danger, .error-summary');
        const alertErrText = alertBanner?.textContent?.trim();

        if (pwdErrText) throw new Error(pwdErrText);
        if (capErrText) throw new Error(capErrText);
        if (usrErrText) throw new Error(usrErrText);
        if (anyErrText) throw new Error(anyErrText);
        if (alertErrText) throw new Error(alertErrText);

        // If loginForm is NOT found, verify that html is genuine authenticated student HTML (not an error page)
        if (!loginForm) {
            const hasAuthProof = html.includes('site%2Flogout') || 
                                 html.includes('site/logout') || 
                                 html.includes('indexindi') || 
                                 html.includes('logout') || 
                                 html.includes(username);
            if (hasAuthProof) {
                return { success: true, verified: true, html };
            }
            throw new Error("Credentials verification failed. Please check your Student ID and Password.");
        }

        // If loginForm is present, verify if active session exists via indexindi fallback
        const storedCookies = getStoredErpCookies();
        const hasDeviceId = storedCookies.includes('kl_erp_device_id');
        const hasAnyFormError = !!(pwdErrText || capErrText || usrErrText || anyErrText || alertErrText);

        if (!hasAnyFormError || hasDeviceId) {
            try {
                const dashResp = await fetch(`${getErpBase()}/index.php?r=site%2Findexindi`, {
                    method: 'GET',
                    headers: buildErpHeaders({
                        'Cache-Control': 'no-cache'
                    }),
                    credentials: 'include',
                    cache: 'no-store'
                });
                if (dashResp.ok) {
                    saveErpCookiesFromResponse(dashResp);
                    const dashHtml = await dashResp.text();
                    const dashDoc = parser.parseFromString(dashHtml, 'text/html');
                    const isForm = dashDoc.getElementById('login-form');
                    const hasAuth = dashHtml.includes('site%2Flogout') || 
                                    dashHtml.includes('site/logout') || 
                                    dashHtml.includes('indexindi') || 
                                    dashHtml.includes('logout') || 
                                    dashHtml.includes(username);
                    if (!isForm && hasAuth) {
                        console.log("[ERP] Successfully verified active session via indexindi fallback!");
                        return { success: true, verified: true, html: dashHtml };
                    }
                }
            } catch (e) {
                console.warn("[ERP] Fallback dashboard check failed:", e);
            }
        }

        throw new Error("Incorrect username or password. Please verify your credentials.");
    },

    // IMPORTANT: Actually tell the ERP server to destroy the session cookie!
    async erpLogout() {
        try {
            // We need the CSRF token to logout from Yii2
            let csrfToken = null;
            const dashboardHtml = localStorage.getItem('erpDashboardHtml');
            if (dashboardHtml) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            }

            if (csrfToken) {
                const formData = new URLSearchParams();
                formData.append('_csrf', csrfToken);

                const headers = buildErpHeaders({
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                });

                await fetch(`${getErpBase()}/index.php?r=site%2Flogout`, {
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
        } finally {
            clearStoredErpCookies();
        }
    },

    // Parse Student Data from Dashboard HTML
    parseStudentData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let name = "Student";
        let image = "/assets/default-user.png"; // Fallback

        const nameEl = doc.querySelector('.profile_info h2') || doc.querySelector('.user-profile');
        if (nameEl) name = nameEl.textContent.trim();

        const imgEl = doc.querySelector('.profile_pic img') || doc.querySelector('img.img-circle');
        if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src) image = src;
        }

        return { name, image };
    },

    // Single request helper
    async _postFetchAttendance(yearId, semId, csrfToken) {
        const activeCsrf = csrfToken || getStoredCsrfToken();

        // 1. Primary Strategy: Fast low-latency direct proxy (< 300ms)
        try {
            const fastResp = await fetch(`${getErpBase()}/api/fast-attendance`, {
                method: 'POST',
                headers: buildErpHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    yearId: String(yearId),
                    semId: String(semId),
                    csrfToken: activeCsrf || ''
                }),
                cache: 'no-store'
            });

            if (fastResp.ok) {
                const fastData = await fastResp.json();
                if (fastData.success && fastData.html) {
                    if (fastData.html.includes('id="login-form"') || fastData.html.includes('loginFormUserNameID')) {
                        throw new Error("Your session has expired. Please log out and sign in again.");
                    }
                    saveErpCookiesFromResponse(fastResp);
                    const subjects = this.parseSubjects(fastData.html);
                    if (subjects && subjects.length > 0) {
                        return { subjects, html: fastData.html };
                    }
                } else if (fastData.sessionExpired || (fastData.html && (fastData.html.includes('id="login-form"') || fastData.html.includes('loginFormUserNameID')))) {
                    throw new Error("Your session has expired. Please log out and sign in again.");
                }
            }
        } catch (fastErr) {
            if (fastErr.message?.includes('session has expired')) {
                throw fastErr;
            }
            console.warn('[ERP] Fast-attendance endpoint notice, trying standard endpoint:', fastErr);
        }

        // 2. Secondary Strategy: Standard proxy post to courselist
        const formData = new URLSearchParams();
        formData.append('DynamicModel[academicyear]', String(yearId));
        formData.append('DynamicModel[semesterid]', String(semId));
        formData.append('academicyear', String(yearId));
        formData.append('semesterid', String(semId));
        if (activeCsrf) {
            formData.append('_csrf', activeCsrf);
        }

        const extraHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache'
        };
        if (activeCsrf) {
            extraHeaders['X-CSRF-Token'] = activeCsrf;
        }
        const headers = buildErpHeaders(extraHeaders);

        let response;
        try {
            response = await fetch(`${getErpBase()}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include',
                cache: 'no-store'
            });
        } catch (fetchErr) {
            if (getErpBase() !== FALLBACK_ERP_BASE) {
                switchToFallbackErpBase();
                response = await fetch(`${FALLBACK_ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                    method: 'POST',
                    headers: buildErpHeaders(extraHeaders),
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });
            } else {
                throw fetchErr;
            }
        }

        if (response.status === 401) {
            throw new Error("Your session has expired. Please log out and sign in again.");
        }

        if (response.status === 302) {
            const loc = response.headers.get('Location') || response.headers.get('location') || '';
            if (loc.includes('login')) {
                throw new Error("Your session has expired. Please log out and sign in again.");
            }
            return { subjects: [], html: '' };
        }

        if (!response.ok) {
            console.error("ERP HTTP Error:", response.status, response.statusText);
            throw new Error(`Unable to load attendance (HTTP ${response.status}). Please try again.`);
        }

        let html = await response.text();

        const parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');
        if (doc.getElementById('login-form') || html.includes('loginFormUserNameID')) {
            throw new Error("Your session has expired. Please log out and sign in again.");
        }

        saveErpCookiesFromResponse(response);
        let subjects = this.parseSubjects(html);

        // Fallback: If courselist yielded 0 subjects, attempt posting to index route
        if (!subjects || subjects.length === 0) {
            try {
                const indexResp = await fetch(`${getErpBase()}/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex`, {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include',
                    cache: 'no-store'
                });
                if (indexResp.ok) {
                    const indexHtml = await indexResp.text();
                    if (!indexHtml.includes('login-form')) {
                        saveErpCookiesFromResponse(indexResp);
                        const indexSubjects = this.parseSubjects(indexHtml);
                        if (indexSubjects && indexSubjects.length > 0) {
                            return { subjects: indexSubjects, html: indexHtml };
                        }
                    }
                }
            } catch (e) {
                console.warn("[ERP] Index POST fallback failed", e);
            }
        }

        return { subjects, html };
    },

    // Fetch live attendance index page to scrape real option values & CSRF token
    async getAttendancePageOptions(year, semester) {
        try {
            const timestamp = new Date().getTime();
            const headers = buildErpHeaders({
                'Cache-Control': 'no-cache'
            });
            let response;
            try {
                response = await fetch(`${getErpBase()}/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex&_t=${timestamp}`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers
                });
            } catch (fetchErr) {
                if (getErpBase() !== FALLBACK_ERP_BASE) {
                    switchToFallbackErpBase();
                    response = await fetch(`${FALLBACK_ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex&_t=${timestamp}`, {
                        method: 'GET',
                        credentials: 'include',
                        cache: 'no-store',
                        headers: buildErpHeaders({ 'Cache-Control': 'no-cache' })
                    });
                } else {
                    throw fetchErr;
                }
            }

            if (response && response.ok) {
                const html = await response.text();
                // Never extract tokens or cookies from a redirected login page!
                if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                    console.warn("[ERP] Attendance index returned login page; skipping option scraping.");
                    return null;
                }

                saveErpCookiesFromResponse(response);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (csrfToken) {
                    sessionStorage.setItem('erp_csrf_token', csrfToken);
                    localStorage.setItem('erp_csrf_token', csrfToken);
                }
                const parsedYearId = findAcademicYearFromHtml(html, year);
                const parsedSemId = findSemesterFromHtml(html, semester);
                return { csrfToken, parsedYearId, parsedSemId, html };
            }
        } catch (e) {
            console.warn("[ERP] Failed to fetch live attendance index page options", e);
        }
        return null;
    },

    // Fast-Path In-Memory and Session Storage Helpers
    _getFastPathKey(year, semester) {
        const username = sessionStorage.getItem('erp_username') || localStorage.getItem('activeErpUser') || 'default';
        return `kl_erp_fastpath_${username}_${year}_${semester}`;
    },

    _getFastPath(year, semester) {
        const key = this._getFastPathKey(year, semester);
        try {
            const raw = sessionStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch {
            // Ignore fast-path cache read errors
        }
        return null;
    },

    _saveFastPath(year, semester, yearId, semId, csrfToken) {
        const key = this._getFastPathKey(year, semester);
        try {
            sessionStorage.setItem(key, JSON.stringify({
                yearId,
                semId,
                csrfToken: csrfToken || '',
                savedAt: Date.now()
            }));
        } catch {
            // Ignore fast-path cache write errors
        }
    },

    // 0ms Synchronous Optimistic Cache Reader for Instant Page Paint
    getCachedAttendance(year, semester) {
        const username = sessionStorage.getItem('erp_username') || localStorage.getItem('activeErpUser') || '';
        const cacheKey = username ? `kl_att_cache_${username}_${year}_${semester}` : null;
        if (cacheKey) {
            try {
                const cachedRaw = sessionStorage.getItem(cacheKey);
                if (cachedRaw) {
                    const data = JSON.parse(cachedRaw);
                    if (Array.isArray(data.subjects) && data.subjects.length > 0) {
                        return data.subjects;
                    }
                }
            } catch {
                // Ignore session cache parse errors
            }
        }
        try {
            const activeId = localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId');
            const storageKey = activeId ? `kleData_${activeId}` : 'kleData';
            const raw = localStorage.getItem(storageKey) || localStorage.getItem('kleData');
            if (raw) {
                const parsed = JSON.parse(raw);
                const list = parsed.attendance_data || (Array.isArray(parsed) ? parsed : null);
                if (Array.isArray(list) && list.length > 0) {
                    return list;
                }
            }
        } catch {
            // Ignore storage key read errors
        }
        return null;
    },

    // Live Sub-Second Attendance Fetcher (< 1s execution)
    async fetchAttendance(year, semester, { forceLive = true } = {}) {
        const startTime = performance.now();
        const username = sessionStorage.getItem('erp_username') || localStorage.getItem('activeErpUser') || '';
        const cacheKey = username ? `kl_att_cache_${username}_${year}_${semester}` : null;

        // If forceLive is explicitly false and valid local cache exists, return cache
        if (!forceLive && cacheKey) {
            try {
                const cachedRaw = sessionStorage.getItem(cacheKey);
                if (cachedRaw) {
                    const data = JSON.parse(cachedRaw);
                    if (Array.isArray(data.subjects) && data.subjects.length > 0) {
                        return data.subjects;
                    }
                }
            } catch {
                // Ignore session cache read errors
            }
        }

        // 1. FAST-PATH EXECUTION (< 1s, typically ~150ms-350ms):
        // If resolved yearId and semId are already known, skip discovery loops and fire a single direct network hop!
        const fastPath = this._getFastPath(year, semester);
        if (fastPath && fastPath.yearId && fastPath.semId) {
            try {
                const t0 = performance.now();
                const { subjects } = await this._postFetchAttendance(
                    fastPath.yearId,
                    fastPath.semId,
                    fastPath.csrfToken
                );

                if (subjects && subjects.length > 0) {
                    const latencyMs = Math.round(performance.now() - t0);
                    console.log(`[ERP Fast-Path] Attendance updated in ${latencyMs}ms (< 1s) for ${year} ${semester}`);

                    // Refresh fast path timestamp
                    this._saveFastPath(year, semester, fastPath.yearId, fastPath.semId, fastPath.csrfToken);

                    // Attach speed metadata
                    subjects.__latencyMs = latencyMs;
                    subjects.__isFastPath = true;
                    subjects.__fetchedAt = Date.now();

                    // Update session storage
                    if (cacheKey) {
                        try {
                            sessionStorage.setItem(cacheKey, JSON.stringify({
                                subjects,
                                last_updated: Date.now()
                            }));
                        } catch {
                            // Ignore session storage errors
                        }
                    }

                    return subjects;
                }
            } catch (err) {
                if (err.message?.includes('session has expired')) {
                    throw err;
                }
                console.warn('[ERP Fast-Path] Fast-path missed or CSRF rotated, falling back to full resolver:', err);
            }
        }

        // 2. Full Resolution (Discovers active yearId and semId, then stores in Fast-Path)
        const subjects = await this._fetchAttendanceFromERP(year, semester);
        const totalLatencyMs = Math.round(performance.now() - startTime);

        if (subjects && subjects.length > 0) {
            subjects.__latencyMs = totalLatencyMs;
            subjects.__isFastPath = false;
            subjects.__fetchedAt = Date.now();

            if (cacheKey) {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        subjects,
                        last_updated: Date.now()
                    }));
                } catch {
                    // Ignore session storage errors
                }
            }
        }

        return subjects;
    },

    // Actual Scraping & Discovery Logic
    async _fetchAttendanceFromERP(year, semester) {
        let dashboardHtml = localStorage.getItem('erpDashboardHtml') || '';
        const liveOptions = await this.getAttendancePageOptions(year, semester);

        let csrfToken = liveOptions?.csrfToken || getStoredCsrfToken();
        if (!csrfToken && dashboardHtml) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(dashboardHtml, 'text/html');
                csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            } catch (e) {
                console.warn("[ERP] Failed to parse cached dashboard HTML", e);
            }
        }

        const liveYearId = liveOptions?.parsedYearId;
        const liveSemId = liveOptions?.parsedSemId;
        const htmlYearId = findAcademicYearFromHtml(dashboardHtml, year);
        const calculatedYearId = getAcademicYearCode(year);
        const semId = SEMESTER_MAP[semester] || '1';

        const primaryYearId = liveYearId || htmlYearId || calculatedYearId;
        console.log(`[ERP] Fetch Attendance -> Year: ${year} (Primary ID: ${primaryYearId}, Live Year ID: ${liveYearId}), Sem: ${semester} (Live Sem ID: ${liveSemId}, Sem ID: ${semId})`);

        if (!primaryYearId || !semId) {
            throw new Error(`Invalid year (${year}) or semester (${semester}) selected.`);
        }

        if (!csrfToken) {
            console.error("[ERP] No CSRF token available for request. Session likely wiped.");
        }

        // Candidate year IDs strictly isolated for requested academic year
        const candidateYearIds = getCandidateYearIdsForYear(year, liveYearId, htmlYearId);

        // Candidate semester IDs (e.g. '1', 'Odd Sem', 'Odd')
        const candidateSemIds = Array.from(new Set([
            liveSemId,
            semId,
            semester,
            semester === 'Odd' ? 'Odd Sem' : semester === 'Even' ? 'Even Sem' : semester
        ])).filter(Boolean);

        let fallbackSubjects = null;
        let fallbackCandidate = null;

        for (const candidateYearId of candidateYearIds) {
            for (const candidateSemId of candidateSemIds) {
                try {
                    const { subjects, html } = await this._postFetchAttendance(candidateYearId, candidateSemId, csrfToken);
                    const isLiveId = (candidateYearId === liveYearId);
                    
                    if (subjects && subjects.length > 0) {
                        if (isLiveId || isHtmlMatchingRequestedYear(html, year)) {
                            console.log(`[ERP] Successfully fetched ${subjects.length} subjects for requested year ${year} with yearId: ${candidateYearId}, semId: ${candidateSemId}`);
                            // Memorize for future sub-second (< 1s) Fast-Path requests
                            this._saveFastPath(year, semester, candidateYearId, candidateSemId, csrfToken);
                            return subjects;
                        } else {
                            console.warn(`[ERP] Saving fallback subjects for yearId ${candidateYearId} despite HTML mismatch with requested year ${year}`);
                            if (!fallbackSubjects) {
                                fallbackSubjects = subjects;
                                fallbackCandidate = { yearId: candidateYearId, semId: candidateSemId };
                            }
                        }
                    }
                } catch (err) {
                    if (err.message?.includes('session has expired')) {
                        throw err;
                    }
                    console.warn(`[ERP] Candidate yearId ${candidateYearId} / semId ${candidateSemId} failed:`, err);
                }
            }
        }

        if (fallbackSubjects && fallbackSubjects.length > 0) {
            console.log(`[ERP] Using fallback subjects from candidate yearId ${fallbackCandidate.yearId} because no perfect HTML match was found.`);
            this._saveFastPath(year, semester, fallbackCandidate.yearId, fallbackCandidate.semId, csrfToken);
            return fallbackSubjects;
        }

        // Auto-extract registered subjects from user data / dashboard HTML
        if (isHtmlMatchingRequestedYear(dashboardHtml, year)) {
            console.log(`[ERP] Auto-extracting registered subjects for ${year} (${semester} Sem) from user data...`);
            return this.extractRegisteredCoursesFromUserData(dashboardHtml, liveOptions?.html);
        } else {
            throw new Error(`No attendance data found for ${year} ${semester} Semester`);
        }
    },
    // Parse Subjects from Attendance Page
    parseSubjects(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const subjectMap = new Map();

        const getWeight = (ltpsType) => {
            const type = (ltpsType || '').toLowerCase();
            if (type.includes('lecture') || type === 'l') return 100;
            if (type.includes('tutorial') || type === 't') return 100;
            if (type.includes('theory')) return 100;
            if (type.includes('practical') || type === 'p') return 50;
            if (type.includes('skill') || type === 's') return 25;
            return 1;
        };

        const rows = doc.querySelectorAll('table tr');

        rows.forEach(row => {
            if (row.querySelector('th')) return;

            const cols = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
            if (cols.length < 2) return;

            // Detect course code and title
            let code = '';
            let title = '';
            let ltps = 'N/A';
            let rawConducted = 0;
            let rawAttended = 0;

            if (cols.length >= 4) {
                // Standard ERP table structure
                code = cols[1];
                title = cols[2];
                ltps = cols[3] || 'N/A';
            }

            // Fallback for non-standard column index: search for code matching pattern or column
            if (!code || !/^[A-Za-z0-9\s-]{4,15}$/.test(code) || /^\d+$/.test(code) || code.toLowerCase().includes('course') || title.toLowerCase().includes('title')) {
                const codeIdx = cols.findIndex(c => /\b[0-9]{2}[A-Z]{1,5}[0-9]{3,5}[A-Z]?\b/i.test(c));
                if (codeIdx !== -1) {
                    code = cols[codeIdx];
                    title = cols[codeIdx + 1] || cols[codeIdx - 1] || '';
                    if (cols[codeIdx + 2] && ['L', 'T', 'P', 'S', 'Lecture', 'Tutorial', 'Practical', 'Skill'].some(k => cols[codeIdx + 2].includes(k))) {
                        ltps = cols[codeIdx + 2];
                    }
                }
            }

            if (!code || !title || /^\d+$/.test(code) || code.toLowerCase().includes('course') || title.toLowerCase().includes('title')) {
                return;
            }

            // Clean up trailing percentage in title if concatenated by ERP (e.g. "SOA PROGRAMMING...92.06%")
            title = title.replace(/\s*\d+(\.\d+)?%\s*$/, '').trim();

            // Extract numbers for conducted, attended, and TCBR (classes before late registration)
            let rawTcbr = 0;
            if (cols.length >= 12) {
                rawConducted = parseInt(cols[8] || '0', 10) || 0;
                rawAttended = parseInt(cols[9] || '0', 10) || 0;
                rawTcbr = parseInt(cols[11] || '0', 10) || 0;
            } else if (cols.length >= 10) {
                rawConducted = parseInt(cols[8] || '0', 10) || 0;
                rawAttended = parseInt(cols[9] || '0', 10) || 0;
            } else {
                const numbers = cols.map(c => parseInt(c, 10)).filter(n => !isNaN(n) && n >= 0);
                if (numbers.length >= 2) {
                    rawConducted = numbers[numbers.length - 2];
                    rawAttended = numbers[numbers.length - 1];
                }
            }

            // Effective conducted is total conducted minus classes before registration
            const effectiveConducted = Math.max(0, rawConducted - rawTcbr);
            const weight = getWeight(ltps);
            const conducted = effectiveConducted * weight;
            const attended = rawAttended * weight;

            const componentName = ltps !== 'N/A' && ltps !== '' ? ltps : 'Unknown';
            const componentPercent = effectiveConducted > 0 ? ((rawAttended / effectiveConducted) * 100).toFixed(2) : 0;
            const componentData = {
                conducted: effectiveConducted,
                totalConducted: rawConducted,
                tcbr: rawTcbr,
                attended: rawAttended,
                percent: parseFloat(componentPercent)
            };

            if (!subjectMap.has(code)) {
                subjectMap.set(code, {
                    code: code,
                    title: title,
                    ltpsArray: ltps !== 'N/A' && ltps !== '' ? [ltps] : [],
                    components: { [componentName]: componentData },
                    totalConducted: conducted,
                    totalAttended: attended,
                    rawConducted: effectiveConducted,
                    rawAttended: rawAttended
                });
            } else {
                const existing = subjectMap.get(code);
                if (ltps !== 'N/A' && ltps !== '' && !existing.ltpsArray.includes(ltps)) {
                    existing.ltpsArray.push(ltps);
                }

                if (existing.components[componentName]) {
                    existing.components[componentName].conducted += effectiveConducted;
                    existing.components[componentName].attended += rawAttended;
                    existing.components[componentName].percent = parseFloat((existing.components[componentName].conducted > 0 ? (existing.components[componentName].attended / existing.components[componentName].conducted) * 100 : 0).toFixed(2));
                } else {
                    existing.components[componentName] = componentData;
                }

                existing.totalConducted += conducted;
                existing.totalAttended += attended;
                existing.rawConducted += effectiveConducted;
                existing.rawAttended += rawAttended;
            }
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

    extractRegisteredCoursesFromUserData(dashboardHtml, liveHtml) {
        const combinedHtml = (dashboardHtml || '') + ' ' + (liveHtml || '');
        const subjectMap = new Map();

        if (combinedHtml.trim()) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(combinedHtml, 'text/html');

                const elements = doc.querySelectorAll('tr, li, div.card, div.box, div.panel, p, span, td, a');
                elements.forEach(el => {
                    const text = el.textContent.trim();
                    // Match valid KL University course codes like 24CS3101, 23SDCS11, 22EC2101, 24UC1101
                    const match = text.match(/\b([0-9]{2}[A-Z]{1,5}[0-9]{3,5}[A-Z]?)\b/i);
                    if (match && /[A-Za-z]/.test(match[1]) && /\d{3,}/.test(match[1])) {
                        const code = match[1].toUpperCase();
                        let title = text.replace(match[1], '').replace(/[\s\-_:=]+/g, ' ').trim();
                        title = title.split('\n')[0].trim();
                        if (title.length > 50) title = title.slice(0, 50);
                        if (!title || /^\d+$/.test(title)) title = `Course ${code}`;

                        if (!subjectMap.has(code) && !code.toLowerCase().includes('course')) {
                            subjectMap.set(code, {
                                code: code,
                                title: title,
                                ltps: 'L + T + P',
                                components: {
                                    'Lecture': { conducted: 0, attended: 0, percent: 0 },
                                    'Tutorial': { conducted: 0, attended: 0, percent: 0 },
                                    'Practical': { conducted: 0, attended: 0, percent: 0 }
                                },
                                attended: '0/0',
                                percent: 0,
                                isAutoExtracted: true
                            });
                        }
                    }
                });
            } catch (e) {
                console.warn("[ERP] Failed parsing registered courses from user HTML", e);
            }
        }

        if (subjectMap.size > 0) {
            return Array.from(subjectMap.values());
        }

        // Output debug HTML if nothing worked
        throw new Error(`DEBUG_HTML:` + (liveHtml || dashboardHtml || 'No HTML available to debug.'));
    },

    async getCaptchaUrl() {
        const apiBase = getErpBase();
        return `${apiBase}/api/captcha?v=${Math.random().toString(36).substring(7)}`;
    }
};


