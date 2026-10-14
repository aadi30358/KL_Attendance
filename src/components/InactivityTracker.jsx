import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogOut, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/useAuth';

// Inactivity configuration: 5 minutes total (warning shown during last 60 seconds)
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
const WARNING_WINDOW_MS = 60 * 1000;
const WARNING_THRESHOLD_MS = INACTIVITY_LIMIT_MS - WARNING_WINDOW_MS; // 4 minutes

export const InactivityTracker = () => {
    const { erpUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(60);

    const lastActiveRef = useRef(Date.now());
    const isLoggingOutRef = useRef(false);

    // Check if user is logged into ERP
    const isErpLoggedIn = Boolean(erpUser || (typeof window !== 'undefined' && localStorage.getItem('activeErpUser')));
    const isLoginPage = location.pathname === '/login';

    const handleAutoLogout = useCallback(async () => {
        if (isLoggingOutRef.current) return;
        isLoggingOutRef.current = true;
        setShowWarning(false);

        try {
            sessionStorage.setItem('kl_logout_reason', 'inactivity');
            const activeId = localStorage.getItem('activeErpUser');
            if (activeId) {
                localStorage.removeItem(`kleData_${activeId}`);
                localStorage.removeItem(`activeYear_${activeId}`);
                localStorage.removeItem(`activeSem_${activeId}`);
                localStorage.removeItem(`attendanceLastUpdated_${activeId}`);
            }
            localStorage.removeItem('activeErpUser');
            localStorage.removeItem('erpDashboardHtml');
            localStorage.removeItem('kleData');
            sessionStorage.removeItem('erp_authenticated');
            sessionStorage.removeItem('adminLoggedOut');

            if (typeof logout === 'function') {
                await logout();
            }
        } catch (e) {
            console.error('[InactivityTracker] Auto-logout error:', e);
        } finally {
            window.dispatchEvent(new Event('storage'));
            navigate('/login');
            isLoggingOutRef.current = false;
        }
    }, [logout, navigate]);

    const resetTimer = useCallback(() => {
        lastActiveRef.current = Date.now();
        if (showWarning) {
            setShowWarning(false);
            setSecondsLeft(60);
        }
    }, [showWarning]);

    // Track user interaction events
    useEffect(() => {
        if (!isErpLoggedIn || isLoginPage) {
            setShowWarning(false);
            return;
        }

        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
        let throttleTimer = null;

        const onUserActivity = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
            }, 1000);

            lastActiveRef.current = Date.now();
            if (showWarning) {
                setShowWarning(false);
                setSecondsLeft(60);
            }
        };

        events.forEach(evt => {
            window.addEventListener(evt, onUserActivity, { passive: true });
        });

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const idleTime = Date.now() - lastActiveRef.current;
                if (idleTime >= INACTIVITY_LIMIT_MS) {
                    handleAutoLogout();
                }
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            events.forEach(evt => {
                window.removeEventListener(evt, onUserActivity);
            });
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [isErpLoggedIn, isLoginPage, showWarning, handleAutoLogout]);

    // Timer check loop
    useEffect(() => {
        if (!isErpLoggedIn || isLoginPage) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastActiveRef.current;

            if (elapsed >= INACTIVITY_LIMIT_MS) {
                handleAutoLogout();
            } else if (elapsed >= WARNING_THRESHOLD_MS) {
                setShowWarning(true);
                const remainingSec = Math.max(1, Math.ceil((INACTIVITY_LIMIT_MS - elapsed) / 1000));
                setSecondsLeft(remainingSec);
            } else {
                if (showWarning) {
                    setShowWarning(false);
                    setSecondsLeft(60);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isErpLoggedIn, isLoginPage, showWarning, handleAutoLogout]);

    if (!showWarning || !isErpLoggedIn || isLoginPage) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 relative overflow-hidden"
                >
                    {/* Top ambient color bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                            <Clock className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                    Inactivity Alert
                                </span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mt-1">
                                Are you still there?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                You have been inactive. To keep your university portal secure, your session will automatically log out in:
                            </p>
                        </div>
                    </div>

                    {/* Countdown Display */}
                    <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2">
                        <span className="text-3xl font-black text-amber-600 font-mono tracking-tight">
                            {secondsLeft}s
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            remaining
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                        <button
                            type="button"
                            onClick={resetTimer}
                            className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <CheckCircle className="w-4 h-4" />
                            <span>Stay Signed In</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleAutoLogout}
                            className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Logout Now</span>
                        </button>
                    </div>

                    <p className="text-[11px] text-center text-slate-400 mt-3 font-medium">
                        Moving your mouse or scrolling will also keep you signed in.
                    </p>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
