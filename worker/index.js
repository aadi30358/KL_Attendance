// KL Attendance - High-Speed Cloudflare Edge Worker API
// 24/7/365 Always-Active • 0ms Cold Start • Global Edge Distribution • Zero Sleep Mode
// Optimized for heavy student traffic and ultra-low latency

const ERP_BASE = 'https://newerp.kluniversity.in';
const FETCH_TIMEOUT_MS = 20000; // 20s safeguard against stalled upstream connections

function getCorsHeaders(request) {
    const reqOrigin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');
    let origin = reqOrigin;
    if (!origin && referer) {
        try {
            origin = new URL(referer).origin;
        } catch {
            origin = null;
        }
    }
    if (!origin || origin === 'null') {
        origin = 'https://klattendancecalculator.web.app';
    }
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, x-erp-cookie, x-csrf-token, Authorization, Pragma, Cache-Control, X-Requested-With, Accept',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'x-set-erp-cookie, set-cookie, Location, Server-Timing',
        'Access-Control-Max-Age': '86400',
    };
}

function parseCookieHeader(rawCookies) {
    const map = new Map();
    if (!rawCookies) return map;
    const items = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    const IGNORED = new Set(['path', 'expires', 'max-age', 'domain', 'samesite', 'secure', 'httponly', 'partitioned', 'priority']);

    for (const item of items) {
        if (!item || typeof item !== 'string') continue;
        const parts = item.split(';');
        for (let part of parts) {
            part = part.trim();
            if (!part) continue;

            if (part.includes(',')) {
                const subParts = part.split(',');
                for (let sub of subParts) {
                    sub = sub.trim();
                    const eqIdx = sub.indexOf('=');
                    if (eqIdx > 0) {
                        const key = sub.slice(0, eqIdx).trim();
                        const val = sub.slice(eqIdx + 1).trim();
                        if (key && !IGNORED.has(key.toLowerCase())) {
                            map.set(key, val);
                        }
                    }
                }
                continue;
            }

            const eqIdx = part.indexOf('=');
            if (eqIdx > 0) {
                const key = part.slice(0, eqIdx).trim();
                const val = part.slice(eqIdx + 1).trim();
                if (key && !IGNORED.has(key.toLowerCase())) {
                    map.set(key, val);
                }
            }
        }
    }
    return map;
}

