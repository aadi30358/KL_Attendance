import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";
import svgCaptcha from 'svg-captcha';
import session from 'express-session';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

app.use(limiter);

const allowedOrigins = [
    'https://kl-attendance-brown.vercel.app',
    'https://kl-attendance-backend.onrender.com', // Own backend
    'http://localhost:5173', // Vite default dev port
    'http://127.0.0.1:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        // Allow dynamic local network IP addresses for mobile testing
        if (origin.startsWith('http://192.168.') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            // Throwing actual `new Error` here will crash Express with a 500 HTML trace! Returning `false` safely blocks instead.
            return callback(null, false);
        }
    },
    credentials: true
}));

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

// Gemini Proxy Endpoint
app.post('/api/ai/gemini', async (req, res) => {
    try {
        const { contents, systemInstruction, model: modelName } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API key not configured on server." });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName || "gemini-2.5-flash", systemInstruction });

        const result = await model.generateContent(contents);
        const response = await result.response;
        // console.log("AI Response generated successfully"); // Removed sensitive logging
        res.json({ text: response.text() });
    } catch (error) {
        console.error("Gemini Proxy Error:", error.message);
        res.status(500).json({ error: "Failed to fetch from Gemini. Please try again later." });
    }
});

// Simple health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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
