import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Sparkles, CheckCircle2, X, Users, ArrowLeft, User, ShieldCheck, CalendarDays, ArrowRight, AlertTriangle, LogOut, ChevronDown } from 'lucide-react';
import { erpService, hasActiveErpSession } from '../services/erpService';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
    isNearPeriodEnd,
    calculateAttendanceDiff,
    playAttendanceChime
} from '../services/attendanceAlerts';
import { subscribeCrossDomainSync, broadcastAttendanceUpdate } from '../services/crossDomainSync';
import { getActiveProfileDetails, getSavedFriends, getMyProfile, getAllProfiles } from '../services/friendsService';
import {
    fetchLiveErpTimetable,
    normalizeAcademicYear,
    normalizeSemester,
    getPresentAcademicYearAndSem,
    getTruePresentAcademicYearAndSem,
    getStudentTimetable,
    getLiveClassStatus,
    cleanRoomNumber,
    getSubjectName,
    syncTimetableWithServer,
    DAYS_OF_WEEK,
    KLU_SESSIONS
} from '../services/timetableService';
import { fetchLiveErpGrades } from '../services/gradesService';
import FriendsManagerModal from '../components/FriendsManagerModal';
import FriendCaptchaModal from '../components/FriendCaptchaModal';
import ErpSidebar from '../components/ErpSidebar';
import { getAttendanceFromCloud, saveAttendanceToCloud, saveCgpaToCloud, saveTimetableToCloud, restoreStudentDataInIncognito } from '../services/cloudStorageService';

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

// Dynamically generate modern academic years (current + past years down to 2021)
const generateDefaultYears = () => {
    // Current operational academic year across KL University ERP with enrolled courses is 2026-2027
    const topYear = 2026;
    const years = [];
    for (let y = topYear; y >= 2021; y--) {
        const text = `${y}-${y + 1}`;
        years.push({ value: text, text, isCurrent: y === 2026 });
    }
    return years;
};

const DEFAULT_YEARS = generateDefaultYears();

// Build clean, deduplicated semester dropdown options with Present Semester first
const getAvailableSemesterOptions = (targetId) => {
    const options = [];
    const seen = new Set();

    // 1. Present Academic Session is always first
    const present = getTruePresentAcademicYearAndSem(targetId);
    const presY = normalizeAcademicYear(present.year);
    const presS = normalizeSemester(present.sem);
    const presKey = `${presY}_${presS}`;
    const presSemLabel = presS === 'Even' ? 'Even Sem' : presS === 'Summer' ? 'Summer Term' : presS === 'Term3' ? 'Tri Sem / Term 3' : 'Odd Sem';
    const presLabel = `Present Semester (${presY} · ${presSemLabel})`;

    options.push({
        key: presKey,
        year: presY,
        sem: presS,
        label: presLabel,
        isCurrent: true
    });
    seen.add(presKey);

    // 2. Previously enrolled / discovered semesters
    if (targetId) {
        try {
            const rawEnrolled = localStorage.getItem(`enrolledSemesters_${targetId}`);
            if (rawEnrolled) {
                const list = JSON.parse(rawEnrolled);
                if (Array.isArray(list)) {
                    list.forEach(item => {
                        const y = normalizeAcademicYear(item.year);
                        const s = normalizeSemester(item.semester);
                        const k = `${y}_${s}`;
                        if (!seen.has(k)) {
                            seen.add(k);
                            const semName = s === 'Even' ? 'Even Sem' : s === 'Summer' ? 'Summer Term' : s === 'Term3' ? 'Tri Sem / Term 3' : 'Odd Sem';
                            options.push({
                                key: k,
                                year: y,
                                sem: s,
                                label: `${y} · ${semName}`,
                                isCurrent: false
                            });
                        }
                    });
                }
            }
        } catch { /* ignore */ }
    }

    // 3. Batch-derived academic semesters (e.g. 24000... -> 2024 -> 2024-2025, 2025-2026, 2026-2027)
    const batchMatch = (targetId || '').match(/^(\d{2})/);
    const batchYear = batchMatch ? parseInt(batchMatch[1], 10) + 2000 : 2024;
    const startY = Math.max(2021, Math.min(batchYear, 2026));

    for (let y = 2026; y >= startY; y--) {
        const yrStr = `${y}-${y + 1}`;
        ['Even', 'Odd'].forEach(s => {
            const k = `${yrStr}_${s}`;
            if (!seen.has(k)) {
                seen.add(k);
                const semName = s === 'Even' ? 'Even Sem' : 'Odd Sem';
                options.push({
                    key: k,
                    year: yrStr,
                    sem: s,
                    label: `${yrStr} · ${semName}`,
                    isCurrent: false
                });
            }
        });
    }

    // Sort: Present Semester first, then descending chronological order
    const first = options[0];
    const rest = options.slice(1).sort((a, b) => {
        const yA = parseInt(a.year.split('-')[0], 10) || 0;
        const yB = parseInt(b.year.split('-')[0], 10) || 0;
        if (yB !== yA) return yB - yA;
        if (a.sem === 'Even' && b.sem === 'Odd') return -1;
        if (a.sem === 'Odd' && b.sem === 'Even') return 1;
        return 0;
    });

    return [first, ...rest];
};

