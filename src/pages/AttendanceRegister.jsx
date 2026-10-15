import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Sparkles, CheckCircle2, X } from 'lucide-react';
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

function getComponentMeta(compName) {
    const norm = (compName || '').trim().toLowerCase();
    if (norm.startsWith('pract') || norm.includes('lab') || norm === 'p') {
        return { id: 'P', label: 'Practical', weight: 50 };
    }
    if (norm.includes('theor') || norm.includes('tut') || norm === 't') {
        return { id: 'T', label: 'Tutorial', weight: 100 };
    }
    if (norm.includes('sk') || norm === 's') {
        return { id: 'S', label: 'Skill', weight: 25 };
    }
    return { id: 'L', label: 'Lecture', weight: 100 };
}

// ── BunkSimulator sub-component ──────────────────────────────────────
function BunkSimulator({ subject }) {
    const [bunkInput, setBunkInput] = useState('');

    // Filter to ONLY the components this subject actually has
    const availableComps = useMemo(() => {
        const rawEntries = subject?.components ? Object.entries(subject.components) : [];
        if (rawEntries.length === 0) {
            return [{ id: 'L', label: 'Lecture', weight: 100 }];
        }
        const seen = new Set();
        const list = [];
        rawEntries.forEach(([compName]) => {
            const meta = getComponentMeta(compName);
            if (!seen.has(meta.id)) {
                seen.add(meta.id);
                list.push(meta);
            }
        });
        return list.length > 0 ? list : [{ id: 'L', label: 'Lecture', weight: 100 }];
    }, [subject]);

    const [userSelectedComp, setUserSelectedComp] = useState('');
    const selectedComp = availableComps.some(c => c.id === userSelectedComp)
        ? userSelectedComp
        : (availableComps[0]?.id || 'L');

    const bunkCount = parseInt(bunkInput) || 0;
    let projectedActual = null;

    if (bunkCount > 0) {
        const components = subject?.components ? Object.entries(subject.components) : [];
        if (components.length > 0) {
            let totalConductedW = 0;
            let totalAttendedW = 0;

            components.forEach(([compName, data]) => {
                const meta = getComponentMeta(compName);
                const w = meta.weight;

                let cConducted = Number(data?.conducted) || 0;
                let cAttended = Number(data?.attended) || 0;

                if (meta.id === selectedComp) {
                    cConducted += bunkCount;
                }

                totalConductedW += cConducted * w;
                totalAttendedW += cAttended * w;
            });

            projectedActual = totalConductedW > 0 ? Math.ceil((totalAttendedW / totalConductedW) * 100) : null;
        } else {
            // Fallback for subjects with simple class totals
            const parts = (subject?.attended || '0/0').split('/');
            const attended = parseInt(parts[0]) || 0;
            const total = parseInt(parts[1]) || 0;
            projectedActual = (total + bunkCount > 0) ? Math.ceil((attended / (total + bunkCount)) * 100) : null;
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
                        onChange={(e) => setUserSelectedComp(e.target.value)}
                        className="bg-white border-2 border-indigo-300 text-slate-700 text-xs rounded-xl px-2 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold w-[110px] shrink-0 shadow-sm transition-all cursor-pointer"
                    >
                        {availableComps.map((comp) => (
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

// Dynamically generate modern academic years (current + future years down to 2021)
const generateDefaultYears = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const startYear = (currentMonth >= 5) ? currentYear : currentYear - 1;
    const topYear = Math.max(startYear + 1, 2026);
    const years = [];
    for (let y = topYear; y >= 2021; y--) {
        const text = `${y}-${y + 1}`;
        years.push({ value: text, text, isCurrent: y === startYear });
    }
    return years;
};

const DEFAULT_YEARS = generateDefaultYears();

const AttendanceRegister = () => {
    const { logout } = useAuth();
    const activeId = localStorage.getItem('activeErpUser');
    const storageKey = activeId ? `kleData_${activeId}` : 'kleData';

    const getInitialYears = () => {
        try {
            const cached = localStorage.getItem('kl_erp_session_years');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const filtered = parsed
                        .map(y => {
                            const cleanText = (y.text || y.value || '').replace(/\s*\([^)]*\)/g, '').trim();
                            return { ...y, text: cleanText || y.text };
                        })
                        .filter(y => {
                            const startYr = parseInt((y.text || '').split('-')[0], 10);
                            return !isNaN(startYr) && startYr >= 2021;
                        })
                        .sort((a, b) => {
                            const yA = parseInt((a.text || '').split('-')[0], 10) || 0;
                            const yB = parseInt((b.text || '').split('-')[0], 10) || 0;
                            return yB - yA;
                        });
                    if (filtered.length > 0) return filtered;
                }
            }
        } catch {
            // ignore fallback
        }
        return DEFAULT_YEARS;
    };

    const [year, setYear] = useState(() => {
        const manualYear = activeId ? localStorage.getItem(`manualYear_${activeId}`) : null;
        if (manualYear) return manualYear;
        const savedYear = activeId ? localStorage.getItem(`activeYear_${activeId}`) : null;
        if (savedYear) return savedYear;
        return DEFAULT_YEARS[0]?.value || '2026-2027';
    });
    const [semester, setSemester] = useState(() => {
        const manualSem = activeId ? localStorage.getItem(`manualSem_${activeId}`) : null;
        if (manualSem) return manualSem;
        const savedSem = activeId ? localStorage.getItem(`activeSem_${activeId}`) : null;
        return savedSem || 'Odd';
    });
    const [availableYears, setAvailableYears] = useState(getInitialYears);
    const [availableSemesters, setAvailableSemesters] = useState([
        { value: 'Even', text: 'Even Sem' },
        { value: 'Odd', text: 'Odd Sem' },
        { value: 'Summer', text: 'Summer Term' },
        { value: 'Term3', text: 'Tri Sem / Term 3' }
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
        const savedYear = activeId ? localStorage.getItem(`activeYear_${activeId}`) : null;
        const savedSem = activeId ? localStorage.getItem(`activeSem_${activeId}`) : null;
        const initY = savedYear || '2026-2027';
        const initS = savedSem || 'Odd';
        const scopedKey = activeId ? `kleData_${activeId}_${initY}_${initS}` : null;
        const scopedRaw = scopedKey ? localStorage.getItem(scopedKey) : null;
        const cachedRaw = scopedRaw || localStorage.getItem(storageKey);
        if (cachedRaw) {
            try {
                const parsed = JSON.parse(cachedRaw);
                if (parsed.attendance_data && Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                    setSubjects(parsed.attendance_data);
                    setShowDashboard(true);
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
                // Filter out ancient ERP years (e.g. 2012-2016) to keep dropdown compact and perfectly centered
                const validRecentYears = sessionData.years
                    .map(y => {
                        const cleanText = (y.text || y.value || '').replace(/\s*\([^)]*\)/g, '').trim();
                        return { ...y, text: cleanText || y.text };
                    })
                    .filter(y => {
                        const startYr = parseInt((y.text || '').split('-')[0], 10);
                        return !isNaN(startYr) && startYr >= 2021;
                    })
                    .sort((a, b) => {
                        const yA = parseInt((a.text || '').split('-')[0], 10) || 0;
                        const yB = parseInt((b.text || '').split('-')[0], 10) || 0;
                        return yB - yA;
                    });

                const finalYears = validRecentYears.length > 0 ? validRecentYears : DEFAULT_YEARS;
                setAvailableYears(finalYears);
                try {
                    localStorage.setItem('kl_erp_session_years', JSON.stringify(finalYears));
                } catch {
                    // ignore storage error
                }
            }
            if (sessionData.semesters && sessionData.semesters.length > 0) {
                setAvailableSemesters(sessionData.semesters);
            }
            // Auto-select active year directly: prioritize saved year if recent, otherwise current 2026-2027
            const userManualYear = activeId ? localStorage.getItem(`manualYear_${activeId}`) : null;
            if (userManualYear && (userManualYear.includes('202') || userManualYear === '29' || userManualYear === '18')) {
                setYear(userManualYear);
            } else if (sessionData.selectedYear?.text?.includes('2026') || sessionData.selectedYear?.value === '29' || sessionData.selectedYear?.value === '18') {
                setYear(sessionData.selectedYear.value || '2026-2027');
            } else {
                setYear('2026-2027');
            }

            const userManualSem = activeId ? localStorage.getItem(`manualSem_${activeId}`) : null;
            if (userManualSem) {
                setSemester(userManualSem);
            } else if (sessionData.selectedSemester) {
                const sText = sessionData.selectedSemester.text.toLowerCase();
                const matched = sText.includes('summer') ? 'Summer'
                    : (sText.includes('term') || sText.includes('tri')) ? 'Term3'
                    : sText.includes('even') ? 'Even'
                    : 'Odd';
                setSemester(matched);
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
        const pingInterval = setInterval(doPing, 90 * 1000);
        return () => {
            isMounted = false;
            clearInterval(pingInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDashboard]);

    // Automatically log out before or upon university ERP session expiration
    useEffect(() => {
        if (sessionStatus === 'expired') {
            handleLogoutAction('session_expired');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionStatus]);

    // Live background auto-check (only active while viewing current live semester)
    useEffect(() => {
        if (!showDashboard || !year || !semester) return;
        const yearObj = availableYears.find(y => y.value === year);
        const yText = yearObj?.text || '';
        const isPresentSession = year === '28' || yText.includes('2025-2026') || year === '29';
        if (!isPresentSession) return; // Completed historical records do not need constant polling

        const checkPeriodically = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            handleRefresh(true); // background silent check
        };

        const nearCheck = isNearPeriodEnd();
        const intervalMs = nearCheck.isWindow ? 30000 : 120000;
        const autoTimer = setInterval(checkPeriodically, intervalMs);
        return () => clearInterval(autoTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDashboard, year, semester, availableYears]);

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
            const yearObj = availableYears.find(y => y.value === fetchYear);
            const queryYear = yearObj?.text || fetchYear;
            const data = await erpService.fetchAttendance(queryYear, fetchSemester);
            setSubjects(data);
            setShowDashboard(true);
            // Save fetched data to standard location and scoped semester location safely
            try {
                const payload = JSON.stringify({ 
                    attendance_data: data, 
                    year: fetchYear, 
                    semester: fetchSemester, 
                    timestamp: Date.now() 
                });
                localStorage.setItem(storageKey, payload);
                if (activeId) {
                    localStorage.setItem(`activeYear_${activeId}`, fetchYear);
                    localStorage.setItem(`activeSem_${activeId}`, fetchSemester);
                    localStorage.setItem(`manualYear_${activeId}`, fetchYear);
                    localStorage.setItem(`manualSem_${activeId}`, fetchSemester);
                    localStorage.setItem(`kleData_${activeId}_${fetchYear}_${fetchSemester}`, payload);
                    localStorage.setItem(`attendanceLastUpdated_${activeId}`, String(Date.now()));
                }
            } catch (storageErr) {
                console.warn('[Storage] Quota exceeded or private browsing:', storageErr);
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
            const yearObj = availableYears.find(y => y.value === year);
            const queryYear = yearObj?.text || year;
            const data = await erpService.fetchAttendance(queryYear, semester);
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
                try {
                    localStorage.setItem(storageKey, JSON.stringify({ attendance_data: data }));
                    const now = Date.now();
                    if (activeId) {
                        localStorage.setItem(`attendanceLastUpdated_${activeId}`, String(now));
                    }
                } catch (storageErr) {
                    console.warn('[Storage] Quota exceeded or private browsing:', storageErr);
                }
                setLastUpdated(Date.now());
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
                localStorage.removeItem(`manualYear_${activeId}`);
                localStorage.removeItem(`manualSem_${activeId}`);
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
        const displayYearText = (() => {
            const raw = availableYears.find(y => y.value === year)?.text || (year === '29' || year === '18' ? '2026-2027' : year);
            return (raw || '').replace(/\s*\([^)]*\)/g, '').trim();
        })();
        const displaySemesterText = (() => {
            if (semester === 'Term3') return 'Tri Sem / Term 3';
            if (semester === 'Summer') return 'Summer Term';
            if (semester === 'Even' || semester === '2') return 'Even Sem';
            return 'Odd Sem';
        })();

        return (
            <div className="min-h-screen bg-slate-50 pt-28 sm:pt-32 pb-8 px-4 sm:px-6 font-sans">
                <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30" />

                {/* Header */}
                <div className="flex flex-col gap-4 mb-6 max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                </div>

                {/* Debug view */}
                {debugHtml && (
                    <div className="max-w-7xl mx-auto mb-6 bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-red-500 font-bold mb-4">Debug Output</h2>
                        <textarea readOnly className="w-full h-64 bg-slate-50 text-slate-700 font-mono text-xs p-4 rounded-xl border border-slate-200" value={debugHtml} />
                    </div>
                )}

                {/* Loading state skeleton */}
                {loading && subjects.length === 0 ? (
                    <div className="max-w-2xl mx-auto bg-white border-2 border-slate-900 rounded-[2.5rem] p-12 text-center shadow-lg my-8">
                        <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-5" />
                        <h3 className="text-xl font-black text-slate-900 mb-2">Fetching Academic Record</h3>
                        <p className="text-slate-500 text-sm font-medium">
                            Retrieving course registered records for <span className="font-bold text-indigo-600">{displayYearText} ({displaySemesterText} Semester)</span> from KL ERP...
                        </p>
                    </div>
                ) : subjects.length > 0 ? (
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
                            We couldn&apos;t find any registered courses for {displayYearText} ({displaySemesterText} Semester) on KL ERP.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={handleBack}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-200 transition-all cursor-pointer"
                            >
                                Change Academic Year / Semester
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        );
    }

    // ── SELECTION FORM ───────────────────────────────────────────────
    return (
        <div className="min-h-screen pt-24 sm:pt-28 pb-12 overflow-x-hidden bg-[#FAFAFA] flex items-center justify-center p-4 font-sans relative selection:bg-indigo-500 selection:text-white">
            {/* Ambient Background - High Performance Static Ambient */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-indigo-50/20" />
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-200/50 via-purple-100/40 to-pink-100/30 blur-3xl opacity-70" />
                <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-gradient-to-bl from-blue-200/50 via-teal-100/40 to-emerald-100/30 blur-3xl opacity-60" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="bg-white border-2 border-slate-900 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden transform-gpu">
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
                                <select
                                    value={year}
                                    onChange={e => {
                                        setYear(e.target.value);
                                        if (activeId) localStorage.setItem(`manualYear_${activeId}`, e.target.value);
                                    }}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium cursor-pointer">
                                    <option value="">Select Academic Year</option>
                                    {availableYears.length > 0 ? (
                                        availableYears
                                            .filter(y => {
                                                const startYr = parseInt((y.text || y.value || '').split('-')[0], 10);
                                                return isNaN(startYr) || startYr >= 2021;
                                            })
                                            .map(y => {
                                                const cleanText = (y.text || y.value || '').replace(/\s*\([^)]*\)/g, '').trim();
                                                return (
                                                    <option key={y.value} value={y.value}>
                                                        {cleanText}
                                                    </option>
                                                );
                                            })
                                    ) : (
                                        DEFAULT_YEARS.map(y => (
                                            <option key={y.value} value={y.value}>
                                                {y.text}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest ml-1">Semester</label>
                            <div className="relative">
                                <select
                                    value={semester}
                                    onChange={e => {
                                        setSemester(e.target.value);
                                        if (activeId) localStorage.setItem(`manualSem_${activeId}`, e.target.value);
                                    }}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium cursor-pointer">
                                    <option value="">Select Semester</option>
                                    {(() => {
                                        const seenVals = new Set();
                                        const list = [];
                                        availableSemesters.forEach(s => {
                                            const sLow = (s.text || '').toLowerCase();
                                            const val = sLow.includes('summer') ? 'Summer'
                                                : (sLow.includes('term') || sLow.includes('tri')) ? 'Term3'
                                                : sLow.includes('even') ? 'Even'
                                                : 'Odd';
                                            if (!seenVals.has(val)) {
                                                seenVals.add(val);
                                                const label = val === 'Odd' ? 'Odd Sem'
                                                    : val === 'Even' ? 'Even Sem'
                                                    : val === 'Summer' ? 'Summer Term'
                                                    : 'Tri Sem / Term 3';
                                                list.push({ val, text: label });
                                            }
                                        });
                                        if (!seenVals.has('Odd')) list.push({ val: 'Odd', text: 'Odd Sem' });
                                        if (!seenVals.has('Even')) list.push({ val: 'Even', text: 'Even Sem' });
                                        if (!seenVals.has('Summer')) list.push({ val: 'Summer', text: 'Summer Term' });
                                        if (!seenVals.has('Term3')) list.push({ val: 'Term3', text: 'Tri Sem / Term 3' });
                                        return list.map(s => (
                                            <option key={s.val} value={s.val}>
                                                {s.text}
                                            </option>
                                        ));
                                    })()}
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
