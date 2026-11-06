// KL Attendance - High-Speed Cloudflare Edge Worker API
// 24/7/365 Always-Active • 0ms Cold Start • Global Edge Distribution • Zero Sleep Mode
// Optimized for heavy student traffic and ultra-low latency

const ERP_BASE = 'https://newerp.kluniversity.in';
const FETCH_TIMEOUT_MS = 20000;

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
                for (const sub of part.split(',')) {
                    const s = sub.trim();
                    const eq = s.indexOf('=');
                    if (eq > 0) {
                        const k = s.slice(0, eq).trim();
                        const v = s.slice(eq + 1).trim();
                        if (k && !IGNORED.has(k.toLowerCase())) map.set(k, v);
                    }
                }
                continue;
            }
            const eq = part.indexOf('=');
            if (eq > 0) {
                const k = part.slice(0, eq).trim();
                const v = part.slice(eq + 1).trim();
                if (k && !IGNORED.has(k.toLowerCase())) map.set(k, v);
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

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        const url = new URL(request.url);
        const pathname = url.pathname;
        const clientCookie = request.headers.get('x-erp-cookie') || request.headers.get('cookie') || '';
        const cookieMap = parseCookieHeader(clientCookie);

        // 0. Health check & 24/7 Keep-Alive
        if (pathname === '/' || pathname === '/health' || pathname === '/api/health' || pathname === '/api/ping') {
            return new Response(JSON.stringify({
                status: 'online',
                service: 'KL Attendance Cloudflare Edge API',
                mode: 'Serverless Edge (V8 Isolate)',
                uptime: '24/7 (Always-Active, Never Sleeps)',
                coldStart: '0ms',
                datacenter: request.cf?.colo || 'EDGE',
                country: request.cf?.country || 'IN',
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
        if (pathname === '/api/session-init') {
            try {
                const sessionMap = new Map();
                const erpResp = await fetch(`${ERP_BASE}/index.php?r=site%2Flogin`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache'
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

                const capMatch = html.match(/id="loginform-verifycode-image"[^>]*src="([^"]+)"/i) ||
                                 html.match(/src=["']([^"']*(?:site(?:%2F|\/)captcha)[^"']*)["']/i);
                let captchaPath = capMatch ? capMatch[1] : '/index.php?r=site%2Fcaptcha';
                const captchaUrl = captchaPath.startsWith('http') ? captchaPath : `${ERP_BASE}${captchaPath.startsWith('/') ? '' : '/'}${captchaPath}`;

                const capResp = await fetch(captchaUrl, {
                    headers: {
                        'Cookie': allCookies,
                        'Referer': `${ERP_BASE}/index.php?r=site%2Flogin`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const capScList = capResp.headers.getSetCookie ? capResp.headers.getSetCookie() : [capResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(capScList).forEach((v, k) => sessionMap.set(k, v));
                allCookies = serializeCookieMap(sessionMap);

                const capBuffer = await capResp.arrayBuffer();
                const base64Img = arrayBufferToBase64(capBuffer);
                const contentType = capResp.headers.get('content-type') || 'image/png';
                const captchaDataUrl = `data:${contentType};base64,${base64Img}`;

                return new Response(JSON.stringify({
                    success: true,
                    csrfToken,
                    cookieHeader: allCookies,
                    captchaUrl: captchaDataUrl
                }), {
                    headers: {
                        ...cors,
                        'Content-Type': 'application/json',
                        'x-set-erp-cookie': allCookies,
                        'Server-Timing': `edge;dur=${Date.now() - startTime}`
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 2. /api/refresh-captcha - Reload Captcha preserving active session cookies
        if (pathname === '/api/refresh-captcha') {
            try {
                let currentCookies = serializeCookieMap(cookieMap);
                const refreshUrl = `${ERP_BASE}/index.php?r=site%2Fcaptcha&refresh=1&_=${Date.now()}`;

                const refreshResp = await fetch(refreshUrl, {
                    headers: {
                        'Cookie': currentCookies,
                        'Referer': `${ERP_BASE}/index.php?r=site%2Flogin`,
                        'X-Requested-With': 'XMLHttpRequest',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const refScList = refreshResp.headers.getSetCookie ? refreshResp.headers.getSetCookie() : [refreshResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(refScList).forEach((v, k) => cookieMap.set(k, v));
                currentCookies = serializeCookieMap(cookieMap);

                const refData = await refreshResp.json().catch(() => null);
                let imgUrl = refData?.url ? (refData.url.startsWith('http') ? refData.url : `${ERP_BASE}${refData.url}`) : `${ERP_BASE}/index.php?r=site%2Fcaptcha&v=${Date.now()}`;

                const capResp = await fetch(imgUrl, {
                    headers: {
                        'Cookie': currentCookies,
                        'Referer': `${ERP_BASE}/index.php?r=site%2Flogin`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const capScList = capResp.headers.getSetCookie ? capResp.headers.getSetCookie() : [capResp.headers.get('set-cookie')].filter(Boolean);
                parseCookieHeader(capScList).forEach((v, k) => cookieMap.set(k, v));
                const allCookies = serializeCookieMap(cookieMap);

                const capBuffer = await capResp.arrayBuffer();
                const base64Img = arrayBufferToBase64(capBuffer);
                const contentType = capResp.headers.get('content-type') || 'image/png';
                const captchaDataUrl = `data:${contentType};base64,${base64Img}`;

                return new Response(JSON.stringify({
                    success: true,
                    captchaUrl: captchaDataUrl,
                    cookieHeader: allCookies
                }), {
                    headers: {
                        ...cors,
                        'Content-Type': 'application/json',
                        'x-set-erp-cookie': allCookies,
                        'Server-Timing': `edge;dur=${Date.now() - startTime}`
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 3. /api/fast-login - High-Speed Authentication with dual captcha field resolution
        if (pathname === '/api/fast-login') {
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

                if (!effectiveCsrf && clientCookies) {
                    try {
                        const initResp = await fetch(`${ERP_BASE}/index.php?r=site%2Flogin`, {
                            headers: { 'Cookie': clientCookies, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });
                        const scList = initResp.headers.getSetCookie ? initResp.headers.getSetCookie() : [initResp.headers.get('set-cookie')].filter(Boolean);
                        parseCookieHeader(scList).forEach((v, k) => cookieMap.set(k, v));
                        clientCookies = serializeCookieMap(cookieMap);
                        const initHtml = await initResp.text();
                        const m = initHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                  initHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i);
                        if (m) effectiveCsrf = m[1];
                    } catch {}
                }

                const formData = new URLSearchParams();
                if (effectiveCsrf) {
                    formData.append('_csrf', effectiveCsrf);
                    formData.append('_csrf-frontend', effectiveCsrf);
                }
                formData.append('LoginForm[username]', String(username).trim());
                formData.append('LoginForm[password]', String(password));
                formData.append('LoginForm[rememberMe]', '0');
                // Send BOTH LoginForm[captcha] (KLU ERP primary) and LoginForm[verifyCode] (fallback)
                formData.append('LoginForm[captcha]', String(captcha).trim());
                formData.append('LoginForm[verifyCode]', String(captcha).trim());
                formData.append('LoginForm[qr_code]', '');
                formData.append('login-button', '');

                let loginResp = await fetch(`${ERP_BASE}/index.php?r=site%2Flogin`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': clientCookies,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

                // Authentication redirect check
                if (loginResp.status === 302 || loginResp.status === 301) {
                    const nextLoc = loginResp.headers.get('location') || loginResp.headers.get('x-redirect') || '/index.php';
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

                    // Follow up to 5 redirect hops to collect session tokens
                    let currentTarget = nextLoc.startsWith('http') ? nextLoc.replace(/^http:/i, 'https:') : `${ERP_BASE}${nextLoc.startsWith('/') ? '' : '/'}${nextLoc}`;
                    let finalResp = null;
                    for (let hop = 0; hop < 5; hop++) {
                        allCookies = serializeCookieMap(cookieMap);
                        finalResp = await fetch(currentTarget, {
                            headers: {
                                'Cookie': allCookies,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': `${ERP_BASE}/`
                            },
                            redirect: 'manual',
                            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                        });

                        const hopSc = finalResp.headers.getSetCookie ? finalResp.headers.getSetCookie() : [finalResp.headers.get('set-cookie')].filter(Boolean);
                        parseCookieHeader(hopSc).forEach((v, k) => cookieMap.set(k, v));
                        if (finalResp.status === 302 || finalResp.status === 301) {
                            const hopLoc = finalResp.headers.get('location');
                            if (hopLoc) {
                                currentTarget = hopLoc.startsWith('http') ? hopLoc.replace(/^http:/i, 'https:') : `${ERP_BASE}${hopLoc.startsWith('/') ? '' : '/'}${hopLoc}`;
                                continue;
                            }
                        }
                        break;
                    }

                    const finalHtml = finalResp ? await finalResp.text() : '';
                    allCookies = serializeCookieMap(cookieMap);
                    const isAuth = finalHtml.includes('site/logout') || finalHtml.includes('site%2Flogout') || finalHtml.includes('logout') || finalHtml.includes('student') || finalHtml.includes('indexindi');

                    return new Response(JSON.stringify({
                        success: isAuth,
                        verified: isAuth,
                        html: finalHtml,
                        cookies: allCookies,
                        cookieHeader: allCookies
                    }), {
                        status: isAuth ? 200 : 401,
                        headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                    });
                }

                const postHtml = await loginResp.text();
                const isSuccess = postHtml.includes('site/logout') || postHtml.includes('site%2Flogout') || postHtml.includes('logout') || postHtml.includes('student') || postHtml.includes('indexindi');

                return new Response(JSON.stringify({
                    success: isSuccess,
                    verified: isSuccess,
                    html: postHtml,
                    cookies: allCookies,
                    cookieHeader: allCookies,
                    error: isSuccess ? null : 'Incorrect Student ID, Password, or Captcha. Please verify your credentials.'
                }), {
                    status: isSuccess ? 200 : 401,
                    headers: { ...cors, 'Content-Type': 'application/json', 'x-set-erp-cookie': allCookies }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 4. /api/fast-attendance - Multi-Semester ERP Attendance Fetching
        if (pathname === '/api/fast-attendance') {
            try {
                const body = await request.json().catch(() => ({}));
                const { year, semester, yearId, semId, csrfToken } = body;
                let currentCookieStr = serializeCookieMap(cookieMap);
                let currentCsrf = csrfToken || '';

                // Dynamic option discovery & CSRF extraction from searchgetinput
                try {
                    const inputResp = await fetch(`${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`, {
                        headers: {
                            'Cookie': currentCookieStr,
                            'Referer': `${ERP_BASE}/index.php`,
                            'X-Requested-With': 'XMLHttpRequest',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });
                    if (inputResp.ok) {
                        const inputHtml = await inputResp.text();
                        const cm = inputHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                   inputHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i);
                        if (cm && cm[1]) currentCsrf = cm[1];
                    }
                } catch {}

                // Resolve candidate year codes (formula from timetable-copy + ERP aliases)
                const candidateYears = [];
                const strYear = String(year || yearId || '').trim();
                let firstYear = parseInt(strYear.split('-')[0], 10);
                if (!isNaN(firstYear) && firstYear < 100) firstYear += 2000;

                if (firstYear >= 2026 || strYear === '29' || strYear === '18') {
                    candidateYears.push('29', '18', '22');
                } else if (firstYear === 2025 || strYear === '19' || strYear === '28' || strYear === '17') {
                    candidateYears.push('19', '28', '17');
                } else if (firstYear === 2024 || strYear === '16' || strYear === '27') {
                    candidateYears.push('16', '27', '15');
                } else if (firstYear === 2023 || strYear === '13' || strYear === '15') {
                    candidateYears.push('13', '15', '26');
                }
                if (yearId) candidateYears.unshift(String(yearId));

                // Resolve semester ID
                let resolvedSemId = String(semId || '1');
                const reqSemStr = String(semester || '').toLowerCase();
                if (reqSemStr.includes('summer') || reqSemStr === '3') resolvedSemId = '3';
                else if (reqSemStr.includes('term') || reqSemStr === '4' || reqSemStr.includes('tri')) resolvedSemId = '4';
                else if (reqSemStr.includes('even') || reqSemStr === '2') resolvedSemId = '2';
                else if (reqSemStr.includes('odd') || reqSemStr === '1') resolvedSemId = '1';

                let finalHtml = '';
                const postHeaders = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput`,
                    'Cookie': currentCookieStr,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                };
                if (currentCsrf) postHeaders['x-csrf-token'] = currentCsrf;

                for (const testYearId of Array.from(new Set(candidateYears.filter(Boolean)))) {
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

                    postHeaders['Cookie'] = currentCookieStr;
                    const crResp = await fetch(`${ERP_BASE}/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist`, {
                        method: 'POST',
                        headers: postHeaders,
                        body: formData.toString(),
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });

                    const crHtml = await crResp.text();
                    finalHtml = crHtml;
                    const hasTable = crHtml.includes('<table') || crHtml.includes('grid-view') || crHtml.includes('Course Code');
                    const hasEmptyResult = crHtml.includes('class="empty"') || crHtml.includes('No results found');
                    
                    // Verify row-level academic year to reject default-session fallback
                    const rowYears = Array.from(crHtml.matchAll(/<td[^>]*>\s*(20\d\d[-/]\d{2,4})\s*<\/td>/gi)).map(m => m[1]);
                    const matchesReqYear = (!firstYear || rowYears.length === 0 || rowYears.some(y => y.includes(String(firstYear))));

                    if (hasTable && !hasEmptyResult && matchesReqYear) {
                        break;
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    html: finalHtml,
                    resolvedSemId
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

        // 5. /api/fetch-timetable
        if (pathname === '/api/fetch-timetable' || pathname === '/api/fetch_timetable' || pathname === '/fetch-timetable') {
            try {
                const body = await request.json().catch(() => ({}));
                const year = String(body.year || body.yearId || body.academic_year_code || '');
                const semester = String(body.semester || body.semId || body.semester_id || '').toLowerCase();
                const semId = semester.includes('even') || semester === '2' ? '2' : (semester.includes('summer') || semester === '3' ? '3' : (semester.includes('term') || semester === '4' ? '4' : '1'));
                const yCode = year.includes('2025') ? '19' : year.includes('2024') ? '16' : '29';

                const ttUrl = `${ERP_BASE}/index.php?r=timetables%2Funiversitymasteracademictimetableview%2Findividualstudenttimetableget&UniversityMasterAcademicTimetableView%5Bacademicyear%5D=${yCode}&UniversityMasterAcademicTimetableView%5Bsemesterid%5D=${semId}`;
                const ttResp = await fetch(ttUrl, {
                    headers: {
                        'Cookie': serializeCookieMap(cookieMap),
                        'Referer': `${ERP_BASE}/index.php`,
                        'X-Requested-With': 'XMLHttpRequest',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });
                const ttHtml = await ttResp.text();
                return new Response(JSON.stringify({ success: true, html: ttHtml }), {
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 6. /api/fetch-cgpa
        if (pathname === '/api/fetch-cgpa' || pathname === '/api/fetch_cgpa' || pathname === '/fetch-cgpa') {
            try {
                const cgpaHeaders = {
                    'Cookie': serializeCookieMap(cookieMap),
                    'Referer': `${ERP_BASE}/index.php`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                };

                let cgpaResp = await fetch(`${ERP_BASE}/index.php?r=studentinfo%2Fstudentendexamresult%2Fsearchgetmycgpa`, {
                    headers: cgpaHeaders,
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });
                let cgpaHtml = await cgpaResp.text();

                if (!cgpaHtml.includes('<table') || cgpaHtml.includes('id="login-form"')) {
                    const fallbackResp = await fetch(`${ERP_BASE}/index.php?r=student%2Fstudentgrade%2Fgradecard`, {
                        headers: cgpaHeaders,
                        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                    });
                    if (fallbackResp.ok) {
                        const fallbackHtml = await fallbackResp.text();
                        if (fallbackHtml.includes('<table')) {
                            cgpaHtml = fallbackHtml;
                        }
                    }
                }

                return new Response(JSON.stringify({ success: true, html: cgpaHtml }), {
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 7. /api/fetch-marks-detail
        if (pathname === '/api/fetch-marks-detail' || pathname === '/api/fetch_marks_detail' || pathname === '/fetch-marks-detail') {
            try {
                const body = await request.json().catch(() => ({}));
                const { targetHref } = body;
                if (!targetHref) {
                    return new Response(JSON.stringify({ success: false, error: 'targetHref parameter required' }), {
                        status: 400,
                        headers: { ...cors, 'Content-Type': 'application/json' }
                    });
                }
                const fullUrl = targetHref.startsWith('http') ? targetHref : `${ERP_BASE}${targetHref.startsWith('/') ? '' : '/'}${targetHref}`;
                const mkResp = await fetch(fullUrl, {
                    headers: {
                        'Cookie': serializeCookieMap(cookieMap),
                        'Referer': `${ERP_BASE}/index.php`,
                        'X-Requested-With': 'XMLHttpRequest',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });
                const mkHtml = await mkResp.text();
                return new Response(JSON.stringify({ success: true, html: mkHtml }), {
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        // 8. /api/logins
        if (pathname === '/api/logins') {
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }

        // 9. /api/ai/gemini
        if (pathname === '/api/ai/gemini') {
            return new Response(JSON.stringify({ success: false, error: 'AI helper not configured at edge' }), {
                status: 501,
                headers: { ...cors, 'Content-Type': 'application/json' }
            });
        }

        // 10. Transparent ERP Reverse Proxy (/index.php*)
        if (pathname.startsWith('/index.php')) {
            try {
                const targetUrl = `${ERP_BASE}${pathname}${url.search}`;
                const proxyHeaders = new Headers();
                for (const [k, v] of request.headers.entries()) {
                    const lk = k.toLowerCase();
                    if (!['host', 'origin', 'referer'].includes(lk)) {
                        proxyHeaders.set(k, v);
                    }
                }
                const inCookie = serializeCookieMap(cookieMap);
                if (inCookie) proxyHeaders.set('Cookie', inCookie);
                proxyHeaders.set('Origin', ERP_BASE);
                proxyHeaders.set('Referer', `${ERP_BASE}/index.php`);

                const erpResp = await fetch(targetUrl, {
                    method: request.method,
                    headers: proxyHeaders,
                    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
                    redirect: 'manual',
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });

                const respHeaders = new Headers();
                for (const [k, v] of erpResp.headers.entries()) {
                    respHeaders.set(k, v);
                }
                Object.entries(cors).forEach(([k, v]) => respHeaders.set(k, v));
                const sc = erpResp.headers.get('set-cookie');
                if (sc) respHeaders.set('x-set-erp-cookie', sc);

                return new Response(erpResp.body, {
                    status: erpResp.status,
                    headers: respHeaders
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 502,
                    headers: { ...cors, 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response(JSON.stringify({ error: 'Endpoint not found', path: pathname }), {
            status: 404,
            headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
};
