import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";
import svgCaptcha from 'svg-captcha';

// Simple in-memory store for captcha answers (in production, use Redis or sessions)
const captchaStore = new Map();

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

// Restrict CORS to production domain and localhost (for dev)
const allowedOrigins = [
    'https://kl-attendance-brown.vercel.app',
    'http://localhost:5173', // Vite default dev port
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

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
      noise: 2,
      color: true,
      background: '#f5f5f5'
    });
    
    // Generate a unique ID for this captcha
    const captchaId = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the captcha answer (expire after 5 minutes)
    captchaStore.set(captchaId, captcha.text.toLowerCase());
    setTimeout(() => captchaStore.delete(captchaId), 5 * 60 * 1000);
    
    // Send SVG with proper content type
    res.type('svg+xml');
    res.set('X-Captcha-ID', captchaId);
    res.send(captcha.data);
  } catch (error) {
    console.error('Captcha generation error:', error);
    res.status(500).json({ error: 'Failed to generate captcha' });
  }
});
app.listen(PORT, () => {
    console.log(`Hardened AI Proxy Server running on http://localhost:${PORT}`);
});
