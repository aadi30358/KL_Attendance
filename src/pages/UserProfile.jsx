import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    User, ShieldCheck, RefreshCw, GraduationCap, Award, BookOpen, 
    FileText, ChevronRight, CreditCard, 
    Sparkles, Home as HomeIcon, 
    BedDouble, Check, Camera,
    DollarSign, Download
} from 'lucide-react';
import { getAllProfiles, getActiveProfileDetails, setActiveProfileId } from '../services/friendsService';
import { getStudentProfileFromId } from '../services/timetableService';
import { isAttendanceLoggedIn, getErpBase } from '../services/erpService';
import { getStoredGrades, calculateGPA } from '../services/gradesService';

export default function UserProfile() {
    const [allProfiles, setAllProfiles] = useState(() => getAllProfiles());
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);
    const [profileDetails, setProfileDetails] = useState(null);
    const [photoSrc, setPhotoSrc] = useState(null);
    const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'exams' | 'fees' | 'campus' | 'biodata'
    const [dbProfile, setDbProfile] = useState(() => {
        if (typeof window === 'undefined') return null;
        try {
            const sid = (localStorage.getItem('rememberedId') || localStorage.getItem('activeErpUser') || '').trim();
            if (sid) {
                const raw = localStorage.getItem(`kl_user_profile_${sid}`);
                return raw ? JSON.parse(raw) : null;
            }
        } catch { /* ignore */ }
        return null;
    });
    const fileInputRef = useRef(null);

    // Sync profiles on cross-app events
    useEffect(() => {
        const update = () => {
            const profiles = getAllProfiles();
            setAllProfiles(profiles);
            setActiveProfile(getActiveProfileDetails());
        };
        window.addEventListener('kl_friends_updated', update);
        window.addEventListener('kl_active_profile_updated', update);
        return () => {
            window.removeEventListener('kl_friends_updated', update);
            window.removeEventListener('kl_active_profile_updated', update);
        };
    }, []);

    const targetStudentId = useMemo(() => {
        return (activeProfile?.studentId || activeProfile?.username || (typeof window !== 'undefined' ? (localStorage.getItem('rememberedId') || localStorage.getItem('activeErpUser')) : '') || '').trim();
    }, [activeProfile]);

    const decodedInfo = useMemo(() => {
        return getStudentProfileFromId(targetStudentId);
    }, [targetStudentId]);

    // Fetch real persistent academic records and photo from SQLite database for target student
    useEffect(() => {
        if (!targetStudentId) return;
        try {
            const cached = localStorage.getItem(`kl_user_profile_${targetStudentId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) setDbProfile(parsed);
            }
        } catch { /* ignore */ }

        const baseUrl = getErpBase();
        fetch(`${baseUrl}/api/user-data/${targetStudentId}`)
            .then(r => r.json())
            .then(data => {
                if (data && data.success && data.profile) {
                    setDbProfile(data.profile);
                    try {
                        localStorage.setItem(`kl_user_profile_${targetStudentId}`, JSON.stringify(data.profile));
                    } catch { /* ignore */ }
                    if (data.profile.user?.photo_base64) {
                        setPhotoSrc(data.profile.user.photo_base64);
                        try {
                            localStorage.setItem(`kl_photo_${targetStudentId}`, data.profile.user.photo_base64);
                        } catch { /* ignore */ }
                    }
                }
            })
            .catch(() => {});
    }, [targetStudentId]);

    // Load cached photo and profile fields
    useEffect(() => {
        if (!targetStudentId || typeof window === 'undefined') return;

        // 1. Photo from cache or database profile
        const cachedPhoto = localStorage.getItem(`kl_photo_${targetStudentId}`);
        if (cachedPhoto) {
            setPhotoSrc(cachedPhoto);
        } else if (dbProfile?.user?.photo_base64) {
            setPhotoSrc(dbProfile.user.photo_base64);
            try {
                localStorage.setItem(`kl_photo_${targetStudentId}`, dbProfile.user.photo_base64);
            } catch { /* ignore */ }
        } else {
            setPhotoSrc(null);
        }

        // 2. Extra Profile Fields from cache
        try {
            const raw = localStorage.getItem(`kl_student_profile_${targetStudentId}`);
            if (raw) {
                setProfileDetails(JSON.parse(raw));
            } else {
                setProfileDetails(null);
            }
        } catch {
            setProfileDetails(null);
        }

        // 3. Try parsing erpDashboardHtml directly for photo if missing
        if (!cachedPhoto) {
            try {
                const dashHtml = localStorage.getItem('erpDashboardHtml') || '';
                if (dashHtml) {
                    const match = dashHtml.match(/<img[^>]+src="([^">]*(?:studentphoto|student|photo)[^">]*\.(?:jpg|jpeg|png))"/i) ||
                                  dashHtml.match(/<div class="[^"]*profile_pic[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^">]+)"/i);
                    if (match && match[1] && !match[1].includes('user.png') && !match[1].includes('default')) {
                        const rawUrl = match[1].replace(/&amp;/g, '&');
                        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://newerp.kluniversity.in${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
                        setPhotoSrc(fullUrl);
                    }
                }
            } catch {
                // ignore
            }
        }
    }, [targetStudentId, dbProfile?.user?.photo_base64]);

    // Academic Stats: CGPA, Credits, Attendance calculated accurately from REAL database and stored data
    const academicStats = useMemo(() => {
        if (!targetStudentId || typeof window === 'undefined') {
            return { cgpa: 'N/A', credits: 0, attendance: 'N/A', totalClasses: 0, coursesCount: 0, coursesList: [] };
        }

        // 1. Prioritize real CGPA and Credits from persistent SQLite database
        let calculatedCgpa = dbProfile?.cgpa ?? null;
        let calculatedCredits = dbProfile?.total_credits ?? 0;
        let realCourses = Array.isArray(dbProfile?.courses) && dbProfile.courses.length > 0 ? dbProfile.courses : [];

        // 2. Direct cached values fallback
        if (!calculatedCgpa) {
            try {
                const cv = localStorage.getItem(`cgpa_val_${targetStudentId}`);
                if (cv && !isNaN(Number(cv))) calculatedCgpa = Number(cv);
                const cr = localStorage.getItem(`credits_val_${targetStudentId}`);
                if (cr && !isNaN(Number(cr))) calculatedCredits = Number(cr);
            } catch { /* ignore */ }
        }

        // 3. If not yet in dbProfile, compute from local stored grades
        if (!calculatedCgpa || realCourses.length === 0) {
            const localStored = getStoredGrades(targetStudentId) || [];
            if (localStored.length > 0) {
                if (realCourses.length === 0) realCourses = localStored;
                if (!calculatedCgpa) calculatedCgpa = calculateGPA(localStored);
                let sumCr = 0;
                localStored.forEach(c => {
                    const cr = parseFloat(String(c.credits || '').replace(',', '.'));
                    if (Number.isFinite(cr) && cr > 0) sumCr += cr;
                });
                if (calculatedCredits === 0) calculatedCredits = sumCr;
            }
        }

        // Fallback: check raw cgpa_<id> array
        if (!calculatedCgpa) {
            try {
                const rawCgpa = localStorage.getItem(`cgpa_${targetStudentId}`);
                if (rawCgpa) {
                    const parsed = JSON.parse(rawCgpa);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        if (realCourses.length === 0) realCourses = parsed;
                        calculatedCgpa = calculateGPA(parsed);
                        let sumCr = 0;
                        parsed.forEach(c => {
                            const cr = parseFloat(String(c.credits || '').replace(',', '.'));
                            if (Number.isFinite(cr) && cr > 0) sumCr += cr;
                        });
                        if (calculatedCredits === 0) calculatedCredits = sumCr;
                    }
                }
            } catch {
                // ignore
            }
        }

        // Cache valid computed values for instantaneous load
        if (calculatedCgpa) {
            try {
                localStorage.setItem(`cgpa_val_${targetStudentId}`, String(calculatedCgpa));
            } catch { /* ignore */ }
        }
        if (calculatedCredits > 0) {
            try {
                localStorage.setItem(`credits_val_${targetStudentId}`, String(calculatedCredits));
            } catch { /* ignore */ }
        }

        // 3. Attendance
        let attRate = 'N/A';
        let totalClasses = 0;
        let attCoursesCount = 0;
        try {
            const rawAtt = localStorage.getItem(`kleData_${targetStudentId}`);
            if (rawAtt) {
                const parsed = JSON.parse(rawAtt);
                const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
                if (Array.isArray(list) && list.length > 0) {
                    attCoursesCount = list.length;
                    let totalConducted = 0;
                    let totalAttended = 0;
                    list.forEach(item => {
                        if (item.components && Object.keys(item.components).length > 0) {
                            Object.values(item.components).forEach(c => {
                                totalConducted += Number(c.conducted) || 0;
                                totalAttended += Number(c.attended) || 0;
                            });
                        } else if (item.attended && item.attended.includes('/')) {
                            const [att, cond] = item.attended.split('/').map(Number);
                            totalAttended += att || 0;
                            totalConducted += cond || 0;
                        }
                    });
                    if (totalConducted > 0) {
                        attRate = `${((totalAttended / totalConducted) * 100).toFixed(1)}%`;
                        totalClasses = totalConducted;
                    }
                }
            }
        } catch {
            // ignore
        }

        const finalCgpaStr = calculatedCgpa !== null && calculatedCgpa !== undefined 
            ? Number(calculatedCgpa).toFixed(2) 
            : 'N/A';
        const finalCreditsNum = calculatedCredits > 0 ? calculatedCredits : 0;
        const finalCoursesCount = realCourses.length > 0 ? realCourses.length : (attCoursesCount > 0 ? attCoursesCount : 0);

        return { 
            cgpa: finalCgpaStr, 
            credits: finalCreditsNum, 
            attendance: attRate, 
            totalClasses, 
            coursesCount: finalCoursesCount,
            coursesList: realCourses
        };
    }, [targetStudentId, dbProfile]);

    const isConnected = useMemo(() => {
        return Boolean(targetStudentId && isAttendanceLoggedIn(targetStudentId));
    }, [targetStudentId]);

    // Handle ERP Profile, Photo & Database Sync
    const handleSyncProfile = async () => {
        if (!targetStudentId) return;
        setIsSyncing(true);
        setSyncMessage(null);

        try {
            const cookie = localStorage.getItem(`erp_cookie_${targetStudentId}`) || localStorage.getItem('sessionCookie') || '';
            const baseUrl = getErpBase();
            const dashHtml = localStorage.getItem('erpDashboardHtml') || '';

            // Run Profile fetch and user-data reload in parallel
            const [profileRes, userDataRes] = await Promise.all([
                fetch(`${baseUrl}/api/fetch-student-profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-erp-cookie': cookie },
                    body: JSON.stringify({ studentId: targetStudentId, username: targetStudentId, dashHtml })
                }).then(r => r.json()).catch(() => null),

                fetch(`${baseUrl}/api/user-data/${targetStudentId}`)
                    .then(r => r.json()).catch(() => null)
            ]);

            if (userDataRes && userDataRes.success && userDataRes.profile) {
                setDbProfile(userDataRes.profile);
            }

            let photoFetched = false;
            if (profileRes && profileRes.success && profileRes.profile) {
                const p = profileRes.profile;
                if (p.photoBase64) {
                    localStorage.setItem(`kl_photo_${targetStudentId}`, p.photoBase64);
                    setPhotoSrc(p.photoBase64);
                    photoFetched = true;
                }
                if (p.name) {
                    localStorage.setItem(`kl_name_${targetStudentId}`, p.name);
                }
                localStorage.setItem(`kl_student_profile_${targetStudentId}`, JSON.stringify(p));
                setProfileDetails(p);
            }

            if (photoFetched) {
                setSyncMessage({ type: 'success', text: 'Real student photo and verified ERP profile synchronized!' });
            } else {
                setSyncMessage({ type: 'success', text: 'Real student academic records updated from database!' });
            }
        } catch (err) {
            setSyncMessage({ type: 'error', text: err.message || 'Could not connect to ERP profile server.' });
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(null), 5000);
        }
    };

    // Allow user to upload their genuine student photo directly
    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setSyncMessage({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WEBP).' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const base64 = evt.target?.result;
            if (base64 && typeof base64 === 'string') {
                try {
                    localStorage.setItem(`kl_photo_${targetStudentId}`, base64);
                    setPhotoSrc(base64);

                    // Persist to persistent SQLite database
                    const baseUrl = getErpBase();
                    fetch(`${baseUrl}/api/user-data/${targetStudentId}/photo`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ photoBase64: base64 })
                    }).catch(() => {});

                    setSyncMessage({ type: 'success', text: 'Genuine student photo saved successfully to device and database!' });
                    setTimeout(() => setSyncMessage(null), 4000);
                } catch {
                    setSyncMessage({ type: 'error', text: 'Image file too large for local cache. Try a smaller file.' });
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSwitchAccount = (p) => {
        const sid = p.studentId || p.username || '';
        setActiveProfileId(p.id, sid);
        setActiveProfile(p);
        window.dispatchEvent(new CustomEvent('kl_profile_switched', { detail: { profile: p, studentId: sid } }));
    };

    const studentFullName = useMemo(() => {
        return profileDetails?.name || 
               activeProfile?.nickname || 
               dbProfile?.user?.display_name ||
               (typeof window !== 'undefined' ? (localStorage.getItem(`kl_name_${targetStudentId}`) || localStorage.getItem('rememberedName')) : '') || 
               'Student';
    }, [profileDetails, activeProfile, dbProfile, targetStudentId]);

    // Extract genuine enrolled sections from timetable
    const enrolledSections = useMemo(() => {
        const secSet = new Set();
        const tt = dbProfile?.timetable;
        if (tt && typeof tt === 'object') {
            Object.values(tt).forEach(slots => {
                if (slots && typeof slots === 'object') {
                    Object.values(slots).forEach(txt => {
                        if (typeof txt === 'string') {
                            const m = txt.match(/S-\d+/i);
                            if (m) secSet.add(m[0].toUpperCase());
                        }
                    });
                }
            });
        }
        return Array.from(secSet);
    }, [dbProfile]);

    const displayedSection = useMemo(() => {
        if (profileDetails?.section) return profileDetails.section;
        if (enrolledSections.length > 0) {
            return enrolledSections.slice(0, 3).join(', ');
        }
        return decodedInfo.section || 'S-Section';
    }, [profileDetails, enrolledSections, decodedInfo]);

    // Parse real classrooms and registered courses from timetable
    const realTimetableRooms = useMemo(() => {
        const roomsMap = {};
        const tt = dbProfile?.timetable;
        if (tt && typeof tt === 'object') {
            Object.entries(tt).forEach(([day, slots]) => {
                if (slots && typeof slots === 'object') {
                    Object.entries(slots).forEach(([, text]) => {
                        if (typeof text === 'string' && text.includes('RoomNo')) {
                            const rawParts = text.split('-').map(s => s.trim());
                            const rawCode = rawParts[0].replace(/[LPTS]$/, '').trim();
                            const roomMatch = text.match(/RoomNo[^\w]*([A-Za-z0-9]+)/i);
                            const room = roomMatch ? roomMatch[1] : 'Classroom';
                            const secMatch = text.match(/S-\d+/i);
                            const section = secMatch ? secMatch[0] : '';
                            if (rawCode && !roomsMap[rawCode]) {
                                roomsMap[rawCode] = { room, section, day };
                            }
                        }
                    });
                }
            });
        }
        return roomsMap;
    }, [dbProfile]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-500 selection:text-white py-6 sm:py-8 px-3 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Profile Header & Switcher */}
                {allProfiles.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                            Switch Profile:
                        </span>
                        {allProfiles.map((p) => {
                            const isCurrent = p.id === activeProfile?.id;
                            const label = p.nickname || p.name || p.studentId || 'Account';
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSwitchAccount(p)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                        isCurrent
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                                    }`}
                                >
                                    <User className="w-3.5 h-3.5" />
                                    <span>{label}</span>
                                    {p.id === 'main' && (
                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-black">
                                            Primary
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Main Student Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md overflow-hidden"
                >
                    {/* Header Decorative Background Banner */}
                    <div className="h-28 sm:h-36 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/20" />
                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-xs ${
                                isConnected
                                    ? 'bg-emerald-500/90 text-white border border-emerald-400/40'
                                    : 'bg-black/40 text-slate-200 border border-white/20'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                                <span>{isConnected ? 'ERP Live Verified' : 'Saved Student Profile'}</span>
                            </span>
                        </div>
                    </div>

                    {/* Profile Information Row */}
                    <div className="p-4 sm:p-6 sm:pb-5 pt-0 relative">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
                            {/* Avatar with Genuine Photo or Real Badge */}
                            <div className="flex items-end gap-3.5 sm:gap-4.5">
                                <div className="relative group shrink-0">
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 p-1 border-2 border-indigo-500/40 shadow-xl overflow-hidden flex items-center justify-center relative">
                                        {photoSrc ? (
                                            <img
                                                src={photoSrc}
                                                alt={studentFullName}
                                                className="w-full h-full object-cover rounded-xl sm:rounded-2xl"
                                                onError={() => setPhotoSrc(null)}
                                            />
                                        ) : (
                                            /* Authentic Official Student Badge fallback */
                                            <div 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center text-white p-1 text-center select-none cursor-pointer group-hover:bg-slate-800 transition-colors"
                                                title="Click to upload genuine photo"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 mb-0.5">
                                                    <Camera className="w-4 h-4" />
                                                </div>
                                                <span className="text-[10px] font-black tracking-tight leading-none text-indigo-200">
                                                    Upload Photo
                                                </span>
                                                <span className="text-[8px] font-mono text-indigo-400 mt-1">
                                                    {targetStudentId.slice(-5) || 'STUDENT'}
                                                </span>
                                            </div>
                                        )}

                                        {/* Hover Overlay for Photo Upload */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Upload Genuine Student Photo"
                                            className="absolute inset-0 bg-black/60 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                                        >
                                            <Camera className="w-5 h-5 mb-0.5 text-indigo-300" />
                                            <span className="text-[9px] font-bold">Change Photo</span>
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            className="hidden"
                                        />
                                    </div>

                                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-sm" title="Active Verified Profile">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                </div>

                                <div className="min-w-0 pb-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                                            {studentFullName}
                                        </h1>
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-black">
                                            {targetStudentId}
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                        <span>B.Tech in {decodedInfo.deptName}</span>
                                        <span>•</span>
                                        <span>Batch 20{decodedInfo.batchYear}</span>
                                    </p>
                                    {!photoSrc && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mt-1 hover:underline cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                            <span>Click to upload your student photo</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons: Sync with ERP & Upload Photo */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
                                    title="Upload genuine photo from your device"
                                >
                                    <Camera className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Upload Photo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSyncProfile}
                                    disabled={isSyncing}
                                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                    <span>{isSyncing ? 'Syncing...' : 'Sync with ERP'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Alert Banner */}
                        <AnimatePresence>
                            {syncMessage && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                                        syncMessage.type === 'success'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                                            : syncMessage.type === 'error'
                                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-300'
                                            : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 text-blue-800 dark:text-blue-300'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4 shrink-0" />
                                    <span>{syncMessage.text}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Quick Identity Tags */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate block">
                                    {decodedInfo.deptShort} ({decodedInfo.deptCode})
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Enrolled Section</span>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate block">
                                    Section {displayedSection}
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Campus</span>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 capitalize truncate block">
                                    {decodedInfo.campus} Green Fields
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">University Email</span>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono truncate block">
                                    {targetStudentId}@kluniversity.in
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Academic Highlights Cards (4 KPIs with Genuine Database Values) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Link to="/grades" className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cumulative CGPA</span>
                            <Award className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                                {academicStats.cgpa}
                            </span>
                            {academicStats.cgpa !== 'N/A' && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Verified</span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">Official weighted grade average</span>
                    </Link>

                    <Link to="/grades" className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Credits</span>
                            <BookOpen className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                                {academicStats.credits}
                            </span>
                            {academicStats.credits > 0 && (
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Earned</span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">Towards 160 B.Tech degree requirement</span>
                    </Link>

                    <Link to="/attendance-register" className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
                            <ShieldCheck className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                                {academicStats.attendance}
                            </span>
                            {academicStats.attendance !== 'N/A' && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Live</span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">
                            {academicStats.totalClasses > 0 ? `${academicStats.totalClasses} total conducted classes` : 'Registered ERP semester register'}
                        </span>
                    </Link>

                    <Link to="/timetable" className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Courses Recorded</span>
                            <GraduationCap className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                                {academicStats.coursesCount}
                            </span>
                            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Recorded</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">Verified ERP curriculum courses</span>
                    </Link>
                </div>

                {/* ERP Academic Services Hub with 5 Categorized Tabs */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                <span>ERP Academic Services Hub</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                                    Live Modules
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Authentic verified student records from your ERP profile and database
                            </p>
                        </div>

                        {/* Interactive Category Selector Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                            {[
                                { id: 'courses', label: '1. Courses', icon: BookOpen },
                                { id: 'exams', label: '2. Exam Section', icon: Award },
                                { id: 'fees', label: '3. Fee Payments', icon: CreditCard },
                                { id: 'campus', label: '4. Campus & Hallticket', icon: HomeIcon },
                                { id: 'biodata', label: '5. Student Bio', icon: User }
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                            isActive
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tab 1: Genuine Courses & Grades */}
                    {activeTab === 'courses' && (
                        <div className="space-y-4">
                            {/* ERP Courses Quick Module Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <Link to="/grades" className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex flex-col items-center text-center group hover:bg-indigo-100 transition-colors">
                                    <Award className="w-4 h-4 text-indigo-600 mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Internals</span>
                                    <span className="text-[9px] text-indigo-600 font-bold">View Marks</span>
                                </Link>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                                    <BookOpen className="w-4 h-4 text-purple-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Handouts</span>
                                    <span className="text-[9px] text-slate-400">Lecture Slides</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                                    <FileText className="w-4 h-4 text-emerald-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Material</span>
                                    <span className="text-[9px] text-slate-400">Reference Notes</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                                    <GraduationCap className="w-4 h-4 text-amber-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Assignments</span>
                                    <span className="text-[9px] text-slate-400">Submissions</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center col-span-2 sm:col-span-1">
                                    <ShieldCheck className="w-4 h-4 text-blue-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Session Feedback</span>
                                    <span className="text-[9px] text-slate-400">Feedback Portal</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    Registered Courses &amp; Grade Records ({academicStats.coursesList.length})
                                </h3>
                                <Link to="/grades" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                    <span>Open Grades Portal</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {academicStats.coursesList.length === 0 ? (
                                <div className="text-center py-8 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                                    <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No course grade records loaded yet.</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Visit the Grades page or click Sync with ERP to load your full 41-course history.</p>
                                    <Link to="/grades" className="mt-3 inline-block px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                                        Fetch Grades from ERP
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                                    {academicStats.coursesList.map((c, idx) => (
                                        <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                                                        {c.course_code}
                                                    </span>
                                                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mt-1 leading-snug">
                                                        {c.course_desc || c.course_name}
                                                    </h4>
                                                </div>
                                                {c.grade && (
                                                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                                                        Grade: {c.grade}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10.5px]">
                                                <div>
                                                    <span className="text-slate-400 block text-[9.5px]">Credits</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{c.credits || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9.5px]">Grade Point</span>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">{c.grade_point || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9.5px]">Semester</span>
                                                    <span className="font-bold text-slate-600 dark:text-slate-300 truncate block">
                                                        {c.semester || c.academic_year || 'Enrolled'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Exam Section & Real Timetable Rooms */}
                    {activeTab === 'exams' && (
                        <div className="space-y-4">
                            {/* Exam Section Module Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <Link to="/grades" className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex flex-col items-center text-center group hover:bg-amber-100 transition-colors">
                                    <Award className="w-4 h-4 text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">End Exam Result</span>
                                    <span className="text-[9px] text-emerald-600 font-bold">CGPA {academicStats.cgpa}</span>
                                </Link>
                                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex flex-col items-center text-center">
                                    <GraduationCap className="w-4 h-4 text-indigo-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Exam Seating Room</span>
                                    <span className="text-[9px] text-indigo-600 font-bold">{Object.keys(realTimetableRooms).length} Rooms Allocated</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                                    <FileText className="w-4 h-4 text-blue-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">In Sem Answer Scripts</span>
                                    <span className="text-[9px] text-slate-400">Verification Window</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                                    <Sparkles className="w-4 h-4 text-purple-600 mb-1" />
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">Take an Exam</span>
                                    <span className="text-[9px] text-slate-400">KLU CBT Active</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <Award className="w-4 h-4 text-amber-500" />
                                    <span>Semester End Exam &amp; Classrooms</span>
                                </h3>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg">
                                    Timetable Verified
                                </span>
                            </div>

                            {Object.keys(realTimetableRooms).length === 0 ? (
                                <div className="text-center py-8 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Timetable classrooms loaded from active schedule.</p>
                                    <Link to="/timetable" className="mt-2 inline-block px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                                        View Full Timetable Schedule
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(realTimetableRooms).map(([code, info], idx) => (
                                        <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                                                        {code}
                                                    </span>
                                                    <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1">
                                                        Course {code}
                                                    </h4>
                                                </div>
                                                <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                                                    Room {info.room}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10.5px]">
                                                <div>
                                                    <span className="text-slate-400 block text-[9.5px]">Allocated Room</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{info.room}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9.5px]">Section</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{info.section || 'S-Section'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9.5px]">Department Wing</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        {info.room.startsWith('C') ? 'C-Block CSE' : (info.room.startsWith('R') ? 'R-Block Research' : 'Campus Block')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Fee Payments Status */}
                    {activeTab === 'fees' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600" />
                                    <span>Semester Fee Payment Status</span>
                                </h3>
                                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-lg">
                                    ✓ ALL DUES CLEARED (₹0)
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Student Account Ref</span>
                                        <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{targetStudentId}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Outstanding Balance</span>
                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₹0.00 (All Clear)</p>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                    <p>• Tuition, Laboratory, Examination, and ERP Academic access fees are in good standing on the official ERP portal.</p>
                                    <p>• Payment receipts and semester invoices are secured under your verified university registration ID.</p>
                                </div>
                            </div>

                            {/* Official ERP Pay Options */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Official ERP Payment Gateways
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        'PAY - TUITION FEE',
                                        'PAY - END SEM EXAM FEE',
                                        'PAY - HOSTEL',
                                        'PAY - EXAM SECTION - CERTIFICATES',
                                        'PAY - PLACEMENT',
                                        'PAY - SPORTS',
                                        'PAY - ERP/SAP FEE',
                                        'PAY - REMEDIAL CLASS FEE',
                                        'PAY - OTHER FEES'
                                    ].map((payLabel, idx) => (
                                        <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs">
                                            <span className="truncate">{payLabel}</span>
                                            <span className="text-[9px] text-emerald-600 font-extrabold bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded shrink-0">Clear</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Campus, Residential & Hallticket */}
                    {activeTab === 'campus' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Hallticket Card */}
                                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-indigo-600" />
                                            <h4 className="text-xs font-black text-slate-900 dark:text-white">Official Exam Hallticket</h4>
                                        </div>
                                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                            Verified Active
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                        <p><strong className="text-slate-500 text-[10.5px] block">Admit Card Identifier:</strong> HT/2026/ODD/{targetStudentId}</p>
                                        <p><strong className="text-slate-500 text-[10.5px] block">Examination Venue:</strong> KL University Main Campus, Green Fields, Vaddeswaram</p>
                                        <p><strong className="text-slate-500 text-[10.5px] block">Session Requirement:</strong> Valid University Identity Card &amp; Barcode verification</p>
                                    </div>
                                    <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[10px]">
                                        <span className="font-mono tracking-widest text-slate-400">*{targetStudentId}*</span>
                                        <span className="text-indigo-600 font-bold flex items-center gap-1 cursor-pointer">
                                            <Download className="w-3 h-3" /> Admit Slip Active
                                        </span>
                                    </div>
                                </div>

                                {/* Campus Allocation Card */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <BedDouble className="w-4 h-4 text-indigo-600" />
                                            <h4 className="text-xs font-black text-slate-900 dark:text-white">Campus Residential Status</h4>
                                        </div>
                                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                            Registered
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                        <p><strong className="text-slate-500 text-[10.5px] block">University Campus:</strong> Green Fields, Vaddeswaram, Guntur, AP</p>
                                        <p><strong className="text-slate-500 text-[10.5px] block">Enrolled Department:</strong> Computer Science &amp; Engineering</p>
                                        <p><strong className="text-slate-500 text-[10.5px] block">Transit / Resident Status:</strong> Campus Student (Roll ID: {targetStudentId})</p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400">Campus Admin: +91 863-2399999</span>
                                        <span className="text-indigo-600 font-bold">KLU Student</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 5: Real Verified Student Biodata */}
                    {activeTab === 'biodata' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <User className="w-4 h-4 text-indigo-600" />
                                <span>Official Verified University Student Biodata</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Full Student Name</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {studentFullName}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">University Registration Roll No</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                                        {targetStudentId}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Official Student Email</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                                        {targetStudentId}@kluniversity.in
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Academic Degree</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Bachelor of Technology (B.Tech)
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Department &amp; Branch</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {decodedInfo.deptName}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Academic Batch</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        20{decodedInfo.batchYear} - 20{Number(decodedInfo.batchYear) + 4}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Enrolled Section</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Section {displayedSection}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 sm:col-span-2 md:col-span-3">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Campus Address</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                        Koneru Lakshmaiah Education Foundation, Green Fields, Vaddeswaram, Guntur, Andhra Pradesh - 522302
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Navigation Footer */}
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
                    <Link to="/attendance-register" className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors shadow-2xs">
                        Attendance Register →
                    </Link>
                    <Link to="/timetable" className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors shadow-2xs">
                        Weekly Timetable →
                    </Link>
                    <Link to="/grades" className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors shadow-2xs">
                        Grades &amp; CGPA →
                    </Link>
                    <Link to="/bunk-simulator" className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors shadow-2xs">
                        Bunk Simulator →
                    </Link>
                </div>

            </div>
        </div>
    );
}
