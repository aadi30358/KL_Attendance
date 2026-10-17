import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, RefreshCcw, Loader2, X, AlertCircle } from 'lucide-react';
import { erpService, isVerifiedErpDashboard } from '../services/erpService';
import { decodePassword, setActiveProfileId } from '../services/friendsService';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

export default function FriendCaptchaModal({ friend, isOpen, onClose, onSuccess }) {
    const { setErpUser } = useAuth();
    const navigate = useNavigate();

    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const captchaUrlRef = useRef('');
    const csrfTokenRef = useRef('');
    const inputRef = useRef(null);

    const refreshCaptcha = useCallback(async () => {
        setLoadingCaptcha(true);
        setError('');
        setCaptcha('');
        try {
            const res = await erpService.refreshCaptcha();
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
            console.error('Failed to load captcha:', err);
            setError('Could not load Captcha. Tap refresh.');
        } finally {
            setLoadingCaptcha(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen || !friend) return;
        setCaptcha('');
        setError('');
        refreshCaptcha();

        const timer = setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 150);

        return () => clearTimeout(timer);
    }, [isOpen, friend, refreshCaptcha]);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        if (isSubmitting || !friend) return;

        const cleanCaptcha = captcha.trim();
        if (!cleanCaptcha) {
            setError('Please enter the captcha shown above.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const studentId = friend.studentId;
        const rawPassword = decodePassword(friend.password) || (friend.id === 'main' ? decodePassword(localStorage.getItem('rememberedPassword') || '') : '');
        const activeToken = csrfTokenRef.current || erpService.getStoredCsrfToken() || csrfToken || '';

        if (!studentId || !rawPassword) {
            setError('Missing saved password. Please enter credentials in Edit Profile.');
            setIsSubmitting(false);
            return;
        }

        try {
            // Clear current active ERP session cookies before logging in
            erpService.clearStoredErpCookies();
            sessionStorage.removeItem('erp_authenticated');

            const loginResult = await erpService.login(studentId, rawPassword, cleanCaptcha, activeToken);

            if (loginResult && loginResult.success && loginResult.verified && loginResult.html && isVerifiedErpDashboard(loginResult.html, studentId)) {
                // Save session for profile
                localStorage.setItem('erpDashboardHtml', loginResult.html);
                localStorage.removeItem('kleData');
                localStorage.setItem('userUniversity', 'klu');
                localStorage.setItem('activeErpUser', studentId);

                // Set active profile
                setActiveProfileId(friend.id || 'main');

                if (typeof setErpUser === 'function') {
                    setErpUser(studentId);
                }

                // Notify all listeners that a profile has successfully authenticated
                window.dispatchEvent(new CustomEvent('kl_profile_switched', {
                    detail: {
                        profile: friend,
                        studentId
                    }
                }));

                if (onSuccess) {
                    onSuccess(friend);
                }
                onClose();
                if (!window.location.pathname.includes('/timetable')) {
                    navigate('/attendance-register');
                }
            } else {
                throw new Error('Incorrect Captcha or ERP session error. Please try again.');
            }
        } catch (err) {
            console.error('Friend login failed:', err);
            setError(err.message || 'Verification failed. Please check the captcha.');
            refreshCaptcha();
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !friend) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border-2 border-slate-900 relative overflow-hidden transform-gpu"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Friend Avatar & Title */}
                <div className="text-center mb-5">
                    <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-indigo-50 border-2 border-slate-900 flex items-center justify-center shadow-md">
                        <ShieldCheck className="w-7 h-7 text-indigo-700" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        {friend.nickname || 'Buddy'}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold mt-0.5 tracking-wide">
                        ID: <span className="text-indigo-600 font-black">{friend.studentId}</span>
                    </p>
                </div>

                {/* Auto-filled Notice */}
                <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ID & Password saved. Enter Captcha only.</span>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    {/* Captcha Display & Refresh */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                            University ERP Captcha
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-14 bg-slate-50 border-2 border-slate-300 rounded-xl flex items-center justify-center overflow-hidden relative shadow-inner">
                                {loadingCaptcha ? (
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                        <span>Fetching Captcha...</span>
                                    </div>
                                ) : captchaUrl ? (
                                    <img
                                        src={captchaUrl}
                                        alt="Captcha"
                                        className="h-11 max-w-full object-contain filter contrast-125"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-400 font-semibold">No captcha loaded</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={refreshCaptcha}
                                disabled={loadingCaptcha || isSubmitting}
                                title="Get a new Captcha"
                                className="w-14 h-14 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                            >
                                <RefreshCcw className={`w-5 h-5 ${loadingCaptcha ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Single Input: Enter Captcha */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                            Enter Captcha Code
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={captcha}
                            onChange={(e) => setCaptcha(e.target.value)}
                            placeholder="Type characters here"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck="false"
                            maxLength={10}
                            className="w-full text-center text-xl font-black tracking-widest bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-xl py-3 px-4 text-slate-900 transition-all uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-sm placeholder:text-slate-400"
                        />
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !captcha.trim()}
                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-xl shadow-lg shadow-slate-900/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Verifying {friend.nickname || 'Student'}...</span>
                            </>
                        ) : (
                            <span>Check Attendance as {friend.nickname || 'Student'}</span>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