function serializeCookieMap(map) {
    return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export default {
    async fetch(request, env) {
        const startTime = Date.now();
        const cors = getCorsHeaders(request);

        // Preflight OPTIONS handling (cached for 24h)
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        const url = new URL(request.url);
        const clientCookie = request.headers.get('x-erp-cookie') || request.headers.get('cookie') || '';
        const cookieMap = parseCookieHeader(clientCookie);

        // 0. Health check & 24/7 Keep-Alive endpoints
        if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/api/health' || url.pathname === '/api/ping') {
            const colo = request.cf?.colo || 'EDGE';
            const country = request.cf?.country || 'IN';
            return new Response(JSON.stringify({
                status: 'online',
                service: 'KL Attendance Cloudflare Edge API',
                mode: 'Serverless Edge (V8 Isolate)',
                uptime: '24/7 (Always-Active, Never Sleeps)',
                coldStart: '0ms',
                datacenter: colo,
                country: country,
                timestamp: new Date().toISOString()
            }, null, 2), {
                headers: {
                    ...cors,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0',
                    'Server-Timing': `edge;dur=${Date.now() - startTime}`
                }
            });
        }

        // 1. /api/session-init - High-speed session boot with CSRF & Captcha extraction
        // Always starts a clean, fresh session so previous user's cookies never bleed into new sessions
        if (url.pathname === '/api/session-init') {
            try {
                const sessionMap = new Map();
                const erpResp = await fetch(`${ERP_BASE}/index.php`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const scList = erpResp.headers.getSetCookie ? erpResp.headers.getSetCookie() : [erpResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(scList).forEach((v, k) => sessionMap.set(k, v));
                let allCookies = serializeCookieMap(sessionMap);

                const html = await erpResp.text();
                const csrfMatch = html.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                  html.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                  html.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                  html.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                const csrfToken = csrfMatch ? csrfMatch[1] : '';

                const capMatch = html.match(/src=["']([^"']*(?:site(?:%2F|\/)captcha)[^"']*)["']/i) ||
                                 html.match(/id=["'](?:loginFormCaptcha-image|loginform-verifycode-image)["'][^>]+src=["']([^"']+)["']/i) ||
                                 html.match(/src=["']([^"']+)["'][^>]+id=["'](?:loginFormCaptcha-image|loginform-verifycode-image)["']/i);
                let captchaDataUrl = '';

                if (capMatch) {
                    let capPath = capMatch[1].replace(/&amp;/g, '&');
                    const capUrl = capPath.startsWith('http') ? capPath : `${ERP_BASE}${capPath.startsWith('/') ? '' : '/'}${capPath}`;
                    const capResp = await fetch(capUrl, {
                        headers: {
                            'Cookie': allCookies,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': `${ERP_BASE}/index.php`
                        },
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });
                    const capScList = capResp.headers.getSetCookie ? capResp.headers.getSetCookie() : [capResp.headers.get('set-cookie')].filter(Boolean);
                    parseCookieHeader(capScList).forEach((v, k) => sessionMap.set(k, v));
                    allCookies = serializeCookieMap(sessionMap);

                    if (capResp.ok) {
                        const capBuf = await capResp.arrayBuffer();
                        const base64 = arrayBufferToBase64(capBuf);
                        captchaDataUrl = `data:image/png;base64,${base64}`;
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    csrfToken,
                    captchaUrl: captchaDataUrl,
                    dataUrl: captchaDataUrl,
                    captchaDataUrl,
                    cookies: allCookies
                }), {
                    headers: {
                        ...cors,
                        'Content-Type': 'application/json',
                        'x-set-erp-cookie': allCookies,
                        'Server-Timing': `edge;dur=${Date.now() - startTime}`
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.name === 'TimeoutError' ? 'KL ERP server took too long to respond. Please refresh.' : err.message
                }), {
                    status: 504,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 2. /api/refresh-captcha - Ultra-Fast Captcha Renewal (< 600ms)
        if (url.pathname === '/api/refresh-captcha') {
            try {
                let currentCookies = serializeCookieMap(cookieMap);
                const reqCsrf = request.headers.get('x-csrf-token') || '';
                let freshCsrf = reqCsrf;
                let targetImg = '';

                // If PHPSESSID exists, refresh captcha directly in 1 fast hop
                if (cookieMap.size > 0 && cookieMap.has('PHPSESSID')) {
                    const refResp = await fetch(`${ERP_BASE}/index.php?r=site%2Fcaptcha&refresh=1`, {
                        headers: {
                            'Cookie': currentCookies,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': `${ERP_BASE}/index.php`
                        },
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });

                    const scList = refResp.headers.getSetCookie ? refResp.headers.getSetCookie() : [refResp.headers.get('set-cookie')].filter(Boolean);
                    parseCookieHeader(scList).forEach((v, k) => cookieMap.set(k, v));
                    currentCookies = serializeCookieMap(cookieMap);

                    const data = await refResp.json().catch(() => null);
                    if (data && data.url) {
                        targetImg = data.url;
                    }
                }

                // If session was empty or refresh didn't return URL, fetch index.php directly (1 hop)
                if (!targetImg) {
                    cookieMap.clear();
                    const initResp = await fetch(`${ERP_BASE}/index.php`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        },
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });
                    const initScList = initResp.headers.getSetCookie ? initResp.headers.getSetCookie() : [initResp.headers.get('set-cookie')].filter(Boolean);
                    parseCookieHeader(initScList).forEach((v, k) => cookieMap.set(k, v));
                    currentCookies = serializeCookieMap(cookieMap);

                    const initHtml = await initResp.text();
                    const cm = initHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                               initHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                               initHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                               initHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                    if (cm) freshCsrf = cm[1];

                    const im = initHtml.match(/id="loginFormCaptcha-image"\s+src="([^"]+)"/i) ||
                               initHtml.match(/src="([^"]+)"\s+id="loginFormCaptcha-image"/i);
                    targetImg = im ? im[1].replace(/&amp;/g, '&') : '/index.php?r=site%2Fcaptcha';
                }

                const imgUrl = targetImg.startsWith('http') ? targetImg : `${ERP_BASE}${targetImg.startsWith('/') ? '' : '/'}${targetImg}`;
                const imgResp = await fetch(imgUrl, {
                    headers: {
                        'Cookie': currentCookies,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': `${ERP_BASE}/index.php`
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });
                const imgScList = imgResp.headers.getSetCookie ? imgResp.headers.getSetCookie() : [imgResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(imgScList).forEach((v, k) => cookieMap.set(k, v));
                const allCookies = serializeCookieMap(cookieMap);

                // If CSRF is still missing, fetch index.php with current cookies to scrape valid CSRF
                if (!freshCsrf && allCookies) {
                    try {
                        const initResp = await fetch(`${ERP_BASE}/index.php`, {
                            headers: {
                                'Cookie': allCookies,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'Referer': `${ERP_BASE}/`
                            },
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });
                        const initHtml = await initResp.text();
                        const cm = initHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                   initHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                   initHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                   initHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                        if (cm) freshCsrf = cm[1];
                    } catch {
                        // ignore
                    }
                }

                let captchaDataUrl = '';
                if (imgResp.ok) {
                    const imgBuf = await imgResp.arrayBuffer();
                    const base64 = arrayBufferToBase64(imgBuf);
                    captchaDataUrl = `data:image/png;base64,${base64}`;
                }

                return new Response(JSON.stringify({
                    success: true,
                    captchaUrl: captchaDataUrl,
                    dataUrl: captchaDataUrl,
                    captchaDataUrl,
                    cookies: allCookies,
                    csrfToken: freshCsrf
                }), {
                    headers: {
                        ...cors,
                        'Content-Type': 'application/json',
                        'x-set-erp-cookie': allCookies,
                        'Server-Timing': `edge;dur=${Date.now() - startTime}`
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.name === 'TimeoutError' ? 'Captcha refresh timed out. Please try again.' : err.message
                }), {
                    status: 504,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 3. /api/fast-login - High-Speed Authentication & Verification (< 800ms execution)
        if (url.pathname === '/api/fast-login') {
            try {
                const body = await request.json().catch(() => ({}));
                const { username, password, captcha, csrfToken } = body;

                if (!username || !password || !captcha) {
                    return new Response(JSON.stringify({ success: false, error: 'Student ID, password, and captcha are all required.' }), {
                        status: 400,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                let effectiveCsrf = csrfToken;
                let clientCookies = serializeCookieMap(cookieMap);

                // If CSRF is missing, quickly grab it using current cookies
                if (!effectiveCsrf && clientCookies) {
                    try {
                        const initResp = await fetch(`${ERP_BASE}/index.php`, {
                            headers: {
                                'Cookie': clientCookies,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'Referer': `${ERP_BASE}/`
                            },
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });
                        const scList = initResp.headers.getSetCookie ? initResp.headers.getSetCookie() : [initResp.headers.get('set-cookie')].filter(Boolean);
                        parseCookieHeader(scList).forEach((v, k) => cookieMap.set(k, v));
                        clientCookies = serializeCookieMap(cookieMap);
                        const initHtml = await initResp.text();
                        const m = initHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                  initHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                  initHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                  initHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                        if (m) effectiveCsrf = m[1];
                    } catch (e) {
                        console.warn("[Worker] Fast-login CSRF recovery:", e.message);
                    }
                }

                const formData = new URLSearchParams();
                if (effectiveCsrf) formData.append('_csrf', effectiveCsrf);
                formData.append('LoginForm[username]', String(username).trim());
                formData.append('LoginForm[password]', String(password));
                formData.append('LoginForm[rememberMe]', '0');
                formData.append('LoginForm[captcha]', String(captcha).trim());
                formData.append('LoginForm[verifyCode]', String(captcha).trim());
                formData.append('LoginForm[qr_code]', '');
                formData.append('login-button', '');

                const loginResp = await fetch(`${ERP_BASE}/index.php?r=site%2Flogin`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': clientCookies,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Origin': ERP_BASE,
                        'Referer': `${ERP_BASE}/index.php?r=site%2Flogin`,
                        'x-csrf-token': effectiveCsrf || ''
                    },
                    body: formData.toString(),
                    redirect: 'manual',
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const scList = loginResp.headers.getSetCookie ? loginResp.headers.getSetCookie() : [loginResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(scList).forEach((v, k) => cookieMap.set(k, v));
                let allCookies = serializeCookieMap(cookieMap);

                // Authentication redirect (ERP returns 302 on login attempt)
                if (loginResp.status === 302) {
                    const nextLoc = loginResp.headers.get('location') || loginResp.headers.get('x-redirect') || '/index.php';

                    // If redirect points back to login, fail immediately without slow extra round trips
                    if (nextLoc.includes('site%2Flogin') || nextLoc.includes('site/login')) {
                        return new Response(JSON.stringify({
                            success: false,
                            error: 'Incorrect Student ID, Password, or Captcha. Please verify your credentials.',
                            cookies: allCookies
                        }), {
                            status: 401,
                            headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                        });
                    }

                    // Follow up to 5 redirect hops manually with cookies attached to reach the authenticated dashboard
                    let currentTarget = nextLoc.startsWith('http')
                        ? nextLoc.replace(/^http:/i, 'https:')
                        : `${ERP_BASE}${nextLoc.startsWith('/') ? '' : '/'}${nextLoc}`;

                    let finalResp = null;
                    for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
                        allCookies = serializeCookieMap(cookieMap);
                        finalResp = await fetch(currentTarget, {
                            method: 'GET',
                            headers: {
                                'Cookie': allCookies,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': `${ERP_BASE}/`
                            },
                            redirect: 'manual',
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });

                        const hopScList = finalResp.headers.getSetCookie ? finalResp.headers.getSetCookie() : [finalResp.headers.get('set-cookie')].filter(Boolean);
                        parseCookieHeader(hopScList).forEach((v, k) => cookieMap.set(k, v));

                        if (finalResp.status === 302 || finalResp.status === 301) {
                            const hopLoc = finalResp.headers.get('location');
                            if (hopLoc) {
                                currentTarget = hopLoc.startsWith('http')
                                    ? hopLoc.replace(/^http:/i, 'https:')
                                    : `${ERP_BASE}${hopLoc.startsWith('/') ? '' : '/'}${hopLoc}`;
                                continue;
                            }
                        }
                        break;
                    }

                    allCookies = serializeCookieMap(cookieMap);
                    let dashHtml = finalResp ? await finalResp.text() : '';

                    // Extract post-login CSRF token directly from dashboard HTML
                    const postCsrfMatch = dashHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                          dashHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                          dashHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i);
                    const postLoginCsrf = postCsrfMatch ? postCsrfMatch[1] : (effectiveCsrf || '');

                    return new Response(JSON.stringify({
                        success: true,
                        verified: true,
                        html: dashHtml,
                        cookies: allCookies,
                        csrfToken: postLoginCsrf,
                        latencyMs: Date.now() - startTime
                    }), {
                        headers: {
                            ...cors,
                            'Content-Type': 'application/json',
                            'x-set-erp-cookie': allCookies,
                            'Server-Timing': `edge;dur=${Date.now() - startTime}`
                        }
                    });
                }

                // If ERP returned 200 without redirect, inspect body for validation error
                const respText = await loginResp.text();
                const isIncorrectUser = respText.includes('Incorrect username or password') ||
                                       respText.includes('field-loginFormPasswordID required has-error') ||
                                       respText.includes('field-loginform-password has-error') ||
                                       respText.includes('floating-label field-loginFormPasswordID required has-error') ||
                                       respText.includes('Enter Password') ||
                                       respText.includes('Enter Username');

                const isIncorrectCap = !isIncorrectUser && (
                                       respText.includes('The verification code is incorrect') ||
                                       respText.includes('Verification code is incorrect') ||
                                       respText.includes('field-loginFormCaptcha has-error') ||
                                       respText.includes('field-loginform-captcha has-error') ||
                                       respText.includes('Verification code cannot be blank')
                );

                let errorMsg = 'Incorrect Student ID, Password, or Captcha. Please try again.';
                if (isIncorrectUser) {
                    errorMsg = 'Incorrect Student ID or Password. Please check your password.';
                } else if (isIncorrectCap) {
                    errorMsg = 'The verification code is incorrect. Please check the captcha.';
                } else if (respText.includes('Unable to verify your data submission')) {
                    errorMsg = 'Session expired. Please enter the new captcha.';
                }

                return new Response(JSON.stringify({
                    success: false,
                    error: errorMsg,
                    message: errorMsg,
                    isCaptchaError: !isIncorrectUser,
                    isPasswordError: isIncorrectUser,
                    cookies: allCookies
                }), {
                    status: 401,
                    headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.name === 'TimeoutError' ? 'Login request timed out. Please retry.' : err.message
                }), {
                    status: 504,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 4. /api/fast-attendance - Ultra-Low Latency Attendance Discovery (< 800ms execution)
        if (url.pathname === '/api/fast-attendance') {
            try {
                const body = await request.json().catch(() => ({}));
                const { yearId, semId, csrfToken, year, semester } = body;
                let clientCookie = request.headers.get('x-erp-cookie') || request.headers.get('cookie') || '';

                if (!clientCookie) {
                    return new Response(JSON.stringify({
                        success: false,
                        sessionExpired: true,
                        error: 'Session cookie missing. Please log in.'
                    }), {
                        status: 401,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const cookieMap = parseCookieHeader(clientCookie);
                let currentCookieStr = serializeCookieMap(cookieMap);
                let currentCsrf = csrfToken || '';

                let resolvedYearId = String(yearId || '').trim();
                let resolvedSemId = String(semId || '').trim();
                let selectedYearText = '';
                let selectedSemText = '';
                const availableYears = [];
                const availableSemesters = [];

                // Discover dynamic session options and valid CSRF
                try {
                    let inputResp = await fetch(`${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                        method: 'GET',
                        headers: {
                            'Cookie': currentCookieStr,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'Referer': `${ERP_BASE}/index.php`,
                            'Cache-Control': 'no-cache'
                        },
                        redirect: 'manual',
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });

                    if (inputResp.status === 404) {
                        inputResp = await fetch(`${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex`, {
                            method: 'GET',
                            headers: {
                                'Cookie': currentCookieStr,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'Referer': `${ERP_BASE}/index.php`,
                                'Cache-Control': 'no-cache'
                            },
                            redirect: 'manual',
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });
                    }

                    const inScList = inputResp.headers.getSetCookie ? inputResp.headers.getSetCookie() : [inputResp.headers.get('set-cookie')].filter(Boolean);
                    parseCookieHeader(inScList).forEach((v, k) => cookieMap.set(k, v));
                    currentCookieStr = serializeCookieMap(cookieMap);

                    if (inputResp.status >= 300 && inputResp.status < 400) {
                        const loc = inputResp.headers.get('location') || inputResp.headers.get('x-redirect') || '';
                        if (loc.toLowerCase().includes('login')) {
                            return new Response(JSON.stringify({
                                success: false,
                                sessionExpired: true,
                                error: 'Your session has expired. Please log out and sign in again.'
                            }), {
                                status: 401,
                                headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': currentCookieStr }
                            });
                        }
                    }

                    if (inputResp.ok) {
                        const inputHtml = await inputResp.text();
                        if (inputHtml.includes('id="login-form"') || inputHtml.includes('loginFormUserNameID')) {
                            return new Response(JSON.stringify({
                                success: false,
                                sessionExpired: true,
                                error: 'Your session has expired. Please log out and sign in again.'
                            }), {
                                status: 401,
                                headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': currentCookieStr }
                            });
                        }

                        const cm = inputHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                   inputHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                   inputHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i);
                        if (cm && cm[1]) currentCsrf = cm[1];

                        const ym = inputHtml.match(/<select[^>]*(?:name=["'](?:DynamicModel\[academicyear\]|academicyear)["']|id=["'](?:dynamicmodel-academicyear|academicyear)["'])[^>]*>([\s\S]*?)<\/select>/i);
                        if (ym && ym[1]) {
                            const optRe = /<option\s+([^>]*)>([^<]*)<\/option>/gi;
                            let m;
                            while ((m = optRe.exec(ym[1])) !== null) {
                                const attrs = m[1];
                                const text = m[2].trim();
                                const valMatch = attrs.match(/value=["']([^"']*)["']/i);
                                const val = valMatch ? valMatch[1].trim() : '';
                                const isSel = /selected/i.test(attrs);
                                if (val) {
                                    availableYears.push({ val, text, isSelected: isSel });
                                    if (isSel) selectedYearText = text;
                                }
                            }
                        }

                        const sm = inputHtml.match(/<select[^>]*(?:name=["'](?:DynamicModel\[semesterid\]|semesterid)["']|id=["'](?:dynamicmodel-semesterid|semesterid)["'])[^>]*>([\s\S]*?)<\/select>/i);
                        if (sm && sm[1]) {
                            const optRe = /<option\s+([^>]*)>([^<]*)<\/option>/gi;
                            let m;
                            while ((m = optRe.exec(sm[1])) !== null) {
                                const attrs = m[1];
                                const text = m[2].trim();
                                const valMatch = attrs.match(/value=["']([^"']*)["']/i);
                                const val = valMatch ? valMatch[1].trim() : '';
                                const isSel = /selected/i.test(attrs);
                                if (val) {
                                    availableSemesters.push({ val, text, isSelected: isSel });
                                    if (isSel) selectedSemText = text;
                                }
                            }
                        }

                        const reqYearStr = (year || '').toString().trim();
                        const reqYearId = (yearId || '').toString().trim();
                        const cleanYearStr = reqYearStr.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
                        const legacyToYear = { '18': '2026', '17': '2025', '16': '2024', '15': '2023', '14': '2022' };
                        const targetYearStart = legacyToYear[reqYearStr] || 
                            (cleanYearStr.includes('-') ? cleanYearStr.split('-')[0].trim() : (cleanYearStr.match(/\b(20\d\d)\b/)?.[1] || ''));

                        let matchedYear = null;
                        if (availableYears.length > 0) {
                            // 1. Direct ERP DB value match first (e.g. '29')
                            const directId = (parseInt(reqYearStr, 10) > 20) ? reqYearStr : reqYearId;
                            if (directId) {
                                matchedYear = availableYears.find(y => y.val === directId);
                            }

                            // 2. Exact or substring text match with clean text (e.g. "2026-2027")
                            if (!matchedYear && cleanYearStr) {
                                matchedYear = availableYears.find(y => {
                                    const yt = y.text.toLowerCase().trim();
                                    return yt === cleanYearStr || yt.includes(cleanYearStr) || cleanYearStr.includes(yt);
                                });
                            }

                            // 3. Match starting year (e.g. "2026")
                            if (!matchedYear && targetYearStart) {
                                matchedYear = availableYears.find(y => y.text.includes(targetYearStart));
                            }

                            // 4. Fallback to direct val match
                            if (!matchedYear && (reqYearId || reqYearStr)) {
                                matchedYear = availableYears.find(y => y.val === reqYearId || y.val === reqYearStr);
                            }

                            // 5. If still no match in availableYears, fall back to ERP's enrolled selected option or first option
                            if (!matchedYear && availableYears.length > 0) {
                                matchedYear = availableYears.find(y => y.isSelected) || availableYears[0];
                            }
                        }
                        if (matchedYear) {
                            resolvedYearId = matchedYear.val;
                            selectedYearText = matchedYear.text;
                        }

                        const reqSemStr = (semester || '').toString().trim().toLowerCase();
                        const reqSemId = (semId || '').toString().trim();
                        const isReqSummer = reqSemStr.includes('summer') || reqSemId === '3';
                        const isReqTerm3 = (reqSemStr.includes('term') || reqSemStr.includes('tri') || reqSemId === '4') && !isReqSummer;
                        let matchedSem = null;
                        if (availableSemesters.length > 0) {
                            if (isReqSummer) {
                                matchedSem = availableSemesters.find(s => {
                                    const sText = (s.text || '').toLowerCase();
                                    const sVal = String(s.val || s.value || '').trim();
                                    return sVal === '3' || sText.includes('summer');
                                });
                            } else if (isReqTerm3) {
                                matchedSem = availableSemesters.find(s => {
                                    const sText = (s.text || '').toLowerCase();
                                    const sVal = String(s.val || s.value || '').trim();
                                    return (sVal === '4' || sText.includes('tri') || sText.includes('term 3') || sText.includes('term-3') || (sText.includes('term') && !sText.includes('summer'))) && !sText.includes('summer') && sVal !== '3';
                                });
                            } else if (reqSemStr.includes('even') || reqSemId === '2') {
                                matchedSem = availableSemesters.find(s => {
                                    const sText = (s.text || '').toLowerCase();
                                    const sVal = String(s.val || s.value || '').trim();
                                    return sVal === '2' || sText.includes('even');
                                });
                            } else if (reqSemStr.includes('odd') || reqSemId === '1') {
                                matchedSem = availableSemesters.find(s => {
                                    const sText = (s.text || '').toLowerCase();
                                    const sVal = String(s.val || s.value || '').trim();
                                    return sVal === '1' || sText.includes('odd');
                                });
                            } else if (reqSemStr) {
                                matchedSem = availableSemesters.find(s => s.text.toLowerCase() === reqSemStr || s.text.toLowerCase().includes(reqSemStr));
                            }
                            if (!matchedSem && reqSemId) {
                                matchedSem = availableSemesters.find(s => (s.val || s.value) === reqSemId);
                            }
                        }
                        if (matchedSem) {
                            resolvedSemId = matchedSem.val;
                            selectedSemText = matchedSem.text;
                        }
                    }
                } catch (e) {
                    console.warn("[Worker] Fast-attendance pre-priming notice:", e.message);
                }

                // Helper to resolve all possible candidate ERP IDs for the requested academic year
                const getCandidateYearIds = (yVal, yIdVal, mVal) => {
                    const list = [];
                    if (mVal) list.push(String(mVal).trim());
                    if (yIdVal) list.push(String(yIdVal).trim());
                    const str = String(yVal || '').trim();
                    const cleanStr = str.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
                    let firstYear = parseInt(str.split('-')[0], 10);
                    if (!isNaN(firstYear) && firstYear < 100) {
                        if (firstYear === 29 || firstYear === 18) firstYear = 2026;
                        else if (firstYear === 28 || firstYear === 17) firstYear = 2025;
                        else if (firstYear === 27 || firstYear === 16) firstYear = 2024;
                        else if (firstYear === 26 || firstYear === 15) firstYear = 2023;
                        else if (firstYear === 25 || firstYear === 14) firstYear = 2022;
                        else if (firstYear === 24 || firstYear === 13) firstYear = 2021;
                        else if (firstYear === 23 || firstYear === 10) firstYear = 2020;
                        else firstYear += 2000;
                    }

                    if (firstYear === 2026 || str === '29' || str === '18' || cleanStr.includes('26')) list.push('29', '18', '2026-2027', '2026-27');
                    else if (firstYear === 2025 || str === '28' || str === '17' || str === '19' || cleanStr.includes('25')) list.push('28', '17', '19', '2025-2026', '2025-26');
                    else if (firstYear === 2024 || str === '27' || str === '16' || cleanStr.includes('24')) list.push('27', '16', '2024-2025', '2024-25');
                    else if (firstYear === 2023 || str === '26' || str === '15' || cleanStr.includes('23')) list.push('26', '15', '2023-2024', '2023-24');
                    else if (firstYear === 2022 || str === '25' || str === '14' || cleanStr.includes('22')) list.push('25', '14', '2022-2023', '2022-23');
                    else if (firstYear === 2021 || str === '24' || str === '13' || cleanStr.includes('21')) list.push('24', '13', '2021-2022', '2021-22');
                    else if (firstYear === 2020 || str === '23' || str === '10' || cleanStr.includes('20')) list.push('23', '10', '2020-2021', '2020-21');
                    else if (firstYear === 2019 || str === '22' || str === '9' || cleanStr.includes('19')) list.push('22', '9');
                    if (str && !list.includes(str)) list.push(str);

                    return Array.from(new Set(list.filter(Boolean)));
                };

                const erpSelectedYear = availableYears.find(y => y.isSelected)?.val;
                const candidateYears = Array.from(new Set([
                    resolvedYearId,
                    ...getCandidateYearIds(year, yearId, resolvedYearId),
                    (!resolvedYearId ? erpSelectedYear : null)
                ].filter(Boolean)));
                if (candidateYears.length === 0) {
                    candidateYears.push(resolvedYearId || '28');
                }

                if (!resolvedSemId) {
                    const sStr = String(semester || semId || '').trim().toLowerCase();
                    resolvedSemId = sStr.includes('summer') || sStr === '3' ? '3' 
                        : sStr.includes('term') || sStr.includes('tri') || sStr === '4' ? '4' 
                        : sStr.includes('even') || sStr === '2' ? '2' 
                        : '1';
                }

                let finalHtml = '';
                let finalResp = null;
                let usedYearId = resolvedYearId;
                let foundValidCourses = false;

                const postHeaders = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Origin': ERP_BASE,
                    'Referer': `${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`,
                    'Cookie': currentCookieStr
                };
                if (currentCsrf) postHeaders['x-csrf-token'] = currentCsrf;

                for (const testYearId of candidateYears) {
                    const formData = new URLSearchParams();
                    formData.append('DynamicModel[academicyear]', String(testYearId));
                    formData.append('DynamicModel[semesterid]', String(resolvedSemId));
                    formData.append('DynamicModel[academic_year]', String(testYearId));
                    formData.append('DynamicModel[semester_id]', String(resolvedSemId));
                    formData.append('academicyear', String(testYearId));
                    formData.append('semesterid', String(resolvedSemId));
                    if (currentCsrf) {
                        formData.append('_csrf', currentCsrf);
                        formData.append('_csrf-frontend', currentCsrf);
                    }

                    // Query courselist directly
                    postHeaders['Cookie'] = currentCookieStr;
                    let crResp = await fetch(`${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                        method: 'POST',
                        headers: postHeaders,
                        body: formData.toString(),
                        redirect: 'manual',
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });

                    const crScList = crResp.headers.getSetCookie ? crResp.headers.getSetCookie() : [crResp.headers.get('set-cookie')].filter(Boolean);
                    parseCookieHeader(crScList).forEach((v, k) => cookieMap.set(k, v));
                    currentCookieStr = serializeCookieMap(cookieMap);

                    if (crResp.status >= 300 && crResp.status < 400) {
                        const loc = crResp.headers.get('location') || crResp.headers.get('x-redirect') || '';
                        if (!loc.toLowerCase().includes('login') && loc) {
                            const nextUrl = loc.startsWith('http') ? loc : `${ERP_BASE}${loc.startsWith('/') ? '' : '/'}${loc}`;
                            crResp = await fetch(nextUrl, {
                                headers: postHeaders,
                                redirect: 'manual',
                                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                            });
                            const followSc = crResp.headers.getSetCookie ? crResp.headers.getSetCookie() : [crResp.headers.get('set-cookie')].filter(Boolean);
                            parseCookieHeader(followSc).forEach((v, k) => cookieMap.set(k, v));
                            currentCookieStr = serializeCookieMap(cookieMap);
                        }
                    }

                    const crHtml = await crResp.text();
                    const isLoginForm = crHtml.includes('id="login-form"') || crHtml.includes('loginFormUserNameID');
                    if (isLoginForm) {
                        finalResp = crResp;
                        finalHtml = crHtml;
                        break;
                    }

                    const hasEmptyResult = crHtml.includes('class="empty"') || crHtml.includes('No results found');
                    const hasTable = crHtml.includes('<table') || crHtml.includes('grid-view') || crHtml.includes('Course Code') || crHtml.includes('Course Title') || crHtml.includes('L-T-P-S');
                    const hasCourseCode = /\b\d{2}[A-Za-z]{2,5}\d+/i.test(crHtml);

                    if (hasTable && !hasEmptyResult && (hasCourseCode || crHtml.includes('Attendance'))) {
                        // Found valid courselist table with real courses for this candidate year ID!
                        finalResp = crResp;
                        finalHtml = crHtml;
                        usedYearId = testYearId;
                        foundValidCourses = true;
                        break;
                    }

                    // Only update finalHtml if no valid courses have been captured yet
                    if (!foundValidCourses) {
                        finalResp = crResp;
                        finalHtml = crHtml;
                        usedYearId = testYearId;
                    }
                }

                const crHtml = finalHtml;
                const crResp = finalResp || { ok: false, status: 500 };
                const isLoginForm = crHtml.includes('id="login-form"') || crHtml.includes('loginFormUserNameID');
                const hasTable = crHtml.includes('<table') || crHtml.includes('grid-view') || crHtml.includes('Course Code') || crHtml.includes('Course Title') || crHtml.includes('L-T-P-S');
                const hasEmpty = crHtml.includes('class="empty"') || crHtml.includes('No results found');

                return new Response(JSON.stringify({
                    success: (crResp.ok || hasTable || hasEmpty) && !isLoginForm,
                    status: crResp.status,
                    latencyMs: Date.now() - startTime,
                    html: crHtml,
                    csrfToken: currentCsrf,
                    resolvedYearId: usedYearId,
                    resolvedSemId,
                    selectedYearText,
                    selectedSemText,
                    availableYears,
                    availableSemesters,
                    sessionExpired: isLoginForm,
                    empty: hasEmpty || !hasTable
                }), {
                    headers: {
                        ...cors,
                        'Content-Type': 'application/json',
                        'x-set-erp-cookie': currentCookieStr,
                        'Server-Timing': `edge;dur=${Date.now() - startTime}`
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.name === 'TimeoutError' ? 'Attendance query timed out. Please retry.' : err.message
                }), {
                    status: 504,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 5. Ultra-Fast Reverse Proxy for /index.php (Course lists, Semesters, Attendance Register)
        if (url.pathname.startsWith('/index.php')) {
            try {
                const targetUrl = `${ERP_BASE}${url.pathname}${url.search}`;
                const reqHeaders = new Headers(request.headers);
                reqHeaders.set('Host', 'newerp.kluniversity.in');
                reqHeaders.set('Origin', ERP_BASE);
                const isCourseQuery = url.pathname.includes('courselist') || url.search.includes('courselist');
                const refererHeader = isCourseQuery
                    ? `${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`
                    : `${ERP_BASE}/index.php`;
                reqHeaders.set('Referer', refererHeader);
                reqHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

                const erpCookie = request.headers.get('x-erp-cookie');
                if (erpCookie) {
                    const merged = parseCookieHeader([request.headers.get('cookie') || '', erpCookie]);
                    reqHeaders.set('Cookie', serializeCookieMap(merged));
                }

                const erpRes = await fetch(targetUrl, {
                    method: request.method,
                    headers: reqHeaders,
                    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
                    redirect: 'manual',
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const resHeaders = new Headers(erpRes.headers);
                Object.entries(cors).forEach(([k, v]) => resHeaders.set(k, v));

                const scList = erpRes.headers.getSetCookie ? erpRes.headers.getSetCookie() : [erpRes.headers.get('set-cookie')].filter(Boolean);
                if (scList.length > 0) {
                    const scMap = parseCookieHeader(scList);
                    resHeaders.set('x-set-erp-cookie', serializeCookieMap(scMap));
                }
                const locHeader = erpRes.headers.get('location');
                if (locHeader) {
                    resHeaders.set('Location', locHeader.replace(/^https?:\/\/newerp\.kluniversity\.in/i, ''));
                }
                resHeaders.set('Server-Timing', `edge;dur=${Date.now() - startTime}`);

                return new Response(erpRes.body, {
                    status: erpRes.status,
                    headers: resHeaders
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.name === 'TimeoutError' ? 'Request to ERP timed out. Please try again.' : err.message
                }), {
                    status: 504,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 5.5. /api/fetch_timetable - High-Speed Timetable extraction (Authentic KLU individualstudenttimetableget)
        if (url.pathname === '/api/fetch_timetable' || url.pathname === '/api/fetch-timetable' || url.pathname === '/fetch-timetable') {
            if (request.method !== 'POST') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }

            try {
                const body = await request.json().catch(() => ({}));
                const { yearId, semId, academic_year_code, semester_id } = body || {};
                const currentCookieStr = serializeCookieMap(cookieMap);

                if (currentCookieStr) {
                    const reqYear = String(yearId || academic_year_code || '');
                    const reqSem = String(semId || semester_id || '');

                    const curYear = new Date().getFullYear();
                    const yearMatch = reqYear.match(/^(\d{4})/);
                    const firstYear = yearMatch ? parseInt(yearMatch[1], 10) : curYear;

                    let yearCandidates = [];
                    if (firstYear >= 2026 || reqYear === '29' || reqYear === '18') {
                        const offset = Math.max(0, firstYear - 2026);
                        yearCandidates = [String(29 + offset), String(18 + offset), '22'];
                    } else if (firstYear === 2025 || reqYear === '28' || reqYear === '17' || reqYear === '19') {
                        yearCandidates = ['19', '28', '17', '18'];
                    } else if (firstYear === 2024 || reqYear === '27' || reqYear === '16') {
                        yearCandidates = ['16', '27', '17'];
                    } else if (firstYear === 2023 || reqYear === '26' || reqYear === '15') {
                        yearCandidates = ['15', '26'];
                    } else {
                        yearCandidates = ['29', '18', '19', '28', '16', '27', '22'];
                    }

                    let semVal = '1';
                    const sLower = reqSem.toLowerCase();
                    if (sLower.includes('summer') || sLower === '3') semVal = '3';
                    else if (sLower.includes('even') || sLower === '2') semVal = '2';
                    else if (sLower.includes('term') || sLower.includes('tri') || sLower === '4') semVal = '4';
                    else semVal = '1';

                    const candidateUrls = [];
                    for (const y of yearCandidates) {
                        candidateUrls.push(`${ERP_BASE}/index.php?r=timetables%2Funiversitymasteracademictimetableview%2Findividualstudenttimetableget&UniversityMasterAcademicTimetableView%5Bacademicyear%5D=${y}&UniversityMasterAcademicTimetableView%5Bsemesterid%5D=${semVal}`);
                        candidateUrls.push(`${ERP_BASE}/index.php?r=timetables%2Funiversitymasteracademictimetableview%2Findividualstudenttimetableget&UniversityMasterAcademicTimetableView[academicyear]=${y}&UniversityMasterAcademicTimetableView[semesterid]=${semVal}`);
                        candidateUrls.push(`${ERP_BASE}/index.php?r=timetables%2Funiversitymasteracademictimetableview%2Findividualstudenttimetableget&academic_year_code=${y}&semester_id=${semVal}`);
                        candidateUrls.push(`${ERP_BASE}/index.php?r=timetables%2Funiversitymasteracademictimetableview%2Findividualstudenttimetableget&academicyear=${y}&semesterid=${semVal}`);
                    }

                    for (const candUrl of candidateUrls) {
                        try {
                            const erpResp = await fetch(candUrl, {
                                method: 'GET',
                                headers: {
                                    'Cookie': currentCookieStr,
                                    'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    'Referer': `${ERP_BASE}/index.php`,
                                    'Cache-Control': 'no-cache'
                                },
                                redirect: 'manual',
                                signal: AbortSignal.timeout(6000)
                            });

                            if (erpResp.ok) {
                                const html = await erpResp.text();
                                if (html && !html.includes('id="login-form"') && html.includes('<table') && (html.includes('Mon') || html.includes('Monday') || html.includes('Tue'))) {
                                    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
                                    let timetableData = null;
                                    if (tableMatch) {
                                        const theadMatch = tableMatch[1].match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
                                        let headers = [];
                                        if (theadMatch) {
                                            const rawHeaders = Array.from(theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
                                            headers = rawHeaders.slice(1);
                                        }
                                        if (headers.length === 0) {
                                            headers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];
                                        }

                                        const tbodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i) || tableMatch;
                                        const rowMatches = Array.from(tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
                                        timetableData = {};

                                        for (const rm of rowMatches) {
                                            const cellMatches = Array.from(rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
                                            if (cellMatches.length > 1) {
                                                const dayName = cellMatches[0];
                                                const slots = cellMatches.slice(1);
                                                const daySlots = {};
                                                headers.forEach((h, idx) => {
                                                    daySlots[h] = slots[idx] || '-';
                                                });
                                                timetableData[dayName] = daySlots;
                                            }
                                        }
                                    }

                                    return new Response(JSON.stringify({
                                        success: true,
                                        source: 'erp_live',
                                        timetable: timetableData,
                                        html: html,
                                        message: "Fetched timetable directly from ERP"
                                    }), {
                                        headers: { ...cors, 'Content-Type': 'application/json' }
                                    });
                                }
                            }
                        } catch {
                            // continue candidate search
                        }
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    source: 'erp_synced',
                    message: "Using ERP registered courses for timetable",
                    timetable: null
                }), {
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.message
                }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 5.6. /api/fetch-cgpa - Authentic KLU Semester Results & CGPA Extraction
        if (url.pathname === '/api/fetch-cgpa' || url.pathname === '/api/fetch_cgpa' || url.pathname === '/fetch-cgpa') {
            try {
                const currentCookieStr = serializeCookieMap(cookieMap);
                if (!currentCookieStr) {
                    return new Response(JSON.stringify({ success: false, message: "No active ERP session. Please log in with your credentials." }), {
                        status: 401,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const cgpaUrl = `${ERP_BASE}/index.php?r=studentinfo%2Fstudentendexamresult%2Fsearchgetmycgpa`;
                const erpResp = await fetch(cgpaUrl, {
                    method: 'GET',
                    headers: {
                        'Cookie': currentCookieStr,
                        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': `${ERP_BASE}/index.php`,
                        'Cache-Control': 'no-cache'
                    },
                    redirect: 'manual',
                    signal: AbortSignal.timeout(10000)
                });

                if (!erpResp.ok) {
                    return new Response(JSON.stringify({ success: false, message: `ERP returned status ${erpResp.status}` }), {
                        status: erpResp.status,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const html = await erpResp.text();
                if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                    return new Response(JSON.stringify({ success: false, message: "ERP session expired. Please log in again." }), {
                        status: 401,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
                if (!tableMatch) {
                    return new Response(JSON.stringify({ success: true, data: [], message: "No academic grade records found." }), {
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const rowMatches = Array.from(tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
                const coursesHistoryList = [];

                // Detect column headers dynamically if present
                let headerIndices = null;
                for (const rm of rowMatches) {
                    const rowContent = rm[1];
                    if (rowContent.toLowerCase().includes('<th')) {
                        const ths = Array.from(rowContent.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi))
                            .map(m => m[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
                        if (ths.length >= 6) {
                            const findIdx = (keywords) => ths.findIndex(h => keywords.some(k => h.includes(k)));
                            headerIndices = {
                                code: findIdx(['course code', 'code']),
                                desc: findIdx(['course desc', 'course title', 'course name', 'desc', 'title']),
                                grade: findIdx(['grade']),
                                point: findIdx(['grade point', 'point', 'gp']),
                                credits: findIdx(['credit', 'cr']),
                                status: findIdx(['promotion status', 'status', 'result']),
                                acy: findIdx(['academic year', 'acy', 'academic']),
                                sem: findIdx(['semester', 'sem']),
                                offeringYear: findIdx(['offering year', 'offering'])
                            };
                            break;
                        }
                    }
                }

                for (const rm of rowMatches) {
                    const rowContent = rm[1];
                    if (rowContent.toLowerCase().includes('<th')) continue;

                    const cells = Array.from(rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
                    if (cells.length < 8) continue;

                    let rawHref = '';
                    const linkMatch = rowContent.match(/href=["']([^"']+)["']/i);
                    if (linkMatch && !linkMatch[1].toLowerCase().startsWith('javascript:')) {
                        rawHref = linkMatch[1].replace(/&amp;/g, '&');
                    } else {
                        const onclickMatch = rowContent.match(/['"]([^'"]*\.php[^'"]*)['"]/i);
                        if (onclickMatch) rawHref = onclickMatch[1].replace(/&amp;/g, '&');
                    }

                    let courseCode = '';
                    let courseName = '';
                    let grade = '';
                    let gradePoint = '0';
                    let credits = '3.0';
                    let promotionStatus = 'P';
                    let academicYear = '';
                    let semester = '';
                    let offeringYear = '';

                    if (headerIndices && headerIndices.code !== -1 && cells[headerIndices.code]) {
                        courseCode = cells[headerIndices.code];
                        courseName = (headerIndices.desc !== -1 && cells[headerIndices.desc]) || courseCode;
                        grade = (headerIndices.grade !== -1 && cells[headerIndices.grade]) || 'P';
                        gradePoint = (headerIndices.point !== -1 && cells[headerIndices.point]) || '0';
                        credits = (headerIndices.credits !== -1 && cells[headerIndices.credits]) || '3.0';
                        promotionStatus = (headerIndices.status !== -1 && cells[headerIndices.status]) || 'P';
                        academicYear = (headerIndices.acy !== -1 && cells[headerIndices.acy]) || '';
                        semester = (headerIndices.sem !== -1 && cells[headerIndices.sem]) || '';
                        if (headerIndices.offeringYear !== -1 && cells[headerIndices.offeringYear]) {
                            offeringYear = cells[headerIndices.offeringYear];
                        }
                    } else {
                        courseCode = cells[3] || cells[2] || '';
                        courseName = cells[4] || cells[3] || courseCode;
                        grade = cells[5] || 'P';
                        gradePoint = cells[6] || '0';
                        credits = cells[7] || '3.0';
                        promotionStatus = cells[8] || 'P';
                        academicYear = cells[9] || '';
                        semester = cells[10] || '';
                    }

                    if (courseCode && courseCode.length >= 3) {
                        coursesHistoryList.push({
                            course_code: courseCode,
                            course_name: courseName,
                            course_desc: courseName,
                            grade,
                            grade_point: gradePoint,
                            credits,
                            promotion_status: promotionStatus,
                            academic_year: academicYear,
                            semester,
                            offering_year: offeringYear,
                            target_href: rawHref
                        });
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    data: coursesHistoryList,
                    courses: coursesHistoryList,
                    count: coursesHistoryList.length,
                    message: "Successfully fetched grades from ERP"
                }), {
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 5.7. /api/fetch-marks-detail - Authentic KLU Marks Scorecard Extraction
        if (url.pathname === '/api/fetch-marks-detail' || url.pathname === '/api/fetch_marks_detail' || url.pathname === '/fetch-marks-detail') {
            try {
                const body = await request.json().catch(() => ({}));
                const href = body.target_href || body.targetHref || url.searchParams.get('target_href') || url.searchParams.get('targetHref');
                const currentCookieStr = serializeCookieMap(cookieMap);

                if (!href) {
                    return new Response(JSON.stringify({ success: false, message: "target_href parameter is required" }), {
                        status: 400,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const cleanHref = href.startsWith('http') ? href : `${ERP_BASE}/${href.replace(/^\//, '')}`;
                const erpResp = await fetch(cleanHref, {
                    method: 'GET',
                    headers: {
                        'Cookie': currentCookieStr,
                        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': `${ERP_BASE}/index.php`,
                        'Cache-Control': 'no-cache'
                    },
                    redirect: 'manual',
                    signal: AbortSignal.timeout(10000)
                });

                if (!erpResp.ok) {
                    return new Response(JSON.stringify({ success: false, message: `ERP returned status ${erpResp.status}` }), {
                        status: erpResp.status,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const html = await erpResp.text();
                if (html.includes('id="login-form"') || html.includes('loginFormUserNameID')) {
                    return new Response(JSON.stringify({ success: false, message: "ERP session expired. Please log in again." }), {
                        status: 401,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const scorecard = {};
                const allTrs = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
                for (const rm of allTrs) {
                    const cells = Array.from(rm[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi))
                        .map(m => m[1].replace(/<[^>]+>/g, '').trim());
                    if (cells.length >= 2) {
                        const rawKey = cells[0].trim();
                        const val = cells[1].trim();
                        if (rawKey && val !== undefined) {
                            const fieldKey = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                            if (fieldKey.length > 0 && fieldKey.length < 50) {
                                scorecard[fieldKey] = val;
                            }
                        }
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    scorecard: scorecard,
                    message: "Successfully fetched marks detail"
                }), {
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 6. /api/logins audit logging endpoint
        if (url.pathname === '/api/logins') {
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }

        // 7. Secure Backend AI Proxy (/api/ai/gemini)
        // Keeps Google Gemini API Key safely stored on the Cloudflare edge backend
        if (url.pathname === '/api/ai/gemini') {
            if (request.method !== 'POST') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }

            try {
                const apiKey = env?.GEMINI_API_KEY || '';
                if (!apiKey) {
                    return new Response(JSON.stringify({
                        error: 'GEMINI_API_KEY is not configured on Cloudflare Worker. Please configure it in Cloudflare Dashboard under Settings > Variables and Secrets.'
                    }), {
                        status: 503,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const body = await request.json().catch(() => ({}));
                let { contents, systemInstruction, model: modelName } = body;

                if (!contents) {
                    return new Response(JSON.stringify({ error: 'Prompt contents are required.' }), {
                        status: 400,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                // Format contents appropriately for Google Gemini REST API
                let formattedContents = [];
                if (typeof contents === 'string') {
                    formattedContents = [{ role: 'user', parts: [{ text: contents }] }];
                } else if (Array.isArray(contents)) {
                    formattedContents = contents.map(item => {
                        if (typeof item === 'string') {
                            return { role: 'user', parts: [{ text: item }] };
                        }
                        return item;
                    });
                } else if (typeof contents === 'object') {
                    formattedContents = [contents];
                }

                const allowedModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
                const targetModel = allowedModels.includes(modelName) ? modelName : 'gemini-2.5-flash';

                const geminiPayload = {
                    contents: formattedContents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                };

                if (systemInstruction) {
                    geminiPayload.systemInstruction = {
                        parts: [{ text: typeof systemInstruction === 'string' ? systemInstruction : JSON.stringify(systemInstruction) }]
                    };
                }

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
                const geminiResp = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiPayload),
                    signal: AbortSignal.timeout(20000)
                });

                const geminiData = await geminiResp.json().catch(() => ({}));
                if (!geminiResp.ok) {
                    return new Response(JSON.stringify({
                        error: geminiData?.error?.message || 'Gemini API call failed.'
                    }), {
                        status: geminiResp.status,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }

                const replyText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                return new Response(JSON.stringify({ text: replyText }), {
                    headers: {
                        ...cors,
                        'Content-Type': 'application/json',
                        'Server-Timing': `edge;dur=${Date.now() - startTime}`
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    error: err.name === 'TimeoutError' ? 'AI request timed out. Please retry.' : err.message
                }), {
                    status: 504,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 5.9 /index.php proxy fallback for legacy scraping flows
        if (url.pathname === '/index.php') {
            try {
                const targetUrl = `${ERP_BASE}${url.pathname}${url.search}`;
                const forwardResp = await fetch(targetUrl, {
                    method: request.method,
                    headers: {
                        'Cookie': serializeCookieMap(cookieMap),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Referer': `${ERP_BASE}/`
                    },
                    body: request.method === 'POST' ? await request.text() : undefined,
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });
                const scList = forwardResp.headers.getSetCookie ? forwardResp.headers.getSetCookie() : [forwardResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(scList).forEach((v, k) => cookieMap.set(k, v));
                const allCookies = serializeCookieMap(cookieMap);
                const respText = await forwardResp.text();
                return new Response(respText, {
                    status: forwardResp.status,
                    headers: {
                        ...cors,
                        'Content-Type': forwardResp.headers.get('Content-Type') || 'text/html; charset=UTF-8',
                        'x-set-erp-cookie': allCookies
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 502,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 6. Default 404 handler
        return new Response(JSON.stringify({
            status: 'online',
            service: 'KL Attendance Cloudflare Edge API',
            message: 'Endpoint not found. Use /api/session-init, /api/refresh-captcha, /api/fast-login, /api/ai/gemini, or /index.php'
        }), {
            status: 404,
            headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
};
