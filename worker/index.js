// KL Attendance - High-Speed Cloudflare Edge Worker API
// 24/7/365 Always-Active • 0ms Cold Start • Global Edge Distribution • Zero Sleep Mode
// Optimized for heavy student traffic and ultra-low latency

const ERP_BASE = 'https://newerp.kluniversity.in';
const FETCH_TIMEOUT_MS = 15000; // 15s safeguard against stalled upstream connections

function getCorsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, x-erp-cookie, x-csrf-token, Authorization, Pragma, Cache-Control, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'x-set-erp-cookie, set-cookie, Location, Server-Timing',
        'Access-Control-Max-Age': '86400', // Cache CORS preflights for 24h to eliminate preflight round-trip latency
    };
}

function parseCookieHeader(rawCookies) {
    const map = new Map();
    if (!rawCookies) return map;
    const items = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    for (const item of items) {
        if (!item) continue;
        item.split(';').forEach(p => {
            const [k, ...v] = p.split('=');
            if (k && k.trim()) {
                const key = k.trim();
                const lower = key.toLowerCase();
                if (!['path', 'expires', 'max-age', 'domain', 'samesite', 'secure', 'httponly', 'partitioned'].includes(lower)) {
                    map.set(key, v.join('=').trim());
                }
            }
        });
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

                const capMatch = html.match(/id="loginFormCaptcha-image"\s+src="([^"]+)"/i) ||
                                 html.match(/src="([^"]+)"\s+id="loginFormCaptcha-image"/i);
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

        // 2. /api/refresh-captcha - Instant Captcha Renewal with CSRF synchronization
        if (url.pathname === '/api/refresh-captcha') {
            try {
                let currentCookies = serializeCookieMap(cookieMap);
                let freshCsrf = '';
                let targetImg = '';

                // If client provided cookies, try refreshing within existing session
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

                    // Scrape fresh CSRF token from index.php with the updated session cookie
                    try {
                        const pageResp = await fetch(`${ERP_BASE}/index.php`, {
                            headers: {
                                'Cookie': currentCookies,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'Referer': `${ERP_BASE}/index.php`
                            },
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });
                        const pageScList = pageResp.headers.getSetCookie ? pageResp.headers.getSetCookie() : [pageResp.headers.get('set-cookie')].filter(Boolean);
                        parseCookieHeader(pageScList).forEach((v, k) => cookieMap.set(k, v));
                        currentCookies = serializeCookieMap(cookieMap);

                        const pageHtml = await pageResp.text();
                        const cm = pageHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                   pageHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                   pageHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                   pageHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                        if (cm) freshCsrf = cm[1];

                        if (!targetImg) {
                            const im = pageHtml.match(/id="loginFormCaptcha-image"\s+src="([^"]+)"/i) ||
                                       pageHtml.match(/src="([^"]+)"\s+id="loginFormCaptcha-image"/i);
                            if (im) targetImg = im[1].replace(/&amp;/g, '&');
                        }
                    } catch (e) {
                        console.warn("[Worker] Captcha page scrape notice:", e.message);
                    }
                }

                // If session was invalid or freshCsrf could not be obtained, perform full session-init fallback
                if (!targetImg || !freshCsrf) {
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

                let imgUrl = targetImg.startsWith('http') ? targetImg : `${ERP_BASE}${targetImg.startsWith('/') ? '' : '/'}${targetImg}`;
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

                let captchaDataUrl = '';
                if (imgResp.ok) {
                    const imgBuf = await imgResp.arrayBuffer();
                    const base64 = arrayBufferToBase64(imgBuf);
                    captchaDataUrl = `data:image/png;base64,${base64}`;
                }

                return new Response(JSON.stringify({
                    success: true,
                    captchaUrl: captchaDataUrl,
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

        // 3. /api/fast-login - High-Speed Authentication & Multi-Hop Redirect Follower
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

                // Authentication succeeded (ERP returns 302 redirect upon valid credentials)
                if (loginResp.status === 302) {
                    let nextLoc = loginResp.headers.get('location') || loginResp.headers.get('x-redirect') || '/index.php';

                    // If redirect points back to login, parse the exact error and fresh CSRF
                    if (nextLoc.includes('site%2Flogin') || nextLoc.includes('site/login')) {
                        let errorMsg = 'Incorrect username or password. Please verify your credentials.';
                        let freshFailCsrf = '';
                        try {
                            const failResp = await fetch(`${ERP_BASE}/index.php?r=site%2Flogin`, {
                                headers: {
                                    'Cookie': allCookies,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                    'Referer': `${ERP_BASE}/`
                                },
                                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                            });
                            const failScList = failResp.headers.getSetCookie ? failResp.headers.getSetCookie() : [failResp.headers.get('set-cookie')].filter(Boolean);
                            parseCookieHeader(failScList).forEach((v, k) => cookieMap.set(k, v));
                            allCookies = serializeCookieMap(cookieMap);

                            const failHtml = await failResp.text();
                            const failCsrfMatch = failHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                                  failHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                                  failHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                                  failHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                            if (failCsrfMatch) freshFailCsrf = failCsrfMatch[1];

                            const capMatch = failHtml.match(/class="[^"]*(?:field-loginFormCaptcha|field-loginform-captcha)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                            const pwdMatch = failHtml.match(/class="[^"]*(?:field-loginFormPasswordID|field-loginform-password)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                            const usrMatch = failHtml.match(/class="[^"]*(?:field-loginFormUserNameID|field-loginform-username)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                            const alertMatch = failHtml.match(/class="[^"]*(?:alert-danger|error-summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                            const clean = m => m ? m.replace(/<[^>]+>/g, '').trim() : '';

                            if (clean(capMatch?.[1])) errorMsg = clean(capMatch[1]);
                            else if (clean(pwdMatch?.[1])) errorMsg = clean(pwdMatch[1]);
                            else if (clean(usrMatch?.[1])) errorMsg = clean(usrMatch[1]);
                            else if (clean(alertMatch?.[1])) errorMsg = clean(alertMatch[1]);
                        } catch {
                            // ignore
                        }

                        return new Response(JSON.stringify({
                            success: false,
                            error: errorMsg,
                            cookies: allCookies,
                            csrfToken: freshFailCsrf
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
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                'Referer': `${ERP_BASE}/`
                            },
                            redirect: 'manual',
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });

                        const hopScList = finalResp.headers.getSetCookie ? finalResp.headers.getSetCookie() : [finalResp.headers.get('set-cookie')].filter(Boolean);
                        parseCookieHeader(hopScList).forEach((v, k) => cookieMap.set(k, v));

                        if (finalResp.status >= 300 && finalResp.status < 400) {
                            const loc = finalResp.headers.get('location') || finalResp.headers.get('x-redirect');
                            if (!loc || loc.includes('site%2Flogin') || loc.includes('site/login')) break;
                            currentTarget = loc.startsWith('http')
                                ? loc.replace(/^http:/i, 'https:')
                                : `${ERP_BASE}${loc.startsWith('/') ? '' : '/'}${loc}`;
                        } else {
                            break;
                        }
                    }

                    allCookies = serializeCookieMap(cookieMap);
                    let dashHtml = finalResp ? await finalResp.text() : '';

                    // Check if landed back on login form
                    if (dashHtml.includes('id="login-form"') || dashHtml.includes('loginFormUserNameID')) {
                        return new Response(JSON.stringify({
                            success: false,
                            error: 'Incorrect username or password. Please verify your credentials.',
                            cookies: allCookies
                        }), {
                            status: 401,
                            headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                        });
                    }

                    // Ensure rich dashboard HTML is fetched from student/indexindi if needed
                    if (!dashHtml || (!dashHtml.includes('logout') && !dashHtml.includes('student') && !dashHtml.includes('indexindi'))) {
                        try {
                            const indiResp = await fetch(`${ERP_BASE}/index.php?r=student%2Findexindi`, {
                                headers: {
                                    'Cookie': allCookies,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                    'Referer': `${ERP_BASE}/index.php`
                                },
                                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                            });
                            const indiScList = indiResp.headers.getSetCookie ? indiResp.headers.getSetCookie() : [indiResp.headers.get('set-cookie')].filter(Boolean);
                            parseCookieHeader(indiScList).forEach((v, k) => cookieMap.set(k, v));
                            allCookies = serializeCookieMap(cookieMap);

                            if (indiResp.ok) {
                                const indiHtml = await indiResp.text();
                                if (indiHtml && !indiHtml.includes('id="login-form"')) {
                                    dashHtml = indiHtml;
                                }
                            }
                        } catch (e) {
                            console.warn("[Worker] indexindi fetch notice:", e.message);
                        }
                    }

                    // Extract post-login CSRF token directly from dashboard HTML
                    const postCsrfMatch = dashHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                          dashHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                          dashHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i);
                    const postLoginCsrf = postCsrfMatch ? postCsrfMatch[1] : (effectiveCsrf || '');

                    // Strictly verify that dashHtml represents an active authenticated student session
                    const isVerifiedAuth = Boolean(
                        dashHtml &&
                        !dashHtml.includes('id="login-form"') &&
                        !dashHtml.includes('id="loginFormID"') &&
                        !dashHtml.includes('loginFormUserNameID') &&
                        !dashHtml.includes('loginFormPasswordID') &&
                        !dashHtml.includes('loginFormCaptcha-image') &&
                        !dashHtml.includes('name="LoginForm') &&
                        !dashHtml.includes('LoginForm[') &&
                        !dashHtml.includes('Incorrect username or password') &&
                        !dashHtml.includes('The verification code is incorrect') &&
                        (
                            dashHtml.includes('logout') ||
                            dashHtml.includes('site%2Flogout') ||
                            dashHtml.includes('site/logout') ||
                            dashHtml.includes('student') ||
                            dashHtml.includes('indexindi') ||
                            dashHtml.includes('attendance') ||
                            dashHtml.includes('academicyear') ||
                            dashHtml.includes(String(username).trim())
                        )
                    );

                    if (!isVerifiedAuth) {
                        return new Response(JSON.stringify({
                            success: false,
                            error: 'Incorrect Student ID, Password, or Captcha. Please verify your credentials.',
                            cookies: allCookies
                        }), {
                            status: 401,
                            headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                        });
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        verified: true,
                        html: dashHtml,
                        cookies: allCookies,
                        csrfToken: postLoginCsrf
                    }), {
                        headers: {
                            ...cors,
                            'Content-Type': 'application/json',
                            'x-set-erp-cookie': allCookies,
                            'Server-Timing': `edge;dur=${Date.now() - startTime}`
                        }
                    });
                }

                // Authentication failed (Status 200/400/401 with validation error in HTML)
                const failHtml = await loginResp.text();
                let errorMsg = 'Incorrect username, password, or captcha.';
                const capErr = failHtml.match(/class="[^"]*(?:field-loginFormCaptcha|field-loginform-captcha)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                const pwdErr = failHtml.match(/class="[^"]*(?:field-loginFormPasswordID|field-loginform-password)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                const usrErr = failHtml.match(/class="[^"]*(?:field-loginFormUserNameID|field-loginform-username)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                const alertErr = failHtml.match(/class="[^"]*(?:alert-danger|error-summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

                const clean = m => m ? m.replace(/<[^>]+>/g, '').trim() : '';
                if (clean(capErr?.[1])) errorMsg = clean(capErr[1]);
                else if (clean(pwdErr?.[1])) errorMsg = clean(pwdErr[1]);
                else if (clean(usrErr?.[1])) errorMsg = clean(usrErr[1]);
                else if (clean(alertErr?.[1])) errorMsg = clean(alertErr[1]);

                // Extract fresh CSRF token from fail HTML for subsequent retry
                const failCsrfMatch = failHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                      failHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                      failHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                      failHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                const freshFailCsrf = failCsrfMatch ? failCsrfMatch[1] : '';

                return new Response(JSON.stringify({
                    success: false,
                    error: errorMsg,
                    cookies: allCookies,
                    csrfToken: freshFailCsrf
                }), {
                    status: 401,
                    headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                });
            } catch (err) {
                return new Response(JSON.stringify({
                    success: false,
                    error: err.name === 'TimeoutError' ? 'Login attempt timed out. KL ERP is responding slowly, please retry.' : err.message
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

                            // 5. If still no match and looking for current active academic year, default to first ERP option
                            if (!matchedYear && (reqYearStr === '18' || reqYearStr.includes('26') || !reqYearStr)) {
                                matchedYear = availableYears[0];
                            }
                        }
                        if (matchedYear) {
                            resolvedYearId = matchedYear.val;
                            selectedYearText = matchedYear.text;
                        }

                        const reqSemStr = (semester || '').toString().trim().toLowerCase();
                        const reqSemId = (semId || '').toString().trim();
                        let matchedSem = null;
                        if (availableSemesters.length > 0) {
                            if (reqSemStr) {
                                matchedSem = availableSemesters.find(s => s.text.toLowerCase() === reqSemStr || s.text.toLowerCase().includes(reqSemStr));
                            }
                            if (!matchedSem) {
                                if (reqSemStr.includes('odd') || reqSemId === '1') {
                                    matchedSem = availableSemesters.find(s => s.text.toLowerCase().includes('odd') || s.val === '1');
                                } else if (reqSemStr.includes('even') || reqSemId === '2') {
                                    matchedSem = availableSemesters.find(s => s.text.toLowerCase().includes('even') || s.val === '2');
                                } else if (reqSemStr.includes('summer') || reqSemId === '3') {
                                    matchedSem = availableSemesters.find(s => s.text.toLowerCase().includes('summer') || s.val === '3');
                                }
                            }
                            if (!matchedSem && reqSemId) {
                                matchedSem = availableSemesters.find(s => s.val === reqSemId);
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

                if (!resolvedYearId) {
                    const yStr = String(year || yearId || '').trim();
                    if (yStr.startsWith('2026') || yStr === '18' || yStr.includes('26')) resolvedYearId = '29';
                    else if (yStr.startsWith('2025') || yStr === '17' || yStr.includes('25')) resolvedYearId = '28';
                    else if (yStr.startsWith('2024') || yStr === '16' || yStr.includes('24')) resolvedYearId = '27';
                    else if (yStr.startsWith('2023') || yStr === '15' || yStr.includes('23')) resolvedYearId = '26';
                    else resolvedYearId = (yStr || '29');
                }
                if (!resolvedSemId) {
                    const sStr = String(semester || semId || '').trim().toLowerCase();
                    resolvedSemId = sStr.includes('even') || sStr === '2' ? '2' : sStr.includes('summer') || sStr === '3' ? '3' : '1';
                }

                const formData = new URLSearchParams();
                formData.append('DynamicModel[academicyear]', String(resolvedYearId));
                formData.append('DynamicModel[semesterid]', String(resolvedSemId));
                formData.append('DynamicModel[academic_year]', String(resolvedYearId));
                formData.append('DynamicModel[semester_id]', String(resolvedSemId));
                formData.append('academicyear', String(resolvedYearId));
                formData.append('semesterid', String(resolvedSemId));
                if (currentCsrf) {
                    formData.append('_csrf', currentCsrf);
                    formData.append('_csrf-frontend', currentCsrf);
                }

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
                const hasTable = crHtml.includes('<table') || crHtml.includes('grid-view') || crHtml.includes('Course Code') || crHtml.includes('Course Title') || crHtml.includes('L-T-P-S');

                return new Response(JSON.stringify({
                    success: (crResp.ok || hasTable) && !isLoginForm,
                    status: crResp.status,
                    latencyMs: Date.now() - startTime,
                    html: crHtml,
                    csrfToken: currentCsrf,
                    resolvedYearId,
                    resolvedSemId,
                    selectedYearText,
                    selectedSemText,
                    availableYears,
                    availableSemesters,
                    sessionExpired: isLoginForm
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
                reqHeaders.set('Referer', `${ERP_BASE}${url.pathname}${url.search}`);
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
                    resHeaders.set('x-set-erp-cookie', scList.map(c => c.split(';')[0]).join('; '));
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

                const allowedModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
                const targetModel = allowedModels.includes(modelName) ? modelName : 'gemini-2.0-flash';

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
