import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, ArrowRight, CalendarDays, Clock, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import ErpSidebar from '../components/ErpSidebar';
import { getActiveProfileDetails, getMyProfile, getAllProfiles, setActiveProfileId } from '../services/friendsService';
import { normalizeAcademicYear, normalizeSemester } from '../services/timetableService';

export default function Timetable() {
    const navigate = useNavigate();
    const myProfile = useMemo(() => getMyProfile(), []);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [activeId, setActiveId] = useState(() => {
        const prof = getActiveProfileDetails();
        const sid = (prof?.isFriend && prof?.studentId) ? prof.studentId : (localStorage.getItem('activeErpUser') || '');
        return sid;
    });

    // Synchronize active profile across events and storage + Auto-logout when profile is deleted
    useEffect(() => {
        const update = () => {
            const all = getAllProfiles();
            const activeUser = localStorage.getItem('activeErpUser');
            if (all.length === 0 || !activeUser) {
                try {
                    sessionStorage.setItem('kl_user_logged_out', 'true');
                    sessionStorage.removeItem('erp_authenticated');
                    localStorage.removeItem('activeErpUser');
                    localStorage.removeItem('erpDashboardHtml');
                } catch { /* ignore */ }
                navigate('/login', { replace: true, state: { loggedOut: true } });
                return;
            }
            const prof = getActiveProfileDetails();
            setActiveProfile(prof);
            const sid = (prof?.isFriend && prof?.studentId) ? prof.studentId : (localStorage.getItem('activeErpUser') || '');
            setActiveId(sid);
        };
        window.addEventListener('kl_friends_updated', update);
        window.addEventListener('kl_active_profile_updated', update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener('kl_friends_updated', update);
            window.removeEventListener('kl_active_profile_updated', update);
            window.removeEventListener('storage', update);
        };
    }, [navigate]);

    const selectedYear = useMemo(() => {
        const raw = activeId ? (localStorage.getItem(`manualYear_${activeId}`) || localStorage.getItem(`activeYear_${activeId}`)) : null;
        const clean = raw || '2026-2027';
        return normalizeAcademicYear(clean);
    }, [activeId]);

    const selectedSem = useMemo(() => {
        const raw = (activeId && (localStorage.getItem(`manualSem_${activeId}`) || localStorage.getItem(`activeSem_${activeId}`))) || 'Odd';
        const s = normalizeSemester(raw);
        if (s === 'Summer') return 'Summer Term';
        if (s === 'Term3') return 'Tri Sem / Term 3';
        if (s === 'Even') return 'Even Sem';
        return 'Odd Sem';
    }, [activeId]);

    return (
        <div className="h-full flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">
            <Helmet>
                <title>Class Timetable | KL Attendance Calculator</title>
                <meta name="description" content="Official KL University live class timetable and schedule." />
                <link rel="icon" type="image/png" href="/timetable-icon-192.png" />
                <link rel="apple-touch-icon" href="/timetable-icon-192.png" />
            </Helmet>

            {/* Top Header */}
            <header className="bg-[#0088cc] text-white px-4 sm:px-6 py-2.5 shadow-md z-40 sticky top-0 shrink-0 w-full select-none border-b border-black/10">
                <div className="w-full relative flex items-center justify-between min-h-[46px]">
                    {/* Left: Mobile Drawer Toggle */}
                    <div className="flex items-center gap-2 z-10">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(prev => !prev)}
                            className="lg:hidden flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all border border-white/20 shadow-2xs cursor-pointer"
                            title="Menu"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline text-[11px] font-bold">Menu</span>
                        </button>
                    </div>

                    {/* Center: Logo + KL Attendance Calculator */}
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
                            {activeId ? `Class Timetable • ${activeProfile?.nickname || 'Account'} (${activeId})` : 'Class Timetable'}
                        </span>
                    </div>

                    {/* Right: Back to Home */}
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

            {/* Page Body: Left Sidebar + Coming Soon View */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                <ErpSidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(false)}
                    activePage="timetable"
                    onSelectProfile={(profile) => {
                        const newId = profile.studentId || profile.username || (profile.id !== 'main' ? profile.id : '');
                        if (newId) {
                            setActiveProfileId(profile.id || newId);
                            setActiveId(newId);
                            setActiveProfile(profile);
                        }
                    }}
                />

                <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 font-sans">
                    <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-amber-50/20 pointer-events-none" />

                    <div className="max-w-4xl mx-auto my-6 sm:my-10">
                        {/* Coming Soon Showcase Card */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-3xl p-6 sm:p-10 border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-none text-center space-y-6">
                            
                            {/* Animated Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/80 text-amber-800 dark:text-amber-300 text-xs font-black uppercase tracking-wider shadow-2xs">
                                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                                <span>Coming Soon</span>
                            </div>

                            {/* Big Icon */}
                            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 ring-8 ring-amber-50 dark:ring-amber-950/40">
                                <CalendarDays className="w-10 h-10 sm:w-12 sm:h-12" />
                            </div>

                            {/* Title & Description */}
                            <div className="max-w-xl mx-auto space-y-3">
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    Class Timetable is Coming Soon!
                                </h2>
                                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                                    We are currently integrating automated, live timetable synchronization directly from KL University ERP. You will soon be able to view your section schedules, room numbers, and real-time class tracking without manual entry.
                                </p>
                                {activeId && (
                                    <div className="inline-block mt-2 px-3.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                                        Active Profile: <span className="font-bold text-slate-900 dark:text-white">{activeProfile?.nickname || 'Account'}</span> ({activeId}) · {selectedYear} ({selectedSem})
                                    </div>
                                )}
                            </div>

                            {/* Feature Preview Badges */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto pt-2 text-left">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                        <Zap className="w-4 h-4" />
                                        <span>Direct ERP Sync</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                        Scrapes your official timetable and registered batch automatically.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Accurate Rooms</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                        Shows genuine classroom allocations and lab locations.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                                        <Clock className="w-4 h-4" />
                                        <span>Live Tracking</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                        Highlights ongoing and upcoming classes in real time.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                                <Link
                                    to="/attendance-register"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
                                >
                                    <span>Check Live Attendance</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                                <Link
                                    to="/"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                                >
                                    <span>Back to Home</span>
                                </Link>
                            </div>

                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