const AttendanceRegister = () => {
    const { logout } = useAuth();
    const initialProfile = getActiveProfileDetails();
    const [activeProfile, setActiveProfile] = useState(() => initialProfile);
    const [activeId, setActiveId] = useState(() => {
        if (initialProfile?.isFriend && initialProfile?.studentId) {
            return initialProfile.studentId;
        }
        return localStorage.getItem('activeErpUser') || initialProfile?.studentId || '';
    });
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
        const present = getPresentAcademicYearAndSem(activeId);
        return present.year;
    });
    const [semester, setSemester] = useState(() => {
        const manualSem = activeId ? localStorage.getItem(`manualSem_${activeId}`) : null;
        if (manualSem) return manualSem;
        const savedSem = activeId ? localStorage.getItem(`activeSem_${activeId}`) : null;
        if (savedSem) return savedSem;
        const present = getPresentAcademicYearAndSem(activeId);
        return present.sem;
    });
    const [availableYears, setAvailableYears] = useState(getInitialYears);
    const [subjects, setSubjects] = useState(() => {
        if (!activeId) return [];
        try {
            const manualYear = localStorage.getItem(`manualYear_${activeId}`);
            const savedYear = localStorage.getItem(`activeYear_${activeId}`);
            const manualSem = localStorage.getItem(`manualSem_${activeId}`);
            const savedSem = localStorage.getItem(`activeSem_${activeId}`);
            const present = getPresentAcademicYearAndSem(activeId);
            const initY = normalizeAcademicYear(manualYear || savedYear || present.year);
            const initS = normalizeSemester(manualSem || savedSem || present.sem);

            const scopedKey = `kleData_${activeId}_${initY}_${initS}`;
            const scopedRaw = localStorage.getItem(scopedKey);
            if (scopedRaw) {
                const parsed = JSON.parse(scopedRaw);
                if (parsed.empty || (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length === 0)) {
                    return [];
                }
                if (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                    return parsed.attendance_data;
                }
            }

            const cached = localStorage.getItem(`kleData_${activeId}`) || ((activeId === localStorage.getItem('rememberedId')) ? localStorage.getItem('kleData') : null);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.year && parsed.semester &&
                    normalizeAcademicYear(parsed.year) === initY &&
                    normalizeSemester(parsed.semester) === initS) {
                    if (parsed.empty || (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length === 0)) {
                        return [];
                    }
                    if (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                        return parsed.attendance_data;
                    }
                }
            }
        } catch { /* ignore */ }
        return [];
    });
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
    const [showFriendsModal, setShowFriendsModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [targetFriendForCaptcha, setTargetFriendForCaptcha] = useState(null);
    const [timetableDisplayMode, setTimetableDisplayMode] = useState('aliases');
    const [timetableTick, setTimetableTick] = useState(0);

    // Reactively refresh timetable when updated from background ERP sync or profile changes
    useEffect(() => {
        const handleTimetableUpdate = () => setTimetableTick(t => t + 1);
        window.addEventListener('kl_timetable_updated', handleTimetableUpdate);
        window.addEventListener('storage', handleTimetableUpdate);
        return () => {
            window.removeEventListener('kl_timetable_updated', handleTimetableUpdate);
            window.removeEventListener('storage', handleTimetableUpdate);
        };
    }, []);

    const studentTimetable = useMemo(() => {
        void timetableTick;
        if (!activeId) return {};
        const cleanYear = normalizeAcademicYear(year);
        const cleanSem = normalizeSemester(semester);
        return getStudentTimetable(activeId, subjects || [], cleanYear, cleanSem) || {};
    }, [activeId, subjects, year, semester, timetableTick]);

    const hasTimetableSlots = useMemo(() => {
        return Boolean(studentTimetable && Object.values(studentTimetable).some(slots => Array.isArray(slots) && slots.length > 0));
    }, [studentTimetable]);

    // Determine active sessions dynamically (defaulting to S1-S8, expanding only if later periods exist)
    const activeSessions = useMemo(() => {
        let maxSlot = 8;
        if (studentTimetable) {
            Object.values(studentTimetable).forEach(slots => {
                if (Array.isArray(slots)) {
                    slots.forEach(s => {
                        const p = s.periodEnd || (s.period && s.span ? s.period + s.span - 1 : s.period) || s.period || 0;
                        if (p > maxSlot) maxSlot = Math.min(p, 14);
                    });
                }
            });
        }
        return KLU_SESSIONS.slice(0, Math.max(maxSlot, 8));
    }, [studentTimetable]);

    const liveClassStatus = useMemo(() => {
        if (!activeId || !hasTimetableSlots) return null;
        return getLiveClassStatus(studentTimetable, activeId);
    }, [studentTimetable, activeId, hasTimetableSlots]);

    useEffect(() => {
        if (!activeId || hasTimetableSlots) return;
        const cleanYear = normalizeAcademicYear(year);
        const cleanSem = normalizeSemester(semester);
        syncTimetableWithServer(activeId, cleanYear, cleanSem).then((dbSlots) => {
            if (dbSlots && Object.keys(dbSlots).length > 0) {
                setTimetableTick(t => t + 1);
            }
        }).catch(() => null);
    }, [activeId, year, semester, hasTimetableSlots]);

    // Listen for switch view event from ErpSidebar or external triggers

    const navigate = useNavigate();
    const location = useLocation();

    // Sync active profile & friends + Auto-logout when profile is deleted
    useEffect(() => {
        const updateProfile = () => {
            const all = getAllProfiles();
            const activeUser = localStorage.getItem('activeErpUser');
            if (all.length === 0 || !activeUser) {
                // INVARIANT: When all profiles or active profile are deleted, automatically logout
                try {
                    sessionStorage.setItem('kl_user_logged_out', 'true');
                    sessionStorage.removeItem('erp_authenticated');
                    localStorage.removeItem('activeErpUser');
                    localStorage.removeItem('erpDashboardHtml');
                } catch { /* ignore */ }
                navigate('/login', { replace: true, state: { loggedOut: true } });
                return;
            }
            setActiveProfile(getActiveProfileDetails());
        };

        window.addEventListener('kl_friends_updated', updateProfile);
        window.addEventListener('kl_active_profile_updated', updateProfile);
        window.addEventListener('storage', updateProfile);
        return () => {
            window.removeEventListener('kl_friends_updated', updateProfile);
            window.removeEventListener('kl_active_profile_updated', updateProfile);
            window.removeEventListener('storage', updateProfile);
        };
    }, [navigate]);
    const subjectsRef = useRef(subjects);
    subjectsRef.current = subjects;
    const sessionAttendanceBaselines = useRef(new Map());
    const hasRestoredCacheRef = useRef(false);

    // Listen for "Change Selection" from Navbar or cross-component reset
    useEffect(() => {
        const handleReset = () => {
            setShowDashboard(false);
            setFetchError(null);
            setDebugHtml(null);
            setJustCheckedNotice(null);
        };
        window.addEventListener('kl_reset_selection', handleReset);
        return () => window.removeEventListener('kl_reset_selection', handleReset);
    }, []);

    // Check manual_sem_reset on route navigation
    useEffect(() => {
        if (sessionStorage.getItem('manual_sem_reset') === 'true') {
            sessionStorage.removeItem('manual_sem_reset');
            setShowDashboard(false);
            setFetchError(null);
            setDebugHtml(null);
            setJustCheckedNotice(null);
        }
    }, [location]);

    // Check if navigated with intent to open Captcha for a friend
    useEffect(() => {
        if (location.state?.openCaptcha && location.state?.targetFriend) {
            setTargetFriendForCaptcha(location.state.targetFriend);
            setShowDashboard(false);
            setLoading(false);
        }
    }, [location.state]);

    // Cross-component trigger to immediately open Captcha for a friend or newly added profile
    useEffect(() => {
        const handleOpenCaptcha = (e) => {
            const friend = e.detail?.targetFriend || e.detail?.profile;
            if (friend) {
                setShowDashboard(false);
                setLoading(false);
                setTargetFriendForCaptcha(friend);
            }
        };
        window.addEventListener('kl_open_captcha', handleOpenCaptcha);
        return () => window.removeEventListener('kl_open_captcha', handleOpenCaptcha);
    }, []);

    const handleSearch = useCallback(async (fetchYear = year, fetchSemester = semester, customId = activeId, forceLive = false) => {
        if (!fetchYear || !fetchSemester) { 
            setFetchError('Please select both Year and Semester'); 
            return; 
        }

        // Resolve clean query year string (e.g. '2025-2026' or '2026-2027')
        const normYear = normalizeAcademicYear(fetchYear);
        const normSem = normalizeSemester(fetchSemester);
        const queryYear = normYear;
        const targetId = customId || activeId || localStorage.getItem('activeErpUser') || '';

        // 1. FAST CACHE-FIRST RELOAD (< 10ms): Check if cached data exists for this specific student, year & sem
        const scopedKey = targetId ? `kleData_${targetId}_${normYear}_${normSem}` : null;
        const scopedRaw = scopedKey ? localStorage.getItem(scopedKey) : null;
        if (scopedRaw && !forceLive) {
            try {
                const parsed = JSON.parse(scopedRaw);
                // If this semester has valid courses, load them immediately (< 10ms)
                if (Array.isArray(parsed?.attendance_data) && parsed.attendance_data.length > 0) {
                    const baseKey = `${targetId}_${normYear}_${normSem}`;
                    sessionAttendanceBaselines.current.set(baseKey, parsed.attendance_data);
                    setSubjects(parsed.attendance_data);
                    setShowDashboard(true);
                    setYear(normYear);
                    setSemester(normSem);
                    setLoading(false);
                    setFetchError(null);
                    setDebugHtml(null);
                    setLastUpdated(parsed.timestamp || Date.now());
                    setSessionStatus('active');

                    if (targetId) {
                        try {
                            localStorage.setItem(`activeYear_${targetId}`, normYear);
                            localStorage.setItem(`activeSem_${targetId}`, normSem);
                            localStorage.setItem(`manualYear_${targetId}`, normYear);
                            localStorage.setItem(`manualSem_${targetId}`, normSem);
                            localStorage.setItem(`kleData_${targetId}`, scopedRaw);
                        } catch { /* ignore */ }
                    }

                    // Background silent revalidation if active ERP session exists
                    if (hasActiveErpSession(targetId)) {
                        erpService.fetchAttendance(queryYear, fetchSemester, targetId)
                            .then(freshCourses => {
                                if (Array.isArray(freshCourses) && freshCourses.length > 0) {
                                    const freshKey = `${targetId}_${normYear}_${normSem}`;
                                    sessionAttendanceBaselines.current.set(freshKey, freshCourses);
                                    const currentActive = localStorage.getItem('activeErpUser');
                                    if (!currentActive || String(currentActive).trim() === String(targetId).trim()) {
                                        setSubjects(freshCourses);
                                        setLastUpdated(Date.now());
                                    }
                                    const payload = JSON.stringify({
                                        attendance_data: freshCourses,
                                        year: normYear,
                                        semester: normSem,
                                        timestamp: Date.now()
                                    });
                                    try {
                                        if (scopedKey) localStorage.setItem(scopedKey, payload);
                                        if (targetId) localStorage.setItem(`kleData_${targetId}`, payload);
                                    } catch { /* ignore */ }
                                }
                            })
                            .catch(() => {});
                    }
                    return;
                }
            } catch { /* ignore and proceed to network */ }
        }

        // 1b. PERMANENT CLOUD FALLBACK (< 120ms): Check Firestore for saved attendance
        // Essential for Incognito mode, cross-browser access, fresh devices, and cleared cache
        if (!forceLive) {
            try {
                const cloudAttendance = await getAttendanceFromCloud(targetId, normYear, normSem);
                if (cloudAttendance && Array.isArray(cloudAttendance.courses) && cloudAttendance.courses.length > 0) {
                    const baseKey = `${targetId}_${normYear}_${normSem}`;
                    sessionAttendanceBaselines.current.set(baseKey, cloudAttendance.courses);
                    setSubjects(cloudAttendance.courses);
                    setShowDashboard(true);
                    setYear(normYear);
                    setSemester(normSem);
                    setLoading(false);
                    setFetchError(null);
                    setDebugHtml(null);
                    setLastUpdated(cloudAttendance.timestamp || Date.now());
                    setSessionStatus(hasActiveErpSession(targetId) ? 'active' : 'expired');

                    // Defensively sync to local storage
                    const payload = JSON.stringify({
                        attendance_data: cloudAttendance.courses,
                        year: normYear,
                        semester: normSem,
                        timestamp: cloudAttendance.timestamp || Date.now()
                    });
                    try {
                        if (scopedKey) localStorage.setItem(scopedKey, payload);
                        if (targetId) {
                            localStorage.setItem(`kleData_${targetId}`, payload);
                            localStorage.setItem(`activeYear_${targetId}`, normYear);
                            localStorage.setItem(`activeSem_${targetId}`, normSem);
                            localStorage.setItem(`manualYear_${targetId}`, normYear);
                            localStorage.setItem(`manualSem_${targetId}`, normSem);
                            localStorage.setItem(`attendanceLastUpdated_${targetId}`, String(cloudAttendance.timestamp || Date.now()));
                        }
                    } catch { /* ignore */ }

                    // If active ERP session exists, silently re-check in background
                    if (hasActiveErpSession(targetId)) {
                        erpService.fetchAttendance(queryYear, fetchSemester, targetId)
                            .then(freshCourses => {
                                if (Array.isArray(freshCourses) && freshCourses.length > 0) {
                                    setSubjects(freshCourses);
                                    saveAttendanceToCloud(targetId, normYear, normSem, freshCourses).catch(() => {});
                                }
                            }).catch(() => {});
                    }
                    return;
                }
            } catch (cloudErr) {
                console.warn('[AttendanceRegister] Cloud read notice:', cloudErr?.message);
            }
        }

        // 2. If no cache exists, check active ERP session before network query
        if (!hasActiveErpSession(targetId)) {
            setLoading(false);
            setShowDashboard(false);
            const targetProfile = (getSavedFriends() || []).find(f => f.studentId === targetId || f.id === targetId) || (getMyProfile()?.studentId === targetId ? getMyProfile() : null);
            if (targetProfile?.password || targetProfile?.hasSavedPassword) {
                setTargetFriendForCaptcha(targetProfile);
                return;
            } else {
                navigate('/login', {
                    state: {
                        studentId: targetId,
                        profileId: targetProfile?.id || targetId,
                        view: 'attendance'
                    }
                });
                return;
            }
        }

        setLoading(true); 
        setDebugHtml(null);
        setFetchError(null);
        setJustCheckedNotice(null);

        try {
            const data = await erpService.fetchAttendance(queryYear, fetchSemester, targetId);
            const finalCourses = Array.isArray(data) ? data : [];
            const finalYear = normYear;
            const finalSem = normSem;
            const baseKey = `${targetId}_${finalYear}_${finalSem}`;
            sessionAttendanceBaselines.current.set(baseKey, finalCourses);

            const currentActive = localStorage.getItem('activeErpUser');
            if (currentActive && String(currentActive).trim() !== String(targetId).trim()) {
                // Profile was switched while network request was in flight; do not overwrite current view
                return;
            }

            if (finalCourses.length > 0) {
                setSubjects(finalCourses);
                setShowDashboard(true);
                saveAttendanceToCloud(targetId, finalYear, finalSem, finalCourses).catch(() => {});

                // Background sync timetable & CGPA to Firestore cloud & localStorage permanently
                try {
                    const { fetchLiveErpTimetable } = await import('../services/timetableService');
                    fetchLiveErpTimetable(targetId, finalYear, finalSem).then(res => {
                        if (res?.timetable) {
                            saveTimetableToCloud(targetId, res.timetable, finalYear, finalSem).catch(() => {});
                        }
                    }).catch(() => {});

                    const { fetchLiveErpGrades } = await import('../services/gradesService');
                    fetchLiveErpGrades(targetId).then(res => {
                        if (res?.courses && res.courses.length > 0) {
                            saveCgpaToCloud(targetId, res.courses, res.cgpa).catch(() => {});
                        }
                    }).catch(() => {});
                } catch { /* ignore */ }

                try {
                    localStorage.setItem(`activeYear_${targetId}`, finalYear);
                    localStorage.setItem(`activeSem_${targetId}`, finalSem);
                    localStorage.setItem(`manualYear_${targetId}`, finalYear);
                    localStorage.setItem(`manualSem_${targetId}`, finalSem);
                    const payload = JSON.stringify({
                        attendance_data: finalCourses,
                        year: finalYear,
                        semester: finalSem,
                        timestamp: Date.now(),
                        empty: false
                    });
                    localStorage.setItem(`kleData_${targetId}`, payload);
                    if (scopedKey) localStorage.setItem(scopedKey, payload);
                } catch { /* ignore */ }
            } else {
                // If semester has no courses on ERP, show clean "No Courses Found" for this semester
                setSubjects([]);
                setShowDashboard(true);
                try {
                    const emptyPayload = JSON.stringify({
                        attendance_data: [],
                        year: finalYear,
                        semester: finalSem,
                        timestamp: Date.now(),
                        empty: true
                    });
                    if (scopedKey) localStorage.setItem(scopedKey, emptyPayload);
                } catch { /* ignore */ }
            }

            setYear(finalYear);
            setSemester(finalSem);
            setLastUpdated(Date.now());
            setSessionStatus('active');

            if (finalCourses.length > 0) {
                // Trigger live ERP timetable & grades sync in background and save to cloud
                if (targetId) {
                    fetchLiveErpTimetable(targetId, finalYear, finalSem).then((res) => {
                        if (res?.timetable) {
                            saveTimetableToCloud(targetId, res.timetable, finalYear, finalSem).catch(() => {});
                            window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                detail: { studentId: targetId, year: finalYear, sem: finalSem }
                            }));
                        }
                    }).catch(() => null);

                    fetchLiveErpGrades(targetId).then(res => {
                        if (res?.courses && res.courses.length > 0) {
                            saveCgpaToCloud(targetId, res.courses, res.cgpa).catch(() => {});
                        }
                    }).catch(() => null);
                }

                const keyToUse = targetId ? `kleData_${targetId}` : 'kleData';
                try {
                    const payload = JSON.stringify({ 
                        attendance_data: finalCourses, 
                        year: finalYear, 
                        semester: finalSem, 
                        timestamp: Date.now() 
                    });
                    localStorage.setItem(keyToUse, payload);
                    if (targetId) {
                        localStorage.setItem(`activeYear_${targetId}`, finalYear);
                        localStorage.setItem(`activeSem_${targetId}`, finalSem);
                        localStorage.setItem(`manualYear_${targetId}`, finalYear);
                        localStorage.setItem(`manualSem_${targetId}`, finalSem);
                        localStorage.setItem(`kleData_${targetId}_${finalYear}_${finalSem}`, payload);
                        localStorage.setItem(`attendanceLastUpdated_${targetId}`, String(Date.now()));

                        // Persist attendance to server SQLite database
                        let totalCond = 0;
                        let totalAtt = 0;
                        finalCourses.forEach(c => {
                            totalCond += Number(c.total_conducted || c.conducted || 0);
                            totalAtt += Number(c.total_attended || c.attended || 0);
                        });
                        const overallPct = totalCond > 0 ? parseFloat(((totalAtt / totalCond) * 100).toFixed(2)) : null;

                        fetch(`/api/user-data/${encodeURIComponent(targetId)}/attendance`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                academicYear: finalYear,
                                semester: finalSem,
                                attendanceData: finalCourses,
                                overallPercentage: overallPct
                            })
                        }).catch(() => null);
                    }

                    // Instant Sub-Second Synchronization across all tabs, components & devices (< 1 second)
                    window.dispatchEvent(new CustomEvent('kl_attendance_updated', {
                        detail: { studentId: targetId, year: finalYear, sem: finalSem, data: finalCourses }
                    }));
                    window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                        detail: { studentId: targetId, year: finalYear, sem: finalSem }
                    }));
                    window.dispatchEvent(new CustomEvent('kl_active_profile_updated', {
                        detail: { studentId: targetId }
                    }));
                    broadcastAttendanceUpdate({
                        studentId: targetId,
                        year: finalYear,
                        semester: finalSem,
                        coursesCount: finalCourses.length,
                        timestamp: Date.now()
                    }).catch(() => {});
                } catch (storageErr) {
                    console.warn('[Storage] Quota exceeded or private browsing:', storageErr);
                }
            } else {
                // Strict Semester Isolation: When 0 courses found for selected year & semester,
                // do NOT resurrect old courses from other semesters or stale cache!
                setSubjects([]);
                setShowDashboard(true);
                const emptyPayload = JSON.stringify({
                    attendance_data: [],
                    year: finalYear,
                    semester: finalSem,
                    timestamp: Date.now(),
                    empty: true
                });
                try {
                    const scopedKey = targetId ? `kleData_${targetId}_${finalYear}_${finalSem}` : null;
                    if (scopedKey) {
                        localStorage.setItem(scopedKey, emptyPayload);
                    }
                    if (targetId) {
                        localStorage.setItem(`kleData_${targetId}`, emptyPayload);
                        localStorage.setItem(`activeYear_${targetId}`, finalYear);
                        localStorage.setItem(`activeSem_${targetId}`, finalSem);
                        localStorage.setItem(`manualYear_${targetId}`, finalYear);
                        localStorage.setItem(`manualSem_${targetId}`, finalSem);
                        localStorage.setItem(`attendanceLastUpdated_${targetId}`, String(Date.now()));
                    }
                    window.dispatchEvent(new CustomEvent('kl_attendance_updated', {
                        detail: { studentId: targetId, year: finalYear, sem: finalSem, data: [] }
                    }));
                    window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                        detail: { studentId: targetId, year: finalYear, sem: finalSem }
                    }));
                } catch { /* ignore storage error */ }
            }
        } catch (error) {
            console.warn('[ERP] Attendance query notice:', error.message);

            // 1. Restore from scoped cache if available for this specific year & semester
            const cachedPayload = targetId ? localStorage.getItem(`kleData_${targetId}_${normYear}_${normSem}`) : null;
            if (cachedPayload) {
                try {
                    const parsed = JSON.parse(cachedPayload);
                    if (Array.isArray(parsed?.attendance_data) && parsed.attendance_data.length > 0) {
                        setSubjects(parsed.attendance_data);
                        setYear(normYear);
                        setSemester(normSem);
                        setShowDashboard(true);
                        return;
                    }
                } catch { /* ignore */ }
            }

            const errMsg = String(error?.message || error || '');
            const lowerErr = errMsg.toLowerCase();
            if (lowerErr.includes('signal') || lowerErr.includes('timed out') || lowerErr.includes('timeout') || lowerErr.includes('abort')) {
                setFetchError('University ERP server took longer than expected to respond. Please try again or re-verify your session.');
            } else if (errMsg.startsWith('DEBUG_HTML:') || errMsg.startsWith('No table found')) { 
                setDebugHtml(errMsg); 
                setShowDashboard(true); 
            } else {
                setFetchError(errMsg || 'Failed to fetch attendance. Please verify your login status.');
            }
        } finally { 
            setLoading(false); 
        }
    }, [activeId, year, semester, navigate]);

    const handleSwitchSemester = useCallback((semesterKey) => {
        if (!semesterKey) return;
        const [targetYear, targetSem] = semesterKey.split('_');
        if (!targetYear || !targetSem) return;

        setAttendanceNotification(null);
        setRecentlyUpdatedCodes(new Set());
        setFetchError(null);
        setYear(targetYear);
        setSemester(targetSem);

        if (activeId) {
            try {
                localStorage.setItem(`manualYear_${activeId}`, targetYear);
                localStorage.setItem(`manualSem_${activeId}`, targetSem);
                localStorage.setItem(`activeYear_${activeId}`, targetYear);
                localStorage.setItem(`activeSem_${activeId}`, targetSem);
            } catch { /* ignore */ }
        }

        handleSearch(targetYear, targetSem, activeId, false);
    }, [activeId, handleSearch]);

    // Reactively update semester dropdown and auto-recover populated courses if background sync finishes
    useEffect(() => {
        const handleEnrolledUpdated = (e) => {
            if (!e.detail?.studentId || e.detail.studentId === activeId) {
                // If currently showing 0 courses, automatically present the latest populated semester
                if (subjectsRef.current.length === 0 && Array.isArray(e.detail?.semesters) && e.detail.semesters.length > 0) {
                    const latest = e.detail.semesters[0];
                    if (latest?.coursesCount > 0 && (latest.year !== year || latest.semester !== semester)) {
                        handleSearch(latest.year, latest.semester, activeId, false);
                    }
                }
            }
        };
        window.addEventListener('kl_enrolled_semesters_updated', handleEnrolledUpdated);
        return () => window.removeEventListener('kl_enrolled_semesters_updated', handleEnrolledUpdated);
    }, [activeId, handleSearch, year, semester]);

    // Listen for profile switches (via quick Captcha modal or sidebar)
    useEffect(() => {
        const handleProfileSwitch = (e) => {
            const detail = e.detail;
            const newId = detail?.studentId || (typeof detail === 'string' && /^\d+$/.test(detail) ? detail : null) || localStorage.getItem('activeErpUser') || '';
            const newProfile = detail?.profile || getActiveProfileDetails(detail?.profileId || newId);
            
            setActiveId(newId);
            setActiveProfile(newProfile);
            setAttendanceNotification(null);
            setRecentlyUpdatedCodes(new Set());
            setJustCheckedNotice(null);
            setSessionStatus('active');
            setFetchError(null);
            setDebugHtml(null);

            // Determine target academic year & semester for this student
            const defaultStudentYear = '2026-2027';
            const detailYear = detail?.year ? detail.year : null;
            const savedYear = newId ? (localStorage.getItem(`manualYear_${newId}`) || localStorage.getItem(`activeYear_${newId}`)) : null;
            const savedSem = newId ? (localStorage.getItem(`manualSem_${newId}`) || localStorage.getItem(`activeSem_${newId}`)) : null;
            let targetYear = detailYear || savedYear || defaultStudentYear;
            const targetSem = detail?.sem || savedSem || semester || 'Odd';

            setYear(targetYear);
            setSemester(targetSem);

            // If the switched profile does not have an active ERP session, DO NOT display private attendance data!
            if (!hasActiveErpSession(newId)) {
                setLoading(false);
                setSubjects([]);
                setShowDashboard(false);
                const profToVerify = newProfile || (getSavedFriends() || []).find(f => f.studentId === newId || f.id === newId) || (getMyProfile()?.studentId === newId ? getMyProfile() : null);
                if (profToVerify?.password || profToVerify?.hasSavedPassword || profToVerify?.studentId) {
                    setTargetFriendForCaptcha(profToVerify);
                    return;
                }
            }

            // Only if authenticated: check if cached data exists for quick display while refreshing
            const scopedKey = newId ? `kleData_${newId}_${targetYear}_${targetSem}` : null;
            const scopedRaw = scopedKey ? localStorage.getItem(scopedKey) : null;
            const fallbackRaw = (!scopedRaw && newId) ? localStorage.getItem(`kleData_${newId}`) : null;
            const dataToParse = scopedRaw || fallbackRaw;
            let hasValidCache = false;
            if (dataToParse) {
                try {
                    const parsed = JSON.parse(dataToParse);
                    if (parsed.attendance_data && Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                        setSubjects(parsed.attendance_data);
                        setShowDashboard(true);
                        hasValidCache = true;
                    }
                } catch {
                    // ignore
                }
            }
            if (!hasValidCache) {
                setSubjects([]);
                setShowDashboard(false);
            }

            // Immediately fetch fresh live attendance from ERP for the switched person
            handleSearch(targetYear, targetSem, newId);

            // Also trigger live ERP timetable sync for the switched person
            fetchLiveErpTimetable(newId, targetYear, targetSem).then((res) => {
                if (res?.timetable) {
                    window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                        detail: { studentId: newId, year: targetYear, sem: targetSem }
                    }));
                }
            }).catch(() => null);
        };

        window.addEventListener('kl_profile_switched', handleProfileSwitch);
        window.addEventListener('kl_active_profile_updated', handleProfileSwitch);
        return () => {
            window.removeEventListener('kl_profile_switched', handleProfileSwitch);
            window.removeEventListener('kl_active_profile_updated', handleProfileSwitch);
        };
    }, [handleSearch, year, semester]);

    // Initial mount and cache restoration
    useEffect(() => {
        if (hasRestoredCacheRef.current) return;
        hasRestoredCacheRef.current = true;

        const html = localStorage.getItem('erpDashboardHtml');
        const activeUser = activeId || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null);
        const hasSavedData = Boolean(
            (activeUser && localStorage.getItem(`kleData_${activeUser}`)) ||
            localStorage.getItem('kleData')
        );
        const hasSavedProfile = Boolean(
            activeUser && (
                (getSavedFriends() || []).some(f => (f.studentId === activeUser || f.id === activeUser)) ||
                (getMyProfile()?.studentId === activeUser)
            )
        );

        if ((!html || html.includes('site-error') || html.includes('The above error occurred') || html.includes('id="login-form"')) && !hasSavedData && !hasSavedProfile) {
            // Attempt fast cloud restore before giving up to login (essential for Incognito direct opens)
            const fallbackStudent = activeUser || '2400030358';
            restoreStudentDataInIncognito(fallbackStudent).then(restored => {
                if (restored) {
                    setActiveId(fallbackStudent);
                    setActiveProfile(getActiveProfileDetails(fallbackStudent));
                    const presentFallback = getPresentAcademicYearAndSem(fallbackStudent);
                    handleSearch(presentFallback.year, presentFallback.sem, fallbackStudent);
                } else {
                    localStorage.removeItem('erpDashboardHtml');
                    localStorage.removeItem('activeErpUser');
                    sessionStorage.removeItem('erp_authenticated');
                    navigate('/login');
                }
            }).catch(() => {
                navigate('/login');
            });
            return;
        }

        // Cleanup any old flags
        sessionStorage.removeItem('manual_sem_reset');

        // Restore cached attendance so student doesn't lose their dashboard on return/refresh
        const savedYear = activeId ? (localStorage.getItem(`activeYear_${activeId}`) || localStorage.getItem(`manualYear_${activeId}`)) : null;
        const savedSem = activeId ? (localStorage.getItem(`activeSem_${activeId}`) || localStorage.getItem(`manualSem_${activeId}`)) : null;
        const present = getPresentAcademicYearAndSem(activeId);
        let initY = normalizeAcademicYear(savedYear || present.year);
        const initS = normalizeSemester(savedSem || present.sem);
        const scopedKey = activeId ? `kleData_${activeId}_${initY}_${initS}` : null;
        const scopedRaw = scopedKey ? localStorage.getItem(scopedKey) : null;

        setYear(initY);
        setSemester(initS);

        let restoredCourses = null;
        let isRestoredEmpty = false;

        if (scopedRaw) {
            try {
                const parsed = JSON.parse(scopedRaw);
                if (parsed.empty || (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length === 0)) {
                    isRestoredEmpty = true;
                    restoredCourses = [];
                } else if (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                    restoredCourses = parsed.attendance_data;
                }
            } catch { /* ignore */ }
        }

        if (restoredCourses === null && !isRestoredEmpty) {
            const rawStorage = localStorage.getItem(storageKey);
            if (rawStorage) {
                try {
                    const parsed = JSON.parse(rawStorage);
                    if (parsed.year && parsed.semester &&
                        normalizeAcademicYear(parsed.year) === initY &&
                        normalizeSemester(parsed.semester) === initS) {
                        if (parsed.empty || (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length === 0)) {
                            isRestoredEmpty = true;
                            restoredCourses = [];
                        } else if (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                            restoredCourses = parsed.attendance_data;
                        }
                    }
                } catch { /* ignore */ }
            }
        }

        if (isRestoredEmpty) {
            setSubjects([]);
            setShowDashboard(true);
            if (hasActiveErpSession(activeId)) {
                handleSearch(initY, initS, activeId, true);
            }
        } else if (restoredCourses && restoredCourses.length > 0) {
            setSubjects(restoredCourses);
            setShowDashboard(true);
        } else {
            // Check permanent cloud storage (< 120ms) before prompting
            getAttendanceFromCloud(activeId, initY, initS).then(cloudData => {
                if (!isMounted) return;
                if (cloudData && Array.isArray(cloudData.courses) && cloudData.courses.length > 0) {
                    setSubjects(cloudData.courses);
                    setShowDashboard(true);
                    setLastUpdated(cloudData.timestamp || Date.now());
                    setSessionStatus(hasActiveErpSession(activeId) ? 'active' : 'expired');
                } else if (hasActiveErpSession(activeId)) {
                    handleSearch(initY, initS, activeId, true);
                } else {
                    setLoading(false);
                    setShowDashboard(false);
                    setSubjects([]);
                    const prof = (getSavedFriends() || []).find(f => f.studentId === activeId || f.id === activeId) || (getMyProfile()?.studentId === activeId ? getMyProfile() : null);
                    if (prof?.password || prof?.hasSavedPassword || prof?.studentId) {
                        setTargetFriendForCaptcha(prof);
                    }
                }
            }).catch(() => {
                if (hasActiveErpSession(activeId)) {
                    handleSearch(initY, initS, activeId, true);
                }
            });
        }

        // Dynamically discover registered sessions from ERP
        let isMounted = true;
        erpService.getAvailableSessions(activeId).then(sessionData => {
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
            // Auto-select active year directly: prioritize saved manual selection if available
            const userManualYear = activeId ? (localStorage.getItem(`manualYear_${activeId}`) || localStorage.getItem(`activeYear_${activeId}`)) : null;
            let nextYear = '2026-2027';
            if (userManualYear) {
                nextYear = normalizeAcademicYear(userManualYear);
                setYear(nextYear);
            } else if (sessionData.selectedYear?.text) {
                nextYear = normalizeAcademicYear(sessionData.selectedYear.text);
                setYear(nextYear);
            } else {
                nextYear = '2026-2027';
                setYear('2026-2027');
            }

            const userManualSem = activeId ? (localStorage.getItem(`manualSem_${activeId}`) || localStorage.getItem(`activeSem_${activeId}`)) : null;
            let nextSem = 'Odd';
            if (userManualSem) {
                nextSem = userManualSem;
                setSemester(userManualSem);
            } else if (sessionData.selectedSemester) {
                const sText = sessionData.selectedSemester.text.toLowerCase();
                const matched = sText.includes('summer') ? 'Summer'
                    : ((sText.includes('term') && !sText.includes('summer')) || sText.includes('tri')) ? 'Term3'
                    : sText.includes('even') ? 'Even'
                    : 'Odd';
                nextSem = matched;
                setSemester(matched);
            }

            // If subjects are currently empty and discovered session differs from initial query, query immediately
            const normNextYear = normalizeAcademicYear(nextYear);
            const normNextSem = normalizeSemester(nextSem);
            if (subjectsRef.current.length === 0 && (normNextYear !== initY || normNextSem !== initS)) {
                handleSearch(normNextYear, normNextSem, activeId);
            }

            // High-speed parallel background ingestion: fetch all enrolled semesters across student's academic history
            if (activeId && hasActiveErpSession(activeId)) {
                erpService.fetchAllEnrolledSemesters(activeId).then((allSemesters) => {
                    if (Array.isArray(allSemesters) && allSemesters.length > 0 && isMounted) {
                        // If current view has 0 courses or was empty, automatically present the latest populated semester
                        if (subjectsRef.current.length === 0) {
                            const latest = allSemesters.find(s => s?.courses && s.courses.length > 0) || allSemesters[0];
                            if (latest?.courses && latest.courses.length > 0) {
                                setSubjects(latest.courses);
                                setYear(latest.year);
                                setSemester(latest.semester);
                                setShowDashboard(true);
                                setLastUpdated(Date.now());
                                try {
                                    localStorage.setItem(`activeYear_${activeId}`, latest.year);
                                    localStorage.setItem(`activeSem_${activeId}`, latest.semester);
                                    localStorage.setItem(`manualYear_${activeId}`, latest.year);
                                    localStorage.setItem(`manualSem_${activeId}`, latest.semester);
                                } catch { /* ignore */ }
                            }
                        }
                    }
                }).catch(() => {});
            }
        }).catch(err => {
            console.warn('[AttendanceRegister] Could not preload sessions:', err);
        });

        return () => { isMounted = false; };
    }, [navigate, storageKey, activeId, handleSearch]);

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
                    // Session is inactive or expired on university server -> update indicator, retain dashboard
                    setSessionStatus('expired');
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
    }, [showDashboard]);

    // Retain dashboard view without wiping data when ERP session expires
    useEffect(() => {
        if (sessionStatus === 'expired') { 
            // Invariant: Never automatically wipe attendance or log out on ERP session expiration
            // Preserves permanent offline dashboard view for registered students
        }
    }, [sessionStatus]);

    // Live in-class auto-check & real-time monitoring (active for current academic sessions)
    useEffect(() => {
        if (!showDashboard || !year || !semester) return;
        const normY = normalizeAcademicYear(year);
        const curY = new Date().getFullYear();
        const startYr = parseInt(normY.split('-')[0], 10);
        const isPresentSession = isNaN(startYr) || startYr >= (curY - 1);
        if (!isPresentSession) return; // Do not constantly poll completed years from 2021

        let isPolling = false;
        const doCheck = async () => {
            if (isPolling) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const targetStudent = activeId || localStorage.getItem('activeErpUser') || '';
            if (!targetStudent || !hasActiveErpSession(targetStudent)) {
                return; // Strictly skip auto-poll if student does not have an active verified ERP session
            }
            isPolling = true;
            try {
                await handleRefresh(true);
            } finally {
                isPolling = false;
            }
        };

        // 1. Instant check the moment screen wakes up or tab is focused in class (0ms trigger)
        const onVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                doCheck();
            }
        };
        const onFocus = () => {
            doCheck();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);

        // 2. High-speed in-class polling: 4 seconds during active class periods, 10 seconds otherwise
        const pollMs = isNearPeriodEnd()?.isWindow ? 4000 : 10000;
        const autoTimer = setInterval(doCheck, pollMs);

        return () => {
            clearInterval(autoTimer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDashboard, year, semester]);

    // 3. Real-Time Cross-Domain & Cross-Tab Subscription (< 1s via BroadcastChannel + Firestore onSnapshot)
    useEffect(() => {
        const unsub = subscribeCrossDomainSync((event) => {
            if (event?.type === 'ATTENDANCE_UPDATED' && event.data) {
                const targetSid = activeId || localStorage.getItem('activeErpUser');
                if (!event.data.studentId || !targetSid || String(event.data.studentId).trim() !== String(targetSid).trim()) {
                    return; // event was for a different student or lacked studentId
                }
                const updatedCourses = event.data.data || event.data.attendance_data;
                if (Array.isArray(updatedCourses) && updatedCourses.length > 0) {
                    const normY = normalizeAcademicYear(year);
                    const normS = normalizeSemester(semester);
                    const key = `${targetSid}_${normY}_${normS}`;
                    const prev = sessionAttendanceBaselines.current.get(key);

                    if (prev && prev.length > 0 && prev !== updatedCourses) {
                        const diff = calculateAttendanceDiff(prev, updatedCourses, targetSid, targetSid);
                        if (diff.hasChanges) {
                            playAttendanceChime(diff.isAbsent);
                            setAttendanceNotification({
                                show: true,
                                changes: diff.changes,
                                summary: diff.summaryBanner,
                                isAbsent: diff.isAbsent,
                                timestamp: Date.now()
                            });
                            const codes = new Set(diff.changes.map(c => c.code));
                            setRecentlyUpdatedCodes(codes);
                            setTimeout(() => setRecentlyUpdatedCodes(new Set()), 25000);
                        }
                    }
                    sessionAttendanceBaselines.current.set(key, updatedCourses);
                    setSubjects(updatedCourses);
                    setLastUpdated(event.data.timestamp || Date.now());
                }
            }
        });

        // 4. Local Window Event Listener (0ms for same-window updates)
        const onLocalUpdate = (e) => {
            const detail = e.detail;
            const targetSid = activeId || localStorage.getItem('activeErpUser');
            if (!detail?.studentId || !targetSid || String(detail.studentId).trim() !== String(targetSid).trim()) return;
            const updated = detail?.data || detail?.attendance_data;
            if (Array.isArray(updated) && updated.length > 0) {
                const normY = normalizeAcademicYear(year);
                const normS = normalizeSemester(semester);
                const key = `${targetSid}_${normY}_${normS}`;
                const prev = sessionAttendanceBaselines.current.get(key);

                if (prev && prev.length > 0 && prev !== updated) {
                    const diff = calculateAttendanceDiff(prev, updated, targetSid, targetSid);
                    if (diff.hasChanges) {
                        playAttendanceChime(diff.isAbsent);
                        setAttendanceNotification({
                            show: true,
                            changes: diff.changes,
                            summary: diff.summaryBanner,
                            isAbsent: diff.isAbsent,
                            timestamp: Date.now()
                        });
                        const codes = new Set(diff.changes.map(c => c.code));
                        setRecentlyUpdatedCodes(codes);
                        setTimeout(() => setRecentlyUpdatedCodes(new Set()), 25000);
                    }
                }
                sessionAttendanceBaselines.current.set(key, updated);
                setSubjects(updated);
                setLastUpdated(Date.now());
            }
        };

        window.addEventListener('kl_attendance_updated', onLocalUpdate);

        return () => {
            unsub();
            window.removeEventListener('kl_attendance_updated', onLocalUpdate);
        };
    }, [activeId, subjects, year, semester]);

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
            const normY = normalizeAcademicYear(year);
            const normS = normalizeSemester(semester);
            const targetStudent = activeId || localStorage.getItem('activeErpUser') || '';
            if (!targetStudent || !hasActiveErpSession(targetStudent)) {
                if (!isSilent) {
                    const profToVerify = activeProfile || (getSavedFriends() || []).find(f => f.studentId === targetStudent || f.id === targetStudent) || (getMyProfile()?.studentId === targetStudent ? getMyProfile() : null);
                    if (profToVerify?.password || profToVerify?.hasSavedPassword || profToVerify?.studentId) {
                        setTargetFriendForCaptcha(profToVerify);
                    }
                }
                return;
            }
            const data = await erpService.fetchAttendance(normY, normS, targetStudent);
            if (Array.isArray(data) && data.length > 0) {
                const key = `${targetStudent}_${normY}_${normS}`;
                const prev = sessionAttendanceBaselines.current.get(key);

                if (prev && prev.length > 0) {
                    const diff = calculateAttendanceDiff(prev, data, targetStudent, targetStudent);

                    if (diff.hasChanges) {
                        playAttendanceChime(diff.isAbsent);
                        setAttendanceNotification({
                            show: true,
                            changes: diff.changes,
                            summary: diff.summaryBanner,
                            isAbsent: diff.isAbsent,
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
                } else if (!isSilent) {
                    setJustCheckedNotice('Attendance verified live from university ERP');
                    setTimeout(() => setJustCheckedNotice(null), 4000);
                }

                sessionAttendanceBaselines.current.set(key, data);
                const currentActive = localStorage.getItem('activeErpUser');
                if (!currentActive || String(currentActive).trim() === String(targetStudent).trim()) {
                    setSubjects(data);
                }
                const payload = JSON.stringify({ 
                    attendance_data: data,
                    year: normY,
                    semester: normS,
                    timestamp: Date.now()
                });
                try {
                    const scopedKey = targetStudent ? `kleData_${targetStudent}` : 'kleData';
                    localStorage.setItem(scopedKey, payload);
                    if (targetStudent) {
                        localStorage.setItem(`kleData_${targetStudent}_${normY}_${normS}`, payload);
                        localStorage.setItem(`attendanceLastUpdated_${targetStudent}`, String(Date.now()));
                    }
                } catch (storageErr) {
                    console.warn('[Storage] Quota exceeded or private browsing:', storageErr);
                }
                setLastUpdated(Date.now());
                setSessionStatus('active');

                // Broadcast instantly across all open tabs, devices, and domains (< 1 second)
                broadcastAttendanceUpdate({
                    studentId: targetStudent,
                    year: normY,
                    semester: normS,
                    data,
                    coursesCount: data.length,
                    timestamp: Date.now()
                }).catch(() => {});
            } else if (!isSilent) {
                setJustCheckedNotice('No attendance records returned for this semester.');
                setTimeout(() => setJustCheckedNotice(null), 4000);
            }
        } catch (error) {
            if (error.message?.includes('expired') || error.message?.includes('sign in')) {
                // University ERP session expired -> update indicator, retain permanent dashboard data
                setSessionStatus('expired');
                if (!isSilent) {
                    setJustCheckedNotice('ERP session expired. Displaying permanently saved attendance data.');
                    setTimeout(() => setJustCheckedNotice(null), 5000);
                }
                return;
            } else if (!isSilent) {
                const errMsg = String(error?.message || error || '');
                const lowerErr = errMsg.toLowerCase();
                if (lowerErr.includes('signal') || lowerErr.includes('timed out') || lowerErr.includes('timeout') || lowerErr.includes('abort')) {
                    setFetchError('University ERP server took longer than expected to respond. Please try again or re-verify your session.');
                } else {
                    setFetchError(errMsg || 'Failed to refresh attendance.');
                }
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
            sessionStorage.setItem('kl_user_logged_out', 'true');
            if (reason === 'session_expired') {
                sessionStorage.setItem('kl_logout_reason', 'session_expired');
            } else if (reason === 'inactivity') {
                sessionStorage.setItem('kl_logout_reason', 'inactivity');
            }
            await logout();
            localStorage.removeItem('activeErpUser');
            localStorage.removeItem('erpDashboardHtml');
            sessionStorage.removeItem('erp_authenticated');
            sessionStorage.removeItem('adminLoggedOut');
            window.dispatchEvent(new Event('storage'));
            navigate('/login', { replace: true, state: { loggedOut: true } });
        } catch (e) {
            console.error(e);
            navigate('/login', { replace: true, state: { loggedOut: true } });
        }
    };

    // ── DASHBOARD VIEW ──────────────────────────────────────────────
    if (showDashboard) {
        const displayYearText = normalizeAcademicYear(year);
        const displaySemesterText = (() => {
            const s = normalizeSemester(semester);
            if (s === 'Summer') return 'Summer Term';
            if (s === 'Term3') return 'Tri Sem / Term 3';
            if (s === 'Even') return 'Even Sem';
            return 'Odd Sem';
        })();
        const cleanSemesterLabel = (() => {
            if (displaySemesterText === 'Odd Sem') return 'Odd Semester';
            if (displaySemesterText === 'Even Sem') return 'Even Semester';
            return displaySemesterText;
        })();

        return (
            <div className="h-full flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">
                {/* KLERP Top Header */}
                <header className="bg-[#0088cc] text-white px-4 sm:px-6 py-2.5 shadow-md z-40 sticky top-0 shrink-0 w-full select-none border-b border-black/10">
                    <div className="w-full relative flex items-center justify-between min-h-[46px]">
                        {/* Left Column: Mobile Drawer Toggle */}
                        <div className="flex items-center gap-2 z-10">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(prev => !prev)}
                                className="lg:hidden flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all border border-white/20 shadow-2xs cursor-pointer"
                                title="Student Profiles & Friends"
                            >
                                <Users className="w-4 h-4" />
                                <span className="hidden sm:inline text-[11px] font-bold">Profiles</span>
                            </button>
                        </div>

                        {/* Center Column: Logo + KL Attendance Calculator */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm ring-1 ring-white/30 shrink-0">
                                    <img
                                        src="/Koneru Lakshmaiah University Logo Banner.png"
                                        alt="KLU"
                                        className="w-full h-full object-contain"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                </div>
                                <span className="font-sans font-extrabold text-sm sm:text-lg text-white tracking-wide drop-shadow-xs whitespace-nowrap">
                                    KL Attendance Calculator
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-semibold text-white/95 tracking-wide leading-none mt-1 whitespace-nowrap">
                                Attendance Register • {activeProfile?.nickname || 'My Profile'} ({activeId})
                            </span>
                        </div>

                        {/* Right Column: Direct Logout & Back to Home */}
                        <div className="flex items-center gap-2 z-10 ml-auto">
                            <button
                                type="button"
                                onClick={() => handleLogoutAction('manual')}
                                className="text-xs font-black uppercase tracking-wider bg-rose-500/20 hover:bg-rose-500/35 active:scale-95 text-white px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs border border-rose-400/30 cursor-pointer"
                                title="Direct Logout"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                            <Link
                                to="/"
                                className="text-xs font-black uppercase tracking-wider bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs border border-white/20"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Back to Home</span>
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Page Body: Left Sidebar + Scrollable Content Area */}
                <div className="flex-1 flex overflow-hidden min-h-0 relative">
                    <ErpSidebar
                        isOpen={sidebarOpen}
                        onToggle={() => setSidebarOpen(false)}
                        activePage="attendance-register"
                        onSelectProfile={(profile) => {
                            const newId = profile.studentId || profile.username || (profile.id !== 'main' ? profile.id : '');
                            if (newId) {
                                setActiveId(newId);
                                setActiveProfile(profile);

                                // Resolve target year and semester for this student
                                const profYear = localStorage.getItem(`manualYear_${newId}`) || localStorage.getItem(`activeYear_${newId}`) || year;
                                const profSem = localStorage.getItem(`manualSem_${newId}`) || localStorage.getItem(`activeSem_${newId}`) || semester;
                                const normY = normalizeAcademicYear(profYear);
                                const normS = normalizeSemester(profSem);
                                setYear(normY);
                                setSemester(normS);

                                const scopedKey = `kleData_${newId}_${normY}_${normS}`;
                                const scopedRaw = localStorage.getItem(scopedKey);
                                let foundCourses = null;
                                let isConfirmedEmpty = false;

                                if (scopedRaw) {
                                    try {
                                        const parsed = JSON.parse(scopedRaw);
                                        if (parsed.empty || (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length === 0)) {
                                            isConfirmedEmpty = true;
                                            foundCourses = [];
                                        } else if (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                                            foundCourses = parsed.attendance_data;
                                        }
                                    } catch { /* ignore */ }
                                }

                                if (foundCourses === null && !isConfirmedEmpty) {
                                    const rememberedId = typeof window !== 'undefined' ? localStorage.getItem('rememberedId') : null;
                                    const isPrimary = newId === rememberedId;
                                    const cached = localStorage.getItem(`kleData_${newId}`) || (isPrimary ? localStorage.getItem('kleData') : null);
                                    if (cached) {
                                        try {
                                            const parsed = JSON.parse(cached);
                                            if (parsed.year && parsed.semester &&
                                                normalizeAcademicYear(parsed.year) === normY &&
                                                normalizeSemester(parsed.semester) === normS) {
                                                if (parsed.empty || (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length === 0)) {
                                                    isConfirmedEmpty = true;
                                                    foundCourses = [];
                                                } else if (Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                                                    foundCourses = parsed.attendance_data;
                                                }
                                            }
                                        } catch { /* ignore */ }
                                    }
                                }

                                if (isConfirmedEmpty) {
                                    // Confirmed empty for this semester: show clean empty state, NEVER show other data!
                                    setSubjects([]);
                                    setShowDashboard(true);
                                    setLastUpdated(Date.now());
                                } else if (foundCourses && foundCourses.length > 0) {
                                    setSubjects(foundCourses);
                                    setShowDashboard(true);
                                    const lastUp = localStorage.getItem(`attendanceLastUpdated_${newId}`);
                                    if (lastUp) setLastUpdated(Number(lastUp));
                                } else {
                                    setSubjects([]);
                                    if (hasActiveErpSession(newId)) {
                                        handleSearch(normY, normS, newId);
                                    } else {
                                        setShowDashboard(false);
                                    }
                                }
                            }
                        }}
                    />

                    <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 font-sans">
                        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 pointer-events-none" />

                        {/* Top Attendance Header */}
                        <div className="flex flex-col gap-3 mb-6 max-w-7xl mx-auto">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
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

                                        {/* In-Class Live Auto-Sync Indicator */}
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/90 shadow-2xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                                            <span>In-Class Live Monitor &lt; 1s</span>
                                        </div>
                                    </div>

                                    {/* Prominent Whose Attendance Is Being Seen Badge */}
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 via-blue-50 to-slate-50 border border-indigo-200/90 text-indigo-950 text-xs sm:text-sm font-semibold shadow-2xs">
                                            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                                <User className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-slate-600">Viewing Attendance for:</span>
                                            <span className="font-black text-indigo-950 text-sm">
                                                {activeProfile?.nickname || 'My Profile'}
                                            </span>
                                            {(activeProfile?.studentId || activeId) && (
                                                <span className="text-indigo-600 font-bold bg-white/95 px-2 py-0.5 rounded-md border border-indigo-200/60 text-xs font-mono">
                                                    ID: {activeProfile?.studentId || activeId}
                                                </span>
                                            )}
                                            {activeProfile?.isFriend ? (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded-full">
                                                    Friend
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                    Primary Account
                                                </span>
                                            )}
                                        </div>
                                    </div>

                            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-xs sm:text-sm font-medium">
                                {/* Inline Academic Semester Selection Dropdown */}
                                <div className="relative inline-flex items-center">
                                    <select
                                        value={`${normalizeAcademicYear(year)}_${normalizeSemester(semester)}`}
                                        onChange={(e) => handleSwitchSemester(e.target.value)}
                                        aria-label="Select Academic Semester"
                                        className="font-bold text-slate-800 dark:text-slate-100 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-300/80 dark:border-slate-700 py-1 pl-2.5 pr-7 rounded-lg text-xs sm:text-sm cursor-pointer outline-none transition-colors appearance-none shadow-2xs"
                                    >
                                        {getAvailableSemesterOptions(activeId).map(opt => (
                                            <option key={opt.key} value={opt.key} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-slate-500" />
                                </div>
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

                        {/* Switch Student / Friend Profile (Visible on mobile only; on desktop, the left sidebar is always open) */}
                        <div className="lg:hidden flex items-center gap-2">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs transition-all cursor-pointer"
                                title="Open student profiles sidebar"
                            >
                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                <span>{activeProfile?.isFriend ? activeProfile.nickname : 'Buddies'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Attendance Diff Alert Banner (Celebration when faculty posts attendance) */}
                    <AnimatePresence>
                        {attendanceNotification?.show && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                className={`p-4 sm:p-5 rounded-2xl shadow-xl flex items-center justify-between gap-4 border-2 ${
                                    attendanceNotification.isAbsent
                                        ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white border-rose-300 shadow-rose-500/25 ring-2 ring-rose-200'
                                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white border-emerald-400 shadow-emerald-500/25 ring-2 ring-emerald-200'
                                }`}
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
                                        {attendanceNotification.isAbsent ? (
                                            <AlertTriangle className="w-6 h-6 text-yellow-300 animate-pulse" />
                                        ) : (
                                            <Sparkles className="w-6 h-6 text-yellow-300 animate-bounce" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-white/25 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                {attendanceNotification.isAbsent ? '⚠️ Faculty Attendance Alert — Absent' : '🎉 New Attendance Detected'}
                                            </span>
                                            <span className="text-white/80 text-xs font-semibold">Live</span>
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

                {/* Attendance Subjects */}
                {loading && subjects.length === 0 ? (
                    <div className="max-w-2xl mx-auto bg-white border-2 border-slate-900 rounded-[2.5rem] p-12 text-center shadow-lg my-8">
                        <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-5" />
                        <h3 className="text-xl font-black text-slate-900 mb-2">Fetching Academic Record</h3>
                        <p className="text-slate-500 text-sm font-medium">
                            Retrieving course registered records for <span className="font-bold text-indigo-600">{displayYearText} ({cleanSemesterLabel})</span> from KL ERP...
                        </p>
                    </div>
                ) : targetFriendForCaptcha ? (
                    <div className="max-w-2xl mx-auto bg-white border-2 border-slate-900 rounded-[2.5rem] p-12 text-center shadow-lg my-8">
                        <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-5" />
                        <h3 className="text-xl font-black text-slate-900 mb-2">Authenticating Session</h3>
                        <p className="text-slate-500 text-sm font-medium">
                            Please solve the Captcha verification above to view attendance records.
                        </p>
                    </div>
                ) : subjects.length > 0 ? (
                    <>
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
                                            ? attendanceNotification?.isAbsent
                                                ? 'border-2 border-rose-500 ring-4 ring-rose-200/90 shadow-xl -translate-y-1'
                                                : 'border-2 border-emerald-500 ring-4 ring-emerald-200/90 shadow-xl -translate-y-1'
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
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse border ${
                                                            attendanceNotification?.isAbsent
                                                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                        }`}>
                                                            {attendanceNotification?.isAbsent ? (
                                                                <>
                                                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                                    Marked Absent Just Now
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                                                    Marked Present Just Now
                                                                </>
                                                            )}
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

                    {/* Weekly Timetable Matrix Section */}
                    <div className="mt-6 max-w-7xl mx-auto w-full bg-white dark:bg-[#1e293b] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/90 dark:border-slate-700/80 shadow-md shadow-indigo-100/30 dark:shadow-none space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                        <span>Weekly Timetable</span>
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 rounded-md">
                                            {activeProfile?.nickname || 'Account'} · {displayYearText} · {displaySemesterText}
                                        </span>
                                    </h4>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                    Class schedules, classrooms, and timing breakdown for ID: {activeId}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Aliases vs Codes Toggle */}
                                <div className="inline-flex bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                                    <button
                                        type="button"
                                        onClick={() => setTimetableDisplayMode('aliases')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            timetableDisplayMode === 'aliases'
                                                ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-2xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Aliases 🏷️
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimetableDisplayMode('codes')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            timetableDisplayMode === 'codes'
                                                ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-2xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Codes
                                    </button>
                                </div>

                                <Link
                                    to="/timetable"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all border border-indigo-200/90 dark:border-indigo-700/60 shadow-2xs group"
                                    title="Open full timetable page"
                                >
                                    <span>View Full Timetable</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                        </div>

                        {hasTimetableSlots ? (
                            /* Compact Week Matrix Table */
                            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/70 overflow-hidden bg-white dark:bg-slate-900/60 shadow-2xs">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <table className="w-full text-xs border-collapse text-center">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80">
                                                <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 text-center p-1.5 sm:p-2 border-r border-slate-200 dark:border-slate-700 z-20 w-12 sm:w-14 min-w-[48px] sm:min-w-[56px]">
                                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                        Day
                                                    </span>
                                                </th>
                                                {activeSessions.map((sess) => (
                                                    <th
                                                        key={sess.id}
                                                        className="p-1 sm:p-1.5 min-w-[85px] w-[85px] sm:min-w-[105px] sm:w-[105px] border-r border-slate-200 dark:border-slate-700/80 text-center font-bold text-slate-700 dark:text-slate-300 align-middle"
                                                    >
                                                        <div className="inline-block px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-[9px] mb-0.5">
                                                            {sess.id}
                                                        </div>
                                                        <div className="text-[8px] sm:text-[8.5px] text-slate-500 dark:text-slate-400 font-normal font-mono whitespace-nowrap">
                                                            {sess.start}–{sess.end}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70">
                                            {DAYS_OF_WEEK.map((day) => {
                                                const slots = studentTimetable[day] || [];
                                                const isToday = liveClassStatus?.dayName === day;

                                                return (
                                                    <tr
                                                        key={day}
                                                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                                                            isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                                                        }`}
                                                    >
                                                        <td
                                                            className={`sticky left-0 p-1.5 sm:p-2 border-r border-slate-200 dark:border-slate-700 font-bold z-10 ${
                                                                isToday
                                                                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200'
                                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="block text-[10px] font-black uppercase">{day.slice(0, 3)}</span>
                                                            {isToday && (
                                                                <span className="text-[7.5px] font-black text-indigo-600 dark:text-sky-400 block mt-0.5">
                                                                    TODAY
                                                                </span>
                                                            )}
                                                        </td>

                                                        {activeSessions.map((sess) => {
                                                            const classItem = slots.find(
                                                                (s) => s.period === sess.slot || s.slotId === sess.id || (s.period <= sess.slot && sess.slot <= (s.periodEnd || (s.period + (s.span || 1) - 1)))
                                                            );
                                                            if (!classItem) {
                                                                return (
                                                                    <td
                                                                        key={sess.id}
                                                                        className="p-1 sm:p-1.5 border-r border-slate-200 dark:border-slate-700/70 text-slate-300 dark:text-slate-600 font-mono text-center text-[10px]"
                                                                    >
                                                                        —
                                                                    </td>
                                                                );
                                                            }

                                                            const isLab =
                                                                (classItem.component || classItem.type || '').toLowerCase().includes('pract') ||
                                                                classItem.code.endsWith('-P');
                                                            const isSkill =
                                                                (classItem.component || classItem.type || '').toLowerCase().includes('skill') ||
                                                                classItem.code.endsWith('-S');
                                                            const isTut =
                                                                (classItem.component || classItem.type || '').toLowerCase().includes('tut') ||
                                                                classItem.code.endsWith('-T');

                                                            const displayTitle =
                                                                timetableDisplayMode === 'codes'
                                                                    ? classItem.code
                                                                    : getSubjectName(classItem.rawCode || classItem.code) || classItem.code;

                                                            return (
                                                                <td
                                                                    key={sess.id}
                                                                    className={`p-1 sm:p-1.5 border-r border-slate-200 dark:border-slate-700/70 align-middle ${
                                                                        isLab
                                                                            ? 'bg-emerald-50/85 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200'
                                                                            : isSkill
                                                                            ? 'bg-purple-50/85 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200'
                                                                            : isTut
                                                                            ? 'bg-amber-50/85 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                                                                            : 'bg-blue-50/85 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200'
                                                                    }`}
                                                                >
                                                                    <div className="space-y-0.5">
                                                                        <div
                                                                            className="font-bold text-[9px] sm:text-[9.5px] leading-tight text-slate-900 dark:text-slate-100 line-clamp-2 overflow-hidden"
                                                                            style={{
                                                                                display: '-webkit-box',
                                                                                WebkitLineClamp: 2,
                                                                                WebkitBoxOrient: 'vertical',
                                                                                overflow: 'hidden'
                                                                            }}
                                                                            title={displayTitle}
                                                                        >
                                                                            {displayTitle}
                                                                        </div>
                                                                        <div className="text-[8px] sm:text-[8.5px] text-slate-600 dark:text-slate-400 font-medium leading-none truncate mt-0.5">
                                                                            {classItem.section ? `${classItem.section} · ` : ''}
                                                                            {classItem.room ? `Rm ${cleanRoomNumber(classItem.room)}` : ''}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 space-y-2">
                                <p className="text-xs font-semibold">
                                    Timetable records for {activeProfile?.nickname || 'Account'} are being loaded...
                                </p>
                                <div className="pt-1">
                                    <Link
                                        to="/timetable"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                                    >
                                        <span>Open Timetable Portal</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                    </>
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
                            We couldn&apos;t find any registered courses for {displayYearText} ({cleanSemesterLabel}) on KL ERP.
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

                    </main>
                </div>

                {/* Friends Switcher Modal */}
                <FriendsManagerModal
                    isOpen={showFriendsModal}
                    onClose={() => setShowFriendsModal(false)}
                />

                {/* Quick ERP Captcha Modal */}
                <FriendCaptchaModal
                    friend={targetFriendForCaptcha}
                    isOpen={Boolean(targetFriendForCaptcha)}
                    onClose={() => setTargetFriendForCaptcha(null)}
                    onSuccess={(authFriend) => {
                        setTargetFriendForCaptcha(null);
                        setAttendanceNotification(null);
                        setRecentlyUpdatedCodes(new Set());
                        const sid = authFriend?.studentId || authFriend?.id || activeId;
                        setActiveId(sid);
                        setActiveProfile(authFriend || getActiveProfileDetails(sid));
                        const savedY = localStorage.getItem(`manualYear_${sid}`) || localStorage.getItem(`activeYear_${sid}`);
                        const targetY = savedY || '2026-2027';
                        const savedS = localStorage.getItem(`manualSem_${sid}`) || localStorage.getItem(`activeSem_${sid}`);
                        const targetS = savedS || semester || 'Odd';
                        setYear(targetY);
                        setSemester(targetS);
                        handleSearch(targetY, targetS, sid, true);
                    }}
                />
            </div>
        );
    }

    // ── SELECTION FORM ───────────────────────────────────────────────
    return (
        <div className="h-full bg-[#F4F6F9] dark:bg-[#0b1120] flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200 overflow-hidden">
            {/* KLERP Top Header */}
            <header className="bg-[#0088cc] text-white px-4 sm:px-6 py-2.5 shadow-md z-40 sticky top-0 shrink-0 w-full select-none border-b border-black/10">
                <div className="w-full relative flex items-center justify-between min-h-[46px]">
                    {/* Left Column: Mobile Drawer Toggle */}
                    <div className="flex items-center gap-2 z-10">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(prev => !prev)}
                            className="lg:hidden flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all border border-white/20 shadow-2xs cursor-pointer"
                            title="Student Profiles & Friends"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline text-[11px] font-bold">Profiles</span>
                        </button>
                    </div>

                    {/* Center Column: Logo + KL Attendance Calculator */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm ring-1 ring-white/30 shrink-0">
                                <img
                                    src="/Koneru Lakshmaiah University Logo Banner.png"
                                    alt="KLU"
                                    className="w-full h-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <span className="font-sans font-extrabold text-sm sm:text-lg text-white tracking-wide drop-shadow-xs whitespace-nowrap">
                                KL Attendance Calculator
                            </span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-white/95 tracking-wide leading-none mt-1 whitespace-nowrap">
                            Attendance Register • {activeProfile?.nickname || 'My Profile'} ({activeId})
                        </span>
                    </div>

                    {/* Right Column: Back to Home */}
                    <div className="flex items-center gap-2 z-10 ml-auto">
                        <Link
                            to="/"
                            className="text-xs font-black uppercase tracking-wider bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs border border-white/20"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Back to Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Page Body: Left Sidebar + Centered Selection Card OR Timetable */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                <ErpSidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(false)}
                    activePage="attendance-register"
                />

                <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-10 flex items-center justify-center relative">
                    <div className="w-full max-w-md relative z-10 my-auto">
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                            className="bg-white/95 dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden transform-gpu transition-all duration-300">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-t-[2.5rem]" />

                            <div className="text-center mb-6 sm:mb-8 relative z-10">
                                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                                    className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                    <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                                </motion.div>
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    KL ERP Attendance
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">
                                    Select your Academic Year and Semester
                                </p>

                                <div className="mt-3 flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowFriendsModal(true)}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/60 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                        <span>Student: <strong className="font-black text-indigo-950 dark:text-white">{activeProfile?.label || activeProfile?.nickname || 'My Account'}</strong></span>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 underline font-black ml-0.5">(Switch)</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-5 relative z-10">
                                <div className="space-y-1.5">
                                    <label className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest ml-1">Academic Year</label>
                                    <div className="relative">
                                        <select
                                            value={normalizeAcademicYear(year)}
                                            onChange={e => {
                                                const norm = normalizeAcademicYear(e.target.value);
                                                setAttendanceNotification(null);
                                                setRecentlyUpdatedCodes(new Set());
                                                setYear(norm);
                                                if (activeId) {
                                                    localStorage.setItem(`manualYear_${activeId}`, norm);
                                                    localStorage.setItem(`activeYear_${activeId}`, norm);
                                                }
                                            }}
                                            className="w-full appearance-none bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition-all font-semibold cursor-pointer shadow-2xs">
                                            <option value="">Select Academic Year</option>
                                            {(() => {
                                                const seenYears = new Set();
                                                const yearList = [];
                                                const sourceYears = availableYears.length > 0 ? availableYears : DEFAULT_YEARS;
                                                sourceYears.forEach(y => {
                                                    const cleanText = (y.text || y.value || '').replace(/\s*\([^)]*\)/g, '').trim();
                                                    const norm = normalizeAcademicYear(cleanText || y.value);
                                                    const startYr = parseInt((norm || '').split('-')[0], 10);
                                                    if (!isNaN(startYr) && startYr >= 2021 && !seenYears.has(norm)) {
                                                        seenYears.add(norm);
                                                        yearList.push({ val: norm, text: norm });
                                                    }
                                                });
                                                if (yearList.length === 0) {
                                                    DEFAULT_YEARS.forEach(y => {
                                                        const norm = normalizeAcademicYear(y.text);
                                                        if (!seenYears.has(norm)) {
                                                            seenYears.add(norm);
                                                            yearList.push({ val: norm, text: norm });
                                                        }
                                                    });
                                                }
                                                return yearList.map(y => (
                                                    <option key={y.val} value={y.val}>
                                                        {y.text}
                                                    </option>
                                                ));
                                            })()}
                                        </select>
                                        <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest ml-1">Semester</label>
                                    <div className="relative">
                                        <select
                                            value={normalizeSemester(semester)}
                                            onChange={e => {
                                                const norm = normalizeSemester(e.target.value);
                                                setAttendanceNotification(null);
                                                setRecentlyUpdatedCodes(new Set());
                                                setSemester(norm);
                                                if (activeId) {
                                                    localStorage.setItem(`manualSem_${activeId}`, norm);
                                                    localStorage.setItem(`activeSem_${activeId}`, norm);
                                                }
                                            }}
                                            className="w-full appearance-none bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition-all font-semibold cursor-pointer shadow-2xs">
                                            <option value="">Select Semester</option>
                                            <option value="Odd">Odd Sem</option>
                                            <option value="Even">Even Sem</option>
                                            <option value="Summer">Summer Term</option>
                                            <option value="Term3">Tri Sem / Term 3</option>
                                        </select>
                                        <BookOpen className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                    </div>
                                </div>

                                {fetchError && (() => {
                                    const currentSaved = (getSavedFriends() || []).find(f => f.studentId === activeId || f.id === activeId) || (getMyProfile()?.studentId === activeId ? getMyProfile() : null);
                                    return (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl p-4 flex flex-col gap-2.5"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-5 h-5 bg-red-100 dark:bg-red-900/60 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                                    <span className="text-red-600 dark:text-red-400 text-xs font-black">!</span>
                                                </div>
                                                <p className="text-xs font-bold text-red-700 dark:text-red-300 leading-relaxed flex-1">
                                                    {fetchError}
                                                </p>
                                            </div>
                                            {Boolean(currentSaved?.password || currentSaved?.hasSavedPassword) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetFriendForCaptcha(currentSaved)}
                                                    className="self-start px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                                >
                                                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                                                    <span>Verify Captcha & Fetch</span>
                                                </button>
                                            )}
                                        </motion.div>
                                    );
                                })()}

                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        const normY = normalizeAcademicYear(year);
                                        const normS = normalizeSemester(semester);
                                        const scopedKey = activeId ? `kleData_${activeId}_${normY}_${normS}` : null;
                                        let hasCache = false; try { hasCache = Boolean(scopedKey && localStorage.getItem(scopedKey)); } catch { /* ignore */ }
                                        if (!hasCache && !hasActiveErpSession(activeId)) {
                                            const currentSaved = (getSavedFriends() || []).find(f => f.studentId === activeId || f.id === activeId) || (getMyProfile()?.studentId === activeId ? getMyProfile() : null);
                                            if (currentSaved?.password || currentSaved?.hasSavedPassword) {
                                                setTargetFriendForCaptcha(currentSaved);
                                                return;
                                            }
                                        }
                                        handleSearch(year, semester, activeId, true);
                                    }} 
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all mt-2 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-85">
                                    {loading ? (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span className="text-sm font-bold tracking-wide">Fetching Attendance…</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-black tracking-wide">
                                            {(() => {
                                                const normY = normalizeAcademicYear(year);
                                                const normS = normalizeSemester(semester);
                                                const scopedKey = activeId ? `kleData_${activeId}_${normY}_${normS}` : null;
                                                let hasCache = false; try { hasCache = Boolean(scopedKey && localStorage.getItem(scopedKey)); } catch { /* ignore */ }
                                                if (hasCache) return '⚡ View Attendance (Instant)';
                                                if (!hasActiveErpSession(activeId)) return '🛡️ Login with Captcha & Get Attendance';
                                                return 'Get Attendance';
                                            })()}
                                        </span>
                                    )}
                                </motion.button>

                                <div className="text-center pt-1 space-y-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowDashboard(true)}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer transition-colors block mx-auto py-1"
                                    >
                                        ← Cancel & Return to Dashboard
                                    </button>
                                    <button onClick={handleLogoutAction} className="text-slate-400 dark:text-slate-500 text-sm font-semibold hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer">
                                        Back to Login
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 relative z-10">
                                <p className="text-slate-400 dark:text-slate-500 text-[10px] text-center font-medium leading-relaxed">
                                    This connects to the university ERP system. Your credentials are processed securely.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </main>
            </div>

            {/* Friends Switcher Modal */}
            <FriendsManagerModal
                isOpen={showFriendsModal}
                onClose={() => setShowFriendsModal(false)}
            />

            {/* Quick ERP Captcha Modal */}
            <FriendCaptchaModal
                friend={targetFriendForCaptcha}
                isOpen={Boolean(targetFriendForCaptcha)}
                onClose={() => setTargetFriendForCaptcha(null)}
                onSuccess={(authFriend) => {
                    setTargetFriendForCaptcha(null);
                    setAttendanceNotification(null);
                    setRecentlyUpdatedCodes(new Set());
                    const sid = authFriend?.studentId || authFriend?.id || activeId;
                    setActiveId(sid);
                    setActiveProfile(authFriend || getActiveProfileDetails(sid));
                    const savedY = localStorage.getItem(`manualYear_${sid}`) || localStorage.getItem(`activeYear_${sid}`);
                    const targetY = savedY || year || '2026-2027';
                    const savedS = localStorage.getItem(`manualSem_${sid}`) || localStorage.getItem(`activeSem_${sid}`);
                    const targetS = savedS || semester || 'Odd';
                    setYear(targetY);
                    setSemester(targetS);
                    handleSearch(targetY, targetS, sid, true);
                }}
            />
        </div>
    );
};

export default AttendanceRegister;
