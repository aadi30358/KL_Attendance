import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";
import svgCaptcha from 'svg-captcha';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security Headers & Anti-Bot Middleware
const MALICIOUS_SCANNER_REGEX = /sqlmap|nikto|dirbuster|dirb|wpscan|acunetix|masscan|zgrab|nmap|morfeus|havij|nessus/i;

app.use((req, res, next) => {
    // 1. Block Automated Vulnerability Scanners
    const ua = req.headers['user-agent'] || '';
    if (MALICIOUS_SCANNER_REGEX.test(ua)) {
        return res.status(403).json({ error: 'Access Denied: Malicious scanner signature detected.' });
    }

    // 2. Block Path Traversal & Suspicious Query Sequences
    if (req.url && (req.url.includes('../') || req.url.includes('..\\') || req.url.includes('%2e%2e'))) {
        return res.status(400).json({ error: 'Malicious path sequence detected.' });
    }

    // 3. Inject High-Grade Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self';");
    next();
});

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    'https://klattendancecalculator.web.app',
    'https://klattendancecalculator.firebaseapp.com',
    'https://klattendance.online',
    'https://www.klattendance.online',
    'http://klattendance.online',
    'http://www.klattendance.online',
    'https://api.klattendance.online',
    'https://kl-attendance-api.yaswanthadithyareddy10.workers.dev',
    'http://localhost:5173', // Vite default dev port
    'http://127.0.0.1:5173',
    'http://localhost:4173', // Vite preview port
    'http://127.0.0.1:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

const isOriginAllowed = (origin) => {
    // Requests from mobile webviews (Instagram, etc.), curl, or server-to-server can have null or undefined origin
    if (!origin || origin === 'null') return true;

    if (allowedOrigins.includes(origin)) return true;

    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return true;

    try {
        const url = new URL(origin);
        const host = url.hostname.toLowerCase();

        // Allow klattendance.online domain and any subdomains
        if (host === 'klattendance.online' || host.endsWith('.klattendance.online')) {
            return true;
        }

        // Allow Firebase hosting domains
        if (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) {
            return true;
        }

        // Allow Cloudflare domains
        if (host.endsWith('.workers.dev') || host.endsWith('.pages.dev') || host === 'api.klattendance.online') {
            return true;
        } 

        // Allow localhost and loopback on any port
        if (host === 'localhost' || host === '127.0.0.1') {
            return true;
        }

        // Allow private network IP addresses (mobile testing on WiFi: 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host)) {
            return true;
        }
    } catch {
        // Fallback
    }

    return false;
};

