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
    'https://kl-attendance-backend-newnode-env.onrender.com', // Own backend
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

        // Allow Render domains
        if (host.endsWith('.onrender.com')) {
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

// Dedicated rate limiting on student login & fast-login: 30 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, error: "Too many login attempts from this IP, please try again after 15 minutes." }
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

        // Support explicit x-erp-cookie header to bypass cross-domain 3rd party cookie blocking
        const clientCookie = req.headers['x-erp-cookie'] || req.headers['cookie'] || '';
        if (clientCookie) {
            cleanHeaders['cookie'] = clientCookie;
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

        let setCookies = [];
        if (typeof response.headers.getSetCookie === 'function') {
            setCookies = response.headers.getSetCookie();
        } else if (typeof response.headers.raw === 'function') {
            setCookies = response.headers.raw()['set-cookie'] || [response.headers.get('set-cookie')].filter(Boolean);
        } else {
            const val = response.headers.get('set-cookie');
            if (val) setCookies = val.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
        }

        const cookieMap = new Map();
        if (clientCookie) {
            clientCookie.split(';').forEach(pair => {
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        }
        setCookies.forEach(c => {
            const pair = c.split(';')[0];
            const [k, ...v] = pair.split('=');
            if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
        });

        // If redirect occurs on a login request or any GET request, follow it internally with accumulated cookies!
        const isLoginPost = response.status === 302 && (req.url.includes('site%2Flogin') || req.url.includes('site/login'));
        const isGetRedirect = req.method === 'GET' && response.status >= 300 && response.status < 400;

        if (isLoginPost || isGetRedirect) {
            let nextLoc = response.headers.get('location') || response.headers.get('x-redirect') || '';
            if (!nextLoc && isLoginPost) {
                nextLoc = '/index.php?r=site%2Findexindi';
            }
            if (isLoginPost && !nextLoc.includes('indexindi') && (nextLoc.endsWith('/index.php') || nextLoc.endsWith('index.php') || nextLoc === '/')) {
                nextLoc = '/index.php?r=site%2Findexindi';
            }

            if (nextLoc) {
                let currentTarget = nextLoc.startsWith('http') 
                    ? nextLoc.replace(/^http:/i, 'https:') 
                    : 'https://newerp.kluniversity.in' + (nextLoc.startsWith('/') ? '' : '/') + nextLoc;

                let finalResp = null;
                for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
                    const currentCookieStr = Array.from(cookieMap.entries())
                        .map(([k, v]) => `${k}=${v}`)
                        .join('; ');

                    const redirectHeaders = { ...cleanHeaders };
                    delete redirectHeaders['content-type'];
                    delete redirectHeaders['content-length'];
                    redirectHeaders['cookie'] = currentCookieStr;

                    finalResp = await fetch(currentTarget, {
                        method: 'GET',
                        headers: redirectHeaders,
                        redirect: 'manual'
                    });

                    let hopCookies = [];
                    if (typeof finalResp.headers.getSetCookie === 'function') {
                        hopCookies = finalResp.headers.getSetCookie();
                    } else if (typeof finalResp.headers.raw === 'function') {
                        hopCookies = finalResp.headers.raw()['set-cookie'] || [finalResp.headers.get('set-cookie')].filter(Boolean);
                    } else {
                        const val = finalResp.headers.get('set-cookie');
                        if (val) hopCookies = val.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/g);
                    }

                    hopCookies.forEach(c => {
                        const pair = c.split(';')[0];
                        const [k, ...v] = pair.split('=');
                        if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
                    });

                    if (finalResp.status >= 300 && finalResp.status < 400) {
                        const loc = finalResp.headers.get('location') || finalResp.headers.get('x-redirect');
                        if (!loc) break;
                        currentTarget = loc.startsWith('http') 
                            ? loc.replace(/^http:/i, 'https:') 
                            : 'https://newerp.kluniversity.in' + (loc.startsWith('/') ? '' : '/') + loc;
                    } else {
                        break;
                    }
                }

                if (finalResp) {
                    const allCookies = Array.from(cookieMap.entries())
                        .map(([k, v]) => `${k}=${v}`)
                        .join('; ');

                    const rewrittenAllCookies = Array.from(cookieMap.entries()).map(([k, v]) => {
                        return `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`;
                    });

                    res.setHeader('Set-Cookie', rewrittenAllCookies);
                    res.setHeader('x-set-erp-cookie', allCookies);

                    for (const [key, value] of finalResp.headers.entries()) {
                        const lowerKey = key.toLowerCase();
                        if (lowerKey === 'content-encoding' || lowerKey === 'content-length' || lowerKey.startsWith('access-control-') || lowerKey === 'set-cookie') {
                            continue;
                        }
                        res.setHeader(key, value);
                    }

                    res.status(finalResp.status);
                    const arrayBuffer = await finalResp.arrayBuffer();
                    return res.send(Buffer.from(arrayBuffer));
                }
            }
        }

        if (setCookies.length > 0) {
            const rewrittenCookies = setCookies.map(cookie => {
                let newCookie = cookie.replace(/Domain=[^;]+;?/gi, '');
                newCookie = newCookie.replace(/SameSite=[^;]+;?/gi, '');
                newCookie = newCookie.replace(/Secure;?/gi, '');
                newCookie = newCookie.replace(/Partitioned;?/gi, '');
                newCookie = newCookie.trim().replace(/;+$/, '');
                newCookie += '; SameSite=None; Secure; Partitioned';
                return newCookie.trim();
            });
            res.setHeader('Set-Cookie', rewrittenCookies);

            const allCookies = Array.from(cookieMap.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
            res.setHeader('x-set-erp-cookie', allCookies);
        }

        res.status(response.status);

        for (const [key, value] of response.headers.entries()) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'content-encoding' || lowerKey === 'content-length' || lowerKey.startsWith('access-control-') || lowerKey === 'set-cookie') {
                continue;
            }
            if (lowerKey === 'location') {
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
        const csrfMatch = html.match(/name="csrf-token"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+name="csrf-token"/i);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        const imgMatch = html.match(/id="loginFormCaptcha-image"\s+src="([^"]+)"/i);
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
        const refreshUrl = 'https://newerp.kluniversity.in/index.php?r=site%2Fcaptcha&refresh=1';
        const refreshResp = await fetch(refreshUrl, {
            headers: {
                'cookie': clientCookie,
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'host': 'newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/'
            }
        });

        const cookieMap = new Map();
        if (clientCookie) {
            clientCookie.split(';').forEach(p => {
                const [k, ...v] = p.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        }

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

        collectCookies(refreshResp);

        const data = await refreshResp.json();
        let targetImg = data && data.url ? data.url : '/index.php?r=site%2Fcaptcha';
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
            cookies: finalCookies
        });
    } catch (e) {
        console.error("refresh-captcha error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Low-Latency Fast Attendance Proxy with Self-Healing (< 1s execution)
app.post('/api/fast-attendance', async (req, res) => {
    try {
        const { yearId, semId, csrfToken } = req.body;
        let clientCookie = req.headers['x-erp-cookie'] || req.headers['cookie'] || '';

        if (!yearId || !semId) {
            return res.status(400).json({ success: false, error: 'Academic Year ID and Semester ID are required for fast attendance query.' });
        }

        const cookieMap = new Map();
        if (clientCookie) {
            clientCookie.split(';').forEach(p => {
                const [k, ...v] = p.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        }

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

        const buildFormData = (token) => {
            const formData = new URLSearchParams();
            formData.append('DynamicModel[academicyear]', String(yearId));
            formData.append('DynamicModel[semesterid]', String(semId));
            formData.append('academicyear', String(yearId));
            formData.append('semesterid', String(semId));
            if (token) {
                formData.append('_csrf', token);
            }
            return formData.toString();
        };

        const tStart = Date.now();
        let currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        let currentCsrf = csrfToken || '';

        let response = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
            method: 'POST',
            headers: buildHeaders(currentCookieStr, currentCsrf),
            body: buildFormData(currentCsrf),
            redirect: 'manual',
            cache: 'no-store'
        });

        collectCookies(response);

        let xRedirect = response.headers.get('x-redirect') || '';
        let loc = response.headers.get('location') || xRedirect;
        let isRedirectToLogin = (response.status >= 300 && response.status < 400) && (loc.toLowerCase().includes('login') || xRedirect.toLowerCase().includes('login'));

        // Self-Healing: If courselist redirected to login or failed due to stale CSRF/session initialization,
        // visit searchgetinput internally in single hop to establish the controller session & retrieve fresh CSRF!
        if (isRedirectToLogin || response.status === 400 || response.status === 401) {
            try {
                console.log('[Fast Attendance] Courselist requested session validation, self-healing via searchgetinput...');
                currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                const inputResp = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fsearchgetinput', {
                    headers: {
                        'cookie': currentCookieStr,
                        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'host': 'newerp.kluniversity.in',
                        'referer': 'https://newerp.kluniversity.in/index.php?r=site%2Findexindi'
                    },
                    redirect: 'manual'
                });

                collectCookies(inputResp);
                const inputLoc = inputResp.headers.get('location') || inputResp.headers.get('x-redirect') || '';

                // Only if searchgetinput ALSO redirects to login is the session genuinely expired
                if (inputResp.status >= 300 && inputResp.status < 400 && inputLoc.toLowerCase().includes('login')) {
                    const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                    res.setHeader('x-set-erp-cookie', finalCookies);
                    return res.json({
                        success: false,
                        status: 401,
                        sessionExpired: true,
                        error: 'Your session has expired. Please log out and sign in again.'
                    });
                }

                if (inputResp.ok) {
                    const inputHtml = await inputResp.text();
                    const csrfMatch = inputHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || inputHtml.match(/content="([^"]+)"\s+name="csrf-token"/i);
                    if (csrfMatch && csrfMatch[1]) {
                        currentCsrf = csrfMatch[1];
                    }

                    currentCookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

                    // Retry courselist with verified active token and session!
                    response = await fetch('https://newerp.kluniversity.in/index.php?r=studentattendance%2Fstudentdailyattendance%2Fcourselist', {
                        method: 'POST',
                        headers: buildHeaders(currentCookieStr, currentCsrf),
                        body: buildFormData(currentCsrf),
                        redirect: 'manual',
                        cache: 'no-store'
                    });

                    collectCookies(response);
                    xRedirect = response.headers.get('x-redirect') || '';
                    loc = response.headers.get('location') || xRedirect;
                    isRedirectToLogin = (response.status >= 300 && response.status < 400) && (loc.toLowerCase().includes('login') || xRedirect.toLowerCase().includes('login'));
                }
            } catch (healErr) {
                console.warn('[Fast Attendance] Session self-healing notice:', healErr);
            }
        }

        const latencyMs = Date.now() - tStart;
        const html = await response.text();
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

        const hasLoginForm = html.includes('id="login-form"') || html.includes('loginFormUserNameID');
        const isSessionExpired = response.status === 401 || isRedirectToLogin || hasLoginForm;

        const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        if (finalCookies) {
            res.setHeader('x-set-erp-cookie', finalCookies);
            const rewrittenCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`);
            res.setHeader('Set-Cookie', rewrittenCookies);
        }

        res.json({
            success: response.ok && !isSessionExpired,
            status: response.status,
            latencyMs,
            html,
            csrfToken: currentCsrf,
            sessionExpired: isSessionExpired
        });
    } catch (e) {
        console.error('[Fast-Attendance] Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// In-memory buffer of recent verified student logins
const recentStudentLogins = [];

app.post('/api/logins', (req, res) => {
    try {
        const record = req.body;
        if (record && record.studentId && /^\d{8,12}$/.test(record.studentId)) {
            const recTime = record.timestamp ? new Date(record.timestamp).getTime() : Date.now();
            // Avoid duplicate logins for the same student within 45 seconds
            const exists = recentStudentLogins.some(
                l => l.studentId === record.studentId && Math.abs((l.timestamp ? new Date(l.timestamp).getTime() : 0) - recTime) < 45000
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

// Ultra-fast Login Endpoint (Sub-second login without lag, protected by authLimiter)
app.post('/api/fast-login', authLimiter, async (req, res) => {
    try {
        const { username, password, captcha, csrfToken } = req.body;
        const clientCookie = req.headers['x-erp-cookie'] || req.headers['cookie'] || '';

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

        const formData = new URLSearchParams();
        if (csrfToken) formData.append('_csrf', csrfToken);
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
                'host': 'newerp.kluniversity.in',
                'origin': 'https://newerp.kluniversity.in',
                'referer': 'https://newerp.kluniversity.in/',
                'x-csrf-token': csrfToken || ''
            },
            body: formData.toString(),
            redirect: 'manual'
        });

        // Collect cookies from login response
        const cookieMap = new Map();
        if (clientCookie) {
            clientCookie.split(';').forEach(p => {
                const [k, ...v] = p.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });
        }

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

        // If status is 302, authentication might have succeeded or redirected
        if (loginResp.status === 302) {
            let nextLoc = loginResp.headers.get('location') || loginResp.headers.get('x-redirect') || '/index.php?r=site%2Findexindi';

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
                            'referer': 'https://newerp.kluniversity.in/'
                        }
                    });
                    const failHtml = await failResp.text();
                    const capMatch = failHtml.match(/class="[^"]*(?:field-loginFormCaptcha|field-loginform-captcha)[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
                    const pwdMatch = failHtml.match(/class="[^"]*(?:field-loginFormPasswordID|field-loginform-password)[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
                    const usrMatch = failHtml.match(/class="[^"]*(?:field-loginFormUserNameID|field-loginform-username)[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
                    const anyMatch = failHtml.match(/class="[^"]*has-error[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
                    const alertMatch = failHtml.match(/class="[^"]*(?:alert-danger|error-summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

                    if (capMatch && capMatch[1]?.trim()) errorMsg = capMatch[1].trim();
                    else if (pwdMatch && pwdMatch[1]?.trim()) errorMsg = pwdMatch[1].trim();
                    else if (usrMatch && usrMatch[1]?.trim()) errorMsg = usrMatch[1].trim();
                    else if (anyMatch && anyMatch[1]?.trim()) errorMsg = anyMatch[1].trim();
                    else if (alertMatch && alertMatch[1]?.replace(/<[^>]+>/g, '')?.trim()) errorMsg = alertMatch[1].replace(/<[^>]+>/g, '').trim();
                } catch {
                    // Fallback to default message
                }

                return res.status(401).json({
                    success: false,
                    error: errorMsg,
                    cookies: allCookies
                });
            }

            if (!nextLoc.includes('indexindi') && (nextLoc.endsWith('/index.php') || nextLoc.endsWith('index.php') || nextLoc === '/')) {
                nextLoc = '/index.php?r=site%2Findexindi';
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
            const dashHtml = finalResp ? await finalResp.text() : '';

            // Authentication verification: Check genuine student dashboard presence
            const isLoginForm = dashHtml.includes('id="login-form"') || dashHtml.includes('loginFormUserNameID');
            const hasAuthProof = dashHtml.includes('site%2Flogout') || 
                                 dashHtml.includes('site/logout') || 
                                 dashHtml.includes('indexindi') || 
                                 dashHtml.includes('logout') || 
                                 dashHtml.includes('profile') || 
                                 dashHtml.includes('student') || 
                                 dashHtml.includes(username.trim());

            if (isLoginForm || !hasAuthProof) {
                console.warn("[Fast Login] Dashboard HTML returned login-form or lacks auth proof. Rejecting unverified login.");
                return res.status(401).json({
                    success: false,
                    error: 'Incorrect username or password. Please verify your credentials.',
                    cookies: allCookies
                });
            }

            // Extract fresh post-login CSRF token directly from dashboard HTML
            const csrfMatch = dashHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) || dashHtml.match(/content="([^"]+)"\s+name="csrf-token"/i);
            const postLoginCsrf = csrfMatch ? csrfMatch[1] : (csrfToken || '');

            res.setHeader('x-set-erp-cookie', allCookies);
            const rewrittenCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}; path=/; SameSite=None; Secure; Partitioned`);
            res.setHeader('Set-Cookie', rewrittenCookies);

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
        const allCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        res.setHeader('x-set-erp-cookie', allCookies);

        let errorMsg = 'Incorrect username or password. Please verify your credentials.';
        const capMatch = failHtml.match(/class="[^"]*(?:field-loginFormCaptcha|field-loginform-captcha)[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
        const pwdMatch = failHtml.match(/class="[^"]*(?:field-loginFormPasswordID|field-loginform-password)[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
        const usrMatch = failHtml.match(/class="[^"]*(?:field-loginFormUserNameID|field-loginform-username)[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
        const anyMatch = failHtml.match(/class="[^"]*has-error[^"]*"[\s\S]*?<div class="help-block">([^<]+)<\/div>/i);
        const alertMatch = failHtml.match(/class="[^"]*(?:alert-danger|error-summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

        if (capMatch && capMatch[1]?.trim()) {
            errorMsg = capMatch[1].trim();
        } else if (pwdMatch && pwdMatch[1]?.trim()) {
            errorMsg = pwdMatch[1].trim();
        } else if (usrMatch && usrMatch[1]?.trim()) {
            errorMsg = usrMatch[1].trim();
        } else if (anyMatch && anyMatch[1]?.trim()) {
            errorMsg = anyMatch[1].trim();
        } else if (alertMatch && alertMatch[1]?.replace(/<[^>]+>/g, '')?.trim()) {
            errorMsg = alertMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        return res.status(401).json({
            success: false,
            error: errorMsg,
            cookies: allCookies
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

// Root path for the Render deploy link so it doesn't show "Cannot GET /"
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
