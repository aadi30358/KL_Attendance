import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
    Award,
    BookOpen,
    Filter,
    Layers,
    Sparkles,
    FileText,
    X,
    Users,
    RotateCcw,
    CheckCircle2,
    Info,
    Calculator,
    ShieldCheck,
    RefreshCw,
    AlertCircle,
    Check,
    Trash2
} from 'lucide-react';
import {
    calculateGPA,
    buildSemesterOptions,
    filterCoursesBySemester,
    getGradeBadgeStyle,
    getStoredGrades,
    saveStoredGrades,
    updateCourseGrade,
    resetGradesToDefault,
    KLU_GRADE_POINTS,
    getEnrolledCoursesTemplate,
    deleteCourseFromScorecard,
    fetchLiveErpGrades,
    fetchLiveMarksDetail
} from '../services/gradesService';
import { getSavedFriends, getMyProfile } from '../services/friendsService';
import FriendCaptchaModal from '../components/FriendCaptchaModal';

export default function Grades() {
    const myProfile = useMemo(() => getMyProfile(), []);
    const myId = myProfile?.studentId || myProfile?.username || (typeof window !== 'undefined' ? localStorage.getItem('activeErpUser') : null) || '2400030358';
    const myName = myProfile?.nickname || myProfile?.name || 'My Profile';

    // Combine saved friends with TimeTablekl 'maddys'
    const allFriends = useMemo(() => {
        const list = getSavedFriends();
        try {
            const rawMaddys = localStorage.getItem('maddys');
            if (rawMaddys) {
                const parsedMaddys = JSON.parse(rawMaddys);
                if (Array.isArray(parsedMaddys)) {
                    parsedMaddys.forEach(m => {
                        const sid = m.username || m.studentId || String(m.id);
                        if (!list.some(f => (f.studentId === sid || f.username === sid))) {
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
    }, []);

    // Active Profile: Self or Buddy
    const [selectedStudentId, setSelectedStudentId] = useState(myId);

    const activeProfileName = useMemo(() => {
        if (selectedStudentId === myId || selectedStudentId === 'main') {
            return myName;
        }
        const fr = allFriends.find(f => (f.studentId === selectedStudentId || f.username === selectedStudentId || f.id === selectedStudentId));
        return fr ? (fr.nickname || fr.name || fr.label) : selectedStudentId;
    }, [selectedStudentId, myId, myName, allFriends]);

    const [courses, setCourses] = useState(() => getStoredGrades(selectedStudentId));
    const [viewMode, setViewMode] = useState('cgpa'); // 'cgpa' | 'sgpa'
    const [selectedSemesterKey, setSelectedSemesterKey] = useState('');
    const [selectedCourseForDetail, setSelectedCourseForDetail] = useState(null);
    const [friendCaptchaTarget, setFriendCaptchaTarget] = useState(null);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);
    const [scorecardDetail, setScorecardDetail] = useState({ loading: false, data: null, error: null });

    // Sync courses whenever student profile changes
    useEffect(() => {
        const stored = getStoredGrades(selectedStudentId);
        setCourses(stored);
    }, [selectedStudentId]);

    // Live update when fresh live ERP grades finish in background
    useEffect(() => {
        const handleGradesUpdate = (e) => {
            const detail = e?.detail;
            if (!detail || detail.studentId === selectedStudentId) {
                setCourses(getStoredGrades(selectedStudentId));
            }
        };
        window.addEventListener('kl_grades_updated', handleGradesUpdate);
        return () => window.removeEventListener('kl_grades_updated', handleGradesUpdate);
    }, [selectedStudentId]);

    const handleSyncLiveErpGrades = useCallback(async () => {
        setIsSyncing(true);
        setSyncMessage(null);
        try {
            const res = await fetchLiveErpGrades(selectedStudentId);
            if (res.success && Array.isArray(res.courses) && res.courses.length > 0) {
                setCourses(res.courses);
                setSyncMessage({ type: 'success', text: `Successfully synced ${res.courses.length} courses from live ERP results!` });
            } else if (res.needsAuth) {
                const fr = allFriends.find(f => (f.studentId === selectedStudentId || f.username === selectedStudentId || f.id === selectedStudentId));
                if (fr) {
                    setFriendCaptchaTarget(fr);
                } else {
                    setSyncMessage({ type: 'error', text: res.message || 'Please connect ERP to fetch live results.' });
                }
            } else {
                setSyncMessage({ type: 'error', text: res.message || 'Could not fetch live grades from ERP. Results may be unpublished or session expired.' });
            }
        } catch (err) {
            setSyncMessage({ type: 'error', text: err.message || 'Error communicating with ERP grades service.' });
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(null), 5000);
        }
    }, [selectedStudentId, allFriends]);

    // Auto-fetch if no grades stored and active session exists
    useEffect(() => {
        const isSelf = selectedStudentId === myId || selectedStudentId === 'main';
        const hasSession = typeof window !== 'undefined' && (localStorage.getItem('erp_session_cookie') || sessionStorage.getItem('erp_session_cookie') || localStorage.getItem('activeErpUser'));
        const friendCookie = !isSelf && typeof window !== 'undefined' ? localStorage.getItem(`erp_cookie_${selectedStudentId}`) : null;
        
        if (courses.length === 0 && (isSelf ? hasSession : Boolean(friendCookie))) {
            handleSyncLiveErpGrades();
        }
    }, [selectedStudentId, courses.length, handleSyncLiveErpGrades, myId]);

    // Fetch marks detail when scorecard modal is opened
    useEffect(() => {
        if (selectedCourseForDetail?.target_href) {
            setScorecardDetail({ loading: true, data: null, error: null });
            fetchLiveMarksDetail(selectedCourseForDetail.target_href, selectedStudentId)
                .then(res => {
                    if (res.success && res.scorecard) {
                        setScorecardDetail({ loading: false, data: res.scorecard, error: null });
                    } else {
                        setScorecardDetail({ loading: false, data: null, error: res.message || 'Consolidated component marks not available.' });
                    }
                })
                .catch(err => {
                    setScorecardDetail({ loading: false, data: null, error: err.message });
                });
        } else {
            setScorecardDetail({ loading: false, data: null, error: null });
        }
    }, [selectedCourseForDetail, selectedStudentId]);

    const semesterOptions = useMemo(() => buildSemesterOptions(courses), [courses]);

    useEffect(() => {
        if (semesterOptions.length > 0 && !selectedSemesterKey) {
            setSelectedSemesterKey(semesterOptions[0].key);
        }
    }, [semesterOptions, selectedSemesterKey]);

    const displayedCourses = useMemo(() => {
        if (viewMode === 'sgpa' && selectedSemesterKey) {
            return filterCoursesBySemester(courses, selectedSemesterKey);
        }
        return courses;
    }, [courses, viewMode, selectedSemesterKey]);

    // Calculate real GPA
    const cgpaValue = useMemo(() => calculateGPA(courses) || '0.00', [courses]);
    const sgpaValue = useMemo(() => calculateGPA(displayedCourses) || cgpaValue, [displayedCourses, cgpaValue]);

    const activeGpa = viewMode === 'cgpa' ? cgpaValue : sgpaValue;
    const cgpaPercent = useMemo(() => {
        const num = parseFloat(activeGpa);
        if (isNaN(num) || num <= 0) return '0.0';
        // Official KLU Formula: (GPA - 0.75) * 10
        return Math.max(0, (num - 0.75) * 10).toFixed(1);
    }, [activeGpa]);

    const totalCreditsEarned = useMemo(() => {
        return displayedCourses.reduce((sum, c) => {
            const cr = parseFloat(c.credits);
            return sum + (Number.isFinite(cr) ? cr : 0);
        }, 0);
    }, [displayedCourses]);

    // Handle grade dropdown change (What-If Grade Simulation)
    const handleGradeChange = (courseCode, nextGrade) => {
        const updated = updateCourseGrade(selectedStudentId, courseCode, nextGrade);
        setCourses([...updated]);
    };

    // Reset grades
    const handleResetBaseline = () => {
        const reset = resetGradesToDefault(selectedStudentId);
        setCourses([...reset]);
    };

    // Import from ERP Enrolled Courses
    const handleImportFromErp = () => {
        const templates = getEnrolledCoursesTemplate(selectedStudentId);
        if (templates.length > 0) {
            saveStoredGrades(selectedStudentId, templates);
            setCourses(templates);
        } else {
            alert('No enrolled ERP courses found in the current session. Please log in or add courses manually.');
        }
    };

    // Delete Course
    const handleDeleteCourse = (code) => {
        const updated = deleteCourseFromScorecard(selectedStudentId, code);
        setCourses([...updated]);
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-20 pb-16 px-4 sm:px-6 lg:px-8 font-sans">
            <Helmet>
                <title>Grades & CGPA | KLU Academic Performance</title>
                <meta name="description" content="Calculate and simulate official KLU semester grades, SGPA and CGPA performance breakdown with real credit points." />
            </Helmet>

            <div className="max-w-6xl mx-auto space-y-6">
                {/* ── Page Header & Profile Switcher ── */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Academic Performance Scorecard</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Grades & CGPA Calculator
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500">
                            KL University Official Credit Grading System · Scale of 10.0
                        </p>

                        {/* Buddy / Profile Switcher Pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setSelectedStudentId(myId)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                    selectedStudentId === myId
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>{myName} ({myId})</span>
                            </button>

                            {allFriends.map((friend) => {
                                const fId = friend.studentId || friend.username || friend.id;
                                const fName = friend.nickname || friend.name || friend.label || 'Buddy';
                                const isSelected = selectedStudentId === fId;

                                return (
                                    <button
                                        key={friend.id || fId}
                                        type="button"
                                        onClick={() => setSelectedStudentId(fId)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                            isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                        }`}
                                    >
                                        <Users className="w-3 h-3 text-indigo-500" />
                                        <span>{fName} ({fId})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mode Toggle & Reset Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {courses.length > 0 && (
                            <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('cgpa')}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        viewMode === 'cgpa'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Award className="w-4 h-4" />
                                    <span>Overall CGPA</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('sgpa')}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        viewMode === 'sgpa'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Layers className="w-4 h-4" />
                                    <span>Semester SGPA</span>
                                </button>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSyncLiveErpGrades}
                                disabled={isSyncing}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-70"
                                title="Sync official semester results and CGPA from ERP"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? 'Syncing...' : 'Sync Live ERP'}</span>
                            </button>

                            {courses.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleResetBaseline}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                    title="Clear all courses from calculator"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {syncMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 border shadow-2xs ${
                            syncMessage.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                    >
                        {syncMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span>{syncMessage.text}</span>
                    </motion.div>
                )}

                {/* ── Summary KPI Cards Grid (When courses exist) ── */}
                {courses.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Primary GPA Card */}
                        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-md shadow-indigo-100 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-indigo-100 text-xs font-bold uppercase tracking-wider">
                                <span>{viewMode === 'cgpa' ? 'Cumulative GPA (CGPA)' : 'Semester GPA (SGPA)'}</span>
                                <Award className="w-5 h-5 text-amber-300" />
                            </div>
                            <div className="my-3">
                                <span className="text-4xl sm:text-5xl font-black tracking-tight">{activeGpa}</span>
                                <span className="text-indigo-200 text-sm ml-1.5 font-bold">/ 10.0</span>
                            </div>
                            <p className="text-xs text-indigo-100 font-medium">
                                {parseFloat(activeGpa) >= 9.0 ? '🌟 Outstanding Distinction' : parseFloat(activeGpa) >= 8.0 ? '✨ First Class with Distinction' : parseFloat(activeGpa) >= 6.5 ? '✅ First Class' : 'Second Class'}
                            </p>
                        </div>

                        {/* Percentage Equivalent Card */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <span>Equivalent Percentage</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    (GPA - 0.75) × 10
                                </span>
                            </div>
                            <div className="my-3">
                                <span className="text-3xl sm:text-4xl font-black text-slate-900">{cgpaPercent}%</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Official KLU Conversion Formula
                            </p>
                        </div>

                        {/* Total Credits */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <span>Total Credits</span>
                                <Layers className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="my-3">
                                <span className="text-3xl sm:text-4xl font-black text-slate-900">{totalCreditsEarned.toFixed(1)}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {displayedCourses.length} Registered Courses
                            </p>
                        </div>

                        {/* Promotion Status */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <span>Academic Standing</span>
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="my-3">
                                <span className="text-3xl sm:text-4xl font-black text-emerald-600">
                                    {displayedCourses.some(c => c.grade === 'F') ? 'REAPPEAR' : 'PASSED'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {displayedCourses.filter(c => c.grade === 'F').length} Pending Re-evaluations
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Empty State / ERP Access Notice ── */}
                {courses.length === 0 ? (
                    <div className="space-y-6">
                        {/* Notice Banner */}
                        <div className="p-6 rounded-3xl bg-blue-50 border border-blue-200 text-blue-900 flex flex-col sm:flex-row items-start gap-4">
                            <Info className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-2 flex-1">
                                <h3 className="text-base font-bold text-blue-950">
                                    Official KLU Grade Sheet Access Notice
                                </h3>
                                <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                                    {selectedStudentId !== myId
                                        ? `Grade records for ${activeProfileName} (${selectedStudentId}) have not been loaded yet. Connect with ERP to fetch live semester grades.`
                                        : 'KL University ERP grades sync automatically when published. You can manually refresh live grades or import enrolled courses below.'}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                    {selectedStudentId !== myId ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const fr = allFriends.find(f => (f.studentId === selectedStudentId || f.username === selectedStudentId || f.id === selectedStudentId));
                                                if (fr) setFriendCaptchaTarget(fr);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                                            <span>Connect ERP for {activeProfileName}</span>
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleSyncLiveErpGrades}
                                                disabled={isSyncing}
                                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-70"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                                <span>{isSyncing ? 'Connecting ERP...' : 'Fetch Live ERP Results'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleImportFromErp}
                                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                            >
                                                <BookOpen className="w-3.5 h-3.5" />
                                                <span>Import Enrolled Courses</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Official KLU Grading System Reference */}
                        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-4">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-indigo-600" />
                                <span>Official KLU Grading Scale & Formulas</span>
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { grade: 'O', gp: 10, label: 'Outstanding (90-100%)', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                                    { grade: 'A+', gp: 9, label: 'Excellent (80-89%)', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                                    { grade: 'A', gp: 8, label: 'Very Good (70-79%)', bg: 'bg-teal-50 text-teal-800 border-teal-200' },
                                    { grade: 'B+', gp: 7, label: 'Good (60-69%)', bg: 'bg-blue-50 text-blue-800 border-blue-200' },
                                    { grade: 'B', gp: 6, label: 'Above Average (55-59%)', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                                    { grade: 'C', gp: 5, label: 'Average (50-54%)', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                                    { grade: 'P', gp: 4, label: 'Pass (40-49%)', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
                                    { grade: 'F', gp: 0, label: 'Fail (<40%)', bg: 'bg-rose-50 text-rose-800 border-rose-200' },
                                ].map((item) => (
                                    <div key={item.grade} className={`p-3 rounded-2xl border ${item.bg} text-center space-y-1`}>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-lg font-black">{item.grade}</span>
                                            <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-white/70">
                                                {item.gp} pts
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-medium opacity-90">{item.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
                                <div className="font-bold text-slate-800">Calculation Formulas:</div>
                                <div>• <strong>SGPA / CGPA:</strong> Σ(Course Credits × Grade Points) ÷ Σ(Course Credits)</div>
                                <div>• <strong>Equivalent Percentage:</strong> (CGPA − 0.75) × 10</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ── SGPA Semester Filter Selector ── */}
                        {viewMode === 'sgpa' && semesterOptions.length > 1 && (
                            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-wrap items-center gap-3">
                                <Filter className="w-4 h-4 text-slate-500" />
                                <span className="text-xs font-bold text-slate-700">Select Term for SGPA:</span>
                                <select
                                    value={selectedSemesterKey}
                                    onChange={(e) => setSelectedSemesterKey(e.target.value)}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    {semesterOptions.map((opt) => (
                                        <option key={opt.key} value={opt.key}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* ── Courses & Grades Grid with Live Simulator ── */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-bold text-slate-900">
                                        {viewMode === 'cgpa'
                                            ? `All Course Grades (${activeProfileName})`
                                            : `Courses for ${semesterOptions.find(o => o.key === selectedSemesterKey)?.label || 'Semester'}`}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-slate-400">
                                        Tip: Change grade to test what-if SGPA
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                        {displayedCourses.length} Courses
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {displayedCourses.map((course, idx) => {
                                    const badge = getGradeBadgeStyle(course.grade, course);
                                    return (
                                        <motion.div
                                            key={`${course.course_code}_${course.academic_year}_${idx}`}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.2, delay: idx * 0.02 }}
                                            className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-200/80 text-slate-800">
                                                            {course.course_code}
                                                        </span>
                                                        <span className="text-[11px] font-semibold text-slate-500">
                                                            {course.academic_year} · {course.semester} Sem
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                                        {course.course_desc || course.course_code}
                                                    </h3>
                                                </div>

                                                {/* Interactive Grade Dropdown Badge */}
                                                <div className="flex flex-col items-end shrink-0">
                                                    <div className="relative">
                                                        <select
                                                            value={course.grade}
                                                            onChange={(e) => handleGradeChange(course.course_code, e.target.value)}
                                                            className={`px-3 py-1.5 rounded-xl border font-black text-sm outline-none cursor-pointer text-center appearance-none pr-6 ${badge.bg}`}
                                                            title="Change grade to simulate what-if CGPA"
                                                        >
                                                            {Object.keys(KLU_GRADE_POINTS).map((g) => (
                                                                <option key={g} value={g} className="bg-white text-slate-900 font-bold">
                                                                    {g} ({KLU_GRADE_POINTS[g]})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <span className="absolute right-2 top-2 pointer-events-none text-xs opacity-70">▼</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 mt-0.5">{badge.text}</span>
                                                </div>
                                            </div>

                                            {/* Bottom Info Bar */}
                                            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                                                <div className="flex items-center gap-3">
                                                    <span>Credits: <strong className="text-slate-800">{course.credits}</strong></span>
                                                    <span>Grade Point: <strong className="text-slate-800">{course.grade_point}</strong></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCourseForDetail(course)}
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        <span>Scorecard</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCourse(course.course_code)}
                                                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                                                        title="Remove subject"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>


            {/* ── Scorecard Detail Modal ── */}
            <AnimatePresence>
                {selectedCourseForDetail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 relative"
                        >
                            <button
                                type="button"
                                onClick={() => setSelectedCourseForDetail(null)}
                                className="absolute top-5 right-5 p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                        {selectedCourseForDetail.course_code}
                                    </span>
                                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                                        {selectedCourseForDetail.course_desc}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedCourseForDetail.academic_year} · {selectedCourseForDetail.semester} Term
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs font-medium text-slate-700">
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span>Course Credits</span>
                                        <span className="font-bold text-slate-900">{selectedCourseForDetail.credits}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span>Awarded Grade</span>
                                        <span className="font-bold text-emerald-600 text-sm">{selectedCourseForDetail.grade}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span>Grade Point Value</span>
                                        <span className="font-bold text-slate-900">{selectedCourseForDetail.grade_point} / 10</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 pt-1.5 border-b border-slate-200/60">
                                        <span className="font-bold text-slate-900">Total Quality Points (Credits × GP)</span>
                                        <span className="font-black text-indigo-600 text-sm">
                                            {(parseFloat(selectedCourseForDetail.credits) * parseFloat(selectedCourseForDetail.grade_point)).toFixed(1)}
                                        </span>
                                    </div>

                                    {/* Detailed Components (Internal/External Marks) if available */}
                                    {selectedCourseForDetail.target_href && (
                                        <div className="pt-2 space-y-2">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                Consolidated Evaluation Components
                                            </div>
                                            {scorecardDetail.loading ? (
                                                <div className="flex items-center gap-2 py-3 justify-center text-slate-500">
                                                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                                                    <span>Fetching component marks from ERP...</span>
                                                </div>
                                            ) : scorecardDetail.data && Object.keys(scorecardDetail.data).length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 pt-1">
                                                    {Object.entries(scorecardDetail.data).map(([key, val]) => {
                                                        if (key === 'course_name' || key === 'course_desc') return null;
                                                        const cleanKey = key.replace(/_/g, ' ').toUpperCase();
                                                        return (
                                                            <div key={key} className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                                                                <div className="text-[10px] text-slate-500 font-bold truncate">{cleanKey}</div>
                                                                <div className="text-sm font-black text-slate-900 mt-0.5">
                                                                    {typeof val === 'object' && val !== null ? (Array.isArray(val) ? val.join(', ') : JSON.stringify(val)) : String(val ?? '')}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                                                    Component scores pending moderation or not published.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedCourseForDetail(null)}
                                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Friend Captcha Modal for Authentic Profile Switching ── */}
            <FriendCaptchaModal
                friend={friendCaptchaTarget}
                isOpen={Boolean(friendCaptchaTarget)}
                onClose={() => setFriendCaptchaTarget(null)}
                onSuccess={() => {
                    setFriendCaptchaTarget(null);
                    handleSyncLiveErpGrades();
                }}
            />
        </div>
    );
}
