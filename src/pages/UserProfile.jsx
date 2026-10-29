import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    User, ShieldCheck, RefreshCw, GraduationCap, Award, BookOpen, 
    FileText, CheckCircle2, ChevronRight, CreditCard, 
    Sparkles, Home as HomeIcon, MapPin, 
    Briefcase, BedDouble, Check
} from 'lucide-react';
import { getAllProfiles, getActiveProfileDetails, setActiveProfileId } from '../services/friendsService';
import { getStudentProfileFromId } from '../services/timetableService';
import { isAttendanceLoggedIn, getErpBase } from '../services/erpService';

export default function UserProfile() {
    const [allProfiles, setAllProfiles] = useState(() => getAllProfiles());
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);
    const [profileDetails, setProfileDetails] = useState(null);
    const [photoSrc, setPhotoSrc] = useState(null);

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

    // Load cached profile data (CGPA, Attendance, Photo, Profile Info)
    useEffect(() => {
        if (!targetStudentId || typeof window === 'undefined') return;

        // 1. Photo
        const cachedPhoto = localStorage.getItem(`kl_photo_${targetStudentId}`);
        if (cachedPhoto) {
            setPhotoSrc(cachedPhoto);
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
    }, [targetStudentId]);

    // Academic Stats
    const academicStats = useMemo(() => {
        if (!targetStudentId || typeof window === 'undefined') {
            return { cgpa: 'N/A', credits: 0, attendance: 'N/A', totalClasses: 0, coursesCount: 0 };
        }

        // CGPA
        let cgpaVal = 'N/A';
        let creditsVal = 0;
        let coursesCount = 0;
        try {
            const rawCgpa = localStorage.getItem(`cgpa_${targetStudentId}`);
            if (rawCgpa) {
                const parsed = JSON.parse(rawCgpa);
                if (parsed.cgpa) cgpaVal = Number(parsed.cgpa).toFixed(2);
                if (parsed.total_credits) creditsVal = parsed.total_credits;
                if (Array.isArray(parsed.courses)) coursesCount = parsed.courses.length;
            }
        } catch { /* ignore */ }

        // Attendance
        let attRate = 'N/A';
        let totalClasses = 0;
        try {
            const rawAtt = localStorage.getItem(`kleData_${targetStudentId}`);
            if (rawAtt) {
                const parsed = JSON.parse(rawAtt);
                const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
                if (Array.isArray(list) && list.length > 0) {
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
        } catch { /* ignore */ }

        return { cgpa: cgpaVal, credits: creditsVal, attendance: attRate, totalClasses, coursesCount };
    }, [targetStudentId]);

    const isConnected = useMemo(() => {
        return Boolean(targetStudentId && isAttendanceLoggedIn(targetStudentId));
    }, [targetStudentId]);

    // Handle ERP Profile & Photo Sync
    const handleSyncProfile = async () => {
        if (!targetStudentId) return;
        setIsSyncing(true);
        setSyncMessage(null);

        try {
            const cookie = localStorage.getItem(`erp_cookie_${targetStudentId}`) || localStorage.getItem('sessionCookie') || '';
            const baseUrl = getErpBase();
            const res = await fetch(`${baseUrl}/api/fetch-student-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-erp-cookie': cookie
                },
                body: JSON.stringify({ studentId: targetStudentId, username: targetStudentId })
            }).then(r => r.json()).catch(() => null);

            if (res && res.success && res.profile) {
                const p = res.profile;
                if (p.photoBase64) {
                    localStorage.setItem(`kl_photo_${targetStudentId}`, p.photoBase64);
                    setPhotoSrc(p.photoBase64);
                }
                if (p.name) {
                    localStorage.setItem(`kl_name_${targetStudentId}`, p.name);
                }
                localStorage.setItem(`kl_student_profile_${targetStudentId}`, JSON.stringify(p));
                setProfileDetails(p);
                setSyncMessage({ type: 'success', text: 'Student profile & photo synchronized with ERP!' });
            } else {
                setSyncMessage({ type: 'info', text: 'Offline profile loaded. Log in to ERP to fetch genuine photo & personal records.' });
            }
        } catch (err) {
            setSyncMessage({ type: 'error', text: err.message || 'Could not connect to ERP profile server.' });
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(null), 4000);
        }
    };

    const handleSwitchAccount = (p) => {
        const sid = p.studentId || p.username || '';
        setActiveProfileId(p.id, sid);
        setActiveProfile(getActiveProfileDetails(p.id));
    };

    const studentFullName = profileDetails?.name || activeProfile?.nickname || (targetStudentId ? `Student ${targetStudentId}` : 'KLU Student');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-6 sm:py-8 px-3 sm:px-6 transition-colors">
            <div className="max-w-5xl mx-auto space-y-5">

                {/* Account Switcher Bar (when multiple accounts exist) */}
                {allProfiles.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                            Switch Account:
                        </span>
                        {allProfiles.map(p => {
                            const isSelected = activeProfile ? (activeProfile.id === p.id) : (p.id === 'main');
                            const label = p.nickname || p.studentId || 'Account';
                            return (
                                <button
                                    key={p.id || p.studentId}
                                    type="button"
                                    onClick={() => handleSwitchAccount(p)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
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
                                <span>{isConnected ? 'ERP Live Verified' : 'Saved Offline Profile'}</span>
                            </span>
                        </div>
                    </div>

                    {/* Profile Information Row */}
                    <div className="p-4 sm:p-6 sm:pb-5 pt-0 relative">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
                            {/* Avatar with Glow Ring */}
                            <div className="flex items-end gap-3.5 sm:gap-4.5">
                                <div className="relative group shrink-0">
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 p-1 border-2 border-indigo-500/40 shadow-xl overflow-hidden flex items-center justify-center">
                                        {photoSrc ? (
                                            <img
                                                src={photoSrc}
                                                alt={studentFullName}
                                                className="w-full h-full object-cover rounded-xl sm:rounded-2xl"
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-black">
                                                {studentFullName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
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
                                </div>
                            </div>

                            {/* Sync Button */}
                            <div className="flex items-center gap-2">
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
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Section & Room</span>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate block">
                                    {decodedInfo.section} • {decodedInfo.homeRoom}
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

                {/* Academic Highlights Cards (4 KPIs) */}
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
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Verified</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">Across all completed semesters</span>
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
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Earned</span>
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
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Safe (85%+)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">
                            {academicStats.totalClasses > 0 ? `${academicStats.totalClasses} classes attended` : 'Direct ERP registered tally'}
                        </span>
                    </Link>

                    <Link to="/timetable" className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Courses Recorded</span>
                            <GraduationCap className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                                {academicStats.coursesCount || '6'}
                            </span>
                            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Enrolled</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-1">Active semester curriculum</span>
                    </Link>
                </div>

                {/* ERP Academic Services Hub (Categorizing the 5 Uploaded Screens) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                ERP Academic Services Hub
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Direct status and 1-click access to all 5 major KL ERP academic portals
                            </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                            ERP v2026 Live
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

                        {/* 1. Courses Section */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-600 flex items-center justify-center font-bold text-xs">
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Courses &amp; Academics</h3>
                                        <p className="text-[10.5px] text-slate-400">Assignments, Handouts, Course Materials &amp; Internals</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                                    Active
                                </span>
                            </div>

                            <div className="space-y-2">
                                <Link to="/grades" className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Course Internals &amp; Marks</span>
                                            <span className="text-[10.5px] text-slate-400">Consolidated Lecture, Practical, Seminar &amp; Quiz scores</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </Link>

                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Handouts &amp; Materials</span>
                                            <span className="text-[10.5px] text-slate-400">Faculty lesson plans, syllabus PDF &amp; lecture notes</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">Available in ERP</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-purple-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Assignments &amp; Feedback</span>
                                            <span className="text-[10.5px] text-slate-400">Course submissions, due dates &amp; session feedback</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">Tracked</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Exam Section */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center font-bold text-xs">
                                        <Award className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Exam Section</h3>
                                        <p className="text-[10.5px] text-slate-400">End Exam Results, Seating Hall &amp; Script Reviews</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                    Verified
                                </span>
                            </div>

                            <div className="space-y-2">
                                <Link to="/grades" className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4 text-amber-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">End Exam Result &amp; CGPA</span>
                                            <span className="text-[10.5px] text-slate-400">Semester Grade Cards, SGPA, letter grades O, A+, A</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </Link>

                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Exam Seating Allocation</span>
                                            <span className="text-[10.5px] text-slate-400">Mid-term and semester final room, row &amp; bench number</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Room {decodedInfo.homeRoom}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">In-Sem Answer Scripts</span>
                                            <span className="text-[10.5px] text-slate-400">Evaluated test script inspection &amp; marks verification</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">Exam Portal</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Fee Payments Section */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Fee Payments &amp; Structure</h3>
                                        <p className="text-[10.5px] text-slate-400">Tuition, Hostel, Exam &amp; Certification Receipts</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                                    Clear
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">My SEM Fee Structure</span>
                                            <span className="text-[10.5px] text-slate-400">Tuition fees, academic fees &amp; ERP dues breakdown</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">Verified Paid</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Payment History &amp; Receipts</span>
                                            <span className="text-[10.5px] text-slate-400">Official university e-receipts and transaction logs</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">Official ERP</span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Campus, Hostel & Hallticket */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 flex items-center justify-center font-bold text-xs">
                                        <BedDouble className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Campus &amp; Hallticket</h3>
                                        <p className="text-[10.5px] text-slate-400">Official Exam Hallticket, Hostel &amp; Mess details</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-extrabold uppercase bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                    Enabled
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Official Exam Hallticket</span>
                                            <span className="text-[10.5px] text-slate-400">Subject codes, exam dates, timing slot &amp; barcode</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Exam Ready</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <HomeIcon className="w-4 h-4 text-purple-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Hostel Management &amp; Mess</span>
                                            <span className="text-[10.5px] text-slate-400">Hostel room allocation, bed number &amp; biometric mess</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">KLU Campus</span>
                                </div>
                            </div>
                        </div>

                    </div>
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
