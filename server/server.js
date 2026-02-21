import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

// ✅ Security Headers
app.use(helmet());

// ✅ Security Headers (Disabled CSP for better compatibility with proxying and third-party AI)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

// ✅ Payload Limit (Increased for high-res base64 images)
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// ✅ Request Logging (Diagnostic)
app.use((req, res, next) => {
    if (req.path !== '/api/health') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Size: ${JSON.stringify(req.body).length} bytes`);
    }
    next();
});

// ✅ Rate Limiting (Prevents abuse and quota draining)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});
app.use("/api/", limiter);

// ✅ Flexible CORS Protection
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
        if (isAllowed || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error("CORS Blocked: Unauthorized Origin"), false);
        }
    }
}));

// Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🤖 Gemini Proxy Endpoint
app.post('/api/ai/gemini', async (req, res) => {
    try {
        const { contents, prompt, systemInstruction } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API key not configured on server." });
        }

        // Initialize model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction || undefined
        });

        // Construct request
        let finalRequest;
        if (contents) {
            finalRequest = contents;
        } else if (prompt) {
            finalRequest = prompt;
        } else {
            return res.status(400).json({ error: "No payload provided." });
        }

        console.log("Calling Gemini with multimodal contents...");
        const result = await model.generateContent(finalRequest);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini Response success. Length:", text.length);
        res.json({
            success: true,
            text: text
        });
    } catch (error) {
        console.error("Gemini Proxy Error:", error);
        res.status(500).json({
            error: error.message || "Service unavailable",
            details: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

// 🤖 Anthropic Proxy Endpoint (Optional but supported)
app.post('/api/ai/anthropic', async (req, res) => {
    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: "Anthropic API key not configured." });
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1024,
                messages: [{ role: "user", content: req.body.prompt }]
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🩺 Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Hardened AI Proxy running on port ${PORT}`);
});
