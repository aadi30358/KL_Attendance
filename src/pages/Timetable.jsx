import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft } from 'lucide-react';
import ClassTimetable from '../components/ClassTimetable';
import ErpSidebar from '../components/ErpSidebar';
import { getActiveProfileDetails, getMyProfile, getEffectiveSavedProfile, getAllProfiles, setActiveProfileId } from '../services/friendsService';
import { normalizeAcademicYear, normalizeSemester } from '../services/timetableService';
import { hasActiveErpSession } from '../services/erpService';

export default function Timetable() {
    const navigate = useNavigate();
    const myProfile = useMemo(() => getMyProfile(), []);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeProfile, setActiveProfile] = useState(() => getActiveProfileDetails());
    const [activeId, setActiveId] = useState(() => {
        if (!hasActiveErpSession()) return '';
        const prof = getActiveProfileDetails();
        if (prof?.isFriend && prof?.studentId) {
            return prof.studentId;
        }
        return localStorage.getItem('activeErpUser') || '';
    });

    // Synchronize active profile across events and storage
    useEffect(() => {
        const update = () => {
            const hasSession = hasActiveErpSession();
            const prof = getActiveProfileDetails();
            setActiveProfile(prof);
            if (!hasSession) {
                setActiveId('');
                return;
            }
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
    }, []);

    const selectedYear = useMemo(() => {
        const raw = (activeId && (localStorage.getItem(`manualYear_${activeId}`) || localStorage.getItem(`activeYear_${activeId}`))) || '2026-2027';
        return normalizeAcademicYear(raw);
    }, [activeId]);

    const selectedSem = useMemo(() => {
        const raw = (activeId && (localStorage.getItem(`manualSem_${activeId}`) || localStorage.getItem(`activeSem_${activeId}`))) || 'Odd';
        const s = normalizeSemester(raw);
        if (s === 'Summer') return 'Summer Term';
        if (s === 'Term3') return 'Tri Sem / Term 3';
        if (s === 'Even') return 'Even Sem';
        return 'Odd Sem';
    }, [activeId]);

    const erpCourses = useMemo(() => {
        try {
            const cached = localStorage.getItem(`kleData_${activeId}`) || (activeId === myProfile?.studentId ? localStorage.getItem('kleData') : null);
            if (cached) {
                const parsed = JSON.parse(cached);
                const list = parsed.attendance_data || parsed.data || (Array.isArray(parsed) ? parsed : []);
                if (Array.isArray(list)) return list;
            }
        } catch {
            /* ignore parse error */
        }
        return [];
    }, [activeId, myProfile?.studentId]);

    return (
        <div className="min-h-screen bg-[#F4F6F9] flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
            <Helmet>
                <title>Class Timetable | KLERP</title>
                <meta name="description" content="Official KL University live class timetable and schedule." />
            </Helmet>

            {/* KLERP Top Header */}
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

                    {/* Center: Logo + KLERP */}
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

            {/* Page Body: Left Sidebar + Timetable View */}
            <div className="flex-1 flex overflow-hidden relative">
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

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 font-sans">
                    <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 pointer-events-none" />

                    <div className="max-w-7xl mx-auto">
                        {!activeId ? (
                            <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700 text-center space-y-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-2xs">
                                    <Users className="w-7 h-7" />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">ERP Attendance Login Required</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        First login with ERP Attendance, then only the timetable will be shown.
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <Link
                                        to="/login"
                                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                                    >
                                        <span>Login with ERP Attendance</span>
                                        <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <ClassTimetable
                                studentId={activeId}
                                studentName={activeProfile?.nickname || 'Account'}
                                erpCourses={erpCourses}
                                selectedYear={selectedYear}
                                selectedSem={selectedSem}
                                onChangeSelection={() => navigate('/attendance-register')}
                                onViewCourseAttendance={() => navigate('/attendance-register')}
                                onSelectFriend={(fid) => {
                                    if (fid) {
                                        setActiveProfileId(fid);
                                        setActiveId(fid);
                                        const allP = getAllProfiles();
                                        const match = allP.find(p => p.studentId === fid || p.username === fid);
                                        if (match) setActiveProfile(match);
                                    }
                                }}
                                onSelectProfile={(profile) => {
                                    const newId = profile.studentId || profile.username || (profile.id !== 'main' ? profile.id : '');
                                    if (newId) {
                                        setActiveProfileId(profile.id || newId);
                                        setActiveId(newId);
                                        setActiveProfile(profile);
                                    }
                                }}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