const corsOptions = {
    origin: function (origin, callback) {
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from origin: ${origin}`);
            return callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-erp-cookie',
        'x-csrf-token',
        'x-requested-with',
        'Pragma',
        'Cache-Control',
        'Accept',
        'Origin',
        'User-Agent'
    ],
    exposedHeaders: ['x-set-erp-cookie', 'set-cookie', 'Location']
};

// Mount CORS before rate limiting to ensure 429 and error responses include CORS headers
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting: 600 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

// Dedicated rate limiting on student login & fast-login: Allow rapid multiple logins without blocking (5000 attempts per 15 mins)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
    message: { success: false, error: "Too many login attempts from this network. Please try again in a few moments." }
});

// Strict rate limiting on admin authentication: 5 attempts per 15 minutes
const adminAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, error: "Too many admin login attempts from this IP. Account temporarily locked for 15 minutes." }
});

// Dedicated rate limiter on Gemini AI endpoint: 30 requests per 10 minutes
const aiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: { error: "Too many AI requests. Please wait a few moments before asking Pluto again." }
});

// Timetable proxy rate limiter
const timetableLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    message: { success: false, message: "Too many timetable requests. Please wait a few moments." }
});

// Admin Authentication Configuration & Token Helpers
const ADMIN_SALT = 'kl-attendance-admin-salt-v1';
const ADMIN_JWT_SECRET = process.env.SESSION_SECRET || 'kl-attendance-secure-token-secret-2026';

const ADMIN_CREDENTIAL_HASHES = {
    'aadi': 'ca3f11f5d85eb3eeb4b06e28436bdb62a4b6bb527e90fda20540aa78418fea84',
    'yaswanthadithyareddy11@gmail.com': 'add6ad05226390a35dbb7888ab7cc98e4abab0f3a12c5ea96f2e09eabf0de0dd',
    'yaswanthadithyareddy12@gmail.com': '3536d3f34d448524f4fa19929e40216cac91eba6efb62b8e23151108847d35ba',
    'yaswanthadithyareddy10@gmail.com': '4190ca0995efb003fd11c1c51ed56edb82a17af90b260f55d999e802113e26ba'
};

function generateAdminToken(uname) {
    const payload = {
        sub: uname,
        iat: Date.now(),
        exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(payloadB64).digest('base64url');
    return `${payloadB64}.${signature}`;
}

function verifyAdminToken(token) {
    if (!token || typeof token !== 'string') return false;

    // Check if JSON session object from local admin
    try {
        const parsed = JSON.parse(token);
        if (parsed && (parsed.user === 'aadi' || ADMIN_CREDENTIAL_HASHES[parsed.user])) {
            if (parsed.exp && Date.now() > parsed.exp) return false;
            return { sub: parsed.user };
        }
    } catch {
        // Not a JSON string, proceed to JWT validation
    }

    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(payloadB64).digest('base64url');
    if (signature.length !== expectedSig.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return false;
    }
    try {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return false;
        return payload;
    } catch {
        return false;
    }
}

app.use(limiter);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

const isProduction = process.env.NODE_ENV === "production";

app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET || "some-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction
    }
}));

// ERP Proxy Endpoint
app.all('/index.php', async (req, res) => {
    const searchParams = req.url.includes('?') ? req.url.split('?')[1] : '';
    const erpUrl = 'https://newerp.kluniversity.in/index.php' + (searchParams ? '?' + searchParams : '');

    try {
        let rawBody = undefined;
        if (!['GET', 'HEAD'].includes(req.method)) {
            if (typeof req.body === 'string') {
                rawBody = req.body;
            } else if (Buffer.isBuffer(req.body)) {
                rawBody = req.body;
            } else if (req.body && typeof req.body === 'object') {
                const flattenObj = (obj, prefix = '') => {
                    return Object.keys(obj).reduce((acc, k) => {
                        const pre = prefix.length ? prefix + '[' + k + ']' : k;
                        if (typeof obj[k] === 'object' && obj[k] !== null) {
                            Object.assign(acc, flattenObj(obj[k], pre));
                        } else {
                            acc[pre] = obj[k];
                        }
                        return acc;
                    }, {});
                };
                const flat = flattenObj(req.body);
                rawBody = new URLSearchParams(flat).toString();
            }
        }

        const allowedHeaders = [
            'cookie', 'user-agent', 'accept', 'accept-language',
            'content-type', 'x-csrf-token', 'x-requested-with'
        ];

        const cleanHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (allowedHeaders.includes(key.toLowerCase())) {
                cleanHeaders[key.toLowerCase()] = value;
            }
        }

        cleanHeaders['host'] = 'newerp.kluniversity.in';
        cleanHeaders['origin'] = 'https://newerp.kluniversity.in';
        cleanHeaders['referer'] = 'https://newerp.kluniversity.in/';

        const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '192.168.1.1';
        cleanHeaders['x-forwarded-for'] = clientIp.split(',')[0].trim();

        const fetchOptions = {
            method: req.method,
            headers: cleanHeaders,
            body: rawBody,
            redirect: 'manual'
        };

        const response = await fetch(erpUrl, fetchOptions);

        res.status(response.status);

        for (const [key, value] of response.headers.entries()) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'content-encoding' || lowerKey === 'content-length') {
                continue;
            }
            if (lowerKey === 'set-cookie') {
                let setCookies = [];
                if (typeof response.headers.getSetCookie === 'function') {
                    setCookies = response.headers.getSetCookie();
                } else if (response.headers.raw && typeof response.headers.raw === 'function') {
                    setCookies = response.headers.raw()['set-cookie'] || [value];
                } else {
                    setCookies = value.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
                }

                const rewrittenCookies = setCookies.map(cookie => {
                    let newCookie = cookie.replace(/Domain=[^;]+;?/gi, '');
                    if (!newCookie.includes('SameSite')) newCookie += '; SameSite=None';
                    if (!newCookie.includes('Secure')) newCookie += '; Secure';
                    return newCookie.trim();
                });
                res.setHeader('Set-Cookie', rewrittenCookies);
            } else if (lowerKey === 'location') {
                const rewrittenLocation = value.replace(/^https?:\/\/newerp\.kluniversity\.in/i, '');
                res.setHeader('Location', rewrittenLocation.replace(/^http:/i, 'https:'));
            } else {
                const safeValue = typeof value === 'string' ? value.replace(/^http:/i, 'https:') : value;
                res.setHeader(key, safeValue);
            }
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);

    } catch (error) {
        console.error('ERP Proxy Error:', error);
        res.status(500).json({ error: 'Failed to communicate with ERP', details: error.message });
    }
});

// Fast Session & Captcha Initialization Endpoint
app.get('/api/session-init', async (req, res) => {
    try {
        const erpUrl = 'https://newerp.kluniversity.in/index.php';
        const response = await fetch(erpUrl, {
            headers: {
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'host': 'newerp.kluniversity.in',
                'origin': 'https://newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/'
            }
        });

        const cookieMap = new Map();
        const collectCookies = (r) => {
            let sc = [];
            if (typeof r.headers.getSetCookie === 'function') {
                sc = r.headers.getSetCookie();
            } else if (typeof r.headers.raw === 'function') {
                sc = r.headers.raw()['set-cookie'] || [r.headers.get('set-cookie')].filter(Boolean);
            } else {
                const val = r.headers.get('set-cookie');
                if (val) sc = val.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
            }
            sc.forEach(c => {
                const pair = c.split(';')[0];
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        };

        collectCookies(response);

        const html = await response.text();
        const csrfMatch = html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/i) || 
                          html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/i) ||
                          html.match(/name=["']_csrf(?:-frontend)?["']\s+value=["']([^"']+)["']/i) ||
                          html.match(/value=["']([^"']+)["']\s+name=["']_csrf(?:-frontend)?["']/i);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        const imgMatch = html.match(/id=["']loginFormCaptcha-image["']\s+src=["']([^"']+)["']/i) ||
                         html.match(/src=["']([^"']+)["']\s+id=["']loginFormCaptcha-image["']/i) ||
                         html.match(/id=["']loginFormCaptcha-image["'][\s\S]*?src=["']([^"']+)["']/i) ||
                         html.match(/src=["']([^"']+)["'][\s\S]*?id=["']loginFormCaptcha-image["']/i);
        let captchaImgUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : '/index.php?r=site%2Fcaptcha';
        if (!captchaImgUrl.startsWith('http')) {
            captchaImgUrl = 'https://newerp.kluniversity.in' + (captchaImgUrl.startsWith('/') ? '' : '/') + captchaImgUrl;
        }

        const cookiePairs = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        const imgResp = await fetch(captchaImgUrl, {
            headers: {
                'cookie': cookiePairs,
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'host': 'newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/'
            }
        });

        collectCookies(imgResp);

        const imgBuf = Buffer.from(await imgResp.arrayBuffer());
        const captchaBase64 = `data:image/png;base64,${imgBuf.toString('base64')}`;

        const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        if (finalCookies) {
            res.setHeader('x-set-erp-cookie', finalCookies);
            const rewrittenCookies = Array.from(cookieMap.entries()).map(([k, v]) => {
                return `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`;
            });
            res.setHeader('Set-Cookie', rewrittenCookies);
        }

        res.json({
            success: true,
            csrfToken,
            captchaUrl: captchaBase64,
            cookies: finalCookies
        });
    } catch (e) {
        console.error("session-init error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Fast Captcha Refresh Endpoint
app.get('/api/refresh-captcha', async (req, res) => {
    try {
        const clientCookie = req.headers['x-erp-cookie'] || req.headers['cookie'] || '';

        // If client has no session cookie, redirect to session-init
        if (!clientCookie) {
            return res.redirect(307, '/api/session-init');
        }

        const cookieMap = new Map();
        clientCookie.split(';').forEach(p => {
            const [k, ...v] = p.split('=');
            if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
        });

        const collectCookies = (r) => {
            let sc = [];
            if (typeof r.headers.getSetCookie === 'function') {
                sc = r.headers.getSetCookie();
            } else if (typeof r.headers.raw === 'function') {
                sc = r.headers.raw()['set-cookie'] || [r.headers.get('set-cookie')].filter(Boolean);
            } else {
                const val = r.headers.get('set-cookie');
                if (val) sc = val.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
            }
            sc.forEach(c => {
                const pair = c.split(';')[0];
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        };

        const refreshUrl = 'https://newerp.kluniversity.in/index.php?r=site%2Fcaptcha&refresh=1';
        let refreshResp = await fetch(refreshUrl, {
            headers: {
                'cookie': Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'host': 'newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/'
            }
        });

        collectCookies(refreshResp);

        let targetImg = null;
        if (refreshResp.ok) {
            const data = await refreshResp.json().catch(() => null);
            if (data && data.url) {
                targetImg = data.url;
            }
        }

        let freshCsrf = '';
        if (!targetImg) {
            const fallbackResp = await fetch('https://newerp.kluniversity.in/index.php', {
                headers: {
                    'cookie': Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
                    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'referer': 'https://newerp.kluniversity.in/'
                }
            });
            collectCookies(fallbackResp);
            const fbHtml = await fallbackResp.text();
            const cm = fbHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || 
                       fbHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                       fbHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                       fbHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
            if (cm) freshCsrf = cm[1];
            const im = fbHtml.match(/id=["']loginFormCaptcha-image["']\s+src=["']([^"']+)["']/i) ||
                       fbHtml.match(/src=["']([^"']+)["']\s+id=["']loginFormCaptcha-image["']/i);
            targetImg = im ? im[1].replace(/&amp;/g, '&') : '/index.php?r=site%2Fcaptcha';
        } else {
            // Also fetch fresh CSRF token for the session from index.php
            try {
                const pageResp = await fetch('https://newerp.kluniversity.in/index.php', {
                    headers: {
                        'cookie': Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
                        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    }
                });
                collectCookies(pageResp);
                const pageHtml = await pageResp.text();
                const cm = pageHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || 
                           pageHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                           pageHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                           pageHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                if (cm) freshCsrf = cm[1];
            } catch (e) {
                console.warn("[Refresh Captcha] Notice retrieving CSRF:", e.message);
            }
        }

        if (!targetImg.startsWith('http')) {
            targetImg = 'https://newerp.kluniversity.in' + (targetImg.startsWith('/') ? '' : '/') + targetImg;
        }

        const mergedCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        const imgResp = await fetch(targetImg, {
            headers: {
                'cookie': mergedCookieStr,
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'host': 'newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/'
            }
        });

        collectCookies(imgResp);

        const imgBuf = Buffer.from(await imgResp.arrayBuffer());
        const captchaBase64 = `data:image/png;base64,${imgBuf.toString('base64')}`;
        const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        if (finalCookies) {
            res.setHeader('x-set-erp-cookie', finalCookies);
            const rewrittenCookies = Array.from(cookieMap.entries()).map(([k, v]) => {
                return `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`;
            });
            res.setHeader('Set-Cookie', rewrittenCookies);
        }

        res.json({
            success: true,
            captchaUrl: captchaBase64,
            cookies: finalCookies,
            csrfToken: freshCsrf
        });
    } catch (e) {
        console.error("refresh-captcha error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Low-Latency Fast Attendance Proxy with Self-Healing (< 1s execution)
app.post('/api/fast-attendance', async (req, res) => {
    try {
        const { yearId, semId, csrfToken, year, semester } = req.body || {};
        let clientCookie = req.headers['x-erp-cookie'] || req.headers['cookie'] || '';

        if (!clientCookie) {
            return res.status(401).json({ success: false, sessionExpired: true, error: 'Session cookie missing. Please log in.' });
        }

        const cookieMap = new Map();
        clientCookie.split(';').forEach(p => {
            const [k, ...v] = p.split('=');
            if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
        });

        const collectCookies = (r) => {
            let sc = [];
            if (typeof r.headers.getSetCookie === 'function') {
                sc = r.headers.getSetCookie();
            } else if (typeof r.headers.raw === 'function') {
                sc = r.headers.raw()['set-cookie'] || [r.headers.get('set-cookie')].filter(Boolean);
            } else {
                const val = r.headers.get('set-cookie');
                if (val) sc = val.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
            }
            sc.forEach(c => {
                const pair = c.split(';')[0];
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        };

        const tStart = Date.now();
        let currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        let currentCsrf = csrfToken || '';

        // 1. Prime the controller session via searchgetinput and discover real dynamic option values
        let resolvedYearId = String(yearId || '').trim();
        let resolvedSemId = String(semId || '').trim();
        let selectedYearText = '';
        let selectedSemText = '';
        const availableYears = [];
        const availableSemesters = [];

        try {
            let inputResp = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput', {
                method: 'GET',
                headers: {
                    'cookie': currentCookieStr,
                    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'host': 'newerp.kluniversity.in',
                    'referer': 'https://newerp.kluniversity.in/index.php',
                    'cache-control': 'no-cache'
                },
                redirect: 'manual'
            });

            if (inputResp.status === 404) {
                inputResp = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Findex', {
                    method: 'GET',
                    headers: {
                        'cookie': currentCookieStr,
                        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'host': 'newerp.kluniversity.in',
                        'referer': 'https://newerp.kluniversity.in/index.php',
                        'cache-control': 'no-cache'
                    },
                    redirect: 'manual'
                });
            }

            collectCookies(inputResp);
            currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

            let finalInputResp = inputResp;
            if (inputResp.status >= 300 && inputResp.status < 400) {
                const loc = inputResp.headers.get('location') || inputResp.headers.get('x-redirect') || '';
                if (loc.toLowerCase().includes('login')) {
                    const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                    res.setHeader('x-set-erp-cookie', finalCookies);
                    return res.status(401).json({
                        success: false,
                        sessionExpired: true,
                        error: 'Your session has expired. Please log out and sign in again.'
                    });
                }
                if (loc) {
                    const nextUrl = loc.startsWith('http') ? loc : `https://newerp.kluniversity.in${loc.startsWith('/') ? '' : '/'}${loc}`;
                    finalInputResp = await fetch(nextUrl, {
                        headers: {
                            'cookie': currentCookieStr,
                            'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'cache-control': 'no-cache'
                        },
                        redirect: 'manual'
                    });
                    collectCookies(finalInputResp);
                    currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                }
            }

            if (finalInputResp.ok) {
                const inputHtml = await finalInputResp.text();
                if (inputHtml.includes('id="login-form"') || inputHtml.includes('loginFormUserNameID')) {
                    return res.status(401).json({
                        success: false,
                        sessionExpired: true,
                        error: 'Your session has expired. Please log out and sign in again.'
                    });
                }

                // Extract fresh CSRF token
                const csrfMatch = inputHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                                  inputHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                  inputHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i);
                if (csrfMatch && csrfMatch[1]) {
                    currentCsrf = csrfMatch[1];
                }

                // Parse academic year dropdown options
                const yearSelectMatch = inputHtml.match(/<select[^>]*(?:name=["'](?:DynamicModel\[academicyear\]|academicyear)["']|id=["'](?:dynamicmodel-academicyear|academicyear)["'])[^>]*>([\s\S]*?)<\/select>/i);
                if (yearSelectMatch && yearSelectMatch[1]) {
                    const optRegex = /<option\s+([^>]*)>([^<]*)<\/option>/gi;
                    let m;
                    while ((m = optRegex.exec(yearSelectMatch[1])) !== null) {
                        const attrs = m[1];
                        const text = m[2].trim();
                        const valMatch = attrs.match(/value=["']([^"']*)["']/i);
                        const val = valMatch ? valMatch[1].trim() : '';
                        const isSelected = /selected/i.test(attrs);
                        if (val) {
                            availableYears.push({ val, text, isSelected });
                            if (isSelected) {
                                selectedYearText = text;
                            }
                        }
                    }
                }

                // Parse semester dropdown options
                const semSelectMatch = inputHtml.match(/<select[^>]*(?:name=["'](?:DynamicModel\[semesterid\]|semesterid)["']|id=["'](?:dynamicmodel-semesterid|semesterid)["'])[^>]*>([\s\S]*?)<\/select>/i);
                if (semSelectMatch && semSelectMatch[1]) {
                    const optRegex = /<option\s+([^>]*)>([^<]*)<\/option>/gi;
                    let m;
                    while ((m = optRegex.exec(semSelectMatch[1])) !== null) {
                        const attrs = m[1];
                        const text = m[2].trim();
                        const valMatch = attrs.match(/value=["']([^"']*)["']/i);
                        const val = valMatch ? valMatch[1].trim() : '';
                        const isSelected = /selected/i.test(attrs);
                        if (val) {
                            availableSemesters.push({ val, text, isSelected });
                            if (isSelected) {
                                selectedSemText = text;
                            }
                        }
                    }
                }

                // Resolve target academic year with thorough matching - text match FIRST!
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
                        matchedYear = availableYears.find(y => (y.val || y.value) === directId);
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
                        matchedYear = availableYears.find(y => (y.val || y.value) === reqYearId || (y.val || y.value) === reqYearStr);
                    }

                    // 5. If still no match and no year was requested, default to selected or first ERP option
                    if (!matchedYear && !reqYearStr && !reqYearId) {
                        matchedYear = availableYears.find(y => y.isSelected) || availableYears[0];
                    }
                }

                if (matchedYear) {
                    resolvedYearId = matchedYear.val;
                    selectedYearText = matchedYear.text;
                }

                // Resolve target semester with thorough matching - text match FIRST!
                const reqSemStr = (semester || '').toString().trim().toLowerCase();
                const reqSemId = (semId || '').toString().trim();
                let matchedSem = null;

                if (availableSemesters.length > 0) {
                    // 1. Text or substring match FIRST (ground truth)
                    if (reqSemStr) {
                        matchedSem = availableSemesters.find(s => s.text.toLowerCase() === reqSemStr || s.text.toLowerCase().includes(reqSemStr));
                    }
                    // 2. Keyword matching (Odd vs Even vs Summer)
                    if (!matchedSem) {
                        if (reqSemStr.includes('odd') || reqSemId === '1') {
                            matchedSem = availableSemesters.find(s => s.text.toLowerCase().includes('odd') || s.val === '1');
                        } else if (reqSemStr.includes('even') || reqSemId === '2') {
                            matchedSem = availableSemesters.find(s => s.text.toLowerCase().includes('even') || s.val === '2');
                        } else if (reqSemStr.includes('summer') || reqSemId === '3') {
                            matchedSem = availableSemesters.find(s => s.text.toLowerCase().includes('summer') || s.val === '3');
                        }
                    }
                    // 3. Direct val match fallback
                    if (!matchedSem && reqSemId) {
                        matchedSem = availableSemesters.find(s => s.val === reqSemId);
                    }
                }

                if (matchedSem) {
                    resolvedSemId = matchedSem.val;
                    selectedSemText = matchedSem.text;
                }
            }
        } catch (primeErr) {
            console.warn('[Fast Attendance] Pre-priming notice:', primeErr);
        }

        // Fallback robust mappings if options couldn't be discovered dynamically
        const getFallbackYearId = (y) => {
            const str = String(y || '').trim();
            if (str.startsWith('2026') || str === '18' || str.includes('26')) return '29';
            if (str.startsWith('2025') || str === '17' || str.includes('25')) return '28';
            if (str.startsWith('2024') || str === '16' || str.includes('24')) return '27';
            if (str.startsWith('2023') || str === '15' || str.includes('23')) return '26';
            if (str.startsWith('2022') || str === '14') return '14';
            if (str.startsWith('2021') || str === '13') return '13';
            if (str.startsWith('2020') || str === '10') return '10';
            if (str.startsWith('2019') || str === '9') return '9';
            if (str.startsWith('2018') || str === '8') return '8';
            if (str.startsWith('2017') || str === '7') return '7';
            if (str.startsWith('2016') || str === '6') return '6';
            return str || '29';
        };
        const getFallbackSemId = (s) => {
            const str = String(s || '').trim().toLowerCase();
            if (str.includes('even') || str === '2') return '2';
            if (str.includes('summer') || str === '3') return '3';
            if (str.includes('term') || str === '4') return '4';
            return '1';
        };

        if (!resolvedYearId) resolvedYearId = getFallbackYearId(year || yearId);
        if (!resolvedSemId) resolvedSemId = getFallbackSemId(semester || semId);

        console.log(`[Fast Attendance] Querying courselist -> Year: ${resolvedYearId} ("${selectedYearText}"), Sem: ${resolvedSemId} ("${selectedSemText}")`);

        const buildFormData = (token, yId, sId) => {
            const formData = new URLSearchParams();
            formData.append('DynamicModel[academicyear]', String(yId));
            formData.append('DynamicModel[semesterid]', String(sId));
            formData.append('DynamicModel[academic_year]', String(yId));
            formData.append('DynamicModel[semester_id]', String(sId));
            formData.append('academicyear', String(yId));
            formData.append('semesterid', String(sId));
            if (token) {
                formData.append('_csrf', token);
                formData.append('_csrf-frontend', token);
            }
            return formData.toString();
        };

        const buildHeaders = (cStr, token) => ({
            'content-type': 'application/x-www-form-urlencoded',
            'x-requested-with': 'XMLHttpRequest',
            'cache-control': 'no-cache',
            'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'host': 'newerp.kluniversity.in',
            'origin': 'https://newerp.kluniversity.in',
            'referer': 'https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput',
            ...(cStr ? { 'cookie': cStr } : {}),
            ...(token ? { 'x-csrf-token': token } : {})
        });

        // 2. Query courselist directly with primed session
        let response = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
            method: 'POST',
            headers: buildHeaders(currentCookieStr, currentCsrf),
            body: buildFormData(currentCsrf, resolvedYearId, resolvedSemId),
            redirect: 'manual',
            cache: 'no-store'
        });

        collectCookies(response);
        currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        let isRedirect = (response.status >= 300 && response.status < 400);
        let loc = response.headers.get('location') || response.headers.get('x-redirect') || '';
        let isRedirectToLogin = isRedirect && loc.toLowerCase().includes('login');

        if (isRedirect && !isRedirectToLogin && loc) {
            let targetLoc = loc.startsWith('http')
                ? loc.replace(/^http:/i, 'https:')
                : 'https://newerp.kluniversity.in' + (loc.startsWith('/') ? '' : '/') + loc;
            const followResp = await fetch(targetLoc, {
                headers: buildHeaders(currentCookieStr, currentCsrf),
                redirect: 'manual'
            });
            collectCookies(followResp);
            if (followResp.ok) {
                response = followResp;
            }
        }

        const latencyMs = Date.now() - tStart;
        const html = await response.text();
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

        const hasLoginForm = html.includes('id="login-form"') || html.includes('loginFormUserNameID');
        const isSessionExpired = response.status === 401 || isRedirectToLogin || hasLoginForm;
        const hasTable = html.includes('<table') || html.includes('grid-view') || html.includes('Course Code') || html.includes('Course Title') || html.includes('L-T-P-S');

        const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        if (finalCookies) {
            res.setHeader('x-set-erp-cookie', finalCookies);
            const rewrittenCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`);
            res.setHeader('Set-Cookie', rewrittenCookies);
        }

        console.log(`[Fast Attendance] Completed in ${latencyMs}ms, status: ${response.status}, HTML length: ${html.length}, hasTable: ${hasTable}, sessionExpired: ${isSessionExpired}`);

        return res.json({
            success: (response.ok || hasTable) && !isSessionExpired,
            status: response.status,
            latencyMs,
            html,
            csrfToken: currentCsrf,
            resolvedYearId,
            resolvedSemId,
            selectedYearText,
            selectedSemText,
            availableYears,
            availableSemesters,
            sessionExpired: isSessionExpired
        });
    } catch (e) {
        console.error('[Fast-Attendance] Error:', e);
        return res.status(500).json({ success: false, error: e.message });
    }
});

// In-memory buffer of recent verified student logins
const recentStudentLogins = [];

app.post('/api/logins', (req, res) => {
    try {
        const record = req.body;
        if (record && record.studentId && /^[A-Za-z0-9_.-]{4,20}$/.test(record.studentId)) {
            const recTime = record.timestamp ? new Date(record.timestamp).getTime() : Date.now();
            // Avoid duplicate rapid double-clicks within 2 seconds (allows logins spaced 1 min apart)
            const exists = recentStudentLogins.some(
                l => l.studentId === record.studentId && Math.abs((l.timestamp ? new Date(l.timestamp).getTime() : 0) - recTime) < 2000
            );
            if (!exists) {
                recentStudentLogins.unshift(record);
                if (recentStudentLogins.length > 2000) {
                    recentStudentLogins.length = 2000;
                }
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/logins', (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query?.token;
    if (!verifyAdminToken(token)) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication token required to inspect login audit logs.' });
    }
    res.json({ success: true, logins: recentStudentLogins });
});
function isVerifiedErpDashboard(html, username = '') {
    if (!html || typeof html !== 'string') return false;
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
    if (
        html.includes('The above error occurred while the Web server was processing your request') ||
        html.includes('Incorrect username or password') ||
        html.includes('The verification code is incorrect') ||
        html.includes('Enter Username') ||
        html.includes('Enter Password')
    ) {
        return false;
    }
    const hasLogout = html.includes('logout') || html.includes('site%2Flogout') || html.includes('site/logout');
    const hasStudentModule = html.includes('student') || html.includes('indexindi') || html.includes('attendance') || html.includes('academicyear') || html.includes('courselist');
    const cleanUser = username ? String(username).trim() : '';
    const hasUsername = cleanUser ? html.includes(cleanUser) : false;

    return Boolean(hasLogout || hasStudentModule || hasUsername);
}

// Ultra-fast Login Endpoint (Sub-second login without lag, protected by authLimiter)
app.post('/api/fast-login', authLimiter, async (req, res) => {
    try {
        const { username, password, captcha, csrfToken } = req.body;
        const rawClientCookie = req.headers['x-erp-cookie'] || req.headers['cookie'] || '';

        if (!username || !password || !captcha) {
            return res.status(400).json({ success: false, error: 'Student ID, Password, and Captcha code are required.' });
        }

        // Strict input type & size checks
        if (typeof username !== 'string' || typeof password !== 'string' || typeof captcha !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid input data format.' });
        }
        if (username.length > 50 || password.length > 100 || captcha.length > 20) {
            return res.status(400).json({ success: false, error: 'Input exceeded maximum allowed character length.' });
        }
        if (!/^[A-Za-z0-9_.-]{4,35}$/.test(username.trim())) {
            return res.status(400).json({ success: false, error: 'Invalid Student ID characters.' });
        }

        // Deduplicate cookies to prevent duplicate or stale PHPSESSID keys
        const cookieMap = new Map();
        if (rawClientCookie) {
            rawClientCookie.split(';').forEach(p => {
                const [k, ...v] = p.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        }
        const clientCookie = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        console.log(`[Fast Login] Attempt for student: ${username.trim()} (Captcha: "${captcha.trim()}")`);
        console.log(`[Fast Login] Client Cookie: "${clientCookie.slice(0, 100)}...", csrfToken: "${csrfToken?.slice(0, 40)}..."`);

        let effectiveCsrf = csrfToken;
        if (!effectiveCsrf && clientCookie) {
            console.warn("[Fast Login] Client did not provide CSRF token. Fetching fresh CSRF from ERP...");
            try {
                const initResp = await fetch('https://newerp.kluniversity.in/index.php', {
                    headers: {
                        'cookie': clientCookie,
                        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'referer': 'https://newerp.kluniversity.in/'
                    }
                });
                collectCookies(initResp);
                const initHtml = await initResp.text();
                const m = initHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || 
                          initHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                          initHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                          initHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                if (m) effectiveCsrf = m[1];
            } catch (e) {
                console.warn("[Fast Login] Notice recovering CSRF:", e.message);
            }
        }

        const formData = new URLSearchParams();
        if (effectiveCsrf) formData.append('_csrf', effectiveCsrf);
        formData.append('LoginForm[username]', username.trim());
        formData.append('LoginForm[password]', password);
        formData.append('LoginForm[rememberMe]', '0');
        formData.append('LoginForm[captcha]', captcha.trim());
        formData.append('LoginForm[qr_code]', '');
        formData.append('login-button', '');

        const loginResp = await fetch('https://newerp.kluniversity.in/index.php?r=site%2Flogin', {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'cookie': clientCookie,
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'origin': 'https://newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/',
                'x-csrf-token': effectiveCsrf || ''
            },
            body: formData.toString(),
            redirect: 'manual'
        });

        const collectCookies = (r) => {
            let sc = [];
            if (typeof r.headers.getSetCookie === 'function') {
                sc = r.headers.getSetCookie();
            } else if (typeof r.headers.raw === 'function') {
                sc = r.headers.raw()['set-cookie'] || [r.headers.get('set-cookie')].filter(Boolean);
            } else {
                const val = r.headers.get('set-cookie');
                if (val) sc = val.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
            }
            sc.forEach(c => {
                const pair = c.split(';')[0];
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        };

        collectCookies(loginResp);

        console.log(`[Fast Login] ERP response status: ${loginResp.status}, Location: ${loginResp.headers.get('location') || 'none'}`);

        // If status is 302, authentication succeeded or redirected
        if (loginResp.status === 302) {
            let nextLoc = loginResp.headers.get('location') || loginResp.headers.get('x-redirect') || '/index.php';

            // If redirect points back to login, fetch the redirected page to extract the precise error message!
            if (nextLoc.includes('site%2Flogin') || nextLoc.includes('site/login')) {
                const allCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                res.setHeader('x-set-erp-cookie', allCookies);

                let errorMsg = 'Incorrect username or password. Please verify your credentials.';
                try {
                    const failResp = await fetch('https://newerp.kluniversity.in/index.php?r=site%2Flogin', {
                        headers: {
                            'cookie': allCookies,
                            'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'host': 'newerp.kluniversity.in',
                            'origin': 'https://newerp.kluniversity.in',
                            'referer': 'https://newerp.kluniversity.in/'
                        }
                    });
                    const failHtml = await failResp.text();
                    const failCsrfMatch = failHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || 
                                          failHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                                          failHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                                          failHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
                    const freshFailCsrf = failCsrfMatch ? failCsrfMatch[1] : '';

                    const capMatch = failHtml.match(/class="[^"]*(?:field-loginFormCaptcha|field-loginform-captcha)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                    const pwdMatch = failHtml.match(/class="[^"]*(?:field-loginFormPasswordID|field-loginform-password)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                    const usrMatch = failHtml.match(/class="[^"]*(?:field-loginFormUserNameID|field-loginform-username)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                    const anyMatch = failHtml.match(/class="[^"]*has-error[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
                    const alertMatch = failHtml.match(/class="[^"]*(?:alert-danger|error-summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

                    const cleanMsg = (m) => m ? m.replace(/<[^>]+>/g, '').trim() : '';

                    if (cleanMsg(capMatch?.[1])) errorMsg = cleanMsg(capMatch[1]);
                    else if (cleanMsg(pwdMatch?.[1])) errorMsg = cleanMsg(pwdMatch[1]);
                    else if (cleanMsg(usrMatch?.[1])) errorMsg = cleanMsg(usrMatch[1]);
                    else if (cleanMsg(anyMatch?.[1])) errorMsg = cleanMsg(anyMatch[1]);
                    else if (cleanMsg(alertMatch?.[1])) errorMsg = cleanMsg(alertMatch[1]);

                    console.warn(`[Fast Login] Redirected back to login form. Parsed error: "${errorMsg}"`);

                    return res.status(401).json({
                        success: false,
                        error: errorMsg,
                        cookies: allCookies,
                        csrfToken: freshFailCsrf
                    });
                } catch {
                    return res.status(401).json({
                        success: false,
                        error: errorMsg,
                        cookies: allCookies
                    });
                }
            }

            let currentTarget = nextLoc.startsWith('http')
                ? nextLoc.replace(/^http:/i, 'https:')
                : 'https://newerp.kluniversity.in' + (nextLoc.startsWith('/') ? '' : '/') + nextLoc;

            let finalResp = null;
            // Follow up to 5 redirect hops to reach the authenticated dashboard
            for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
                const cookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                console.log(`[Fast Login] Redirect hop #${redirectCount + 1}: ${currentTarget}`);

                finalResp = await fetch(currentTarget, {
                    method: 'GET',
                    headers: {
                        'cookie': cookieStr,
                        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'host': 'newerp.kluniversity.in',
                        'referer': 'https://newerp.kluniversity.in/'
                    },
                    redirect: 'manual'
                });

                collectCookies(finalResp);

                if (finalResp.status >= 300 && finalResp.status < 400) {
                    const loc = finalResp.headers.get('location') || finalResp.headers.get('x-redirect');
                    if (!loc) break;
                    if (loc.includes('site%2Flogin') || loc.includes('site/login')) {
                        console.warn("[Fast Login] ERP redirected back to login; credentials rejected.");
                        break;
                    }
                    currentTarget = loc.startsWith('http')
                        ? loc.replace(/^http:/i, 'https:')
                        : 'https://newerp.kluniversity.in' + (loc.startsWith('/') ? '' : '/') + loc;
                } else {
                    break;
                }
            }

            const allCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
            let dashHtml = finalResp ? await finalResp.text() : '';

            // Authentication verification: Only proceed if session is verified
            const isLoginForm = dashHtml.includes('id="login-form"') || dashHtml.includes('loginFormUserNameID');
            if (isLoginForm) {
                console.warn("[Fast Login] Final landing page has login-form. Rejecting unverified login.");
                return res.status(401).json({
                    success: false,
                    error: 'Incorrect username or password. Please verify your credentials.',
                    cookies: allCookies
                });
            }

            // Ensure rich dashboard HTML is available for student attendance discovery
            if (!dashHtml || (!dashHtml.includes('logout') && !dashHtml.includes('student') && !dashHtml.includes('indexindi'))) {
                try {
                    console.log("[Fast Login] Fetching student dashboard HTML from student/indexindi...");
                    const indiResp = await fetch('https://newerp.kluniversity.in/index.php?r=student%2Findexindi', {
                        headers: {
                            'cookie': allCookies,
                            'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'host': 'newerp.kluniversity.in',
                            'referer': 'https://newerp.kluniversity.in/index.php'
                        }
                    });
                    collectCookies(indiResp);
                    if (indiResp.ok) {
                        const indiHtml = await indiResp.text();
                        if (indiHtml && !indiHtml.includes('id="login-form"')) {
                            dashHtml = indiHtml;
                        }
                    }
                } catch (e) {
                    console.warn("[Fast Login] Optional indexindi fetch notice:", e.message);
                }
            }

            // Extract fresh post-login CSRF token directly from dashboard HTML
            const csrfMatch = dashHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || dashHtml.match(/content="([^"]+)"\s+name="csrf-token"/i);
            const postLoginCsrf = csrfMatch ? csrfMatch[1] : (csrfToken || '');

            // Strictly verify that dashHtml represents an active student session
            if (!isVerifiedErpDashboard(dashHtml, username)) {
                console.warn(`[Fast Login] ERP login could not be verified for ${username.trim()}. Rejecting unverified login.`);
                return res.status(401).json({
                    success: false,
                    error: 'Incorrect Student ID, Password, or Captcha. Please verify your credentials.',
                    cookies: allCookies
                });
            }

            res.setHeader('x-set-erp-cookie', allCookies);
            const rewrittenCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`);
            res.setHeader('Set-Cookie', rewrittenCookies);

            console.log(`[Fast Login] Login successful & verified for student: ${username.trim()}`);
            try {
                const sRoll = String(username).trim().toUpperCase();
                if (/^\d{8,12}$/.test(sRoll)) {
                    const nowTs = new Date().toISOString();
                    const nowMs = Date.now();
                    const isDup = recentStudentLogins.some(
                        l => l.studentId === sRoll && Math.abs((l.timestamp ? new Date(l.timestamp).getTime() : 0) - nowMs) < 2000
                    );
                    if (!isDup) {
                        recentStudentLogins.unshift({
                            id: `log_${nowMs}_${sRoll}`,
                            studentId: sRoll,
                            timestamp: nowTs,
                            source: 'ERP Portal',
                            device: 'Web Browser'
                        });
                        if (recentStudentLogins.length > 2000) recentStudentLogins.length = 2000;
                    }
                }
            } catch {
                // non-critical buffer notice
            }

            return res.json({
                success: true,
                verified: true,
                cookies: allCookies,
                csrfToken: postLoginCsrf,
                html: dashHtml
            });
        }

        // Authentication failed - parse ERP error message from 200 response
        const failHtml = await loginResp.text();
        const failCsrfMatch = failHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || 
                              failHtml.match(/content="([^"]+)"\s+name="csrf-token"/i) ||
                              failHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/i) ||
                              failHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/i);
        const freshFailCsrf = failCsrfMatch ? failCsrfMatch[1] : '';

        const allCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        res.setHeader('x-set-erp-cookie', allCookies);

        let errorMsg = 'Incorrect username or password. Please verify your credentials.';
        const capMatch = failHtml.match(/class="[^"]*(?:field-loginFormCaptcha|field-loginform-captcha)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
        const pwdMatch = failHtml.match(/class="[^"]*(?:field-loginFormPasswordID|field-loginform-password)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
        const usrMatch = failHtml.match(/class="[^"]*(?:field-loginFormUserNameID|field-loginform-username)[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
        const anyMatch = failHtml.match(/class="[^"]*has-error[^"]*"[\s\S]*?<div class="help-block[^"]*">([\s\S]*?)<\/div>/i);
        const alertMatch = failHtml.match(/class="[^"]*(?:alert-danger|error-summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

        const cleanMsg = (m) => m ? m.replace(/<[^>]+>/g, '').trim() : '';

        if (cleanMsg(capMatch?.[1])) {
            errorMsg = cleanMsg(capMatch[1]);
        } else if (cleanMsg(pwdMatch?.[1])) {
            errorMsg = cleanMsg(pwdMatch[1]);
        } else if (cleanMsg(usrMatch?.[1])) {
            errorMsg = cleanMsg(usrMatch[1]);
        } else if (cleanMsg(anyMatch?.[1])) {
            errorMsg = cleanMsg(anyMatch[1]);
        } else if (cleanMsg(alertMatch?.[1])) {
            errorMsg = cleanMsg(alertMatch[1]);
        }

        if (loginResp.status === 400 && errorMsg === 'Incorrect username or password. Please verify your credentials.') {
            errorMsg = 'Session verification timed out. Please enter the new captcha to sign in.';
        } else if (loginResp.status === 429) {
            errorMsg = 'Too many attempts on ERP. Please wait 1-2 minutes and try again.';
        }

        console.warn(`[Fast Login] ERP login rejected (status ${loginResp.status}). Parsed error: "${errorMsg}". Snippet: ${failHtml.slice(0, 300).replace(/\s+/g, ' ')}`);

        return res.status(401).json({
            success: false,
            error: errorMsg,
            cookies: allCookies,
            csrfToken: freshFailCsrf
        });
    } catch (err) {
        console.error("fast-login error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Gemini Proxy Endpoint (Rate-limited & input-validated)
app.post('/api/ai/gemini', aiLimiter, async (req, res) => {
    try {
        const { contents, systemInstruction, model: modelName } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API key not configured on server." });
        }

        if (!contents) {
            return res.status(400).json({ error: "Prompt contents are required." });
        }

        const promptLen = typeof contents === 'string' ? contents.length : JSON.stringify(contents).length;
        if (promptLen > 50000) {
            return res.status(400).json({ error: "Prompt contents exceed maximum permissible size (50KB)." });
        }

        const allowedModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        const targetModel = allowedModels.includes(modelName) ? modelName : "gemini-2.0-flash";

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const safeSystemInstruction = typeof systemInstruction === 'string' ? systemInstruction.slice(0, 5000) : undefined;
        const model = genAI.getGenerativeModel({ model: targetModel, systemInstruction: safeSystemInstruction });

        const result = await model.generateContent(contents);
        const response = await result.response;
        const text = response.text();
        res.json({ text });
    } catch (error) {
        console.error("Gemini Proxy Error:", error.message);
        res.status(500).json({ 
            error: "Failed to fetch from Gemini. Please try again later.",
            details: process.env.NODE_ENV === "production" ? undefined : error.message 
        });
    }
});

// Timetable Fetch Endpoint (Rate-limited)
app.post('/api/fetch_timetable', timetableLimiter, async (req, res) => {
    try {
        const { username } = req.body;
        
        // This is a proxy to the ERP. In a real scenario, this would involve 
        // complex session handling. For this implementation, we assume 
        // the ERP session is already established or handled via cookies.
        
        console.log(`[Fetch-Timetable] Request for: ${username}`);
        
        // Note: Actual implementation would require forwarding cookies and handling ERP auth.
        // For now, we return a mock success to verify the connectivity.
        res.json({ 
            success: true, 
            message: "Endpoint reachable. In a live environment, this would proxy the ERP response.",
            timetable: {} // App will fallback to parsing if empty
        });
    } catch (error) {
        console.error("Fetch Timetable Error:", error.message);
        res.status(500).json({ success: false, message: "Server error during timetable fetch" });
    }
});

// Simple health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Root health path so it doesn't show "Cannot GET /"
app.get('/', (req, res) => {
    res.send('KL Attendance Backend is Running successfully!');
});

// Captcha endpoint
app.get('/api/captcha', (req, res) => {
    try {
        const captcha = svgCaptcha.create({
            size: 5,
            noise: 3,
            color: false, // Outputs black/grey text instead of multi-colored
            ignoreChars: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", // Leave only numbers
            background: '#ffffff'
        });

        req.session.captcha = captcha.text;
        res.type("svg");
        res.status(200).send(captcha.data);
    } catch (error) {
        console.error('Captcha generation error:', error);
        res.status(500).json({ error: 'Failed to generate captcha' });
    }
});

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: { success: false, message: "Too many login attempts from this IP, please try again after a minute." }
});

app.post('/api/verify-captcha', loginLimiter, (req, res) => {
    const { captcha } = req.body || {};
    const isValid = captcha && req.session.captcha &&
        captcha.toString().toLowerCase() === req.session.captcha.toLowerCase();

    if (!isValid) return res.status(400).json({ success: false, message: "Invalid captcha" });
    res.json({ success: true });
});

// Admin Authentication Endpoints (Using top-level cryptographic token helpers)

app.post('/api/admin/login', adminAuthLimiter, (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password);

    const expectedHash = ADMIN_CREDENTIAL_HASHES[cleanUser];
    if (!expectedHash) {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials. Access Denied.' });
    }

    const inputHash = crypto.createHash('sha256').update(`${ADMIN_SALT}:${cleanUser}:${cleanPass}`).digest('hex');
    
    // Constant-time timing safe comparison
    if (inputHash.length !== expectedHash.length || !crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash))) {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials. Access Denied.' });
    }

    const token = generateAdminToken(cleanUser);
    return res.json({ success: true, token, user: cleanUser });
});

app.post('/api/admin/verify', (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.body?.token;
    const verified = verifyAdminToken(token);
    if (!verified) {
        return res.status(401).json({ success: false, valid: false });
    }
    return res.json({ success: true, valid: true, user: verified.sub });
});

// Global Error Handler to ensure ALL errors are returned as JSON, never HTML
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("Global Error Caught:", err.message);
    res.status(err.status || 500).json({
        success: false,
        error: "Server Error",
        message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message
    });
});

app.listen(PORT, () => {
    console.log(`Hardened AI Proxy Server running on http://localhost:${PORT}`);
});
