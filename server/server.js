import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";
import svgCaptcha from 'svg-captcha';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    'https://klattendancecalculator.web.app',
    'https://klattendancecalculator.firebaseapp.com',
    'https://kl-attendance-backend.onrender.com', // Own backend
    'http://localhost:5173', // Vite default dev port
    'http://127.0.0.1:5173',
    'http://localhost:3000'
];

// Mount CORS before rate limiting to ensure 429 and error responses include CORS headers
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        // Allow dynamic local network IP addresses for mobile testing
        if (origin.startsWith('http://192.168.') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(null, false);
        }
    },
    credentials: true,
    exposedHeaders: ['x-set-erp-cookie', 'set-cookie', 'Location']
}));

// Rate limiting: 600 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

            // Expose cookies in custom header so client JS can persist in sessionStorage
            const cookiePairs = setCookies.map(c => c.split(';')[0].trim()).join('; ');
            res.setHeader('x-set-erp-cookie', cookiePairs);
        }

        // If login returns 302 redirect, follow it internally with accumulated cookies to fetch the dashboard directly!
        if (response.status === 302 && (req.url.includes('site%2Flogin') || req.url.includes('site/login'))) {
            let nextLoc = response.headers.get('location') || '/index.php?r=site%2Findexindi';
            let currentTarget = nextLoc.startsWith('http') 
                ? nextLoc.replace(/^http:/i, 'https:') 
                : 'https://newerp.kluniversity.in' + (nextLoc.startsWith('/') ? '' : '/') + nextLoc;

            // Maintain a merged map of cookies across all redirect hops
            const cookieMap = new Map();
            if (cleanHeaders['cookie']) {
                cleanHeaders['cookie'].split(';').forEach(pair => {
                    const [k, ...v] = pair.split('=');
                    if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
                });
            }
            setCookies.forEach(c => {
                const pair = c.split(';')[0];
                const [k, ...v] = pair.split('=');
                if (k && k.trim()) cookieMap.set(k.trim(), v.join('=').trim());
            });

            let finalResp = null;
            // Follow up to 5 redirect hops manually, keeping cookies intact without WHATWG fetch dropping them
            for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
                const currentCookieStr = Array.from(cookieMap.entries())
                    .map(([k, v]) => `${k}=${v}`)
                    .join('; ');

                console.log(`[ERP Proxy] Follow redirect hop #${redirectCount + 1}: ${currentTarget}`);
                finalResp = await fetch(currentTarget, {
                    method: 'GET',
                    headers: {
                        ...cleanHeaders,
                        cookie: currentCookieStr
                    },
                    redirect: 'manual'
                });

                // Extract any new cookies set on this hop
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
                    const loc = finalResp.headers.get('location');
                    if (!loc) break;
                    currentTarget = loc.startsWith('http') 
                        ? loc.replace(/^http:/i, 'https:') 
                        : 'https://newerp.kluniversity.in' + (loc.startsWith('/') ? '' : '/') + loc;
                } else {
                    break;
                }
            }

            // Expose accumulated cookies in Set-Cookie and custom header
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

// Gemini Proxy Endpoint
app.post('/api/ai/gemini', async (req, res) => {
    try {
        const { contents, systemInstruction, model: modelName } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API key not configured on server." });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName || "gemini-2.0-flash", systemInstruction });

        const result = await model.generateContent(contents);
        const response = await result.response;
        const text = response.text();
        console.log("[AI-Proxy] Response generated successfully");
        res.json({ text });
    } catch (error) {
        console.error("Gemini Proxy Error:", error.message);
        res.status(500).json({ 
            error: "Failed to fetch from Gemini. Please try again later.",
            details: error.message 
        });
    }
});

// Timetable Fetch Endpoint
app.post('/api/fetch_timetable', async (req, res) => {
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

app.post('/api/verify-captcha', loginLimiter, express.json(), (req, res) => {
    const { captcha } = req.body;
    const isValid = captcha && req.session.captcha &&
        captcha.toString().toLowerCase() === req.session.captcha.toLowerCase();

    if (!isValid) return res.status(400).json({ success: false, message: "Invalid captcha" });
    res.json({ success: true });
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
