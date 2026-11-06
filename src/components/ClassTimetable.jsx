import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin,
    CalendarDays,
    Coffee,
    ArrowRight,
    RefreshCw,
    Copy,
    ChevronDown,
    Printer,
    Image as ImageIcon,
    Users,
    ShieldCheck,
    Tag,
    Share2,
    Utensils,
    ArrowLeftRight,
    SlidersHorizontal,
    ShieldAlert,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    DAYS_OF_WEEK,
    KLU_SESSIONS,
    KLU_COURSE_NAMES,
    getStudentTimetable,
    saveStudentTimetable,
    getLiveClassStatus,
    fetchLiveErpTimetable,
    parseKluTimetableHtml,
    getSubjectName,
    setSubjectMapping,
    getAllSubjectMappings,
    normalizeAcademicYear,
    normalizeSemester,
    cleanRoomNumber
} from '../services/timetableService';
import { getSavedFriends, getMyProfile, saveFriendTimetable, getEffectiveSavedProfile, setActiveProfileId } from '../services/friendsService';
import { hasActiveErpSession } from '../services/erpService';
import FriendCaptchaModal from './FriendCaptchaModal';

const DAY_TABS = [
    { key: 'MON', full: 'Monday' },
    { key: 'TUE', full: 'Tuesday' },
    { key: 'WED', full: 'Wednesday' },
    { key: 'THU', full: 'Thursday' },
    { key: 'FRI', full: 'Friday' },
    { key: 'SAT', full: 'Saturday' }
];

