const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const APP_CONFIG = Object.freeze({
    GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    ANTHROPIC_API_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY,
    UNIVERSITY_NAME: import.meta.env.VITE_UNIVERSITY_NAME || "KL University",
    ERP_URL: import.meta.env.VITE_ERP_URL || "https://newerp.kluniversity.in/index.php",
    API_URL: isLocal 
        ? "http://localhost:3000" 
        : (import.meta.env.VITE_API_URL || "https://kl-attendance-api.yaswanthadithyareddy10.workers.dev"),
    BACKUP_API_URL: isLocal 
        ? "http://localhost:3000" 
        : "https://kl-attendance-api.yaswanthadithyareddy10.workers.dev",
    LOCAL_API_URL: "http://localhost:3000"
});
