import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LogIn, 
    RefreshCcw, 
    Loader2, 
    Check, 
    Sparkles, 
    Eye, 
    EyeOff,
    Wrench,
    Clock,
    Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { erpService } from '../services/erpService';
import { useAuth } from '../context/useAuth';
import { APP_CONFIG } from '../config';
import { saveCredentialsToSheet } from '../services/gsheetsService';
import { recordStudentLogin } from '../services/loginTracker';
import { encryptSecret, decryptSecret } from '../utils/securityShield';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Login = () => {
    const { setErpUser } = useAuth();
    const navigate = useNavigate();

    // Read stored credentials immediately (synchronous)
    const savedId = localStorage.getItem('rememberedId') || '';
    const [idNumber, setIdNumber] = useState(savedId);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingCaptcha, setIsFetchingCaptcha] = useState(true);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(!!savedId);

    // Maintenance Mode State (Real-time Firestore sync & instant local cache)
    const [maintenanceConfig, setMaintenanceConfig] = useState(() => {
        try {
            const raw = localStorage.getItem('kl_erp_maintenance');
            return raw ? JSON.parse(raw) : { enabled: false };
        } catch {
            return { enabled: false };
        }
    });
    const [adminBypass, setAdminBypass] = useState(false);
    const [showBypassPrompt, setShowBypassPrompt] = useState(false);
    const [bypassPassword, setBypassPassword] = useState('');
    const [bypassError, setBypassError] = useState('');
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);

    // Asynchronously load and decrypt remembered password with device hardware key
    useEffect(() => {
        async function loadStoredPass() {
            const enc = localStorage.getItem('rememberedPassword');
            if (enc) {
                try {
                    const dec = await decryptSecret(enc);
                    if (dec) setPassword(dec);
                } catch {
                    // ignore
                }
            }
        }
        if (savedId) {
            loadStoredPass();
        }
    }, [savedId]);

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
        const apiBase = erpService.getErpBase ? erpService.getErpBase() : (APP_CONFIG.API_URL || 'https://kl-attendance-backend-newnode-env.onrender.com');
        const headers = { 'Cache-Control': 'no-cache' };
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

    // Resilient session & captcha initialization
    const initSession = useCallback(async (isManualRetry = false) => {
        setIsFetchingCaptcha(true);
        setError('');

        const attemptInit = async () => {
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
                    const blob = await fetchCaptchaBlob();
                    if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                        URL.revokeObjectURL(captchaUrlRef.current);
                    }
                    const objectUrl = URL.createObjectURL(blob);
                    captchaUrlRef.current = objectUrl;
                    setCaptchaUrl(objectUrl);
                }
                return true;
            }
            throw new Error("Unable to establish ERP session. Please tap retry.");
        };

        try {
            await attemptInit();
            if (savedId) {
                setTimeout(() => {
                    captchaInputRef.current?.focus();
                }, 150);
            }
        } catch (err) {
            console.warn('Initial session attempt failed:', err);
            // If not manual retry, attempt 1 automatic retry after a brief delay (handles cold starts)
            if (!isManualRetry) {
                try {
                    await new Promise(r => setTimeout(r, 1200));
                    await attemptInit();
                    return;
                } catch (retryErr) {
                    console.error('Session retry also failed:', retryErr);
                }
            }
            // Leave hasInitRan.current as true so the on-mount effect does not enter an infinite retry loop
            setError(err?.message || 'Unable to connect to ERP server. Please check your internet connection or tap retry.');
        } finally {
            setIsFetchingCaptcha(false);
        }
    }, [fetchCaptchaBlob, savedId]);

    // Refresh captcha image
    const refreshCaptcha = useCallback(async () => {
        setCaptcha('');
        setError('');
        setIsFetchingCaptcha(true);
        try {
            // If we don't have a valid session or csrfToken, perform full session initialization
            if (!csrfToken) {
                await initSession(true);
                return;
            }

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
            setError('Failed to load captcha. Please tap retry.');
        } finally {
            setIsFetchingCaptcha(false);
        }
    }, [csrfToken, fetchCaptchaBlob, initSession]);

    // Subscribe to Maintenance Mode config in real-time
    useEffect(() => {
        let unsub = null;
        try {
            unsub = onSnapshot(doc(db, 'config', 'maintenance'), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    const isMaint = Boolean(data.enabled);
                    setMaintenanceConfig(data);
                    localStorage.setItem('kl_erp_maintenance', JSON.stringify(data));
                    if (!isMaint && !hasInitRan.current) {
                        hasInitRan.current = true;
                        initSession();
                    }
                } else {
                    setMaintenanceConfig({ enabled: false });
                    localStorage.removeItem('kl_erp_maintenance');
                    if (!hasInitRan.current) {
                        hasInitRan.current = true;
                        initSession();
                    }
                }
            }, (err) => {
                console.warn("[Maintenance] Firestore sync notice:", err);
            });
        } catch (e) {
            console.warn("[Maintenance] Realtime listener error:", e);
        }

        // Cross-tab and local storage real-time sync with 0ms lag
        const handleStorageChange = (e) => {
            if (e.key === 'kl_erp_maintenance') {
                try {
                    const parsed = e.newValue ? JSON.parse(e.newValue) : { enabled: false };
                    setMaintenanceConfig(parsed);
                } catch (err) {
                    console.warn('Storage maintenance parse notice:', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);

        let bc = null;
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            try {
                bc = new BroadcastChannel('kl_portal_sync');
                bc.onmessage = (event) => {
                    if (event.data?.type === 'MAINTENANCE_UPDATE' && event.data.data) {
                        setMaintenanceConfig(event.data.data);
                        localStorage.setItem('kl_erp_maintenance', JSON.stringify(event.data.data));
                    }
                };
            } catch (err) {
                console.warn('BroadcastChannel maintenance notice:', err);
            }
        }

        return () => {
            if (unsub) unsub();
            window.removeEventListener('storage', handleStorageChange);
            if (bc) bc.close();
        };
    }, [initSession]);

    // Initialize session sequentially on mount (only when maintenance is inactive or bypassed)
    useEffect(() => {
        if (maintenanceConfig?.enabled && !adminBypass) return;
        if (hasInitRan.current) return;
        hasInitRan.current = true;
        initSession();
    }, [initSession, maintenanceConfig?.enabled, adminBypass]);

    // Manual status check for the maintenance screen
    const handleManualStatusCheck = async () => {
        setIsCheckingStatus(true);
        try {
            const snap = await getDoc(doc(db, 'config', 'maintenance'));
            if (snap.exists()) {
                const data = snap.data();
                setMaintenanceConfig(data);
                localStorage.setItem('kl_erp_maintenance', JSON.stringify(data));
                if (!data.enabled) {
                    hasInitRan.current = false;
                    await initSession(true);
                }
            } else {
                setMaintenanceConfig({ enabled: false });
                localStorage.removeItem('kl_erp_maintenance');
                hasInitRan.current = false;
                await initSession(true);
            }
        } catch (e) {
            console.warn("[Maintenance] Status check notice:", e);
        } finally {
            setTimeout(() => setIsCheckingStatus(false), 500);
        }
    };

    // Handle form submission
    const handleLogin = async () => {
        const cleanId = idNumber.trim();
        const cleanCaptcha = captcha.trim();

        if (!cleanId || !password || !cleanCaptcha) {
            setError("Please fill in Student ID, Password, and Captcha code.");
            return;
        }

        // Validate Student ID format (8 to 12 digits)
        if (!/^\d{8,12}$/.test(cleanId)) {
            setError("Please enter a valid 8 to 12 digit Student ID number.");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            let activeCsrf = csrfToken;
            if (!activeCsrf) {
                try {
                    const initRes = await erpService.getSessionInit();
                    if (initRes?.csrfToken) {
                        activeCsrf = initRes.csrfToken;
                        setCsrfToken(activeCsrf);
                    }
                } catch (csrfErr) {
                    console.warn("[Login] Pre-login CSRF token fetch notice:", csrfErr);
                }
            }
            const loginResult = await erpService.login(cleanId, password, cleanCaptcha, activeCsrf);

            // Strict credential verification check: Only proceed if authenticated by ERP
            const html = loginResult?.html || '';
            const isVerified = loginResult?.success && 
                loginResult?.verified && 
                html && 
                !html.includes('id="login-form"') && 
                !html.includes('loginFormUserNameID') && 
                (html.includes('site%2Flogout') || html.includes('site/logout') || html.includes('indexindi') || html.includes('logout') || html.includes(cleanId));

            if (!isVerified) {
                throw new Error("Credentials verification failed. Please check your Student ID and Password.");
            }

            // ONLY AFTER VERIFYING CREDENTIALS:
            const loginTimestamp = new Date().toISOString();
            // 1. Record verified real student login in database & admin panel
            // 2. Save verified login to user's Google Sheet (Student ID, Date, Time, Device - NO passwords)
            try {
                await Promise.allSettled([
                    recordStudentLogin(cleanId, loginTimestamp),
                    saveCredentialsToSheet(cleanId, loginTimestamp)
                ]);
            } catch (recordErr) {
                console.warn('Login telemetry record notice:', recordErr);
            }

            localStorage.setItem('erpDashboardHtml', loginResult.html);
            localStorage.removeItem('kleData');
            localStorage.setItem('userUniversity', 'klu');
            setErpUser(cleanId);
            localStorage.setItem('activeErpUser', cleanId);
            sessionStorage.setItem('erp_username', cleanId);

            // Persist verified post-login CSRF token directly from dashboard HTML
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(loginResult.html, 'text/html');
                const postLoginCsrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (postLoginCsrf) {
                    sessionStorage.setItem('erp_csrf_token', postLoginCsrf);
                    localStorage.setItem('erp_csrf_token', postLoginCsrf);
                }
            } catch (csrfErr) {
                console.warn('[Login] CSRF parsing notice:', csrfErr);
            }

            // Flush prior cached attendance for this or other users to ensure fresh fetch
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const k = sessionStorage.key(i);
                if (k && (k.startsWith('kl_att_cache_') || k.startsWith('kl_erp_fastpath_'))) {
                    sessionStorage.removeItem(k);
                }
            }

            if (rememberMe) {
                localStorage.setItem('rememberedId', cleanId);
                const encPass = await encryptSecret(password);
                localStorage.setItem('rememberedPassword', encPass);
            } else {
                localStorage.removeItem('rememberedId');
                localStorage.removeItem('rememberedPassword');
            }

            navigate('/attendance-register', { replace: true });
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
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center pt-28 sm:pt-36 pb-16 px-4 relative font-sans selection:bg-indigo-500 selection:text-white">

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <div className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-40 will-change-transform" />
                <div className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-l from-blue-200 via-teal-200 to-emerald-200 blur-3xl opacity-30 will-change-transform" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-md relative z-10 my-auto"
            >
                {/* Card */}
                <div className="bg-white/80 backdrop-blur-xl border-[3px] border-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    {/* Shine */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/80 via-transparent to-transparent opacity-50 pointer-events-none" />

                    {maintenanceConfig?.enabled && !adminBypass ? (
                        /* ================= SIMPLE & CLEAN MAINTENANCE VIEW ================= */
                        <div className="space-y-6 relative z-10 text-center py-3">
                            {/* Clean Icon */}
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
                                <Wrench className="w-7 h-7" />
                            </div>

                            {/* Headline & Notice */}
                            <div className="space-y-2">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                    {maintenanceConfig.title || 'ERP Login is Under Maintenance'}
                                </h1>
                                <p className="text-slate-500 text-xs font-medium max-w-sm mx-auto leading-relaxed">
                                    {maintenanceConfig.message || 'ERP login is currently under maintenance. Please check back shortly.'}
                                </p>
                                {maintenanceConfig.eta && (
                                    <div className="pt-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                                            <span>Expected completion: <strong className="text-slate-900">{maintenanceConfig.eta}</strong></span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Single Action Button */}
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleManualStatusCheck}
                                    disabled={isCheckingStatus}
                                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                >
                                    <RefreshCcw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                                    <span>{isCheckingStatus ? 'Checking Status...' : 'Check Status'}</span>
                                </button>
                            </div>

                            {/* Discreet Admin Bypass Link */}
                            {maintenanceConfig.allowAdminBypass !== false && (
                                <div className="pt-2">
                                    {!showBypassPrompt ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
                                                const isAdmin = localStorage.getItem('isAdminAuthenticated') === 'true';
                                                if (token || isAdmin) {
                                                    setAdminBypass(true);
                                                } else {
                                                    setShowBypassPrompt(true);
                                                }
                                            }}
                                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer inline-flex items-center gap-1"
                                        >
                                            <Lock className="w-3 h-3" /> Admin Bypass
                                        </button>
                                    ) : (
                                        <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200 text-left">
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    value={bypassPassword}
                                                    onChange={(e) => { setBypassPassword(e.target.value); setBypassError(''); }}
                                                    placeholder="Admin password"
                                                    autoFocus
                                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (bypassPassword === 'adithya3130' || bypassPassword === 'aadi') {
                                                            setAdminBypass(true);
                                                            setShowBypassPrompt(false);
                                                        } else {
                                                            setBypassError('Invalid credentials');
                                                        }
                                                    }}
                                                    className="px-3.5 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg cursor-pointer"
                                                >
                                                    Unlock
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowBypassPrompt(false); setBypassError(''); }}
                                                    className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            {bypassError && <p className="text-[10px] text-red-500 font-semibold">{bypassError}</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ================= STANDARD LOGIN VIEW ================= */
                        <>
                            {maintenanceConfig?.enabled && adminBypass && (
                                <div className="mb-4 p-2.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-bold relative z-10 shadow-xs">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        Maintenance Active (Admin Bypassed)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setAdminBypass(false)}
                                        className="text-[10px] uppercase font-black text-amber-900 hover:underline cursor-pointer"
                                    >
                                        Re-lock
                                    </button>
                                </div>
                            )}

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
                                    className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                                        <span className="leading-snug">{error}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => initSession(true)}
                                        className="px-2.5 py-1 bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer"
                                    >
                                        Retry
                                    </button>
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
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
