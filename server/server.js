import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

app.use(express.json());

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

app.listen(PORT, () => {
    console.log(`Hardened AI Proxy Server running on http://localhost:${PORT}`);
});