export default function ClassTimetable({
    studentId = '',
    studentName = 'My Profile',
    erpCourses = [],
    onViewCourseAttendance,
    onChangeSelection,
    onSemesterChange,
    onRefreshErp,
    onSelectFriend,
    onSelectProfile,
    selectedYear = '2025-2026',
    selectedSem = 'Odd Sem'
}) {
    const navigate = useNavigate();
    const myProfile = useMemo(() => getMyProfile(), []);
    const effectiveSaved = useMemo(() => getEffectiveSavedProfile(), []);
    const primaryMyId = myProfile?.studentId || (typeof window !== 'undefined' ? (localStorage.getItem('rememberedId') || localStorage.getItem('activeErpUser')) : '') || effectiveSaved?.studentId || '';
    const primaryMyName = myProfile?.nickname || (typeof window !== 'undefined' ? (localStorage.getItem('rememberedName') || localStorage.getItem('activeErpUser')) : '') || effectiveSaved?.nickname || 'Account';

    // Combine saved friends with TimeTablekl 'maddys' reactively
    const [allFriends, setAllFriends] = useState(() => {
        const list = getSavedFriends();
        try {
            const rawMaddys = localStorage.getItem('maddys');
            if (rawMaddys) {
                const parsedMaddys = JSON.parse(rawMaddys);
                if (Array.isArray(parsedMaddys)) {
                    parsedMaddys.forEach(m => {
                        const sid = m.username || m.studentId || String(m.id || '');
                        if (sid && !list.some(f => (f.studentId === sid || f.username === sid))) {
                            list.push({
                                id: m.id || sid,
                                nickname: m.name || m.nickname || 'Buddy',
                                label: m.name || m.nickname || 'Buddy',
                                studentId: sid,
                                username: sid
                            });
                        }
                    });
                }
            }
        } catch { /* ignore */ }
        return list;
    });

    useEffect(() => {
        const handleFriendsSync = () => {
            const list = getSavedFriends();
            try {
                const rawMaddys = localStorage.getItem('maddys');
                if (rawMaddys) {
                    const parsedMaddys = JSON.parse(rawMaddys);
                    if (Array.isArray(parsedMaddys)) {
                        parsedMaddys.forEach(m => {
                            const sid = m.username || m.studentId || String(m.id || '');
                            if (sid && !list.some(f => (f.studentId === sid || f.username === sid))) {
                                list.push({
                                    id: m.id || sid,
                                    nickname: m.name || m.nickname || 'Buddy',
                                    label: m.name || m.nickname || 'Buddy',
                                    studentId: sid,
                                    username: sid
                                });
                            }
                        });
                    }
                }
            } catch { /* ignore */ }
            setAllFriends(list);
        };
        window.addEventListener('kl_friends_updated', handleFriendsSync);
        window.addEventListener('storage', handleFriendsSync);
        return () => {
            window.removeEventListener('kl_friends_updated', handleFriendsSync);
            window.removeEventListener('storage', handleFriendsSync);
        };
    }, []);

    // Active Profile: Self or Buddy
    const [activeTargetId, setActiveTargetId] = useState(studentId || primaryMyId);

    const effectiveId = studentId || activeTargetId || primaryMyId;
    const effectiveName = useMemo(() => {
        if (effectiveId === primaryMyId || effectiveId === 'main') {
            return primaryMyName;
        }
        const fr = allFriends.find(f => (f.studentId === effectiveId || f.username === effectiveId || f.id === effectiveId));
        return fr ? (fr.nickname || fr.name || fr.label) : (studentName && studentName !== 'My Profile' ? studentName : effectiveId);
    }, [effectiveId, primaryMyName, primaryMyId, allFriends, studentName]);

    // Friends list with primary user ID strictly excluded to prevent duplicate buttons
    const filteredFriends = useMemo(() => {
        return allFriends.filter(f => {
            const sid = f.studentId || f.username || f.id;
            return sid && sid !== primaryMyId;
        });
    }, [allFriends, primaryMyId]);

    // Dynamic Academic Year & Semester derived directly from props, storage & modal selection
    const [overrideYear, setOverrideYear] = useState(null);
    const [overrideSem, setOverrideSem] = useState(null);
    const [showSemModal, setShowSemModal] = useState(false);

    const currentYear = useMemo(() => normalizeAcademicYear(overrideYear || selectedYear), [overrideYear, selectedYear]);
    const currentSem = useMemo(() => {
        const s = normalizeSemester(overrideSem || selectedSem);
        if (s === 'Summer') return 'Summer Term';
        if (s === 'Term3') return 'Tri Sem / Term 3';
        if (s === 'Even') return 'Even Sem';
        return 'Odd Sem';
    }, [overrideSem, selectedSem]);

    const [tempYear, setTempYear] = useState(currentYear);
    const [tempSem, setTempSem] = useState(currentSem);

    useEffect(() => {
        setTempYear(currentYear);
        setTempSem(currentSem);
    }, [currentYear, currentSem]);

    const availableYearsList = useMemo(() => {
        const topYear = new Date().getFullYear();
        const yrs = [];
        for (let y = topYear; y >= 2021; y--) {
            yrs.push(`${y}-${y + 1}`);
        }
        return yrs;
    }, []);

    const availableSemsList = ['Odd Sem', 'Even Sem', 'Summer Term', 'Tri Sem / Term 3'];

    const handleApplySemester = (newYear, newSem) => {
        const cleanY = normalizeAcademicYear(newYear);
        const cleanS = normalizeSemester(newSem);
        setOverrideYear(cleanY);
        setOverrideSem(cleanS);
        if (effectiveId) {
            try {
                localStorage.setItem(`manualYear_${effectiveId}`, cleanY);
                localStorage.setItem(`activeYear_${effectiveId}`, cleanY);
                localStorage.setItem(`manualSem_${effectiveId}`, cleanS);
                localStorage.setItem(`activeSem_${effectiveId}`, cleanS);
            } catch { /* ignore */ }
        }
        window.dispatchEvent(new CustomEvent('kl_active_profile_updated', {
            detail: { studentId: effectiveId, year: cleanY, sem: cleanS }
        }));
        if (typeof onSemesterChange === 'function') {
            onSemesterChange(cleanY, cleanS);
        }
        setShowSemModal(false);
    };

    const getStudentCourses = useCallback((id) => {
        if (!id) return [];
        if (id === studentId && Array.isArray(erpCourses)) return erpCourses;
        try {
            const scopedKey = `kleData_${id}_${currentYear}_${currentSem}`;
            const scopedRaw = localStorage.getItem(scopedKey);
            if (scopedRaw) {
                const p = JSON.parse(scopedRaw);
                if (p.empty || (Array.isArray(p.attendance_data) && p.attendance_data.length === 0)) return [];
                if (Array.isArray(p.attendance_data) && p.attendance_data.length > 0) return p.attendance_data;
            }
            const raw = localStorage.getItem(`kleData_${id}`) || (id === primaryMyId ? localStorage.getItem('kleData') : null);
            if (raw) {
                const p = JSON.parse(raw);
                if (p.year && p.semester &&
                    normalizeAcademicYear(p.year) === currentYear &&
                    normalizeSemester(p.semester) === normalizeSemester(currentSem)) {
                    if (p.empty || (Array.isArray(p.attendance_data) && p.attendance_data.length === 0)) return [];
                    const list = p.attendance_data || p.data || (Array.isArray(p) ? p : []);
                    if (Array.isArray(list) && list.length > 0) return list;
                }
            }
        } catch { /* ignore */ }
        return [];
    }, [studentId, erpCourses, primaryMyId, currentYear, currentSem]);

    const [timetable, setTimetable] = useState(() => getStudentTimetable(effectiveId, erpCourses, currentYear, currentSem));

    useEffect(() => {
        const fresh = getStudentTimetable(effectiveId, erpCourses, currentYear, currentSem);
        setTimetable(fresh);
    }, [effectiveId, erpCourses, currentYear, currentSem]);

    useEffect(() => {
        if (studentId) setActiveTargetId(studentId);
    }, [studentId]);

    useEffect(() => {
        const handleProfileSwitch = (e) => {
            const detail = e?.detail;
            const newTargetId = detail?.studentId || (detail?.id && detail.id !== 'main' ? detail.id : primaryMyId);
            if (newTargetId && newTargetId !== activeTargetId) {
                setActiveTargetId(newTargetId);
                const fresh = getStudentTimetable(newTargetId, getStudentCourses(newTargetId), currentYear, currentSem);
                setTimetable(fresh);
            }
        };
        window.addEventListener('kl_active_profile_updated', handleProfileSwitch);
        window.addEventListener('kl_profile_switched', handleProfileSwitch);
        return () => {
            window.removeEventListener('kl_active_profile_updated', handleProfileSwitch);
            window.removeEventListener('kl_profile_switched', handleProfileSwitch);
        };
    }, [activeTargetId, studentId, getStudentCourses, currentYear, currentSem, primaryMyId]);

    const safeTimetable = useMemo(() => {
        const defaultDays = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };
        if (!timetable || typeof timetable !== 'object') return defaultDays;
        const res = { ...defaultDays };
        for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
            const val = timetable[d];
            res[d] = Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []);
        }
        res._source = timetable._source;
        res._userCustomized = timetable._userCustomized;
        return res;
    }, [timetable]);

    const activeSessions = useMemo(() => {
        let maxSlot = 8;
        if (safeTimetable) {
            Object.values(safeTimetable).forEach(slots => {
                if (Array.isArray(slots)) {
                    slots.forEach(s => {
                        const p = s.periodEnd || (s.period && s.span ? s.period + s.span - 1 : s.period) || s.period || 0;
                        if (p > maxSlot) maxSlot = Math.min(p, 14);
                    });
                }
            });
        }
        return KLU_SESSIONS.slice(0, Math.max(maxSlot, 8));
    }, [safeTimetable]);

    const [selectedDay, setSelectedDay] = useState(() => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = dayNames[new Date().getDay()];
        return today === 'Sunday' ? 'Monday' : today;
    });

    // View & Display Modes (Defaults: Week Matrix view & Aliases)
    const [viewMode, setViewMode] = useState('week'); // 'week' | 'day'
    const [displayMode, setDisplayMode] = useState('aliases'); // 'aliases' | 'codes'
    const [currentTimeStr, setCurrentTimeStr] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [captchaModalTarget, setCaptchaModalTarget] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importHtmlInput, setImportHtmlInput] = useState('');
    const [importError, setImportError] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef(null);

    // Subject Aliases Modal State
    const [showAliasesModal, setShowAliasesModal] = useState(false);
    const [aliasEditMap, setAliasEditMap] = useState(() => getAllSubjectMappings());

    // Schedule Compare ("Where's Maddy?") Modal State
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareLeftId, setCompareLeftId] = useState(effectiveId);
    const [compareRightId, setCompareRightId] = useState(() => allFriends[0]?.studentId || '');
    const [compareDay, setCompareDay] = useState(() => selectedDay);

    // Share & Import Modal State
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareTab, setShareTab] = useState('share'); // 'share' | 'import'
    const [importFriendId, setImportFriendId] = useState('');
    const [importFriendName, setImportFriendName] = useState('');
    const [importJsonInput, setImportJsonInput] = useState('');
    const [importFeedback, setImportFeedback] = useState('');

    // Live clock ticker
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTimeStr(now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // Close more dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync timetable whenever effectiveId, erpCourses, currentYear or currentSem change
    useEffect(() => {
        const hasSession = hasActiveErpSession(effectiveId);
        if (!hasSession) {
            setTimetable(null);
            // Clean up any unauthenticated or contaminated timetable data for this student
            if (typeof window !== 'undefined' && effectiveId) {
                try {
                    const scopedKey = `kl_timetable_${effectiveId}_${currentYear}_${currentSem}`;
                    const raw = localStorage.getItem(scopedKey) || localStorage.getItem(`kl_timetable_${effectiveId}`);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (!parsed?._userCustomized) {
                            localStorage.removeItem(scopedKey);
                            localStorage.removeItem(`kl_timetable_${effectiveId}`);
                        }
                    }
                } catch { /* ignore */ }
            }
            return;
        }

        const cached = getStudentTimetable(effectiveId, erpCourses, currentYear, currentSem);
        setTimetable(cached);

        // If not yet fetched from live ERP or user refreshed, trigger live ERP fetch in background
        if ((!cached || cached._source !== 'erp_live')) {
            setIsRefreshing(true);
            fetchLiveErpTimetable(effectiveId, currentYear, currentSem)
                .then((res) => {
                    if (res?.success && res?.timetable) {
                        setTimetable(res.timetable);
                    }
                })
                .catch(() => {})
                .finally(() => setIsRefreshing(false));
        }
    }, [effectiveId, erpCourses, currentYear, currentSem]);

    // Live update when fresh live ERP timetable finishes in background
    useEffect(() => {
        const handleTimetableUpdate = (e) => {
            const detail = e?.detail;
            if (!detail || detail.studentId === effectiveId) {
                const fresh = getStudentTimetable(effectiveId, erpCourses, currentYear, currentSem);
                setTimetable(fresh);
            }
        };
        window.addEventListener('kl_timetable_updated', handleTimetableUpdate);
        return () => window.removeEventListener('kl_timetable_updated', handleTimetableUpdate);
    }, [effectiveId, erpCourses, currentYear, currentSem]);

    // Live class status in Indian Standard Time (IST)
    const liveStatus = useMemo(() => {
        void currentTimeStr; // Retick live countdown every second
        return getLiveClassStatus(safeTimetable, effectiveId);
    }, [safeTimetable, effectiveId, currentTimeStr]);

    // Verify whether authentic live ERP timetable was fetched for this student
    const isVerifiedErpTimetable = useMemo(() => {
        if (!effectiveId) return false;

        // Must have valid timetable slots
        if (!safeTimetable || typeof safeTimetable !== 'object') return false;
        const totalSlots = Object.values(safeTimetable).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
        if (totalSlots === 0) return false;

        if (timetable?._source === 'erp_live' || safeTimetable._source === 'erp_live' || safeTimetable._userCustomized) {
            return true;
        }

        if (hasActiveErpSession(effectiveId)) return true;

        if (typeof window !== 'undefined') {
            const scopedKey = `kl_timetable_${effectiveId}_${currentYear}_${currentSem}`;
            const raw = localStorage.getItem(scopedKey) || localStorage.getItem(`kl_timetable_${effectiveId}`);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed?._source === 'erp_live' || parsed?._userCustomized || parsed?._source === 'erp_synced') return true;
                } catch { /* ignore */ }
            }
            if (localStorage.getItem('maddys') || localStorage.getItem('timetable')) return true;
        }
        return totalSlots > 0;
    }, [safeTimetable, timetable, effectiveId, currentYear, currentSem]);

    // Unique Course Codes for Alias Editing
    const uniqueCourseCodes = useMemo(() => {
        const set = new Set();
        DAYS_OF_WEEK.forEach(day => {
            const daySlots = safeTimetable[day];
            if (Array.isArray(daySlots)) {
                daySlots.forEach(slot => {
                    const raw = (slot.rawCode || slot.code || '').replace(/-[LPTS]$/, '').trim();
                    if (raw) set.add(raw);
                });
            }
        });
        return Array.from(set).sort();
    }, [safeTimetable]);

    // Handle Timetable Reload
    const handleReloadTimetable = async () => {
        if (!hasActiveErpSession(effectiveId)) {
            // Need ERP authentication / Captcha
            const targetProfile = effectiveId === primaryMyId
                ? (myProfile || { id: 'main', studentId: effectiveId, nickname: effectiveName, label: effectiveName })
                : (allFriends.find(f => (f.studentId === effectiveId || f.username === effectiveId || f.id === effectiveId)) || {
                    id: effectiveId,
                    studentId: effectiveId,
                    nickname: effectiveName,
                    label: effectiveName
                });
            setCaptchaModalTarget(targetProfile);
            return;
        }

        setIsRefreshing(true);
        try {
            if (onRefreshErp) {
                await onRefreshErp(currentYear, currentSem);
            }
            await fetchLiveErpTimetable(effectiveId, currentYear, currentSem);
            const fresh = getStudentTimetable(effectiveId, erpCourses, currentYear, currentSem);
            setTimetable(fresh);
        } catch {
            const fresh = getStudentTimetable(effectiveId, erpCourses, currentYear, currentSem);
            setTimetable(fresh);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // Resolve course display label based on Course Codes vs Course Names vs Custom Aliases
    const getSlotDisplayTitle = (slot) => {
        if (!slot) return '';
        const raw = (slot.rawCode || (slot.code || '').replace(/-[LPTS]$/, '')).trim();

        if (displayMode === 'codes') {
            return slot.code || slot.rawCode || 'COURSE';
        }

        // 1. If slot already carries an authentic verified title from ERP or authentic timetable, prioritize it!
        if (slot.title && slot.title !== raw && slot.title !== slot.code && !slot.title.toLowerCase().includes('subject')) {
            const cleanBase = slot.title.replace(/\s*\((Lab|Tut|Tutorial|Lecture|Skill|Practical)\)$/i, '').trim();
            const compSuffix = slot.code?.endsWith('-P') ? ' (Lab)'
                : slot.code?.endsWith('-T') ? ' (Tut)'
                : slot.code?.endsWith('-S') ? ' (Skill)'
                : '';
            return `${cleanBase}${compSuffix}`;
        }

        const baseWithoutSuffix = raw.replace(/HF$/, '');
        let baseName = '';
        if (Array.isArray(erpCourses) && erpCourses.length > 0) {
            const match = erpCourses.find(c => {
                const cCode = (c.code || '').replace(/-[LPTS]$/, '').trim();
                return cCode === raw || cCode === baseWithoutSuffix;
            });
            if (match && (match.title || match.name)) {
                baseName = match.title || match.name;
            }
        }

        if (!baseName) {
            baseName = getSubjectName(raw) || getSubjectName(baseWithoutSuffix) || KLU_COURSE_NAMES[raw] || KLU_COURSE_NAMES[baseWithoutSuffix];
        }

        if (!baseName || baseName === raw || baseName === slot.code) {
            if (raw.includes('24EDS3308')) baseName = 'Principles of Deep Neural Networks';
            else if (raw.includes('24GMI3101')) baseName = 'Embedded AI – Edge Intelligence and TinyML';
            else if (raw.includes('24CC3014')) baseName = 'Cloud Computing';
            else if (raw.includes('23EC1202')) baseName = 'Digital Design and Computer Architecture';
        }

        baseName = baseName || raw || slot.code;
        const cleanBase = baseName.replace(/\s*\((Lab|Tut|Tutorial|Lecture|Skill|Practical)\)$/i, '').trim();

        const compSuffix = slot.code?.endsWith('-P') ? ' (Lab)'
            : slot.code?.endsWith('-T') ? ' (Tut)'
            : slot.code?.endsWith('-S') ? ' (Skill)'
            : '';
        return `${cleanBase}${compSuffix}`;
    };

    // High-resolution Canvas Timetable Picture generator
    const generateHighQualityCanvas = useCallback(() => {
        if (!timetable || Object.keys(timetable).length === 0) return null;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const width = 1600;
        const height = 950;
        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, width, height);

        // Header Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`KL University · Academic Timetable (${selectedYear})`, 60, 65);

        ctx.fillStyle = '#cfff04';
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${effectiveName} (${effectiveId}) · ${selectedSem}`, 60, 95);

        // Grid Dimensions
        const startX = 60;
        const startY = 130;
        const colWidth = (width - 120 - 100) / 9;
        const rowHeight = (height - 180) / DAYS_OF_WEEK.length;

        // Day rows
        DAYS_OF_WEEK.forEach((day, rIdx) => {
            const y = startY + rIdx * rowHeight;
            const slots = safeTimetable[day] || [];

            ctx.fillStyle = '#17171b';
            ctx.fillRect(startX, y, 100, rowHeight - 4);
            ctx.strokeStyle = '#2a2a31';
            ctx.strokeRect(startX, y, 100, rowHeight - 4);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(day.slice(0, 3).toUpperCase(), startX + 50, y + rowHeight / 2 + 5);

            for (let p = 1; p <= 9; p++) {
                const x = startX + 100 + (p - 1) * colWidth;
                const slot = slots.find(s => s.period === p);

                if (slot && slot.code) {
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(x + 2, y, colWidth - 4, rowHeight - 4);
                    ctx.strokeStyle = '#43209e';
                    ctx.strokeRect(x + 2, y, colWidth - 4, rowHeight - 4);

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
                    ctx.fillText(slot.code, x + colWidth / 2, y + 30);

                    ctx.fillStyle = '#93c5fd';
                    ctx.font = '11px system-ui, -apple-system, sans-serif';
                    ctx.fillText(slot.room ? `Room ${slot.room}` : (slot.section || 'Class'), x + colWidth / 2, y + 50);
                } else {
                    ctx.fillStyle = '#111115';
                    ctx.fillRect(x + 2, y, colWidth - 4, rowHeight - 4);
                    ctx.strokeStyle = '#222228';
                    ctx.strokeRect(x + 2, y, colWidth - 4, rowHeight - 4);

                    ctx.fillStyle = '#475569';
                    ctx.font = '14px system-ui, -apple-system, sans-serif';
                    ctx.fillText('—', x + colWidth / 2, y + rowHeight / 2 + 5);
                }
            }
        });

        // Watermark Footer
        ctx.fillStyle = '#64748b';
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Generated by KL Attendance & Timetable · https://klattendance.online`, 60, height - 20);

        return canvas;
    }, [timetable, safeTimetable, effectiveName, effectiveId, selectedYear, selectedSem]);

    // Export Timetable as Image
    const exportAsImage = useCallback(() => {
        try {
            const canvas = generateHighQualityCanvas();
            if (!canvas) return;
            const fileName = `KLU_Timetable_${effectiveId}_${new Date().toISOString().split('T')[0]}.png`;
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 'image/png', 1.0);
        } catch (err) {
            console.error('Export as image failed:', err);
        }
    }, [generateHighQualityCanvas, effectiveId]);

    // Copy timetable text formatted for WhatsApp
    const handleCopySchedule = () => {
        let text = `📅 KLU Weekly Timetable (${effectiveName} - ${effectiveId})\n`;
        text += `Academic Year: ${selectedYear} · ${selectedSem}\n\n`;

        DAYS_OF_WEEK.forEach(day => {
            const slots = safeTimetable[day] || [];
            text += `📌 ${day.toUpperCase()}:\n`;
            if (slots.length === 0) {
                text += `   No classes scheduled\n\n`;
                return;
            }
            slots.forEach(s => {
                const title = s.title || KLU_COURSE_NAMES[s.rawCode] || s.code;
                text += `   • ${s.slotId || `P${s.period}`} (${s.time}): ${s.code} - ${title} [${s.section || 'General'}] @ Room ${s.room || 'Room'}\n`;
            });
            text += '\n';
        });

        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // Print timetable
    const handlePrintTimetable = () => {
        window.print();
    };

    // Import timetable from HTML
    const handleImportHtml = () => {
        if (!importHtmlInput.trim()) return;
        const parsed = parseKluTimetableHtml(importHtmlInput);
        if (parsed) {
            setTimetable(parsed);
            saveStudentTimetable(effectiveId, parsed, currentYear, currentSem);
            setShowImportModal(false);
            setImportHtmlInput('');
            setImportError('');
        } else {
            setImportError('Could not find timetable table in the provided HTML. Please make sure to copy the full table element.');
        }
    };

    // Save Custom Subject Aliases
    const handleSaveAliases = () => {
        Object.entries(aliasEditMap).forEach(([code, alias]) => {
            if (alias && alias.trim()) {
                setSubjectMapping(code, alias.trim());
            }
        });
        setShowAliasesModal(false);
    };

    // Import Friend's Timetable (No password required)
    const handleImportFriendSchedule = () => {
        if (!importFriendId.trim()) {
            setImportFeedback('Please enter your friend\'s Student ID.');
            return;
        }
        if (!importJsonInput.trim()) {
            setImportFeedback('Please paste the timetable JSON code.');
            return;
        }

        try {
            const parsed = JSON.parse(importJsonInput.trim());
            const schedule = parsed.timetable || parsed;
            saveFriendTimetable({
                studentId: importFriendId.trim(),
                nickname: importFriendName.trim() || importFriendId.trim(),
                timetable: schedule,
                academicYear: currentYear,
                semester: currentSem
            });
            setImportFeedback('Friend\'s timetable imported successfully!');
            setTimeout(() => {
                setShowShareModal(false);
                setImportFeedback('');
                setImportJsonInput('');
            }, 1200);
        } catch {
            setImportFeedback('Invalid timetable JSON format. Please ensure valid export text was pasted.');
        }
    };


    const daySchedule = safeTimetable[selectedDay] || [];
    const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    // Schedule Comparison Timetable data
    const leftCompareTimetable = useMemo(() => {
        return getStudentTimetable(compareLeftId, [], currentYear, currentSem);
    }, [compareLeftId, currentYear, currentSem]);

    const rightCompareTimetable = useMemo(() => {
        return getStudentTimetable(compareRightId, [], currentYear, currentSem);
    }, [compareRightId, currentYear, currentSem]);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-5 pb-16 font-sans select-none">
            
            {/* ── Top Header Bar & Profile Switcher ── */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Timetable</h2>
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                            {effectiveName} · {effectiveId}
                        </span>
                    </div>

                    <div className="text-xs sm:text-sm text-slate-500 font-normal">
                        View weekly class schedules, live class countdowns, and classrooms
                    </div>

                    {/* Academic Year & Semester Session Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-slate-500 text-xs sm:text-sm font-medium">
                        <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                            {currentYear} · {currentSem}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Timetable
                        </span>
                    </div>

                    {/* Prominent Active Schedule Viewing Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-indigo-50/70 border border-indigo-100 my-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="text-xs font-medium text-slate-500">Viewing Timetable:</span>
                            <span className="text-xs font-black text-indigo-800">
                                {effectiveName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                ID: {effectiveId}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                            <span className="text-indigo-700">{currentYear}</span>
                            <span>•</span>
                            <span className="text-indigo-700">{currentSem}</span>
                        </div>
                    </div>

                    {/* Buddy / Friend Switcher Bar (Names first, Account last) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {filteredFriends.map((friend) => {
                            const fId = friend.studentId || friend.username || friend.id;
                            const fName = friend.nickname || friend.name || friend.label || 'Buddy';
                            const isSelected = effectiveId === fId;

                            return (
                                <button
                                    key={friend.id || fId}
                                    type="button"
                                    onClick={() => {
                                        try {
                                            localStorage.setItem('activeErpUser', fId);
                                        } catch { /* ignore */ }
                                        setActiveProfileId(friend.id || fId, fId);
                                        setActiveTargetId(fId);
                                        if (onSelectFriend) onSelectFriend(fId);
                                        if (onSelectProfile) onSelectProfile(friend);
                                        const fresh = getStudentTimetable(fId, getStudentCourses(fId), currentYear, currentSem);
                                        setTimetable(fresh);
                                        if (hasActiveErpSession(fId) && (!fresh || fresh._source !== 'erp_live')) {
                                            fetchLiveErpTimetable(fId, currentYear, currentSem).then(res => {
                                                if (res?.timetable) setTimetable(res.timetable);
                                            }).catch(() => {});
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                        isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                    }`}
                                >
                                    <Users className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                                    <span>{fName} ({fId})</span>
                                </button>
                            );
                        })}

                        {/* Account as the LAST option */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetSid = primaryMyId || 'main';
                                try {
                                    if (primaryMyId) localStorage.setItem('activeErpUser', primaryMyId);
                                } catch { /* ignore */ }
                                setActiveProfileId('main', primaryMyId);
                                setActiveTargetId(targetSid);
                                if (onSelectFriend) onSelectFriend(targetSid);
                                if (onSelectProfile) onSelectProfile(myProfile || { id: 'main', nickname: 'Account', studentId: primaryMyId });
                                const fresh = getStudentTimetable(targetSid, primaryMyId === studentId ? erpCourses : [], currentYear, currentSem);
                                setTimetable(fresh);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                (effectiveId === primaryMyId || effectiveId === 'main' || !filteredFriends.some(f => (f.studentId === effectiveId || f.id === effectiveId)))
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${
                                (effectiveId === primaryMyId || effectiveId === 'main' || !filteredFriends.some(f => (f.studentId === effectiveId || f.id === effectiveId)))
                                    ? 'bg-emerald-300'
                                    : 'bg-emerald-500'
                            }`} />
                            <span>{primaryMyId ? `${primaryMyName || 'Account'} (${primaryMyId})` : 'Account'}</span>
                        </button>
                    </div>
                </div>

                {/* Right Action Controls: Live Status Pill, Save Picture, More Options */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                    {/* Live Sync Status */}
                    {isRefreshing ? (
                        <div className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            <span>Updating...</span>
                        </div>
                    ) : (
                        <div className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live Timetable</span>
                        </div>
                    )}

                    {/* More Options Dropdown */}
                    <div className="relative" ref={moreMenuRef}>
                        <button
                            type="button"
                            onClick={() => setShowMoreMenu(prev => !prev)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                        >
                            <span>More</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        <AnimatePresence>
                            {showMoreMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs font-bold text-slate-700"
                                >
                                    {onChangeSelection && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowMoreMenu(false);
                                                onChangeSelection();
                                            }}
                                            className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-b border-slate-100 text-indigo-700 font-bold"
                                        >
                                            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                                            <span>Change Academic Year / Sem</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            handleReloadTimetable();
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-b border-slate-100 text-indigo-700 font-bold"
                                    >
                                        <RefreshCw className="w-4 h-4 text-indigo-600" />
                                        <span>Force Re-fetch from ERP</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            const targetProfile = effectiveId === primaryMyId
                                                ? myProfile
                                                : allFriends.find(f => (f.studentId === effectiveId || f.username === effectiveId || f.id === effectiveId));
                                            if (targetProfile) {
                                                setCaptchaModalTarget(targetProfile);
                                            } else {
                                                setCaptchaModalTarget({
                                                    id: effectiveId,
                                                    studentId: effectiveId,
                                                    nickname: effectiveName,
                                                    label: effectiveName
                                                });
                                            }
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-b border-slate-100"
                                    >
                                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                        <span>Re-authenticate ERP</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            setShowCompareModal(true);
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                                        <span>Compare Schedules</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            setAliasEditMap(getAllSubjectMappings());
                                            setShowAliasesModal(true);
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        <Tag className="w-4 h-4 text-amber-600" />
                                        <span>Custom Aliases</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            setShowShareModal(true);
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        <Share2 className="w-4 h-4 text-emerald-600" />
                                        <span>Share / Import</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            handleCopySchedule();
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        <Copy className="w-4 h-4 text-blue-600" />
                                        <span>Copy as Text</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            handlePrintTimetable();
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        <Printer className="w-4 h-4 text-rose-600" />
                                        <span>Print / PDF</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMoreMenu(false);
                                            exportAsImage();
                                        }}
                                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        <ImageIcon className="w-4 h-4 text-amber-600" />
                                        <span>Download as Image</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Buddy Banner when viewing friend's schedule */}
            {primaryMyId && effectiveId !== primaryMyId && allFriends.some(f => (f.studentId === effectiveId || f.id === effectiveId) && f.id !== 'main') ? (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 text-indigo-950">
                    <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="text-xs">
                            <span className="font-bold">Viewing Buddy&apos;s Schedule:</span>{' '}
                            <span className="font-extrabold text-indigo-700">{effectiveName}</span>{' '}
                            <span className="font-mono text-indigo-600">({effectiveId})</span>
                            {safeTimetable?._source === 'erp_live' ? (
                                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Verified ERP Timetable</span>
                                </span>
                            ) : (
                                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                                    <span>Curriculum Schedule</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {safeTimetable?._source !== 'erp_live' && (
                            <button
                                type="button"
                                onClick={handleReloadTimetable}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                <span>Sync Live ERP Timetable</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setActiveProfileId('main');
                                setActiveTargetId(primaryMyId);
                                if (onSelectFriend) onSelectFriend(primaryMyId);
                                if (onSelectProfile) onSelectProfile(myProfile);
                                const fresh = getStudentTimetable(primaryMyId, getStudentCourses(primaryMyId), currentYear, currentSem);
                                setTimetable(fresh);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-300 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                            <span>Back to My Timetable</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            ) : null}

            {!isVerifiedErpTimetable ? (
                <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/90 shadow-md text-center max-w-lg mx-auto my-10 space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                            ERP Attendance Login Required
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            First login with ERP Attendance for <span className="font-bold text-slate-900">{effectiveName} ({effectiveId})</span>, then only the timetable will be shown.
                        </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                if (effectiveId) {
                                    setActiveProfileId(effectiveId);
                                }
                                if (typeof onViewCourseAttendance === 'function') {
                                    onViewCourseAttendance();
                                }
                                window.dispatchEvent(new CustomEvent('kl_switch_view', { detail: 'attendance' }));
                                navigate('/login', { state: { studentId: effectiveId, profileId: effectiveId, view: 'attendance' } });
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                        >
                            <ShieldCheck className="w-4 h-4 text-white" />
                            <span>ERP Portal Login</span>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Present (Current) & Next Class Row ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Present / Ongoing Class Card */}
                <div className="p-5 rounded-3xl bg-[#090d16] text-white border border-slate-800/90 shadow-md relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${liveStatus.currentClass ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-500'}`} />
                                <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-cyan-400/90">
                                    {liveStatus.currentClass
                                        ? 'ONGOING CLASS (NOW)'
                                        : liveStatus.isLunch
                                        ? 'LUNCH BREAK'
                                        : liveStatus.isFreePeriod
                                        ? 'FREE PERIOD / BREAK'
                                        : liveStatus.isBeforeCollege
                                        ? 'UPCOMING TODAY'
                                        : liveStatus.isDayEnded
                                        ? 'CLASSES CONCLUDED'
                                        : 'WEEKEND / NO CLASSES'}
                                </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-cyan-400">
                                {currentTimeStr || liveStatus.istTimeWithSecondsString || 'IST'}
                            </span>
                        </div>

                        {liveStatus.currentClass ? (
                            <div className="space-y-2">
                                <h4 className="text-lg sm:text-xl font-black text-white leading-tight">
                                    {getSlotDisplayTitle(liveStatus.currentClass)}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-0.5">
                                    <span className="text-indigo-300 font-bold">
                                        {liveStatus.currentClass.slotId} ({liveStatus.currentClass.time})
                                    </span>
                                    {liveStatus.currentClass.room && (
                                        <>
                                            <span>•</span>
                                            <span className="text-amber-300 font-bold flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                <span>Room {cleanRoomNumber(liveStatus.currentClass.room)}</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : liveStatus.isLunch ? (
                            <div className="space-y-1 py-1">
                                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm">
                                    <Utensils className="w-4 h-4 text-amber-400" />
                                    <span>Lunch Break (12:45 PM – 01:45 PM)</span>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Recharge yourself! Afternoon class sessions commence at 01:45 PM.
                                </p>
                            </div>
                        ) : liveStatus.isFreePeriod ? (
                            <div className="space-y-1 py-1">
                                <div className="flex items-center gap-1.5 text-blue-300 font-bold text-sm">
                                    <Coffee className="w-4 h-4 text-blue-400" />
                                    <span>Free Period / Library Break</span>
                                </div>
                                <p className="text-xs text-slate-400">
                                    No class scheduled right now. Review lecture notes or relax.
                                </p>
                            </div>
                        ) : liveStatus.isBeforeCollege ? (
                            <div className="space-y-1 py-1">
                                <h4 className="text-sm font-bold text-slate-200 tracking-tight">
                                    Classes Begin Today at {liveStatus.firstClassToday?.time || '7:10 AM'}
                                </h4>
                                {liveStatus.firstClassToday && (
                                    <p className="text-xs text-sky-400 font-medium leading-relaxed">
                                        First Class: {liveStatus.firstClassToday.slotId} ({liveStatus.firstClassToday.time}) · {getSlotDisplayTitle(liveStatus.firstClassToday)} {liveStatus.firstClassToday.room ? `@ Room ${cleanRoomNumber(liveStatus.firstClassToday.room)}` : ''}
                                    </p>
                                )}
                            </div>
                        ) : liveStatus.isDayEnded ? (
                            <div className="space-y-1 py-1">
                                <h4 className="text-sm font-bold text-slate-200 tracking-tight">
                                    All Classes Completed for Today
                                </h4>
                                {liveStatus.nextWorkingDayFirstClass ? (
                                    <p className="text-xs text-sky-400 font-medium leading-relaxed">
                                        Next Class: {liveStatus.nextWorkingDayFirstClass.relativeDay || liveStatus.nextWorkingDayFirstClass.day} {liveStatus.nextWorkingDayFirstClass.time} · {getSlotDisplayTitle(liveStatus.nextWorkingDayFirstClass)} {liveStatus.nextWorkingDayFirstClass.room ? `@ Room ${cleanRoomNumber(liveStatus.nextWorkingDayFirstClass.room)}` : ''}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400">
                                        All periods for today have concluded. Rest up and prepare for upcoming classes.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1 py-1">
                                <h4 className="text-sm font-bold text-slate-200 tracking-tight">
                                    No Classes Scheduled Today ({liveStatus.dayName || 'Weekend'})
                                </h4>
                                {liveStatus.nextWorkingDayFirstClass ? (
                                    <p className="text-xs text-sky-400 font-medium leading-relaxed">
                                        Next Class: {liveStatus.nextWorkingDayFirstClass.relativeDay || liveStatus.nextWorkingDayFirstClass.day} {liveStatus.nextWorkingDayFirstClass.time} · {getSlotDisplayTitle(liveStatus.nextWorkingDayFirstClass)} {liveStatus.nextWorkingDayFirstClass.room ? `@ Room ${cleanRoomNumber(liveStatus.nextWorkingDayFirstClass.room)}` : ''}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400">
                                        Enjoy your weekend / break!
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {liveStatus.currentClass && (
                        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Class in progress ({liveStatus.currentClass.progressPercent || 0}%)</span>
                                <span className="text-emerald-400 font-bold font-mono">
                                    {liveStatus.currentClass.minutesRemaining}m {liveStatus.currentClass.secondsRemaining ?? 0}s left
                                </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(129,140,248,0.6)]"
                                    style={{ width: `${liveStatus.currentClass.progressPercent || 0}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Upcoming / Next Class Card */}
                <div className="p-5 rounded-3xl bg-[#090d16] text-white border border-slate-800/90 shadow-md flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-slate-400">
                                NEXT CLASS (UPCOMING)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {liveStatus.nextClass ? (liveStatus.nextClass.minutesUntil <= 60 ? `Starts in ${liveStatus.nextClass.minutesUntil}m` : 'Next Up') : liveStatus.isBeforeCollege ? 'First Period' : liveStatus.isWeekendOrNoClass ? 'Weekend' : 'Concluded'}
                            </span>
                        </div>

                        {liveStatus.nextClass ? (
                            <div className="space-y-2">
                                <h4 className="text-lg sm:text-xl font-black text-white leading-tight">
                                    {getSlotDisplayTitle(liveStatus.nextClass)}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-0.5">
                                    <span className="text-indigo-300 font-bold">
                                        {liveStatus.nextClass.slotId} ({liveStatus.nextClass.time})
                                    </span>
                                    {liveStatus.nextClass.room && (
                                        <>
                                            <span>•</span>
                                            <span className="text-amber-300 font-bold flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                <span>Room {cleanRoomNumber(liveStatus.nextClass.room)}</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : liveStatus.isBeforeCollege && liveStatus.firstClassToday ? (
                            <div className="space-y-2">
                                <h4 className="text-lg sm:text-xl font-black text-white leading-tight">
                                    {getSlotDisplayTitle(liveStatus.firstClassToday)}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-0.5">
                                    <span className="text-indigo-300 font-bold">
                                        {liveStatus.firstClassToday.slotId} ({liveStatus.firstClassToday.time})
                                    </span>
                                    {liveStatus.firstClassToday.room && (
                                        <>
                                            <span>•</span>
                                            <span className="text-amber-300 font-bold flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                <span>Room {cleanRoomNumber(liveStatus.firstClassToday.room)}</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : liveStatus.nextWorkingDayFirstClass ? (
                            <div className="space-y-2">
                                <h4 className="text-base sm:text-lg font-black text-white leading-tight">
                                    {liveStatus.nextWorkingDayFirstClass.relativeDay}: {getSlotDisplayTitle(liveStatus.nextWorkingDayFirstClass)}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-0.5">
                                    <span className="text-indigo-300 font-bold">
                                        {liveStatus.nextWorkingDayFirstClass.slotId} ({liveStatus.nextWorkingDayFirstClass.time})
                                    </span>
                                    {liveStatus.nextWorkingDayFirstClass.room && (
                                        <>
                                            <span>•</span>
                                            <span className="text-amber-300 font-bold flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                                <span>Room {cleanRoomNumber(liveStatus.nextWorkingDayFirstClass.room)}</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-300">
                                    No More Classes Scheduled Today
                                </h4>
                                <p className="text-xs text-slate-400">
                                    All periods for today have been completed.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span className="truncate max-w-[200px] sm:max-w-xs">
                            Previous: {liveStatus.previousClass ? (
                                <strong className="text-slate-300 font-semibold">
                                    {getSlotDisplayTitle(liveStatus.previousClass)}{liveStatus.previousClass.room ? ` (Rm ${cleanRoomNumber(liveStatus.previousClass.room)})` : ''}
                                </strong>
                            ) : (liveStatus.isDayEnded && Array.isArray(liveStatus.todaySchedule) && liveStatus.todaySchedule.length > 0) ? (
                                <strong className="text-slate-300 font-semibold">
                                    {getSlotDisplayTitle(liveStatus.todaySchedule[liveStatus.todaySchedule.length - 1])}
                                </strong>
                            ) : (
                                <span className="text-slate-500 font-medium">None</span>
                            )}
                        </span>
                        <span className="font-mono text-white font-bold shrink-0 text-xs">
                            {liveStatus.nextClass ? liveStatus.nextClass.time : (liveStatus.nextWorkingDayFirstClass ? `${liveStatus.nextWorkingDayFirstClass.relativeDay} ${liveStatus.nextWorkingDayFirstClass.time.split('–')[0].trim()}` : 'None')}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Main Timetable Card: Clean, Crisp, Modern Light UI with Generous Gap ── */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 space-y-6 shadow-sm mt-8 sm:mt-10">
                
                {/* Header & View Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0" />
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                                Weekly Timetable
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowSemModal(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                                title="Click to change Academic Year & Semester"
                            >
                                <span>{effectiveName} · {currentYear} · {currentSem}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            Class schedules, classrooms, and timing breakdown for ID: {effectiveId}
                        </p>
                    </div>

                    {/* View Controls: Codes vs Names vs Aliases & Day vs Week Toggle */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Course Display Mode: Aliases vs Codes (Aliases first) */}
                        <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                            <button
                                type="button"
                                onClick={() => setDisplayMode('aliases')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    displayMode === 'aliases'
                                        ? 'bg-white text-indigo-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Aliases 🏷️
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisplayMode('codes')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    displayMode === 'codes'
                                        ? 'bg-white text-indigo-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Codes
                            </button>
                        </div>

                        {/* Week Matrix vs Day Schedule (Week Matrix first) */}
                        <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                            <button
                                type="button"
                                onClick={() => setViewMode('week')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    viewMode === 'week'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Week Matrix
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('day')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    viewMode === 'day'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Day Schedule
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── DAY SCHEDULE VIEW: Clean Day Tabs ── */}
                {viewMode === 'day' && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist">
                            {DAY_TABS.map((tab) => {
                                const isSelected = selectedDay === tab.full;
                                const isToday = todayDayName === tab.full;

                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        onClick={() => setSelectedDay(tab.full)}
                                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                                        }`}
                                    >
                                        <span>{tab.key}</span>
                                        {isToday && <span className="ml-1 text-emerald-400 font-extrabold">•</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Classes for Selected Day */}
                        {daySchedule.length === 0 ? (
                            <div className="p-10 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                <Coffee className="w-8 h-8 text-slate-400 mx-auto" />
                                <h4 className="text-base font-bold text-slate-800">No classes scheduled on {selectedDay}</h4>
                                <p className="text-xs text-slate-500">A full day off or weekend break.</p>
                                {onChangeSelection && (
                                    <button
                                        type="button"
                                        onClick={onChangeSelection}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-indigo-700 border border-slate-200 transition-all cursor-pointer shadow-2xs active:scale-95 mx-auto"
                                    >
                                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Change Academic Year / Semester</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {daySchedule.map((slot, sIdx) => {
                                    const title = getSlotDisplayTitle(slot);
                                    const isLab = (slot.component || slot.type || '').toLowerCase().includes('pract') || slot.code.endsWith('-P');
                                    const isSkill = (slot.component || slot.type || '').toLowerCase().includes('skill') || slot.code.endsWith('-S');
                                    const isTut = (slot.component || slot.type || '').toLowerCase().includes('tut') || slot.code.endsWith('-T');

                                    return (
                                        <div
                                            key={`${slot.period}_${sIdx}`}
                                            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 transition-all rounded-2xl p-4 gap-3.5 shadow-2xs"
                                        >
                                            {/* Time Column */}
                                            <div className="sm:w-36 bg-white border border-slate-200/80 rounded-xl p-2.5 flex sm:flex-col justify-between sm:justify-center items-center sm:items-start text-left shadow-2xs">
                                                <span className="text-xs font-mono font-bold text-indigo-700">
                                                    {slot.time || `Period ${slot.period}`}
                                                </span>
                                                <span className="text-[10px] font-mono font-semibold text-slate-500 mt-0.5">
                                                    Slot {slot.period}{slot.periodEnd && slot.periodEnd !== slot.period ? `–${slot.periodEnd}` : ''}
                                                </span>
                                            </div>

                                            {/* Course Details */}
                                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 shadow-2xs">
                                                            {slot.code}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                                                            isLab ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                            : isSkill ? 'bg-purple-50 text-purple-800 border-purple-200'
                                                            : isTut ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                            : 'bg-blue-50 text-blue-800 border-blue-200'
                                                        }`}>
                                                            {slot.type || slot.component || 'Lecture'}
                                                        </span>
                                                        {slot.section && (
                                                            <span className="text-[10px] font-semibold text-slate-500">
                                                                {slot.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                                                        {title}
                                                    </h4>
                                                </div>

                                                {/* Room Badge */}
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {slot.room && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 shadow-2xs">
                                                            <MapPin className="w-3.5 h-3.5 text-amber-600" />
                                                            <span>Room {cleanRoomNumber(slot.room)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── WEEK MATRIX VIEW: Full Schedule Grid ── */}
                {viewMode === 'week' && (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                        <div className="overflow-x-auto relative scrollbar-thin">
                            <table className="w-full text-xs border-collapse text-center">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                        <th className="sticky left-0 bg-slate-100 text-center p-1.5 sm:p-2 border-r border-slate-200 z-20 w-12 sm:w-14 min-w-[48px] sm:min-w-[56px]">
                                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                Day
                                            </span>
                                        </th>
                                        {activeSessions.map((sess) => (
                                            <th
                                                key={sess.id}
                                                className="p-1 sm:p-1.5 min-w-[85px] w-[85px] sm:min-w-[105px] sm:w-[105px] border-r border-slate-200 text-center font-bold text-slate-700 align-middle"
                                            >
                                                <div className="inline-block px-1.5 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-[9px] mb-0.5">
                                                    {sess.id}
                                                </div>
                                                <div className="text-[8px] sm:text-[8.5px] text-slate-500 font-normal font-mono whitespace-nowrap">
                                                    {sess.start}–{sess.end}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-200">
                                    {DAYS_OF_WEEK.map((day) => {
                                        const slots = safeTimetable[day] || [];
                                        const isToday = todayDayName === day;

                                        return (
                                            <tr key={day} className={`hover:bg-slate-50/70 transition-colors ${isToday ? 'bg-indigo-50/30' : ''}`}>
                                                <td className={`sticky left-0 p-1.5 sm:p-2 border-r border-slate-200 font-bold z-10 ${
                                                    isToday ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-50 text-slate-800'
                                                }`}>
                                                    <span className="block text-[10px] font-black uppercase">{day.slice(0, 3)}</span>
                                                    {isToday && <span className="text-[7.5px] font-black text-indigo-600 block mt-0.5">TODAY</span>}
                                                </td>

                                                {activeSessions.map((sess) => {
                                                    const classItem = slots.find(s => {
                                                        if (s.period === sess.slot || s.slotId === sess.id) return true;
                                                        const startP = s.periodStart || s.period;
                                                        const endP = s.periodEnd || (s.period && s.span ? s.period + s.span - 1 : s.period);
                                                        if (startP && endP && sess.slot >= startP && sess.slot <= endP) return true;
                                                        return false;
                                                    });
                                                    if (!classItem) {
                                                        return (
                                                            <td key={sess.id} className="p-1 sm:p-1.5 border-r border-slate-200 text-slate-300 font-mono text-center text-[10px]">
                                                                —
                                                            </td>
                                                        );
                                                    }

                                                    const isLab = (classItem.component || classItem.type || '').toLowerCase().includes('pract') || classItem.code.endsWith('-P');
                                                    const isSkill = (classItem.component || classItem.type || '').toLowerCase().includes('skill') || classItem.code.endsWith('-S');
                                                    const isTut = (classItem.component || classItem.type || '').toLowerCase().includes('tut') || classItem.code.endsWith('-T');

                                                    const displayTitle = displayMode === 'codes' ? classItem.code : getSlotDisplayTitle(classItem);

                                                    return (
                                                        <td
                                                            key={sess.id}
                                                            className={`p-1 sm:p-1.5 border-r border-slate-200 align-middle ${
                                                                isLab ? 'bg-emerald-50/85 text-emerald-950'
                                                                : isSkill ? 'bg-purple-50/85 text-purple-950'
                                                                : isTut ? 'bg-amber-50/85 text-amber-950'
                                                                : 'bg-blue-50/85 text-blue-950'
                                                            }`}
                                                        >
                                                            <div className="space-y-0.5">
                                                                <div
                                                                    className="font-bold text-[9px] sm:text-[9.5px] leading-tight text-slate-900 line-clamp-2 overflow-hidden"
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
                                                                <div className="text-[8px] sm:text-[8.5px] text-slate-600 font-medium leading-none truncate mt-0.5">
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
                )}
            </div>
        </>
    )}

            {/* ── Compare Schedules Modal ("Where's Maddy?") ── */}
            <AnimatePresence>
                {showCompareModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0e0e11] text-white rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl border border-[#2a2a31] max-h-[90vh] overflow-y-auto space-y-5"
                        >
                            <div className="flex items-center justify-between border-b border-[#222228] pb-4">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                                        <ArrowLeftRight className="w-5 h-5 text-purple-400" />
                                        <span>Compare Schedules 👥</span>
                                    </h3>
                                    <p className="text-xs text-[#8b8b95] mt-0.5">
                                        Compare period-by-period class schedules to find common free hours and shared classrooms.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCompareModal(false)}
                                    className="p-1.5 rounded-full text-slate-400 hover:text-white bg-[#17171b] hover:bg-[#202026] cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Selectors Bar: Day, Left Student, Right Student */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131316] p-3.5 rounded-2xl border border-[#2a2a31]">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-[#8b8b95] block mb-1">Select Day</label>
                                    <select
                                        value={compareDay}
                                        onChange={(e) => setCompareDay(e.target.value)}
                                        className="w-full bg-[#17171b] text-white text-xs font-bold p-2.5 rounded-xl border border-[#2a2a31] outline-none"
                                    >
                                        {DAYS_OF_WEEK.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-[#8b8b95] block mb-1">Left Profile</label>
                                    <select
                                        value={compareLeftId}
                                        onChange={(e) => setCompareLeftId(e.target.value)}
                                        className="w-full bg-[#17171b] text-white text-xs font-bold p-2.5 rounded-xl border border-[#2a2a31] outline-none"
                                    >
                                        <option value={primaryMyId}>{primaryMyName} ({primaryMyId})</option>
                                        {filteredFriends.map(f => (
                                            <option key={f.id || f.studentId} value={f.studentId || f.username}>{f.nickname || f.name} ({f.studentId})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-[#8b8b95] block mb-1">Right Profile (Buddy)</label>
                                    <select
                                        value={compareRightId}
                                        onChange={(e) => setCompareRightId(e.target.value)}
                                        className="w-full bg-[#17171b] text-white text-xs font-bold p-2.5 rounded-xl border border-[#2a2a31] outline-none"
                                    >
                                        {filteredFriends.map(f => (
                                            <option key={f.id || f.studentId} value={f.studentId || f.username}>{f.nickname || f.name} ({f.studentId})</option>
                                        ))}
                                        <option value={primaryMyId}>{primaryMyName} ({primaryMyId})</option>
                                    </select>
                                </div>
                            </div>

                            {/* Comparison Rows */}
                            <div className="space-y-2">
                                {KLU_SESSIONS.map((sess) => {
                                    const leftSlot = (leftCompareTimetable[compareDay] || []).find(s => {
                                        if (s.period === sess.slot || s.slotId === sess.id) return true;
                                        const startP = s.periodStart || s.period;
                                        const endP = s.periodEnd || (s.period && s.span ? s.period + s.span - 1 : s.period);
                                        if (startP && endP && sess.slot >= startP && sess.slot <= endP) return true;
                                        return false;
                                    });
                                    const rightSlot = (rightCompareTimetable[compareDay] || []).find(s => {
                                        if (s.period === sess.slot || s.slotId === sess.id) return true;
                                        const startP = s.periodStart || s.period;
                                        const endP = s.periodEnd || (s.period && s.span ? s.period + s.span - 1 : s.period);
                                        if (startP && endP && sess.slot >= startP && sess.slot <= endP) return true;
                                        return false;
                                    });

                                    const isBothFree = !leftSlot && !rightSlot;
                                    const isSameClass = leftSlot && rightSlot && (leftSlot.code === rightSlot.code || leftSlot.rawCode === rightSlot.rawCode);

                                    return (
                                        <div
                                            key={sess.id}
                                            className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
                                                isBothFree
                                                    ? 'bg-emerald-950/20 border-emerald-500/30'
                                                    : isSameClass
                                                    ? 'bg-purple-950/25 border-purple-500/40'
                                                    : 'bg-[#131316] border-[#2a2a31]'
                                            }`}
                                        >
                                            {/* Time info */}
                                            <div className="sm:w-28 text-left">
                                                <span className="text-[11px] font-bold text-[#cfff04]">{sess.id}</span>
                                                <div className="text-[10px] text-[#8b8b95]">{sess.start}–{sess.end}</div>
                                            </div>

                                            {/* Left Student Slot */}
                                            <div className="flex-1 p-2 rounded-xl bg-[#17171b] border border-[#222228] text-xs">
                                                {leftSlot ? (
                                                    <div>
                                                        <span className="font-bold text-white">{leftSlot.code}</span>
                                                        <span className="text-[10px] text-amber-300 ml-2">Rm {cleanRoomNumber(leftSlot.room) || '—'}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 italic">Free Period</span>
                                                )}
                                            </div>

                                            {/* Comparison Status Badge */}
                                            <div className="text-center px-2">
                                                {isBothFree ? (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                        🎉 Both Free!
                                                    </span>
                                                ) : isSameClass ? (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                        👥 Same Class
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500">vs</span>
                                                )}
                                            </div>

                                            {/* Right Student Slot */}
                                            <div className="flex-1 p-2 rounded-xl bg-[#17171b] border border-[#222228] text-xs">
                                                {rightSlot ? (
                                                    <div>
                                                        <span className="font-bold text-white">{rightSlot.code}</span>
                                                        <span className="text-[10px] text-amber-300 ml-2">Rm {cleanRoomNumber(rightSlot.room) || '—'}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 italic">Free Period</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Custom Subject Aliases Modal ── */}
            <AnimatePresence>
                {showAliasesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 relative space-y-4 max-h-[85vh] overflow-y-auto"
                        >
                            <button
                                type="button"
                                onClick={() => setShowAliasesModal(false)}
                                className="absolute top-5 right-5 p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Tag className="w-5 h-5 text-amber-600" />
                                    <span>Custom Subject Aliases</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Replace lengthy course codes with short easy-to-read nicknames (e.g., DSA, OS, DBMS, AI, Math).
                                </p>
                            </div>

                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                {uniqueCourseCodes.map((code) => {
                                    return (
                                        <div key={code} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="w-32 text-xs font-mono font-bold text-slate-800 shrink-0">
                                                {code}
                                            </span>
                                            <input
                                                type="text"
                                                maxLength={10}
                                                placeholder="e.g. DSA"
                                                value={aliasEditMap[code] || ''}
                                                onChange={(e) => setAliasEditMap(prev => ({ ...prev, [code]: e.target.value }))}
                                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAliasesModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveAliases}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer shadow-xs"
                                >
                                    Save Aliases
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Share / Import Timetable Modal ── */}
            <AnimatePresence>
                {showShareModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 relative space-y-4"
                        >
                            <button
                                type="button"
                                onClick={() => setShowShareModal(false)}
                                className="absolute top-5 right-5 p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <button
                                    type="button"
                                    onClick={() => setShareTab('share')}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        shareTab === 'share' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Share My Schedule
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShareTab('import')}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        shareTab === 'import' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Import Buddy&apos;s Schedule
                                </button>
                            </div>

                            {shareTab === 'share' ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-600">
                                        Send your schedule to your friends without ever sharing your password!
                                    </p>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                        <div className="text-[11px] font-bold text-slate-700">Quick WhatsApp Message:</div>
                                        <button
                                            type="button"
                                            onClick={handleCopySchedule}
                                            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{copySuccess ? 'Copied WhatsApp Text!' : 'Copy Formatted Text'}</span>
                                        </button>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                        <div className="text-[11px] font-bold text-slate-700">Export JSON Code (For Direct Import):</div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const json = JSON.stringify({ studentId: effectiveId, name: effectiveName, timetable }, null, 2);
                                                navigator.clipboard.writeText(json);
                                                setCopySuccess(true);
                                                setTimeout(() => setCopySuccess(false), 2000);
                                            }}
                                            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{copySuccess ? 'Copied Timetable JSON!' : 'Copy Export JSON'}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-600">
                                        Paste your buddy&apos;s timetable JSON to save them into your timetable switcher. Zero ERP passwords required.
                                    </p>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Friend&apos;s Student ID</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 2400030123"
                                            value={importFriendId}
                                            onChange={(e) => setImportFriendId(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Friend&apos;s Name / Nickname</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Rahul"
                                            value={importFriendName}
                                            onChange={(e) => setImportFriendName(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Timetable JSON</label>
                                        <textarea
                                            rows={4}
                                            placeholder="Paste the exported JSON code here..."
                                            value={importJsonInput}
                                            onChange={(e) => setImportJsonInput(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                                        />
                                    </div>
                                    {importFeedback && (
                                        <p className={`text-xs font-bold ${importFeedback.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {importFeedback}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleImportFriendSchedule}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                                    >
                                        Save Friend Schedule
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── HTML Import Modal ── */}
            <AnimatePresence>
                {showImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
                        >
                            <h3 className="text-lg font-bold text-slate-900">Import Timetable from ERP HTML</h3>
                            <p className="text-xs text-slate-500">
                                Paste the raw HTML copied from your ERP timetable page. It will automatically be parsed into your schedule.
                            </p>
                            <textarea
                                value={importHtmlInput}
                                onChange={(e) => setImportHtmlInput(e.target.value)}
                                rows={6}
                                placeholder="Paste <table>...</table> HTML from ERP here"
                                className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            />
                            {importError && (
                                <p className="text-xs text-red-600 font-semibold">{importError}</p>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportError('');
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleImportHtml}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                >
                                    Parse & Save
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Semester Switcher Modal for Timetable ── */}
            <AnimatePresence>
                {showSemModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-slate-900 transform-gpu"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-5 h-5 text-indigo-600" />
                                    <h3 className="text-lg font-black text-slate-900">Select Academic Semester</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSemModal(false)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-xs text-slate-500 font-medium">
                                Choose academic session for <strong className="text-slate-800">{effectiveName} ({effectiveId})</strong>
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                                        Academic Year
                                    </label>
                                    <select
                                        value={tempYear}
                                        onChange={(e) => setTempYear(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        {availableYearsList.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                                        Semester
                                    </label>
                                    <select
                                        value={tempSem}
                                        onChange={(e) => setTempSem(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        {availableSemsList.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowSemModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplySemester(tempYear, tempSem)}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                                >
                                    Apply Schedule
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Quick Friend / Student ERP Captcha Verification Modal */}
            <FriendCaptchaModal
                friend={captchaModalTarget}
                isOpen={Boolean(captchaModalTarget)}
                onClose={() => setCaptchaModalTarget(null)}
                onSuccess={async (friend) => {
                    setCaptchaModalTarget(null);
                    setIsRefreshing(true);
                    try {
                        const targetId = friend.studentId || friend.username || friend.id;
                        await fetchLiveErpTimetable(targetId, currentYear, currentSem);
                        if (onRefreshErp) {
                            await onRefreshErp(currentYear, currentSem);
                        }
                        const fresh = getStudentTimetable(targetId, [], currentYear, currentSem);
                        setTimetable(fresh);
                    } catch {
                        // ignore
                    } finally {
                        setIsRefreshing(false);
                    }
                }}
            />
        </div>
    );
}
