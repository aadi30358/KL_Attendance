export const APP_CONFIG = {
    GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    ANTHROPIC_API_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY,
    UNIVERSITY_NAME: import.meta.env.VITE_UNIVERSITY_NAME || "KL University",
    ERP_URL: import.meta.env.VITE_ERP_URL || "https://newerp.kluniversity.in/index.php",
    API_URL: import.meta.env.VITE_API_URL || "" // Empty string works with Vite proxy in dev
};
