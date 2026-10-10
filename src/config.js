const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'
);

export const CLOUDFLARE_WORKER_URL = "https://kl-attendance-api.yaswanthadithyareddy10.workers.dev";

export const APP_CONFIG = Object.freeze({
    UNIVERSITY_NAME: import.meta.env.VITE_UNIVERSITY_NAME || "KL University",
    ERP_URL: import.meta.env.VITE_ERP_URL || "https://newerp.kluniversity.in/index.php",
    API_URL: isLocal 
        ? "http://localhost:3000" 
        : CLOUDFLARE_WORKER_URL,
    BACKUP_API_URL: isLocal 
        ? "http://localhost:3000" 
        : CLOUDFLARE_WORKER_URL,
    LOCAL_API_URL: "http://localhost:3000"
});

