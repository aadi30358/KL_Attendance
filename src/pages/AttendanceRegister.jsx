import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Sparkles, CheckCircle2, X, Users, ArrowLeft, User, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { erpService, hasActiveErpSession } from '../services/erpService';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
    isNearPeriodEnd,
    calculateAttendanceDiff,
    playAttendanceChime
} from '../services/attendanceAlerts';
import { getActiveProfileDetails, getSavedFriends, getMyProfile } from '../services/friendsService';
import { fetchLiveErpTimetable, normalizeAcademicYear, normalizeSemester, getPresentAcademicYearAndSem } from '../services/timetableService';
import { fetchLiveErpGrades } from '../services/gradesService';
import FriendsManagerModal from '../components/FriendsManagerModal';
import FriendCaptchaModal from '../components/FriendCaptchaModal';
import ErpSidebar from '../components/ErpSidebar';

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
    const [availableSemesters, setAvailableSemesters] = useState([
        { value: 'Odd', text: 'Odd Sem' },
        { value: 'Even', text: 'Even Sem' },
        { value: 'Summer', text: 'Summer Term' },
        { value: 'Term3', text: 'Tri Sem / Term 3' }
    ]);
    const [subjects, setSubjects] = useState(() => {
        if (!activeId) return [];
        try {
            const cached = localStorage.getItem(`kleData_${activeId}`) || ((activeId && activeId === localStorage.getItem('rememberedId')) ? localStorage.getItem('kleData') : null);
            if (cached) {
                const parsed = JSON.parse(cached);
                const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
                if (Array.isArray(list) && list.length > 0) {
                    return list;
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

    // Listen for switch view event from ErpSidebar or external triggers

    // Sync active profile & friends
    useEffect(() => {
        const updateProfile = () => setActiveProfile(getActiveProfileDetails());
        window.addEventListener('kl_friends_updated', updateProfile);
        window.addEventListener('kl_active_profile_updated', updateProfile);
        window.addEventListener('storage', updateProfile);
        return () => {
            window.removeEventListener('kl_friends_updated', updateProfile);
            window.removeEventListener('kl_active_profile_updated', updateProfile);
            window.removeEventListener('storage', updateProfile);
        };
    }, []);

    const navigate = useNavigate();
    const location = useLocation();
    const subjectsRef = useRef(subjects);
    subjectsRef.current = subjects;
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

    const handleSearch = useCallback(async (fetchYear = year, fetchSemester = semester, customId = activeId) => {
        if (!fetchYear || !fetchSemester) { 
            setFetchError('Please select both Year and Semester'); 
            return; 
        }
        setLoading(true); 
        setDebugHtml(null);
        setFetchError(null);
        setJustCheckedNotice(null);

        // Resolve clean query year string (e.g. '2025-2026' or '2026-2027')
        const normYear = normalizeAcademicYear(fetchYear);
        const normSem = normalizeSemester(fetchSemester);
        const queryYear = normYear;
        const targetId = customId || activeId || localStorage.getItem('activeErpUser') || '';

        // Cannot fetch live courses from ERP without an authenticated session
        if (!hasActiveErpSession(targetId)) {
            setLoading(false);
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

        try {
            const data = await erpService.fetchAttendance(queryYear, fetchSemester, targetId);
            let finalCourses = Array.isArray(data) ? data : [];
            let finalYear = normYear;
            let finalSem = normSem;

            // If 0 courses found for initial query, try candidate year fallbacks based on student ID batch
            if (finalCourses.length === 0 && targetId) {
                const matchBatch = targetId.match(/^(\d{2})/);
                if (matchBatch) {
                    const startBatch = 2000 + parseInt(matchBatch[1], 10);
                    const candidateYears = [];
                    for (let y = Math.min(new Date().getFullYear(), startBatch + 4); y >= startBatch; y--) {
                        const cand = `${y}-${y + 1}`;
                        if (cand !== normYear) candidateYears.push(cand);
                    }
                    const candSems = ['Even', 'Odd', 'Summer'];
                    for (const candY of candidateYears) {
                        for (const candS of candSems) {
                            try {
                                const altData = await erpService.fetchAttendance(candY, candS, targetId);
                                if (Array.isArray(altData) && altData.length > 0) {
                                    finalCourses = altData;
                                    finalYear = candY;
                                    finalSem = candS;
                                    break;
                                }
                            } catch { /* continue */ }
                        }
                        if (finalCourses.length > 0) break;
                    }
                }
            }

            if (finalCourses.length > 0) {
                setSubjects(finalCourses);
                setShowDashboard(true);
                setYear(finalYear);
                setSemester(finalSem);
                setLastUpdated(Date.now());
                setSessionStatus('active');

                // Trigger live ERP timetable & grades sync in background
                if (targetId) {
                    fetchLiveErpTimetable(targetId, finalYear, finalSem).then((res) => {
                        if (res?.timetable) {
                            window.dispatchEvent(new CustomEvent('kl_timetable_updated', {
                                detail: { studentId: targetId, year: finalYear, sem: finalSem }
                            }));
                        }
                    }).catch(() => null);

                    fetchLiveErpGrades(targetId).catch(() => null);
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
                    }
                } catch (storageErr) {
                    console.warn('[Storage] Quota exceeded or private browsing:', storageErr);
                }
            } else {
                // If live fetch returned 0 courses, check if cached attendance exists for this person
                const scopedKey = targetId ? `kleData_${targetId}_${finalYear}_${finalSem}` : null;
                const scopedRaw = scopedKey ? localStorage.getItem(scopedKey) : null;
                const generalKey = targetId ? `kleData_${targetId}` : 'kleData';
                const generalRaw = localStorage.getItem(generalKey);
                const dataToUse = scopedRaw || generalRaw;
                let cachedCourses = [];
                if (dataToUse) {
                    try {
                        const parsed = JSON.parse(dataToUse);
                        const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
                        if (Array.isArray(list) && list.length > 0) {
                            cachedCourses = list;
                        }
                    } catch { /* ignore */ }
                }

                if (cachedCourses.length > 0) {
                    setSubjects(cachedCourses);
                    setShowDashboard(true);
                    setYear(finalYear);
                    setSemester(finalSem);
                } else {
                    setSubjects([]);
                    setShowDashboard(false);
                }
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

            // 2. Restore from student's general cached attendance (kleData_id or kleData)
            const fallbackKey = targetId ? `kleData_${targetId}` : 'kleData';
            const fallbackRaw = localStorage.getItem(fallbackKey) || ((targetId && targetId === localStorage.getItem('rememberedId')) ? localStorage.getItem('kleData') : null);
            if (fallbackRaw) {
                try {
                    const parsed = JSON.parse(fallbackRaw);
                    const list = parsed?.attendance_data || parsed?.data || (Array.isArray(parsed) ? parsed : []);
                    if (Array.isArray(list) && list.length > 0) {
                        setSubjects(list);
                        setYear(parsed.year || normYear);
                        setSemester(parsed.semester || normSem);
                        setShowDashboard(true);
                        return;
                    }
                } catch { /* ignore */ }
            }

            if (error.message?.startsWith('DEBUG_HTML:') || error.message?.startsWith('No table found')) { 
                setDebugHtml(error.message); 
                setShowDashboard(true); 
            } else {
                setFetchError(error.message || 'Failed to fetch attendance. Please verify your login status.');
            }
        } finally { 
            setLoading(false); 
        }
    }, [activeId, year, semester]);

    // Listen for profile switches (via quick Captcha modal or sidebar)
    useEffect(() => {
        const handleProfileSwitch = (e) => {
            const detail = e.detail;
            const newId = detail?.studentId || localStorage.getItem('activeErpUser') || '';
            const newProfile = detail?.profile || getActiveProfileDetails();
            
            setActiveId(newId);
            setActiveProfile(newProfile);
            setSessionStatus('active');
            setFetchError(null);
            setDebugHtml(null);

            // Determine target academic year & semester for this student
            const savedYear = newId ? (localStorage.getItem(`manualYear_${newId}`) || localStorage.getItem(`activeYear_${newId}`)) : null;
            const savedSem = newId ? (localStorage.getItem(`manualSem_${newId}`) || localStorage.getItem(`activeSem_${newId}`)) : null;
            const targetYear = savedYear || year || '2026-2027';
            const targetSem = savedSem || semester || 'Odd';

            setYear(targetYear);
            setSemester(targetSem);

            // Check if cached data exists for quick display while refreshing
            const scopedKey = newId ? `kleData_${newId}_${targetYear}_${targetSem}` : null;
            const scopedRaw = scopedKey ? localStorage.getItem(scopedKey) : null;
            const fallbackRaw = (!scopedRaw && newId) ? localStorage.getItem(`kleData_${newId}`) : null;
            const dataToParse = scopedRaw || fallbackRaw;
            if (dataToParse) {
                try {
                    const parsed = JSON.parse(dataToParse);
                    if (parsed.attendance_data && Array.isArray(parsed.attendance_data) && parsed.attendance_data.length > 0) {
                        setSubjects(parsed.attendance_data);
                        setShowDashboard(true);
                    }
                } catch {
                    // ignore
                }
            } else {
                setSubjects([]);
                setLoading(true);
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
            localStorage.removeItem('erpDashboardHtml');
            localStorage.removeItem('activeErpUser');
            sessionStorage.removeItem('erp_authenticated');
            navigate('/login');
            return;
        }

        // Cleanup any old flags
        sessionStorage.removeItem('manual_sem_reset');

        // Restore cached attendance so student doesn't lose their dashboard on return/refresh
        const savedYear = activeId ? (localStorage.getItem(`activeYear_${activeId}`) || localStorage.getItem(`manualYear_${activeId}`)) : null;
        const savedSem = activeId ? (localStorage.getItem(`activeSem_${activeId}`) || localStorage.getItem(`manualSem_${activeId}`)) : null;
        const present = getPresentAcademicYearAndSem(activeId);
        const initY = savedYear || present.year;
        const initS = savedSem || present.sem;
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
        } else {
            setYear(initY);
            setSemester(initS);
            if (hasActiveErpSession(activeId)) {
                handleSearch(initY, initS, activeId);
            } else {
                setLoading(false);
                setShowDashboard(false);
                const prof = (getSavedFriends() || []).find(f => f.studentId === activeId || f.id === activeId) || (getMyProfile()?.studentId === activeId ? getMyProfile() : null);
                if (prof?.password || prof?.hasSavedPassword) {
                    setTargetFriendForCaptcha(prof);
                }
            }
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
            if (sessionData.semesters && sessionData.semesters.length > 0) {
                setAvailableSemesters(sessionData.semesters);
            }
            // Auto-select active year directly: prioritize saved manual selection if available
            const userManualYear = activeId ? (localStorage.getItem(`manualYear_${activeId}`) || localStorage.getItem(`activeYear_${activeId}`)) : null;
            let nextYear = '2026-2027';
            if (userManualYear) {
                nextYear = userManualYear;
                setYear(userManualYear);
            } else if (sessionData.selectedYear?.value) {
                nextYear = sessionData.selectedYear.value;
                setYear(sessionData.selectedYear.value);
            } else {
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
            if (subjectsRef.current.length === 0 && (nextYear !== initY || nextSem !== initS)) {
                handleSearch(nextYear, nextSem, activeId);
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
            // Preserve cached attendance (kleData_*, activeYear_*, etc.) permanently
            // Data is only wiped when user explicitly deletes via Delete Profile
            localStorage.removeItem('activeErpUser');
            localStorage.removeItem('erpDashboardHtml');
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
            <div className="min-h-screen bg-[#F4F6F9] flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
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

                        {/* Center Column: Logo + KLERP + Image 5 Subtitle (True 100% Mathematical Center) */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm ring-1 ring-white/30 shrink-0">
                                    <img
                                        src="/Koneru Lakshmaiah University Logo Banner.png"
                                        alt="KLU"
                                        className="w-full h-full object-contain"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                </div>
                                <span className="font-serif italic font-extrabold text-xl sm:text-2xl text-white tracking-wider drop-shadow-xs">
                                    KLERP
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

                {/* Page Body: Left Sidebar + Scrollable Content Area */}
                <div className="flex-1 flex overflow-hidden relative">
                    <ErpSidebar
                        isOpen={sidebarOpen}
                        onToggle={() => setSidebarOpen(false)}
                        activePage="attendance-register"
                        onSelectProfile={(profile) => {
                            const newId = profile.studentId || profile.username || (profile.id !== 'main' ? profile.id : '');
                            if (newId) {
                                setActiveId(newId);
                                setActiveProfile(profile);
                                try {
                                    const cached = localStorage.getItem(`kleData_${newId}`) || localStorage.getItem('kleData');
                                    if (cached) {
                                        const parsed = JSON.parse(cached);
                                        const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
                                        if (Array.isArray(list) && list.length > 0) {
                                            setSubjects(list);
                                        }
                                    }
                                } catch { /* ignore */ }
                            }
                        }}
                    />

                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 font-sans">
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
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-indigo-200/90 shadow-2xs transition-all cursor-pointer active:scale-95"
                                    title="Change Academic Year or Semester"
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Change Selection</span>
                                </button>
                                <button
                                    onClick={handleBack}
                                    title="Click to change academic year or semester"
                                    className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left font-semibold"
                                >
                                    {year && semester ? `${displayYearText} · ${cleanSemesterLabel}` : 'Current Session'}
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

                {/* Attendance Subjects */}
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

                    </main>
                </div>

                {/* Friends Switcher Modal */}
                <FriendsManagerModal
                    isOpen={showFriendsModal}
                    onClose={() => setShowFriendsModal(false)}
                />
            </div>
        );
    }

    // ── SELECTION FORM ───────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0b1120] flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200">
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

                    {/* Center Column: Logo + KLERP + Image 5 Subtitle (True 100% Mathematical Center) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-auto">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm ring-1 ring-white/30 shrink-0">
                                <img
                                    src="/Koneru Lakshmaiah University Logo Banner.png"
                                    alt="KLU"
                                    className="w-full h-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <span className="font-serif italic font-extrabold text-xl sm:text-2xl text-white tracking-wider drop-shadow-xs">
                                KLERP
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
            <div className="flex-1 flex overflow-hidden relative">
                <ErpSidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(false)}
                    activePage="attendance-register"
                />

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 flex items-center justify-center relative">
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
                                            value={(() => {
                                                const norm = normalizeAcademicYear(year);
                                                const match = availableYears.find(y => y.value === year || y.value === norm || normalizeAcademicYear(y.text) === norm);
                                                return match ? match.value : (year || '2025-2026');
                                            })()}
                                            onChange={e => {
                                                setYear(e.target.value);
                                                if (activeId) localStorage.setItem(`manualYear_${activeId}`, e.target.value);
                                            }}
                                            className="w-full appearance-none bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition-all font-semibold cursor-pointer shadow-2xs">
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
                                        <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest ml-1">Semester</label>
                                    <div className="relative">
                                        <select
                                            value={normalizeSemester(semester)}
                                            onChange={e => {
                                                setSemester(e.target.value);
                                                if (activeId) localStorage.setItem(`manualSem_${activeId}`, e.target.value);
                                            }}
                                            className="w-full appearance-none bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition-all font-semibold cursor-pointer shadow-2xs">
                                            <option value="">Select Semester</option>
                                            {(() => {
                                                const seenVals = new Set();
                                                const list = [];
                                                availableSemesters.forEach(s => {
                                                    const sLow = (s.text || '').toLowerCase();
                                                    const val = sLow.includes('summer') ? 'Summer'
                                                        : ((sLow.includes('term') && !sLow.includes('summer')) || sLow.includes('tri')) ? 'Term3'
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
                                        if (!hasActiveErpSession(activeId)) {
                                            const currentSaved = (getSavedFriends() || []).find(f => f.studentId === activeId || f.id === activeId) || (getMyProfile()?.studentId === activeId ? getMyProfile() : null);
                                            if (currentSaved?.password || currentSaved?.hasSavedPassword) {
                                                setTargetFriendForCaptcha(currentSaved);
                                                return;
                                            }
                                        }
                                        handleSearch(year, semester);
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
                                            {!hasActiveErpSession(activeId) ? '🛡️ Login with Captcha & Get Attendance' : 'Get Attendance'}
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
                onSuccess={() => {
                    setTargetFriendForCaptcha(null);
                    handleSearch(year, semester, activeId);
                }}
            />
        </div>
    );
};

export default AttendanceRegister;
