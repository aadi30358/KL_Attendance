import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, RefreshCcw, Loader2, X, AlertCircle } from 'lucide-react';
import { erpService, isVerifiedErpDashboard } from '../services/erpService';
import { decodePassword, setActiveProfileId, saveMyProfile, saveFriend, getSavedFriends, getMyProfile } from '../services/friendsService';
import { fetchLiveErpGrades } from '../services/gradesService';
import { fetchLiveErpTimetable } from '../services/timetableService';
import { useMaintenance } from '../services/useMaintenance';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

export default function FriendCaptchaModal({ friend, isOpen, onClose, onSuccess }) {
    const { setErpUser } = useAuth();
    const navigate = useNavigate();
    const { isMaintenance, maintenanceConfig } = useMaintenance();

    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [manualPassword, setManualPassword] = useState('');
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const captchaUrlRef = useRef('');
    const csrfTokenRef = useRef('');
    const inputRef = useRef(null);

    const studentId = friend?.studentId || friend?.username || (friend?.id !== 'main' ? friend?.id : '') || (typeof window !== 'undefined' ? localStorage.getItem('rememberedId') : '') || '';

    const savedPassword = useMemo(() => {
        if (!friend) return '';
        let candidate = friend.password;
        const sid = friend.studentId || friend.username || (friend.id !== 'main' ? friend.id : '') || '';
        if (!candidate && sid) {
            const foundInFriends = (getSavedFriends() || []).find(f => f.studentId === sid || f.username === sid || f.id === sid);
            if (foundInFriends?.password) candidate = foundInFriends.password;
        }
        if (!candidate && (friend.id === 'main' || sid === (typeof window !== 'undefined' ? localStorage.getItem('rememberedId') : ''))) {
            candidate = (typeof window !== 'undefined' ? localStorage.getItem('rememberedPassword') : '') || getMyProfile()?.password;
        }
        if (!candidate) return '';
        const decoded = decodePassword(candidate);
        return decoded || candidate;
    }, [friend]);

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
        setManualPassword('');

        let isMounted = true;
        const loadInitial = async () => {
            setLoadingCaptcha(true);
            try {
                const res = await erpService.getInitialState();
                if (!isMounted) return;
                if (res?.csrfToken) {
                    setCsrfToken(res.csrfToken);
                    csrfTokenRef.current = res.csrfToken;
                }
                if (res?.captchaUrl) {
                    setCaptchaUrl(res.captchaUrl);
                    captchaUrlRef.current = res.captchaUrl;
                } else if (res?.captchaBlob) {
                    if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                        URL.revokeObjectURL(captchaUrlRef.current);
                    }
                    const objectUrl = URL.createObjectURL(res.captchaBlob);
                    captchaUrlRef.current = objectUrl;
                    setCaptchaUrl(objectUrl);
                } else {
                    await refreshCaptcha();
                }
            } catch (err) {
                console.warn('[FriendCaptchaModal] Initial state notice, falling back:', err);
                if (isMounted) await refreshCaptcha();
            } finally {
                if (isMounted) setLoadingCaptcha(false);
            }
        };

        loadInitial();

        const timer = setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 150);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [isOpen, friend, refreshCaptcha]);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        if (isSubmitting || !friend) return;

        if (isMaintenance) {
            setError(maintenanceConfig?.message || 'ERP login is currently under maintenance. Direct login is paused.');
            return;
        }

        const cleanCaptcha = captcha.trim();
        if (!cleanCaptcha) {
            setError('Please enter the captcha shown above.');
            return;
        }

        const rawPassword = savedPassword || manualPassword.trim();
        const activeToken = csrfTokenRef.current || erpService.getStoredCsrfToken() || csrfToken || '';

        if (!studentId) {
            setError('Missing Student ID.');
            return;
        }

        if (!rawPassword) {
            setError('Please enter the ERP password.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const loginResult = await erpService.login(studentId, rawPassword, cleanCaptcha, activeToken);

            if (loginResult && loginResult.success && loginResult.verified && loginResult.html && isVerifiedErpDashboard(loginResult.html, studentId)) {
                // Save session for profile
                localStorage.setItem('erpDashboardHtml', loginResult.html);
                localStorage.setItem('userUniversity', 'klu');
                localStorage.setItem('activeErpUser', studentId);
                const currentCookies = erpService.getStoredErpCookies(studentId);
                if (currentCookies) {
                    localStorage.setItem(`erp_cookie_${studentId}`, currentCookies);
                }

                // Set active profile
                setActiveProfileId(friend.id || 'main');

                if (typeof setErpUser === 'function') {
                    setErpUser(studentId);
                }

                // If password was manually entered, auto-save so user never has to re-type
                if (manualPassword.trim()) {
                    if (friend.id === 'main') {
                        saveMyProfile({
                            nickname: friend.nickname || 'My Account',
                            studentId,
                            password: manualPassword.trim()
                        });
                    } else {
                        saveFriend({
                            id: friend.id,
                            nickname: friend.nickname || 'Buddy',
                            studentId,
                            password: manualPassword.trim()
                        });
                    }
                }

                // Determine target session
                const targetYear = localStorage.getItem(`activeYear_${studentId}`) || localStorage.getItem('selectedAcademicYear') || '2026-2027';
                const targetSem = localStorage.getItem(`activeSem_${studentId}`) || localStorage.getItem('selectedSemester') || 'Odd';

                // Pre-sync and await live timetable so it is guaranteed saved to persistent storage
                try {
                    const res = await Promise.race([
                        fetchLiveErpTimetable(studentId, targetYear, targetSem),
                        new Promise(resolve => setTimeout(resolve, 3500))
                    ]);
                    if (res?.timetable) {
                        window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                            detail: { studentId, year: targetYear, sem: targetSem }
                        }));
                    }
                } catch { /* proceed */ }

                try {
                    const data = await Promise.race([
                        erpService.fetchAttendance(targetYear, targetSem, studentId),
                        new Promise(resolve => setTimeout(() => resolve([]), 6000))
                    ]);
                    if (Array.isArray(data) && data.length > 0) {
                        const payload = JSON.stringify({
                            attendance_data: data,
                            year: targetYear,
                            semester: targetSem,
                            timestamp: Date.now()
                        });
                        localStorage.setItem(`kleData_${studentId}`, payload);
                        localStorage.setItem(`kleData_${studentId}_${targetYear}_${targetSem}`, payload);
                        localStorage.setItem(`activeYear_${studentId}`, targetYear);
                        localStorage.setItem(`activeSem_${studentId}`, targetSem);
                        localStorage.setItem(`attendanceLastUpdated_${studentId}`, String(Date.now()));
                        window.dispatchEvent(new CustomEvent('kl_attendance_updated', {
                            detail: { studentId, data }
                        }));
                    }
                } catch { /* proceed */ }

                // Pre-sync live ERP grades in background (< 1s)
                fetchLiveErpGrades(studentId).catch(() => {});

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
                // Always navigate to Attendance Register (odd sem and year)
                navigate('/attendance-register');
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
                        ID: <span className="text-indigo-600 font-black">{studentId}</span>
                    </p>
                </div>

                {/* Auto-filled Notice */}
                {savedPassword ? (
                    <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 flex items-center gap-2 text-emerald-800 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>ID & Password saved. Enter Captcha only.</span>
                    </div>
                ) : (
                    <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-xl py-2 px-3 flex items-center gap-2 text-indigo-800 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Enter Password & Captcha to authenticate.</span>
                    </div>
                )}

                {/* ERP Maintenance Notice */}
                {isMaintenance && (
                    <div className="mb-4 p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs shadow-2xs">
                        <div className="font-black flex items-center gap-1.5 text-amber-900">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>ERP Under Maintenance · Unable to Login</span>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-amber-800 leading-snug">
                            {maintenanceConfig?.message || 'Direct ERP login is temporarily paused. Access will resume once maintenance completes.'}
                        </p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    {/* Manual Password field (shown if password not saved) */}
                    {!savedPassword && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                                ERP Password
                            </label>
                            <input
                                type="password"
                                value={manualPassword}
                                onChange={(e) => setManualPassword(e.target.value)}
                                placeholder="Enter your ERP password"
                                autoComplete="current-password"
                                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-xl py-2.5 px-4 text-slate-900 font-bold text-sm transition-all"
                            />
                        </div>
                    )}
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
                        disabled={isSubmitting || !captcha.trim() || isMaintenance}
                        className={`w-full py-3.5 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
                            isMaintenance
                                ? 'bg-amber-600 cursor-not-allowed opacity-90'
                                : 'bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98'
                        }`}
                    >
                        {isMaintenance ? (
                            <span>Unable to Login (ERP Maintenance)</span>
                        ) : isSubmitting ? (
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
