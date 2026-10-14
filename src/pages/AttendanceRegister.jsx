import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, RefreshCw, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { erpService } from '../services/erpService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
    isNearPeriodEnd,
    calculateAttendanceDiff,
    playAttendanceChime
} from '../services/attendanceAlerts';

function formatTimeAgo(timestamp) {
    if (!timestamp) return null;
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
}

// Component weights matching the extension: L=100, T=100, P=50, S=25
const WEIGHTS = { L: 100, T: 100, P: 50, S: 25 };

function getColor(pct) {
    if (pct >= 85) return 'text-emerald-600';
    if (pct >= 75) return 'text-amber-500';
    return 'text-red-500';
}

function getBgStrip(pct) {
    if (pct >= 85) return 'bg-gradient-to-r from-emerald-400 to-teal-500';
    if (pct >= 75) return 'bg-gradient-to-r from-amber-400 to-yellow-400';
    return 'bg-gradient-to-r from-red-400 to-rose-500';
}

function getStatusLabel(pct) {
    if (pct >= 85) return { text: '✓ Safe (85%+)', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    if (pct >= 75) return { text: '⚠ OK (75–85%)', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
    return { text: '✗ Shortage', cls: 'bg-red-50 text-red-600 ring-red-200' };
}

// ── BunkSimulator sub-component ──────────────────────────────────────
function BunkSimulator({ subject }) {
    const [bunkInput, setBunkInput] = useState('');

    // Always allow these 4 standard options
    const ALL_COMPS = [
        { id: 'L', label: 'Lecture' },
        { id: 'T', label: 'Tutorial' },
        { id: 'P', label: 'Practical' },
        { id: 'S', label: 'Skill' }
    ];

    // Determine available components to see if we can default to one they actually have
    const components = subject.components ? Object.entries(subject.components) : [];
    const hasComponents = components.length > 0;

    // Default to the first component if available, else Lecture
    const [selectedComp, setSelectedComp] = useState(hasComponents ? components[0][0].charAt(0).toUpperCase() : 'L');

    const bunkCount = parseInt(bunkInput) || 0;
    let projectedActual = null;

    if (bunkCount > 0) {
        if (hasComponents) {
            let totalConductedW = 0;
            let totalAttendedW = 0;
            let selectedCompFound = false;

            components.forEach(([compName, data]) => {
                const firstChar = compName ? compName.charAt(0).toUpperCase() : '';
                const w = WEIGHTS[firstChar] || WEIGHTS[compName] || 1;

                let cConducted = data.conducted;
                let cAttended = data.attended;

                if (firstChar === selectedComp || compName === selectedComp) {
                    cConducted += bunkCount;
                    selectedCompFound = true;
                }

                totalConductedW += cConducted * w;
                totalAttendedW += cAttended * w;
            });

            if (!selectedCompFound) {
                const w = WEIGHTS[selectedComp] || 1;
                totalConductedW += bunkCount * w;
                // attended doesn't increase since we bunked
            }

            projectedActual = totalConductedW > 0 ? Math.ceil((totalAttendedW / totalConductedW) * 100) : null;
        } else {
            // Fallback for subjects with completely broken component names
            const parts = (subject.attended || '0/0').split('/');
            const attended = parseInt(parts[0]) || 0;
            const total = parseInt(parts[1]) || 0;
            projectedActual = parseFloat(((attended / (total + bunkCount)) * 100).toFixed(2));
        }
    }

    const projColor = projectedActual !== null
        ? (projectedActual >= 85 ? 'text-emerald-600' : projectedActual >= 75 ? 'text-amber-600' : 'text-red-600')
        : '';

    return (
        <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em] mb-2">Bunk Simulator</p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <select
                        value={selectedComp}
                        onChange={(e) => setSelectedComp(e.target.value)}
                        className="bg-white border-2 border-indigo-300 text-slate-700 text-xs rounded-xl px-2 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold w-[110px] shrink-0 shadow-sm transition-all cursor-pointer"
                    >
                        {ALL_COMPS.map((comp) => (
                            <option key={comp.id} value={comp.id}>{comp.label}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min="0"
                        placeholder="Classes to bunk"
                        value={bunkInput}
                        onChange={e => setBunkInput(e.target.value)}
                        className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-slate-50"
                    />
                    {projectedActual !== null && (
                        <div className={`text-sm font-black tabular-nums shrink-0 ${projColor}`}>
                            → {projectedActual}%
                        </div>
                    )}
                </div>
                {projectedActual !== null && (
                    <p className={`text-[11px] font-semibold mt-1.5 ${projColor}`}>
                        {projectedActual >= 85
                            ? <span className="text-emerald-700">Safe</span>
                            : projectedActual >= 75
                                ? <span className="text-amber-700">⚠️ Caution: Attendance below 85%, my friend — whatever the reason, too many skips ain’t cool. Reconsider before it’s a whole problem.</span>
                                : <span className="text-red-700">⚠️ Attendance on thin ice, it’s giving detention vibes — don’t say I didn’t warn you.</span>}
                    </p>
                )}
                <p className="text-[10px] text-slate-400 italic font-medium mt-2">
                    * Note: The percentage is your Total Average Attendance. It drops differently depending on the component&apos;s weight (e.g. Lecture dropping impacts more than Skill).
                </p>
            </div>
        </div>
    );
}

const AttendanceRegister = () => {
    const { logout } = useAuth();
    const activeId = localStorage.getItem('activeErpUser');
    const storageKey = activeId ? `kleData_${activeId}` : 'kleData';

    // Default clean academic years matching ERP's real option format
    const DEFAULT_YEARS = [
        { value: '29', text: '2026-2027' },
        { value: '28', text: '2025-2026' },
        { value: '27', text: '2024-2025' },
        { value: '26', text: '2023-2024' }
    ];

    const getInitialYears = () => {
        try {
            const cached = localStorage.getItem('kl_erp_session_years');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {
            // ignore fallback
        }
        return DEFAULT_YEARS;
    };

    const [year, setYear] = useState(() => {
        const savedYear = activeId ? localStorage.getItem(`activeYear_${activeId}`) : null;
        if (savedYear && savedYear !== '18' && !savedYear.includes('(26-27)')) return savedYear;
        return '29';
    });
    const [semester, setSemester] = useState('Odd');
    const [availableYears, setAvailableYears] = useState(getInitialYears);
    const [availableSemesters, setAvailableSemesters] = useState([
        { value: 'Odd', text: 'Odd Sem' },
        { value: 'Even', text: 'Even Sem' },
        { value: 'Summer', text: 'Summer Term' },
        { value: 'Term3', text: 'Term 3' }
    ]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [debugHtml, setDebugHtml] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const [showDashboard, setShowDashboard] = useState(false);
    const [sessionStatus, setSessionStatus] = useState('active'); // 'active' | 'checking' | 'expired'
    const [lastUpdated, setLastUpdated] = useState(() => {
        if (!activeId) return null;
        try {
            const v = localStorage.getItem(`attendanceLastUpdated_${activeId}`);
            return v ? Number(v) : null;
        } catch {
            return null;
        }
    });
    const [attendanceNotification, setAttendanceNotification] = useState(null);
    const [justCheckedNotice, setJustCheckedNotice] = useState(null);
    const [recentlyUpdatedCodes, setRecentlyUpdatedCodes] = useState(new Set());

    const navigate = useNavigate();
    const location = useLocation();
    const subjectsRef = useRef(subjects);
    subjectsRef.current = subjects;

    // Listen for "Change Selection" from Navbar or cross-component reset
    useEffect(() => {
        const handleReset = () => {
            setShowDashboard(false);
            setSubjects([]);
            setFetchError(null);
            setDebugHtml(null);
        };
        window.addEventListener('kl_reset_selection', handleReset);
        return () => window.removeEventListener('kl_reset_selection', handleReset);
    }, []);

    // Check manual_sem_reset on route navigation
    useEffect(() => {
        if (sessionStorage.getItem('manual_sem_reset') === 'true') {
            sessionStorage.removeItem('manual_sem_reset');
            setShowDashboard(false);
            setSubjects([]);
            setFetchError(null);
            setDebugHtml(null);
        }
    }, [location]);

    // Initial mount and cache restoration
    useEffect(() => {
        const html = localStorage.getItem('erpDashboardHtml');

        if (!html || html.includes('site-error') || html.includes('The above error occurred') || html.includes('id="login-form"')) {
            localStorage.removeItem('erpDashboardHtml');
            localStorage.removeItem('activeErpUser');
            sessionStorage.removeItem('erp_authenticated');
            navigate('/login');
            return;
        }

        // Cleanup any old flags
        sessionStorage.removeItem('manual_sem_reset');

        // Restore cached attendance so student doesn't lose their dashboard on return/refresh
        const cachedRaw = localStorage.getItem(storageKey);
        if (cachedRaw) {
            try {
                const parsed = JSON.parse(cachedRaw);
                if (parsed.attendance_data && Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                    setSubjects(parsed.attendance_data);
                    setShowDashboard(true);
                    const savedYear = activeId ? localStorage.getItem(`activeYear_${activeId}`) : null;
                    const savedSem = activeId ? localStorage.getItem(`activeSem_${activeId}`) : null;
                    if (savedYear) setYear(savedYear);
                    if (savedSem) setSemester(savedSem);
                }
            } catch {
                // ignore
            }
        }

        // Dynamically discover registered sessions from ERP
        let isMounted = true;
        erpService.getAvailableSessions().then(sessionData => {
            if (!isMounted || !sessionData) return;
            if (sessionData.years && sessionData.years.length > 0) {
                setAvailableYears(sessionData.years);
                try {
                    localStorage.setItem('kl_erp_session_years', JSON.stringify(sessionData.years));
                } catch {
                    // ignore storage error
                }
            }
            if (sessionData.semesters && sessionData.semesters.length > 0) {
                setAvailableSemesters(sessionData.semesters);
            }
            // Auto-select active year and semester if not manually chosen or if using legacy default
            if (sessionData.selectedYear?.value) {
                const activeYrVal = sessionData.selectedYear.value;
                setYear(prev => {
                    if (!prev || prev === '18' || prev === '2026-2027' || prev.includes('(26-27)')) {
                        return activeYrVal;
                    }
                    const exists = sessionData.years?.some(y => y.value === prev);
                    return exists ? prev : activeYrVal;
                });
            } else if (sessionData.years && sessionData.years.length > 0) {
                const firstYrVal = sessionData.years[0].value;
                setYear(prev => {
                    if (!prev || prev === '18' || prev === '2026-2027' || prev.includes('(26-27)')) {
                        return firstYrVal;
                    }
                    const exists = sessionData.years?.some(y => y.value === prev);
                    return exists ? prev : firstYrVal;
                });
            }
            if (sessionData.selectedSemester) {
                const sText = sessionData.selectedSemester.text.toLowerCase();
                const matched = sText.includes('even') ? 'Even'
                    : sText.includes('summer') ? 'Summer'
                    : sText.includes('term') ? 'Term3'
                    : 'Odd';
                setSemester(prev => prev || matched);
            } else {
                setSemester(prev => prev || 'Odd');
            }
        }).catch(err => {
            console.warn('[AttendanceRegister] Could not preload sessions:', err);
        });

        return () => { isMounted = false; };
    }, [navigate, storageKey, activeId]);

    // Keep ERP session alive while dashboard is open (pings every 4 mins)
    useEffect(() => {
        if (!showDashboard) return;

        let isMounted = true;
        const doPing = async () => {
            try {
                const res = await erpService.keepSessionAlive();
                if (!isMounted) return;
                if (res?.sessionActive) {
                    setSessionStatus('active');
                } else if (res?.reason === 'Session expired' || res?.sessionActive === false) {
                    // Session is inactive or expired on university server -> auto logout
                    handleLogoutAction('session_expired');
                }
            } catch {
                // ignore
            }
        };

        doPing();
        const pingInterval = setInterval(doPing, 4 * 60 * 1000);
        return () => {
            isMounted = false;
            clearInterval(pingInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDashboard]);

    // Live background auto-check (always active while viewing dashboard)
    useEffect(() => {
        if (!showDashboard || !year || !semester) return;

        const checkPeriodically = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            handleRefresh(true); // background silent check
        };

        // If in attendance submission window (near period end), check every 15s; otherwise every 60s
        const nearCheck = isNearPeriodEnd();
        const intervalMs = nearCheck.isWindow ? 15000 : 60000;
        const autoTimer = setInterval(checkPeriodically, intervalMs);
        return () => clearInterval(autoTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDashboard, year, semester]);

    const handleSearch = async (fetchYear = year, fetchSemester = semester) => {
        if (!fetchYear || !fetchSemester) { 
            setFetchError('Please select both Year and Semester'); 
            return; 
        }
        setLoading(true); 
        setDebugHtml(null);
        setFetchError(null);
        setJustCheckedNotice(null);
        try {
            const data = await erpService.fetchAttendance(fetchYear, fetchSemester);
            setSubjects(data);
            setShowDashboard(true);
            // Save fetched data to standard location for persistence
            localStorage.setItem(storageKey, JSON.stringify({ attendance_data: data }));
            if (activeId) {
                localStorage.setItem(`activeYear_${activeId}`, fetchYear);
                localStorage.setItem(`activeSem_${activeId}`, fetchSemester);
                localStorage.setItem(`attendanceLastUpdated_${activeId}`, String(Date.now()));
            }
            setYear(fetchYear);
            setSemester(fetchSemester);
            setLastUpdated(Date.now());
            setSessionStatus('active');
        } catch (error) {
            if (error.message?.startsWith('DEBUG_HTML:')) { 
                setDebugHtml(error.message.replace('DEBUG_HTML:', '')); 
                setShowDashboard(true); 
            }
            else if (error.message?.startsWith('No table found')) { 
                setDebugHtml(error.message); 
                setShowDashboard(true); 
            }
            else {
                setFetchError(error.message || 'Failed to fetch attendance. Please verify your login status.');
            }
        } finally { setLoading(false); }
    };

    // Manual or automatic attendance refresh with diff detection and audio alert
    const handleRefresh = async (isSilent = false) => {
        if (loading || refreshing) return;
        if (!year || !semester) return;

        if (!isSilent) {
            setRefreshing(true);
            setFetchError(null);
            setJustCheckedNotice(null);
        }

        try {
            const data = await erpService.fetchAttendance(year, semester);
            if (Array.isArray(data) && data.length > 0) {
                const prev = subjectsRef.current || subjects;
                const diff = calculateAttendanceDiff(prev, data);

                if (diff.hasChanges) {
                    playAttendanceChime();
                    setAttendanceNotification({
                        show: true,
                        changes: diff.changes,
                        summary: diff.summaryBanner,
                        timestamp: Date.now()
                    });
                    const codes = new Set(diff.changes.map(c => c.code));
                    setRecentlyUpdatedCodes(codes);
                    setTimeout(() => {
                        setRecentlyUpdatedCodes(new Set());
                    }, 25000);
                } else if (!isSilent) {
                    setJustCheckedNotice('All caught up · No new attendance marks found');
                    setTimeout(() => setJustCheckedNotice(null), 4000);
                }

                setSubjects(data);
                localStorage.setItem(storageKey, JSON.stringify({ attendance_data: data }));
                const now = Date.now();
                if (activeId) {
                    localStorage.setItem(`attendanceLastUpdated_${activeId}`, String(now));
                }
                setLastUpdated(now);
                setSessionStatus('active');
            } else if (!isSilent) {
                setJustCheckedNotice('No attendance records returned for this semester.');
                setTimeout(() => setJustCheckedNotice(null), 4000);
            }
        } catch (error) {
            if (error.message?.includes('expired') || error.message?.includes('sign in')) {
                // University ERP session expired -> auto logout immediately
                handleLogoutAction('session_expired');
                return;
            } else if (!isSilent) {
                setFetchError(error.message || 'Failed to refresh attendance.');
            }
        } finally {
            if (!isSilent) setRefreshing(false);
        }
    };

    const handleBack = () => {
        setShowDashboard(false);
        setFetchError(null);
        setDebugHtml(null);
        setJustCheckedNotice(null);
    };

    const handleLogoutAction = async (reason = 'manual') => {
        try {
            if (reason === 'session_expired') {
                sessionStorage.setItem('kl_logout_reason', 'session_expired');
            } else if (reason === 'inactivity') {
                sessionStorage.setItem('kl_logout_reason', 'inactivity');
            }
            await logout();
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
            window.dispatchEvent(new Event('storage'));
            navigate('/login');
        } catch (e) {
            console.error(e);
            navigate('/login');
        }
    };

    // ── DASHBOARD VIEW ──────────────────────────────────────────────
    if (showDashboard) {
        const displayYearText = availableYears.find(y => y.value === year)?.text || (year === '29' || year === '18' ? '2026-2027' : year);
        const displaySemesterText = availableSemesters.find(s => s.value === semester)?.text || semester;

        return (
            <div className="min-h-screen bg-slate-50 pt-28 sm:pt-32 pb-8 px-4 sm:px-6 font-sans">
                <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30" />

                {/* Header */}
                <div className="flex flex-col gap-4 mb-6 max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                    Attendance <span className="text-indigo-600">Dashboard</span>
                                </h1>

                                {/* ERP Session Status Pill */}
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors shadow-2xs ${
                                    sessionStatus === 'active'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : sessionStatus === 'checking'
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-red-50 text-red-800 border-red-300'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${
                                        sessionStatus === 'active' ? 'bg-emerald-500 animate-pulse' : sessionStatus === 'checking' ? 'bg-amber-500 animate-spin' : 'bg-red-500'
                                    }`} />
                                    <span>{sessionStatus === 'active' ? 'ERP Session Active' : sessionStatus === 'checking' ? 'Checking ERP Session...' : 'Session Expired'}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-xs sm:text-sm font-medium">
                                <button
                                    onClick={handleBack}
                                    title="Click to change academic year or semester"
                                    className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left font-semibold"
                                >
                                    {year && semester ? `${displayYearText} · ${displaySemesterText} Semester` : 'Current Session'}
                                </button>
                                {lastUpdated && (
                                    <>
                                        <span>•</span>
                                        <span className="text-indigo-600 font-bold">Last checked: {formatTimeAgo(lastUpdated)}</span>
                                    </>
                                )}
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Live
                                </span>
                                <button
                                    onClick={() => handleRefresh(false)}
                                    disabled={refreshing || loading}
                                    title="Refresh attendance data from ERP"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                                >
                                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                                    <span>{refreshing ? 'Checking...' : 'Check Attendance'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Diff Alert Banner (Celebration when faculty posts attendance) */}
                    <AnimatePresence>
                        {attendanceNotification?.show && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white shadow-xl flex items-center justify-between gap-4 border-2 border-emerald-400"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
                                        <Sparkles className="w-6 h-6 text-yellow-300 animate-bounce" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">New Attendance Detected</span>
                                            <span className="text-emerald-100 text-xs font-semibold">Just now</span>
                                        </div>
                                        <p className="font-extrabold text-sm sm:text-base mt-0.5">{attendanceNotification.summary}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAttendanceNotification(null)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                                    title="Dismiss"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Just Checked Up-to-Date Notice */}
                    {justCheckedNotice && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-xs font-bold flex items-center gap-2 shadow-2xs"
                        >
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>{justCheckedNotice}</span>
                        </motion.div>
                    )}

                    {/* Session Expired Banner */}
                    {sessionStatus === 'expired' && (
                        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                <div>
                                    <p className="font-black text-sm text-amber-900">University ERP Session Timed Out</p>
                                    <p className="text-xs font-medium text-amber-800">Your session has expired on the university server after inactivity. Cached attendance is shown above.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow cursor-pointer shrink-0"
                            >
                                Sign In to Refresh
                            </button>
                        </div>
                    )}
                </div>

                {/* Debug view */}
                {debugHtml && (
                    <div className="max-w-7xl mx-auto mb-6 bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-red-500 font-bold mb-4">Debug Output</h2>
                        <textarea readOnly className="w-full h-64 bg-slate-50 text-slate-700 font-mono text-xs p-4 rounded-xl border border-slate-200" value={debugHtml} />
                    </div>
                )}

                {/* Cards Grid */}
                {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-7xl mx-auto">
                        {subjects.map((subject, index) => {
                            const pct = subject.percent;
                            const status = getStatusLabel(pct);
                            const isRecentlyUpdated = recentlyUpdatedCodes.has(subject.code);

                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className={`bg-white rounded-2xl overflow-hidden shadow transition-all duration-300 ${
                                        isRecentlyUpdated
                                            ? 'border-2 border-emerald-500 ring-4 ring-emerald-200/80 shadow-lg -translate-y-1'
                                            : 'border-2 border-slate-900 hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                                >
                                    {/* Top color strip */}
                                    <div className={`h-1.5 w-full ${getBgStrip(pct)}`} />

                                    <div className="p-5">
                                        {/* Title row */}
                                        <div className="flex justify-between items-start gap-4 mb-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide leading-snug">{subject.title}</h3>
                                                    {isRecentlyUpdated && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                                                            <Sparkles className="w-3 h-3 text-emerald-600" />
                                                            Just Updated
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-400 text-[11px] mt-0.5 font-mono">{subject.code}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className={`text-3xl font-black tabular-nums leading-none ${getColor(pct)}`}>{pct}%</div>
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1.5 ring-1 ${status.cls}`}>
                                                    {status.text}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 mb-4" />

                                        <div className="flex flex-col gap-5">
                                            {/* Components */}
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em] mb-2.5">Components</p>
                                                <div className="space-y-1.5">
                                                    {subject.components && Object.entries(subject.components).map(([compName, compData]) => (
                                                        <div key={compName} className="flex justify-between items-center gap-2">
                                                            <span className="text-slate-600 text-xs font-medium">
                                                                {compName === 'L' ? 'Lecture' : compName === 'P' ? 'Practical' : compName === 'T' ? 'Tutorial' : compName === 'S' ? 'Skill' : compName}
                                                            </span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <span className="text-slate-900 text-xs font-bold font-mono">{compData.attended}/{compData.conducted}</span>
                                                                <span className={`text-[10px] font-semibold ${getColor(compData.percent)}`}>({compData.percent}%)</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(!subject.components || Object.keys(subject.components).length === 0) && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-600 text-xs font-medium">Classes</span>
                                                            <span className="text-slate-900 text-xs font-bold font-mono">{subject.attended}</span>
                                                        </div>
                                                    )}
                                                    {subject.components && Object.keys(subject.components).length > 0 && (
                                                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                                                            <span className="text-slate-700 text-xs font-bold">Total (Raw)</span>
                                                            <span className="text-slate-900 text-xs font-bold font-mono">{subject.attended}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bunk Simulator */}
                                        <BunkSimulator subject={subject} />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-2xl mx-auto bg-white border-2 border-slate-900 rounded-[2.5rem] p-12 text-center shadow-xl"
                    >
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <BookOpen className="w-10 h-10 text-slate-300" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">No Courses Found</h2>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto">
                            We couldn&apos;t find any registered courses for the selected semester. Please verify your selection or check back later.
                        </p>
                    </motion.div>
                )}
            </div>
        );
    }

    // ── SELECTION FORM ───────────────────────────────────────────────
    return (
        <div className="min-h-screen pt-28 sm:pt-32 pb-12 overflow-x-hidden bg-[#FAFAFA] flex items-center justify-center p-4 font-sans relative selection:bg-indigo-500 selection:text-white">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-80" />
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 blur-[150px]" />
                <motion.div animate={{ x: [0, 100, 0], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-l from-blue-200 via-teal-200 to-emerald-200 blur-[150px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="bg-white/80 backdrop-blur-xl border-2 border-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 rounded-t-[2.5rem]" />

                    <div className="text-center mb-8 relative z-10">
                        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <BookOpen className="w-8 h-8 text-white" />
                        </motion.div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">KL ERP Attendance</h1>
                        <p className="text-slate-500 text-sm font-medium mt-1">Select your Academic Year and Semester</p>
                    </div>

                    <div className="space-y-5 relative z-10">
                        <div className="space-y-1.5">
                            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest ml-1">Academic Year</label>
                            <div className="relative">
                                <select value={year} onChange={e => setYear(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium cursor-pointer">
                                    <option value="">Select Academic Year</option>
                                    {availableYears.length > 0 ? (
                                        availableYears.map(y => (
                                            <option key={y.value} value={y.value}>
                                                {y.text}
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="29">2026-2027</option>
                                            <option value="28">2025-2026</option>
                                            <option value="27">2024-2025</option>
                                            <option value="26">2023-2024</option>
                                        </>
                                    )}
                                </select>
                                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest ml-1">Semester</label>
                            <div className="relative">
                                <select value={semester} onChange={e => setSemester(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium cursor-pointer">
                                    <option value="">Select Semester</option>
                                    {availableSemesters.length > 0 ? (
                                        availableSemesters.map(s => {
                                            const sLow = (s.text || '').toLowerCase();
                                            const val = sLow.includes('even') ? 'Even'
                                                : sLow.includes('summer') ? 'Summer'
                                                : sLow.includes('term') ? 'Term3'
                                                : 'Odd';
                                            return (
                                                <option key={s.value} value={val}>
                                                    {s.text}
                                                </option>
                                            );
                                        })
                                    ) : (
                                        <>
                                            <option value="Odd">Odd Sem</option>
                                            <option value="Even">Even Sem</option>
                                            <option value="Summer">Summer Term</option>
                                            <option value="Term3">Term 3</option>
                                        </>
                                    )}
                                </select>
                                <BookOpen className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {fetchError && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3"
                            >
                                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-red-600 text-xs font-black">!</span>
                                </div>
                                <p className="text-xs font-bold text-red-700 leading-relaxed">
                                    {fetchError}
                                </p>
                            </motion.div>
                        )}

                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => handleSearch(year, semester)} disabled={loading}
                            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all mt-2 flex items-center justify-center gap-2">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Get Attendance'}
                        </motion.button>

                        <div className="text-center pt-1">
                            <button onClick={handleLogoutAction} className="text-slate-400 text-sm font-semibold hover:text-slate-700 transition-colors">
                                Back to Login
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 relative z-10">
                        <p className="text-slate-400 text-[10px] text-center font-medium leading-relaxed">
                            This connects to the university ERP system. Your credentials are processed securely.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AttendanceRegister;
