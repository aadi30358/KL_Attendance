import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, RefreshCcw, Loader2, X, AlertCircle } from 'lucide-react';
import { erpService } from '../services/erpService';
import { decodePassword, setActiveProfileId, saveMyProfile, saveFriend, getSavedFriends, getMyProfile } from '../services/friendsService';
import { fetchLiveErpGrades } from '../services/gradesService';
import { fetchLiveErpTimetable } from '../services/timetableService';
import { useMaintenance } from '../services/useMaintenance';
import { useAuth } from '../context/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { broadcastAttendanceUpdate } from '../services/crossDomainSync';
import { 
    saveStudentProfileToCloud, 
    getStudentProfileFromCloud,
    saveFriendsToCloud, 
    saveAttendanceToCloud, 
    saveCgpaToCloud, 
    saveTimetableToCloud 
} from '../services/cloudStorageService';

export default function FriendCaptchaModal({ friend, isOpen, onClose, onSuccess }) {
    const { setErpUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isMaintenance, maintenanceConfig } = useMaintenance();

    const [captcha, setCaptcha] = useState('');
    const [captchaUrl, setCaptchaUrl] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [manualPassword, setManualPassword] = useState('');
    const [cloudPassword, setCloudPassword] = useState('');
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const captchaUrlRef = useRef('');
    const csrfTokenRef = useRef('');
    const captchaCookiesRef = useRef('');
    const inputRef = useRef(null);

    const studentId = friend?.studentId || friend?.username || (friend?.id !== 'main' ? friend?.id : '') || (typeof window !== 'undefined' ? localStorage.getItem('rememberedId') : '') || '';

    const savedPassword = useMemo(() => {
        if (!friend) return '';
        let candidate = friend.password || friend.savedPassword;
        const sid = friend.studentId || friend.username || (friend.id !== 'main' ? friend.id : '') || '';
        if (!candidate && sid) {
            const foundInFriends = (getSavedFriends() || []).find(f => f.studentId === sid || f.username === sid || f.id === sid);
            if (foundInFriends?.password) candidate = foundInFriends.password;
        }
        if (!candidate && sid) {
            candidate = (typeof window !== 'undefined' ? (localStorage.getItem(`friend_pass_${sid}`) || localStorage.getItem(`kl_pass_${sid}`)) : '');
        }
        if (!candidate && (friend.id === 'main' || sid === (typeof window !== 'undefined' ? localStorage.getItem('rememberedId') : ''))) {
            candidate = (typeof window !== 'undefined' ? localStorage.getItem('rememberedPassword') : '') || getMyProfile()?.password;
        }
        if (!candidate) {
            candidate = (typeof window !== 'undefined' ? localStorage.getItem('userCredentials_enc') : '');
        }
        if (!candidate) return '';
        const decoded = decodePassword(candidate);
        return decoded || candidate;
    }, [friend]);

    const effectivePassword = savedPassword || cloudPassword;

    const refreshCaptcha = useCallback(async () => {
        setLoadingCaptcha(true);
        setError('');
        setCaptcha('');
        try {
            const res = await erpService.refreshCaptcha(studentId);
            if (res?.cookies) {
                captchaCookiesRef.current = res.cookies;
                try { sessionStorage.setItem('kl_captcha_cookies', res.cookies); } catch { /* ignore */ }
            }
            const resolvedUrl = res?.captchaUrl || res?.dataUrl || (res?.blob ? URL.createObjectURL(res.blob) : null) || (res?.captchaBlob ? URL.createObjectURL(res.captchaBlob) : null);
            if (resolvedUrl) {
                if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                    URL.revokeObjectURL(captchaUrlRef.current);
                }
                captchaUrlRef.current = resolvedUrl;
                setCaptchaUrl(resolvedUrl);
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
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [studentId]);

    useEffect(() => {
        if (!isOpen || !friend) return;
        setCaptcha('');
        setError('');
        setManualPassword('');

        let isMounted = true;

        // In incognito or fresh browser, retrieve permanently saved password from Cloud Firestore
        if (!savedPassword && studentId) {
            getStudentProfileFromCloud(studentId).then(cloudProf => {
                if (cloudProf?.savedPassword && isMounted) {
                    const decoded = decodePassword(cloudProf.savedPassword);
                    if (decoded) setCloudPassword(decoded);
                }
            }).catch(() => {});
        }

        const loadInitial = async () => {
            setLoadingCaptcha(true);
            try {
                const res = await erpService.getInitialState();
                if (!isMounted) return;
                if (res?.cookies) {
                    captchaCookiesRef.current = res.cookies;
                    try { sessionStorage.setItem('kl_captcha_cookies', res.cookies); } catch { /* ignore */ }
                }
                if (res?.csrfToken) {
                    setCsrfToken(res.csrfToken);
                    csrfTokenRef.current = res.csrfToken;
                }
                const resolvedUrl = res?.captchaUrl || res?.dataUrl || (res?.captchaBlob ? URL.createObjectURL(res.captchaBlob) : null) || (res?.blob ? URL.createObjectURL(res.blob) : null);
                if (resolvedUrl) {
                    if (captchaUrlRef.current && captchaUrlRef.current.startsWith('blob:')) {
                        URL.revokeObjectURL(captchaUrlRef.current);
                    }
                    captchaUrlRef.current = resolvedUrl;
                    setCaptchaUrl(resolvedUrl);
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
    }, [isOpen, friend, refreshCaptcha, savedPassword, studentId]);

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

        const rawPassword = effectivePassword || manualPassword.trim();
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
            const boundCookies = captchaCookiesRef.current || (typeof window !== 'undefined' ? sessionStorage.getItem('kl_captcha_cookies') : '') || '';
            const loginResult = await erpService.login(studentId, rawPassword, cleanCaptcha, activeToken, boundCookies);

            if (loginResult && loginResult.success) {
                // Save session for profile
                try {
                    localStorage.setItem('erpDashboardHtml', loginResult.html);
                    localStorage.setItem('userUniversity', 'klu');
                    localStorage.setItem('activeErpUser', studentId);
                    const currentCookies = erpService.getStoredErpCookies(studentId);
                    if (currentCookies) {
                        localStorage.setItem(`erp_cookie_${studentId}`, currentCookies);
                    }
                } catch { /* ignore storage error */ }

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

                // PERMANENT STORAGE: Save profile, credentials & friends to Firestore cloud
                saveStudentProfileToCloud(studentId, {
                    name: friend.nickname || 'Student',
                    nickname: friend.nickname || 'Student',
                    password: rawPassword,
                    isPrimary: friend.id === 'main',
                    primaryAccount: friend.id === 'main'
                }).catch(() => {});
                saveFriendsToCloud(studentId, getSavedFriends()).catch(() => {});

                // Determine target session
                const defaultStudentYear = '2025-2026';
                let targetYear = localStorage.getItem(`manualYear_${studentId}`) || localStorage.getItem(`activeYear_${studentId}`) || defaultStudentYear;
                if (targetYear === '2026-2027') {
                    targetYear = '2025-2026';
                    try {
                        localStorage.setItem(`manualYear_${studentId}`, '2025-2026');
                        localStorage.setItem(`activeYear_${studentId}`, '2025-2026');
                    } catch { /* ignore */ }
                }
                const targetSem = localStorage.getItem(`manualSem_${studentId}`) || localStorage.getItem(`activeSem_${studentId}`) || 'Odd';

                try {
                    sessionStorage.setItem(`erp_verified_${studentId}`, 'true');
                    sessionStorage.setItem('erp_verified_active', studentId);
                } catch { /* ignore */ }

                // High-speed parallel background ingestion: fetch all enrolled semesters across student's academic history
                erpService.fetchAllEnrolledSemesters(studentId).catch(() => {});

                // Notify all listeners that a profile has successfully authenticated
                window.dispatchEvent(new CustomEvent('kl_profile_switched', {
                    detail: {
                        profile: friend,
                        studentId,
                        year: targetYear,
                        sem: targetSem
                    }
                }));

                // Instant UI feedback: Close modal immediately, don't keep user waiting!
                if (onSuccess) {
                    onSuccess(friend);
                }
                onClose();

                // Navigate to Attendance Register if on general pages, but preserve /grades, /cgpa, and /timetable in-place
                const currentPath = location?.pathname || '';
                if (currentPath !== '/grades' && currentPath !== '/cgpa' && currentPath !== '/timetable') {
                    navigate('/attendance-register');
                }

                // High-speed parallel background sync: fetches attendance, timetable, grades & all semesters concurrently & saves to cloud
                Promise.allSettled([
                    erpService.fetchAllEnrolledSemesters(studentId),
                    fetchLiveErpTimetable(studentId, targetYear, targetSem).then(res => {
                        if (res?.timetable) {
                            saveTimetableToCloud(studentId, res.timetable, targetYear, targetSem).catch(() => {});
                            window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                detail: { studentId, year: targetYear, sem: targetSem }
                            }));
                        }
                    }),
                    erpService.fetchAttendance(targetYear, targetSem, studentId).then(async data => {
                        let list = Array.isArray(data) ? data : [];
                        let finalYear = targetYear;
                        let finalSem = targetSem;

                        // INVARIANT: Never overwrite valid existing courses with empty response
                        if (list.length > 0) {
                            const payload = JSON.stringify({
                                attendance_data: list,
                                year: finalYear,
                                semester: finalSem,
                                timestamp: Date.now(),
                                empty: false
                            });
                            try {
                                localStorage.setItem(`kleData_${studentId}`, payload);
                                localStorage.setItem(`kleData_${studentId}_${finalYear}_${finalSem}`, payload);
                                localStorage.setItem(`activeYear_${studentId}`, finalYear);
                                localStorage.setItem(`activeSem_${studentId}`, finalSem);
                                localStorage.setItem(`manualYear_${studentId}`, finalYear);
                                localStorage.setItem(`manualSem_${studentId}`, finalSem);
                                localStorage.setItem(`attendanceLastUpdated_${studentId}`, String(Date.now()));
                            } catch { /* ignore storage error */ }

                            saveAttendanceToCloud(studentId, finalYear, finalSem, list).catch(() => {});
                        }

                        window.dispatchEvent(new CustomEvent('kl_attendance_updated', {
                            detail: { studentId, data: list, year: finalYear, sem: targetSem }
                        }));
                        window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                            detail: { studentId, year: finalYear, sem: targetSem }
                        }));
                        window.dispatchEvent(new CustomEvent('kl_active_profile_updated', {
                            detail: { studentId }
                        }));
                        broadcastAttendanceUpdate({
                            studentId,
                            year: finalYear,
                            semester: targetSem,
                            coursesCount: list.length,
                            timestamp: Date.now()
                        }).catch(() => {});
                    }),
                    fetchLiveErpGrades(studentId).then(res => {
                        if (res?.courses && res.courses.length > 0) {
                            saveCgpaToCloud(studentId, res.courses, res.cgpa).catch(() => {});
                        }
                    })
                ]).catch(() => {});
            } else {
                const failMsg = loginResult?.error || loginResult?.message || '';
                throw new Error(failMsg || 'The verification code is incorrect. Please check the captcha.');
            }
        } catch (err) {
            console.warn('Friend login notice:', err?.message || err);
            const msg = String(err?.message || err || 'The verification code is incorrect. Please check the captcha.');
            const lowerMsg = msg.toLowerCase();
            if (lowerMsg.includes('signal') || lowerMsg.includes('timed out') || lowerMsg.includes('timeout') || lowerMsg.includes('abort')) {
                setError('ERP server response took longer than expected. Please enter the new captcha to try again.');
            } else if (lowerMsg.includes('password') || lowerMsg.includes('incorrect username') || lowerMsg.includes('student id')) {
                setError('Incorrect ERP Password. Please update your saved password and try again.');
            } else if (lowerMsg.includes('verification code') || lowerMsg.includes('captcha') || lowerMsg.includes('verifycode')) {
                setError('The verification code is incorrect. Please check the captcha.');
            } else if (lowerMsg.includes('unable to verify') || lowerMsg.includes('session rejected') || lowerMsg.includes('session expired') || lowerMsg.includes('http 400') || lowerMsg.includes('http 403')) {
                setError('Session expired or invalid captcha. Please enter the new captcha code.');
            } else {
                setError(msg);
            }
            setCaptcha('');
            refreshCaptcha();
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !friend) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        >
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
                {effectivePassword ? (
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
                    {!effectivePassword && (
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
