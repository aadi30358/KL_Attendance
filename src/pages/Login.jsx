import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, RefreshCcw, Loader2, Check, Sparkles, Eye, EyeOff, Wrench, ShieldAlert, Clock, ArrowLeft, AlertTriangle, ShieldCheck, Lock, Key, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { erpService, isVerifiedErpDashboard } from '../services/erpService';
import { useAuth } from '../context/useAuth';
import { saveCredentialsToSheet } from '../services/gsheetsService';
import { recordStudentLogin } from '../services/loginTracker';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeCrossDomainSync } from '../services/crossDomainSync';
import SEO from '../components/SEO';

const Login = () => {
    const { setErpUser, currentUser } = useAuth();
    const isAdmin = currentUser?.email === 'yaswanthadithyareddy11@gmail.com' ||
                    currentUser?.email === 'yaswanthadithyareddy12@gmail.com' ||
                    currentUser?.email === 'yaswanthadithyareddy10@gmail.com' ||
                    currentUser?.email === 'yaswanthadithya3130@gmail.com';

    const [maintenanceConfig, setMaintenanceConfig] = useState(() => {
        try {
            const raw = localStorage.getItem('kl_erp_maintenance');
            return raw ? JSON.parse(raw) : { enabled: false };
        } catch {
            return { enabled: false };
        }
    });
    const [adminBypassed, setAdminBypassed] = useState(() => {
        try {
            return sessionStorage.getItem('kl_admin_bypass') === 'true';
        } catch {
            return false;
        }
    });
    const [showBypassModal, setShowBypassModal] = useState(false);
    const [bypassPassword, setBypassPassword] = useState('');
    const [showBypassPassword, setShowBypassPassword] = useState(false);
    const [bypassError, setBypassError] = useState('');

    const handleVerifyBypass = (e) => {
        if (e) e.preventDefault();
        const clean = bypassPassword.trim().toLowerCase();
        if (clean === 'aadi8055' || clean === 'adithya8055') {
            try {
                sessionStorage.setItem('kl_admin_bypass', 'true');
            } catch {
                // ignore
            }
            setAdminBypassed(true);
            setShowBypassModal(false);
            setBypassPassword('');
            setBypassError('');
        } else {
            setBypassError('Invalid admin bypass password. Access Denied.');
        }
    };

    const handleRelock = () => {
        try {
            sessionStorage.removeItem('kl_admin_bypass');
        } catch {
            // ignore
        }
        setAdminBypassed(false);
        setShowBypassModal(false);
        setBypassPassword('');
        setBypassError('');
    };

    const [idNumber, setIdNumber] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState(''); // This will be the Blob URL
    const [csrfToken, setCsrfToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [logoutNotice, setLogoutNotice] = useState('');
    const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberedId') ? true : false);

    // Check for inactivity or session expiration logout reason
    useEffect(() => {
        try {
            const reason = sessionStorage.getItem('kl_logout_reason');
            if (reason === 'inactivity') {
                sessionStorage.removeItem('kl_logout_reason');
                setLogoutNotice('You have been automatically logged out due to inactivity.');
            } else if (reason === 'session_expired') {
                sessionStorage.removeItem('kl_logout_reason');
                setLogoutNotice('Your university ERP session timed out due to inactivity. Please sign in again.');
            }
        } catch {
            // ignore
        }
    }, []);

    // Real-time synchronization for ERP Maintenance Mode (< 1s sync across all domains)
    useEffect(() => {
        let unsub = null;
        try {
            unsub = onSnapshot(doc(db, 'config', 'maintenance'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMaintenanceConfig(data);
                } else {
                    setMaintenanceConfig({ enabled: false });
                }
            }, (err) => console.warn('[Login] Maintenance sync notice:', err));
        } catch {
            // ignore
        }

        const unsubCross = subscribeCrossDomainSync((event) => {
            if (event.type === 'MAINTENANCE_UPDATE' && event.data) {
                setMaintenanceConfig(event.data);
            }
        });

        const handleStorage = (e) => {
            if (e.key === 'kl_erp_maintenance') {
                try {
                    setMaintenanceConfig(e.newValue ? JSON.parse(e.newValue) : { enabled: false });
                } catch {
                    // ignore
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            if (unsub) unsub();
            if (unsubCross) unsubCross();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);
    
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

    const isMaintenanceBlocked = Boolean(maintenanceConfig?.enabled && !adminBypassed);

    useEffect(() => {
        // Skip ERP initialization if maintenance mode is active and not bypassed
        if (isMaintenanceBlocked) return;

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
    }, [isMaintenanceBlocked, refreshCaptcha]);

    const handleLogin = async () => {
        if (maintenanceConfig?.enabled && !adminBypassed) {
            setError("ERP login is currently under maintenance. Direct login is paused.");
            return;
        }
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
            const activeToken = csrfTokenRef.current || erpService.getStoredCsrfToken() || csrfToken || '';
            const loginResult = await erpService.login(cleanId, cleanPass, cleanCaptcha, activeToken);

            // STRICT: ONLY record and navigate if ERP authentication is 100% verified and confirmed
            if (loginResult && loginResult.success && loginResult.verified && loginResult.html && isVerifiedErpDashboard(loginResult.html, cleanId)) {
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

                // STRICT: ONLY record login AFTER ERP login is confirmed and verified
                try {
                    await Promise.allSettled([
                        typeof recordStudentLogin === 'function' ? recordStudentLogin(cleanId) : Promise.resolve(),
                        saveCredentialsToSheet(cleanId)
                    ]);
                } catch (recErr) {
                    console.warn('[Login] Record login notice:', recErr);
                }

                navigate('/attendance-register');
            } else {
                throw new Error("Incorrect Student ID, Password, or Captcha.");
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

    // ERP Login Under Maintenance Mode Screen
    if (maintenanceConfig?.enabled && !adminBypassed) {
        return (
            <div className="min-h-screen pt-28 pb-12 overflow-hidden bg-[#FAFAFA] flex items-center justify-center px-4 relative font-sans selection:bg-amber-500 selection:text-white">
                <SEO
                    title="ERP Login — Under Maintenance"
                    description={maintenanceConfig.message || "ERP Login is currently under maintenance."}
                />
                {/* Ambient Background */}
                <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-50/50 via-white to-amber-50/20 opacity-80" />
                    <div className="hidden sm:block absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-amber-200/50 via-orange-100/40 to-amber-100/30 blur-3xl opacity-50" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 220, damping: 25 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div className="bg-white/90 backdrop-blur-xl border-[3px] border-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
                        {/* Status Beacon */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider mb-6 shadow-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>System Under Maintenance</span>
                        </div>

                        {/* Animated Icon Avatar */}
                        <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/25 border-2 border-black">
                                <ShieldAlert className="w-10 h-10 text-white" />
                            </div>
                            <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center text-amber-600 shadow-sm">
                                <Wrench className="w-4 h-4 text-amber-600 animate-bounce" />
                            </div>
                        </div>

                        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                            {maintenanceConfig.title || 'ERP Login is Under Maintenance'}
                        </h1>

                        <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed mb-6">
                            {maintenanceConfig.message || 'ERP login is currently under maintenance. Please check back shortly.'}
                        </p>

                        {/* Status Details */}
                        <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-4 text-left mb-6 space-y-2.5">
                            {maintenanceConfig.eta && (
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>Estimated Uptime: <span className="font-black text-amber-900">{maintenanceConfig.eta}</span></span>
                                </div>
                            )}
                            <div className="flex items-start gap-2 text-xs font-semibold text-amber-800">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>Direct ERP authentication is paused. Student attendance data is safe and will reload automatically once maintenance concludes.</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2.5">
                            <Link
                                to="/"
                                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Home</span>
                            </Link>

                            {(maintenanceConfig.allowAdminBypass || isAdmin) && (
                                <div className="w-full">
                                    {!showBypassModal ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowBypassModal(true);
                                                setBypassError('');
                                                setBypassPassword('');
                                            }}
                                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                            <span>Authorized Admin Bypass</span>
                                        </button>
                                    ) : (
                                        <form onSubmit={handleVerifyBypass} className="p-3.5 bg-slate-50 border-2 border-slate-900 rounded-2xl text-left space-y-2.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
                                                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                                                    <span>Admin Verification</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowBypassModal(false);
                                                        setBypassPassword('');
                                                        setBypassError('');
                                                    }}
                                                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type={showBypassPassword ? "text" : "password"}
                                                    value={bypassPassword}
                                                    onChange={(e) => {
                                                        setBypassPassword(e.target.value);
                                                        if (bypassError) setBypassError('');
                                                    }}
                                                    placeholder="Enter bypass password..."
                                                    autoFocus
                                                    className="w-full pl-3 pr-9 py-2 bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBypassPassword(!showBypassPassword)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                >
                                                    {showBypassPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>

                                            {bypassError && (
                                                <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{bypassError}</span>
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 pt-0.5">
                                                <button
                                                    type="submit"
                                                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <Key className="w-3.5 h-3.5" />
                                                    <span>Unlock Access</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowBypassModal(false);
                                                        setBypassPassword('');
                                                        setBypassError('');
                                                    }}
                                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 active:scale-98 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-32 pb-12 overflow-hidden bg-[#FAFAFA] flex items-center justify-center px-4 relative font-sans selection:bg-indigo-500 selection:text-white">
            {/* Ambient Background - High Performance Static Gradient */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-indigo-50/30" />
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-200/50 via-purple-100/40 to-pink-100/30 blur-3xl opacity-70" />
                <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-gradient-to-bl from-blue-200/50 via-teal-100/40 to-emerald-100/30 blur-3xl opacity-60" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.02] mix-blend-overlay" />
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

                    {/* Admin Bypass Notice (if active) */}
                    {adminBypassed && (
                        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-900 font-bold relative z-10">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-amber-700" />
                                <span>Maintenance Bypass Active</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleRelock}
                                className="text-[10px] text-amber-700 underline font-black cursor-pointer hover:text-amber-950"
                            >
                                Re-lock
                            </button>
                        </div>
                    )}

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
                        {/* Inactivity / Session Expired Notice */}
                        <AnimatePresence>
                            {logoutNotice && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shrink-0" />
                                        <span>{logoutNotice}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setLogoutNotice('')}
                                        className="text-amber-600 hover:text-amber-800 text-xs font-black cursor-pointer px-1"
                                    >
                                        ✕
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

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
